const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const multer = require('multer');
const uniqid = require('uniqid');
const utils = require('../Utils');
const moment = require('moment');
const qs = require('qs');
const axios = require('axios');


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


router.post('/set_resv', checkMiddleWare, async function(req, res, next) {
    const { room_key, user_id, doctor_id, date, time, is_call, app_use_price, app_use_receipt_url, imp_uid2 } = req.body;

    //예약하기
    await new Promise(function(resolve, reject) {
        const sql = `
            INSERT INTO JINLYOBI_tbl SET
            ROOM_KEY = ?,
            USER_ID = ?,
            DOCTOR_ID = ?,
            DATE1 = ?,
            TIME1 = ?,
            IS_CALL = ?,
            APP_USE_PRICE = ?,
            app_use_receipt_url = ?,
            imp_uid2 = ?,
            WDATE = NOW(),
            LDATE = NOW()
        `;
        db.query(sql, [room_key, user_id, doctor_id, date, time, is_call, app_use_price, app_use_receipt_url, imp_uid2], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then();
    //


    //채팅방이 있는지 확인
    var cnt = 0;
    await new Promise(function(resolve, reject) {
        const sql = `SELECT COUNT(*) as CNT FROM ROOM_tbl WHERE ROOM_KEY = ?`;
        db.query(sql, room_key, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        cnt = data.CNT;
    });
    //

    //방이 없으면 만든다!
    if (!cnt) {
        const sql = `
            INSERT INTO ROOM_tbl SET
            ROOM_KEY = ?,
            USER_ID = ?,
            DOCTOR_ID = ?,
            LAST_MSG = '',
            STATE = 0,
            WDATE = NOW()
        `;
        db.query(sql, [room_key, user_id, doctor_id, '']);
    } else {
        //있으면 state 값을 대기상태로 바꾼다!!
        const sql = `UPDATE ROOM_tbl SET STATE = 0 WHERE ROOM_KEY = ?`;
        db.query(sql, room_key);
    }

    res.send({
        msg: '정상적으로 예약 되었습니다.',
    });

});


router.post('/set_resv_cancel', checkMiddleWare, async function(req, res, next) {
    const idx = req.body.IDX;

    var imp_uid2 = '';

    //imp_uid2 가져오기
    await new Promise(function(resolve, reject) {
        const sql = `SELECT imp_uid2 FROM JINLYOBI_tbl WHERE IDX = ?`;
        db.query(sql, idx, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0].imp_uid2);
            } else {
                console.log(err);
                res.send(err);
            }
        });
    }).then(function(data) {
        imp_uid2 = data;
    });

    var access_token = '';

    await new Promise(function(resolve, reject) {
        /* 액세스 토큰(access token) 발급 */
        const data = qs.stringify({
            'imp_key': process.env.imp_key,
            'imp_secret': process.env.imp_secret,
        });
        const config = {
            method: 'post',
            url: 'https://api.iamport.kr/users/getToken',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data : data
        };
        axios(config).then(function(res) {
            access_token = res.data.response.access_token;
            resolve();
        }).catch(function (error) {
            res.send(error);
        });
    }).then();

    //취소 API 호출
    axios({
        url: "https://api.iamport.kr/payments/cancel",
        method: "post",
        headers: { "Content-Type": "application/json", "Authorization": access_token },
        data: {
            reason: '예약취소',     // 가맹점 클라이언트로부터 받은 환불사유
            imp_uid: imp_uid2,        // imp_uid를 환불 고유번호로 입력
        }
    }).then(async function(response) {
        console.log(response.data.response);

        if (response.data.response.status == 'cancelled') {
            //예약취소 상태로 변경
            await new Promise(function(resolve, reject) {
                const sql = `UPDATE JINLYOBI_tbl SET STATUS = -1, APP_USE_PRICE = 0 WHERE IDX = ?`;
                db.query(sql, idx, function(err, rows, fields) {
                    if (!err) {
                        resolve(rows);
                    } else {
                        console.log(err);
                        res.send(err);
                        return;
                    }
                });
            }).then(function(data) {
                res.send(data);
            });
        }
    }).catch(function (error) {
        res.send(error);
    });


});


router.get('/list/:USER_ID', checkMiddleWare, async function(req, res, next) {
    const userId = req.params.USER_ID;

    var arr = [];

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            A.*,
            (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DOCTOR_THUMB,
            (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DOCTOR_NAME,
            (SELECT HOSPITAL FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as HOSPITAL
            FROM JINLYOBI_tbl as A
            WHERE A.USER_ID = ?
            AND A.STATUS < 4
            AND A.ROOM_KEY != ''
            ORDER BY DATE1 ASC, TIME1 ASC
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
        arr = utils.nvl(data);
    });

    res.send(arr);
});


router.get('/doctor_resv_detail/:DATE/:DOCTOR_ID', checkMiddleWare, async function(req, res, next) {
    const date = req.params.DATE;
    const doctor_id = req.params.DOCTOR_ID;

    var arr = [];

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            A.*,
            (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.USER_ID) as USER_THUMB,
            (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.USER_ID) as USER_NAME,
            (SELECT HP FROM MEMB_tbl WHERE ID = A.USER_ID) as HP
            FROM JINLYOBI_tbl as A
            WHERE A.DOCTOR_ID = ?
            AND A.DATE1 = ?
            AND A.ROOM_KEY != ''
            ORDER BY DATE1 ASC, TIME1 ASC
        `;
        db.query(sql, [doctor_id, date], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        for (obj of data) {
            if (obj.HP) {
                obj.HP = utils.decrypto(obj.HP);
            }

            if (obj.USER_NAME) {
                arr.push(obj);
            }
        }
    });

    res.send(arr);
});


router.get('/already_check/:user_id/:doctor_id/:date', checkMiddleWare, async function(req, res, next) {
    const { user_id, doctor_id, date } = req.params;

    await new Promise(function(resolve, reject) {
        const sql = `SELECT COUNT(*) as CNT FROM JINLYOBI_tbl WHERE USER_ID = ? AND DOCTOR_ID = ? AND DATE1 = ? AND STATUS = 0`;
        db.query(sql, [user_id, doctor_id, date], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0].CNT);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        if (data) {
            res.send({ code: 0 });
        } else {
            res.send({ code: 1 });
        }
    });


});

router.get('/', checkMiddleWare, async function(req, res, next) {

    // await new Promise(function(resolve, reject) {
    //     const sql = ``;
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

    res.send('api');
});



module.exports = router;
