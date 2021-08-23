const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const utils = require('../Utils');
const moment = require('moment');

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

router.get('/list/:doctor_id', checkMiddleWare, async function(req, res, next) {
    const doctorId = req.params.doctor_id;

    var arr = {};

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            DATE1,
            SUM(APP_USE_PRICE) as SUM
            FROM JINLYOBI_tbl
            WHERE DOCTOR_ID = ?
            AND APP_USE_PRICE > 0
            AND STATUS >= 3
            GROUP BY DATE1
            ORDER BY DATE1 DESC, TIME1 DESC`;
        db.query(sql, doctorId, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        arr.header = utils.nvl(data);
    });

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            A.IDX,
            A.DATE1,
            A.TIME1,
            A.APP_USE_PRICE,
            (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.USER_ID) as NAME1,
            (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.USER_ID) as USER_THUMB
            FROM JINLYOBI_tbl as A
            WHERE A.DOCTOR_ID = ?
            AND A.APP_USE_PRICE > 0
            AND STATUS = 3
            ORDER BY DATE1 DESC, TIME1 DESC`;
        db.query(sql, doctorId, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        arr.body = utils.nvl(data);
    });
    res.send(arr);
});

router.get('/list/:doctor_id/:idx', checkMiddleWare, async function(req, res, next) {
    const doctorId = req.params.doctor_id;
    const idx = req.params.idx;

    var arr = [];
    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            A.*,
            (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.USER_ID) as NAME1,
            (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.USER_ID) as USER_THUMB
            FROM JINLYOBI_tbl as A
            WHERE DOCTOR_ID = ?
            AND IDX = ?
            AND STATUS = 3
            ORDER BY DATE1 DESC, TIME1 DESC`;
        db.query(sql, [doctorId, idx], function(err, rows, fields) {
            console.log(rows[0]);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });
    res.send(arr);
});

router.get('/export_ava_price/:doctor_id', checkMiddleWare, async function(req, res, next) {
    const doctor_id = req.params.doctor_id;
    var ttl_price = 0;
    var exported_price = 0;

    var arr = {};

    //전체금액 구하고!!
    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            SUM(APP_USE_PRICE) as SUM
            FROM JINLYOBI_tbl
            WHERE DOCTOR_ID = ?
            AND APP_USE_PRICE > 0
            AND STATUS >= 3 
        `;
        db.query(sql, doctor_id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        if (data.SUM) {
            ttl_price = data.SUM;
        }
    });
    //

    //출금금액을 구하고!!
    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            SUM(PRICE) as SUM
            FROM EXPORT_REQ_PRICE_tbl
            WHERE ID = ?
        `;
        db.query(sql, doctor_id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        if (data.SUM) {
            exported_price = data.SUM;
        }
    });
    //
    arr.CALC = ttl_price - exported_price;

    res.send(arr);
});


router.get('/export_list/:doctor_id/:flag', checkMiddleWare, async function(req, res, next) {
    const doctor_id = req.params.doctor_id;
    const flag = req.params.flag;

    var arr = [];
    await new Promise(function(resolve, reject) {
        const sql = `SELECT * FROM EXPORT_REQ_PRICE_tbl WHERE ID = ? AND IS_COMPLETED = ? ORDER BY WDATE DESC`;
        db.query(sql, [doctor_id, flag], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                res.send(err);
                return;
            }
        });
    }).then(function(data) {
        arr = utils.nvl(data);
    });
    res.send(arr);

});

router.get('/', checkMiddleWare, async function(req, res, next) {

    // var arr = [];
    // await new Promise(function(resolve, reject) {
    //     const sql = ``;
    //     db.query(sql, function(err, rows, fields) {
    //         console.log(rows);
    //         if (!err) {
    //             resolve(rows);
    //         } else {
    //             console.log(err);
    //             res.send(err);
    //             return;
    //         }
    //     });
    // }).then(function(data) {
    //     arr = utils.nvl(data);
    // });
    // res.send(arr);

    res.send('api');
});



module.exports = router;
