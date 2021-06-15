var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var db = require('../db');
var multer = require('multer');
var uniqid = require('uniqid');
var utils = require('../Utils');
var requestIp = require('request-ip');
var moment = require('moment');


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

async function checkMiddleWare(req, res, next) {
    var rows;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT VISIT FROM ANALYZER_tbl WHERE IP = ? ORDER BY IDX DESC LIMIT 0, 1`;
        db.query(sql, req.sessionID, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            }
        });
    }).then(function(data){
        rows = data;
    });

    await new Promise(function(resolve, reject) {
        var sql = `INSERT INTO ANALYZER_tbl SET IP = ?, AGENT = ?, VISIT = ?, WDATE = NOW()`;
        if (rows.length > 0) {
            var cnt = rows[0].VISIT + 1;
            db.query(sql, [req.sessionID, req.headers['user-agent'], cnt], function(err, rows, fields) {
                resolve(cnt);
            });
        } else {
            db.query(sql, [req.sessionID, req.headers['user-agent'], 1], function(err, rows, fields) {
                resolve(1);
            });
        }
    }).then(function(data) {
        console.log(data);
    });

    //현재 접속자 파일 생성
    var memo = new Date().getTime() + "|S|" + req.baseUrl + req.path;
    fs.writeFile('./liveuser/'+req.sessionID, memo, function(err) {
        console.log(memo);
    });
    //
    next();
}


router.get('/jinlyo_list', checkMiddleWare, async function(req, res, next) {
    var userId = req.query.USER_ID;

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            A.*,
            (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DOCTOR_NAME,
            (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DOCTOR_THUMB
            FROM
            JINLYOBI_tbl as A
            WHERE USER_ID = ? ORDER BY WDATE DESC
        `;

        db.query(sql, userId, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });
});

router.get('/jinlyo_detail/:IDX', checkMiddleWare, async function(req, res, next) {
    var idx = req.params.IDX;

    await new Promise(function(resolve, reject) {
        // var sql = `
        //     SELECT
        //     A.*,
        //     (SELECT ID FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DT_ID,
        //     (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DT_NAME,
        //     (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DT_THUMB,
        //     (SELECT SOGE FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DT_SOGE,
        //     (SELECT HOSPITAL FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DT_HOSPITAL,
        //     (SELECT CATEGORYS FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DT_CATEGORYS
        //     FROM JINLYO_tbl as A WHERE A.IDX = ?
        // `;

        var sql = ` SELECT * FROM JINLYO_tbl as A WHERE A.IDX = ? `;

        db.query(sql, idx, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });
});

router.get('/jinlyo_info/:DOCTOR_ID/:USER_ID', checkMiddleWare, async function(req, res, next) {
    var doctorId = req.params.DOCTOR_ID;
    var userId = req.params.USER_ID;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT * FROM JINLYO_tbl WHERE USER_ID = ? AND DOCTOR_ID = ? ORDER BY WDATE DESC`;
        db.query(sql, [userId, doctorId],function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });
});


router.get('/get_chojin_data/:ROOM_KEY', checkMiddleWare, async function(req, res, next) {
    var roomKey = req.params.ROOM_KEY;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT * FROM ROOM_tbl WHERE ROOM_KEY = ?`;
        db.query(sql, roomKey, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });
});



router.get('/jinlyobi_payment_ok', checkMiddleWare, async function(req, res, next) {
    var idx = req.query.IDX;
    var userId = req.query.USER_ID;

    await new Promise(function(resolve, reject) {
        var sql = `UPDATE JINLYOBI_tbl SET IS_PAYMENT = 1, STATUS_MSG = '진료비 수납이 완료되었습니다.' WHERE IDX = ? AND USER_ID = ?`;
        db.query(sql, [idx, userId], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                res.send({
                    code: 1,
                    msg: '정상적으로 결제가 완료 되었습니다.',
                });
            } else {
                console.log(err);
                res.send({
                    code: 0,
                    msg: err,
                });
            }
        });
    });


});

router.get('/', checkMiddleWare, async function(req, res, next) {

    // await new Promise(function(resolve, reject) {
    //     var sql = ``;
    //     db.query(sql, function(err, rows, fields) {
    //         console.log(rows);
    //         if (!err) {
    //
    //         } else {
    //             console.log(err);
    //         }
    //     });
    // }).then(function(data) {
    //
    // });

    res.send('jinlyo');
});



module.exports = router;
