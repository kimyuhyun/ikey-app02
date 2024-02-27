const express = require("express");
const router = express.Router();
const fs = require("fs");
const multer = require("multer");
const uniqid = require("uniqid");
const path = require("path");

const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const folder = "./data";
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder);
            }

            const date = new Date();
            var month = eval(date.getMonth() + 1);
            if (eval(date.getMonth() + 1) < 10) {
                month = "0" + eval(date.getMonth() + 1);
            }
            const dir = `${folder}/${date.getFullYear()}${month}`;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            const mimeType = path.extname(file.originalname);
            if ("php|phtm|htm|cgi|pl|exe|jsp|asp|inc".includes(mimeType)) {
                cb(null, file.originalname + "x");
                return;
            }

            if ("pdf|ppt|pptx|xls|xlsx|doc|docx|hwp|zip|txt".includes(mimeType)) {
                cb(null, file.originalname);
            } else {
                cb(null, uniqid(file.filename) + "" + mimeType);
            }
        },
        limits: {
            fileSize: 1024 * 1024,
        },
    }),
});

const myUpload = upload.fields([
    { name: "filename0", maxCount: 1 },
    { name: "filename1", maxCount: 1 },
    { name: "filename2", maxCount: 1 },
    { name: "filename3", maxCount: 1 },
    { name: "filename4", maxCount: 1 },
    { name: "filename5", maxCount: 1 },
    { name: "filename6", maxCount: 1 },
    { name: "filename7", maxCount: 1 },
    { name: "filename8", maxCount: 1 },
    { name: "filename9", maxCount: 1 },
]);

router.post("/", myUpload, async function (req, res, next) {
    console.log("files", req.files);
    var arr = [];
    for (var i = 0; i < 9; i++) {
        try {
            const obj = eval(`req.files.filename${i}`);
            const tmp = `${process.env.HOST_NAME}/${obj[0].path}`;
            const fieldname = obj[0].fieldname;
            const filename = tmp;
            arr.push({
                key: fieldname,
                url: filename,
            });
        } catch (err) {
            console.log(err.message);
        }
    }
    console.log(arr);
    res.json(arr[0]);
});

router.get("/", async function (req, res, next) {
    res.send("uploader");
});

module.exports = router;
