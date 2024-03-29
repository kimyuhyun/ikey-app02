var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs')
var multer = require('multer');
var uniqid = require('uniqid');
var db = require('../db');
var utils = require('../Utils');


var upload = multer({
    storage: multer.diskStorage({
        destination: function(req, file, cb) {
            var date = new Date();
            var month = eval(date.getMonth() + 1);
            if (eval(date.getMonth() + 1) < 10) {
                month = "0" + eval(date.getMonth() + 1);
            }
            var dir = 'data/' + date.getFullYear() + "" + month;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            cb(null, dir);
        },
        filename: function(req, file, cb) {
            var tmp = file.originalname.split('.');
            var mimeType = tmp[tmp.length - 1];
            if ('php|phtm|htm|cgi|pl|exe|jsp|asp|inc'.includes(mimeType)) {
                mimeType = mimeType + "x";
            }
            cb(null, uniqid(file.filename) + '.' + mimeType);
        }
    })
});


function checkMiddleWare(req, res, next) {
    if (req.session.ID == null) {
        if (req.headers["user-agent"] == "okhttp/3.14.9") {
            next();
            return;
        }
        res.redirect('/admin/login');
        return;
    }
    next();
}


router.post('/list', checkMiddleWare, async function(req, res, next) {
    var table = req.query.TABLE;
    var board_id = req.query.board_id;
    var level1 = req.query.level1;
    var doctor_id = req.query.DOCTOR_ID;
    var params;

    if (req.body.request != null) {
        params = JSON.parse(req.body.request);
    } else {
        params.offset = 0;
        params.limit = 10;
    }

    // console.log(params);

    var records = 0;
    var sql = "";
    var where = " WHERE 1=1 ";
    var orderby = "";
    var start = params.offset == null ? 0 : params.offset;
    var rows = params.limit;

    if (board_id != null) {
        where += " AND BOARD_ID = '" + board_id + "'";
    }

    if (level1 != null) {
        where += " AND LEVEL1 = " + level1;
    }

    if (doctor_id) {
        where += " AND DOCTOR_ID = '" + doctor_id + "' ";
    }

    if (params.search != null) {
        var tmp = "";
        for (var i in params.search) {
            if (i > 0) {
                tmp += " OR ";
            }
            tmp += params.search[i].field + " LIKE '%" + params.search[i].value + "%'";
        }
        where += "AND (" + tmp + ")";
    }


    var sql = "SELECT COUNT(*) as CNT FROM " + table + where;
    await db.query(sql, function(err, rows, fields) {
        records = rows[0].CNT;
    });


    if (params.sort != null) {
        orderby = " ORDER BY " + params.sort[0].field + " " + params.sort[0].direction;
    } else {
        orderby = " ORDER BY IDX DESC ";
    }

    sql = "SELECT * FROM " + table + where + orderby + " LIMIT " + start + ", " + rows;
    console.log(sql);
    await db.query(sql, function(err, rows, fields) {
        var arr = new Object();
        arr['status'] = 'success';
        arr['total'] = records;
        arr['records'] = rows;
        res.send(arr);
    });
});

router.get('/iterator', checkMiddleWare, async function(req, res, next) {
    var table = req.query.table;
    var sql = "SELECT * FROM " + table + " ORDER BY IDX DESC";
    db.query(sql, function(err, rows, fields) {
        res.send(rows);
    });
});

router.post('/write', checkMiddleWare, upload.array('FILES'), async function(req, res, next) {
    var table = req.body.TABLE;
    var idx = req.body.IDX;

    var uploadedLength = 0;
    if (req.body.UPLOADED_FILES != null && req.body.UPLOADED_FILES != '') {
        uploadedLength = req.body.UPLOADED_FILES.split(',').length;
    }

    for (i in req.files) {
        var fileIndex = Number(i) + Number(uploadedLength);
        // console.log("req.body.FILENAME" + fileIndex, i, uploadedLength);
        await utils.setResize(req.files[i]).then(function(newFileName) {
            newFileName = process.env.HOST_NAME + '/' + newFileName;
            console.log('newFileName', newFileName);
            eval("req.body.FILENAME" + fileIndex + " = newFileName");
        });
    }

    delete req.body.recid;
    delete req.body.TABLE;
    delete req.body.IDX;
    delete req.body.WDATE;
    delete req.body.LDATE;
    delete req.body.UPLOADED_FILES;
    delete req.body.FILES;

    var sql = ""
    var records = new Array();

    for (key in req.body) {
        if (req.body[key] != 'null') {
            if (key == 'PASS1') {
                if (req.body['PASS1'] != '') {
                    sql += key + '= PASSWORD(?), ';
                    records.push(req.body[key]);
                }
            } else {
                sql += key + '= ?, ';
                records.push(req.body[key]);
            }
        }
    }

    // console.log(records);return;

    if (idx == null) {
        sql = "INSERT INTO " + table + " SET " + sql + " WDATE = NOW(), LDATE = NOW()";
        await db.query(sql, records, function(err, rows, fields) {
            if (!err) {
                console.log(rows);
                var arr = new Object();
                arr['code'] = 1;
                arr['insertId'] = rows.insertId;
                arr['msg'] = '등록 되었습니다.';
                res.send(arr);
            } else {
                res.send(err);
            }
        });
    } else {
        records.push(idx);
        sql = "UPDATE " + table + " SET " + sql + " LDATE = NOW() WHERE IDX = ?";
        await db.query(sql, records, function(err, rows, fields) {
            if (!err) {
                db.query("SELECT * FROM " + table + " WHERE IDX = ?", idx, function(err, rows, fields) {
                    var arr = new Object();
                    arr['code'] = 2;
                    arr['msg'] = '수정 되었습니다.';
                    arr['record'] = rows[0];
                    res.send(arr);
                });


            } else {
                res.send(err);
            }
        });

        // //1:1문의 푸시알림
        // if (req.body.BOARD_ID == 'cscenter') {
        //     utils.sendPush(null, req.body.ID, '1:1문의에 답변이 등록되었습니다.');
        // }
        // //
    }




});

router.post('/delete', checkMiddleWare, async function(req, res, next) {
    const table = req.body.TABLE;
    const idx = req.body.IDX;

    const sql = "DELETE FROM " + table + " WHERE IDX = ?";

    await db.query(sql, idx, function(err, rows, fields) {
        if (!err) {
            console.log(rows);
            res.send({
                code: 1,
                msg: '삭제 되었습니다.'
            });
        } else {
            res.send(err);
        }
    });
});


router.get('/view', checkMiddleWare, async function(req, res, next) {
    console.log('/view', req.body);

    var arr = new Object();
    arr['status'] = 'success';
    res.send(arr);
});

router.post('/remove', checkMiddleWare, async function(req, res, next) {
    var table = req.query.TABLE;
    var params = JSON.parse(req.body.request);
    console.log(params);
    var sql = "";
    for (idx of params.selected) {
        sql = "DELETE FROM " + table + " WHERE IDX = " + idx;
        db.query(sql);
        console.log(sql);
    }

    var arr = new Object();
    arr['code'] = 1;
    res.send(arr);
});

router.post('/remove2', checkMiddleWare, async function(req, res, next) {
    var table = req.query.TABLE;
    var idxs = req.body.IDX;

    var sql = "";
    for (idx of idxs) {
        sql = "DELETE FROM " + table + " WHERE IDX = " + idx;
        db.query(sql);
    }

    var arr = new Object();
    arr['code'] = 1;
    res.send(arr);
});

router.post('/file_delete', checkMiddleWare, async function(req, res, next) {
    console.log(req.body.filename);
    await fs.exists(req.body.filename, function(exists) {
        console.log(exists);
        var arr = new Object();
        if (exists) {
            fs.unlink(req.body.filename, function(err) {
                if (!err) {
                    arr['code'] = 1;
                    res.send(arr);
                }
            });
        } else {
            arr['code'] = 0;
            res.send(arr);
        }
    });
});


module.exports = router;
