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


async function checkMiddleWare(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var rows;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT VISIT FROM ANALYZER_tbl WHERE IP = ? ORDER BY IDX DESC LIMIT 0, 1`;
        db.query(sql, ip, function(err, rows, fields) {
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
            db.query(sql, [ip, req.headers['user-agent'], cnt], function(err, rows, fields) {
                resolve(cnt);
            });
        } else {
            db.query(sql, [ip, req.headers['user-agent'], 1], function(err, rows, fields) {
                resolve(1);
            });
        }
    }).then(function(data) {
        console.log(data);
    });

    //현재 접속자 파일 생성
    var memo = new Date().getTime() + "|S|" + req.baseUrl + req.path;
    fs.writeFile('./liveuser/'+ip, memo, function(err) {
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
            (SELECT HOSPITAL FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as HOSPITAL,
            (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DOCTOR_NAME,
            (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DOCTOR_THUMB
            FROM
            JINLYOBI_tbl as A
            WHERE USER_ID = ?
            AND STATUS = 4
            ORDER BY WDATE DESC
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
        data = utils.nvl(data);
        res.send(data);
    });
});

router.get('/jinlyo_detail/:IDX', checkMiddleWare, async function(req, res, next) {
    var idx = req.params.IDX;

    await new Promise(function(resolve, reject) {
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


router.get('/get_jinlyobi/:IDX', checkMiddleWare, async function(req, res, next) {
    const idx = req.params.IDX;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT IS_PAYMENT, PRICE, APP_USE_PRICE, RCP_PRICE, DLV_PRICE FROM JINLYOBI_tbl WHERE IDX = ?`;
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



router.get('/is_set_jinlyo_time/:ID', checkMiddleWare, async function(req, res, next) {
    const id = req.params.ID;
    var cnt = 0;

    await new Promise(function(resolve, reject) {
        const sql = `SELECT COUNT(*) as CNT FROM MEMB_tbl WHERE ID = ?`;
        db.query(sql, id, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0].CNT);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        cnt = data;
    });

    if (!cnt) {
        res.send({
            code: 0,
            msg: '잘못된 접속입니다.'
        });
        return;
    }

    await new Promise(function(resolve, reject) {
        const sql = `SELECT COUNT(*) as CNT FROM JINLYO_TIME_tbl WHERE ID = ?`;
        db.query(sql, id, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0].CNT);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.send({
            code: 1,
            cnt: data
        });
    });
});

router.post('/set_status', checkMiddleWare, async function(req, res, next) {
    const { idx, status } = req.body;
    var obj = {};

    await new Promise(function(resolve, reject) {
        const sql = `UPDATE JINLYOBI_tbl SET STATUS = ? WHERE IDX = ?`;
        db.query(sql, [status, idx], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        obj = data;
    });
    res.send(obj);
});


router.post('/set_jinlyo_time', async function(req, res, next) {

    console.log(req.body);
    // console.log(yoil);

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
