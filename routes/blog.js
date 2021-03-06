const express = require("express")
const db = require("./../db")
const router = express.Router()
const path = require("path");
const multer = require("multer");
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/images/");
    },
    filename: function (req, file, callback) {
        callback(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage })
const BLOG_PER_PAGE = 3
const TITLE_MIN_LENGTH = 5
const TITLE_MAX_LENGTH = 50
const CAPTION_MIN_LENGTH = 20
const CAPTION_MAX_LENGTH = 75
const CONTENT_MIN_LENGTH = 20
const CONTENT_MAX_LENGTH = 500

router.get("/", function (req, res) {
    const search = req.query.search
    const fromDate = req.query.fromDate
    const toDate = req.query.toDate
    const validationErrors = []
    const fromDateObject = new Date(fromDate)
    const toDateObject = new Date(toDate)
    const page = req.query.page || 1
    const beginIndex = (BLOG_PER_PAGE * page) - BLOG_PER_PAGE
    const endIndex = beginIndex + BLOG_PER_PAGE
    if (fromDate || toDate)
        if (fromDateObject == "Invalid Date")
            validationErrors.push("Please input fromDate")
        else if (toDateObject == "Invalid Date")
            validationErrors.push("Please input toDate")
        else if (fromDateObject > toDateObject)
            validationErrors.push("toDate must be greater than the fromDate")
    db.getAllBlogs(function (error, blogs) {
        if (error)
            res.render("errors/500")
        else {
            if (validationErrors.length == 0) {
                if (search)
                    blogs = blogs.filter(function (element) {
                        return element.title.includes(search)
                            || element.caption.includes(search)
                            || element.content.includes(search)
                    })
                if (fromDateObject != "Invalid Date")
                    blogs = blogs.filter(function (element) {
                        const blogDate = new Date(element.createdAt)
                        blogDate.setUTCHours(0, 0, 0, 0) // initialize a blog date to midnight 
                        return blogDate > fromDateObject
                            || +blogDate === +fromDateObject
                    })
                if (toDateObject != "Invalid Date")
                    blogs = blogs.filter(function (element) {
                        const blogDate = new Date(element.createdAt)
                        blogDate.setUTCHours(0, 0, 0, 0) // initialize a blog date to midnight 
                        return blogDate < toDateObject
                            || +blogDate === +toDateObject
                    })
            }
            res.render("blogs/blogs", {
                blogs: blogs.slice(beginIndex, endIndex),
                pagination: {
                    page: page,
                    pageCount: Math.ceil(blogs.length / BLOG_PER_PAGE),
                },
                validationErrors,
                search,
                toDate,
                fromDate
            })
        }
    })
})

router.get("/create", function (req, res) {
    if (!res.locals.isLoggedIn)
        res.redirect("/login")
    else
        res.render("blogs/createBlog")
})

router.post("/create", upload.single("image"), function (req, res) {
    if (!res.locals.isLoggedIn) {
        res.redirect("/login")
        return
    }
    const validationErrors = []
    const title = req.body.title
    const file = req.file
    const caption = req.body.caption
    const content = req.body.content
    if (!file)
        validationErrors.push("Please upload image file.")
    if (title.length < TITLE_MIN_LENGTH)
        validationErrors.push("Title is too short.")
    else if (title.length > TITLE_MAX_LENGTH)
        validationErrors.push("Title is too long.")
    if (caption.length < CAPTION_MIN_LENGTH)
        validationErrors.push("Caption is too short.")
    else if (caption.length > CAPTION_MAX_LENGTH)
        validationErrors.push("Caption is too long.")
    if (content.length < CONTENT_MIN_LENGTH)
        validationErrors.push("Content is too short.")
    else if (content.length > CONTENT_MAX_LENGTH)
        validationErrors.push("Content is too long.")
    if (validationErrors.length == 0) {
        const blogObject = {
            title,
            imageUrl: file.path.replace(/^public/, ""),
            caption,
            content,
            createdAt: new Date().getTime()
        }
        db.createBlog(blogObject, function (error, id) {
            if (error)
                res.render("errors/500")
            else
                res.redirect("/blogs/" + id)
        })
    }
    else {
        res.render("blogs/createBlog", {
            validationErrors,
            title,
            caption,
            content,
        })
    }
})

router.get("/edit/:id", function (req, res) {
    if (!res.locals.isLoggedIn) {
        res.redirect("/login")
        return
    }
    const id = req.params.id
    db.getBlogById(id, function (error, blog) {
        if (error)
            res.render("errors/500")
        else
            res.render("blogs/editBlog", {
                blog
            })
    })
})

router.post("/edit/:id", upload.single("image"), function (req, res) {
    if (!res.locals.isLoggedIn) {
        res.redirect("/login")
        return
    }
    const id = req.params.id
    const validationErrors = []
    const title = req.body.title
    const originalFile = req.body.originalFile
    const file = req.file
    const caption = req.body.caption
    const content = req.body.content
    if (title.length < TITLE_MIN_LENGTH)
        validationErrors.push("Title is too short.")
    else if (title.length > TITLE_MAX_LENGTH)
        validationErrors.push("Title is too long.")
    if (caption.length < CAPTION_MIN_LENGTH)
        validationErrors.push("Caption is too short.")
    else if (caption.length > CAPTION_MAX_LENGTH)
        validationErrors.push("Caption is too long.")
    if (content.length < CONTENT_MIN_LENGTH)
        validationErrors.push("Content is too short.")
    else if (content.length > CONTENT_MAX_LENGTH)
        validationErrors.push("Content is too long.")
    const blog = {
        id,
        title,
        imageUrl: file ? file.path.replace(/^public/, "") : originalFile,
        caption,
        content,
    }
    if (validationErrors.length == 0)
        db.updateBlogById(id, blog, function (error, portfolioExisted) {
            if (error || !portfolioExisted)
                res.render("errors/500")
            else
                res.redirect("/blogs/" + id)
        })
    else
        res.render("blogs/editBlog", {
            validationErrors,
            blog
        })
})

router.get("/:id", function (req, res) {
    const id = req.params.id
    db.getBlogById(id, function (error, blog) {
        if (error)
            res.render("errors/500")
        else
            res.render("blogs/blog", {
                blog
            })
    })
})

router.post("/delete/:id", function (req, res) {
    if (!res.locals.isLoggedIn) {
        res.redirect("/login")
        return
    }
    const id = req.params.id
    db.deleteBlogById(id, function (error, blogExisted) {
        if (error || !blogExisted)
            res.render("errors/500")
        else
            res.redirect("/blogs/")
    })
})

module.exports = router