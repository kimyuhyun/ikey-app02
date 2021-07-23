const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const multer = require('multer');
const uniqid = require('uniqid');
const utils = require('../Utils');
const moment = require('moment');
const holidayKR = require('holiday-kr');



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
        // console.log(data);
    });

    //현재 접속자 파일 생성
    var memo = new Date().getTime() + "|S|" + req.baseUrl + req.path;
    fs.writeFile('./liveuser/'+ip, memo, function(err) {
        console.log(memo);
    });
    //
    next();
}


router.get('/get_resv/:doctor_id/:start/:end', async function(req, res, next) {
    const { doctor_id, start, end } = req.params;
    const is_dt = req.query.is_dt;

    const date1 = moment(start, "YYYY-MM-DD");
    const date2 = moment(end, "YYYY-MM-DD");
    const diff = date2.diff(date1, 'days');

    var arr = [];
    var startDate = '';

    const today = moment().format("YYYY-MM-DD");
    var isFirst = true;


    for (var i=0;i<=diff;i++) {
        var obj = {};
        var date = moment(start).add(i, 'days').format("YYYY-MM-DD");

        var isHoliday = holidayKR.isSolarHoliday(date.split('-')[0], date.split('-')[1], date.split('-')[2]);
        var yoil = moment(date).format('ddd').toUpperCase();
        if (isHoliday && yoil != 'SUN') {
            yoil = 'HOL';
        }

        //요일별 진료시간 가져오기!
        await new Promise(function(resolve, reject) {
            const sql = `SELECT YOIL, S_TM, E_TM FROM JINLYO_TIME_tbl WHERE ID = ? AND YOIL = ? `;
            db.query(sql, [doctor_id, yoil], function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0]);
                } else {
                    // console.log(err);
                    res.send(err);
                    return;
                    // resolve();
                }
            });
        }).then(function(data) {
            obj.DATE = date;
            obj.YOIL = yoil;
            obj.IS_RESV = false;

            if (data) {
                if (data.S_TM == '00:00' && data.E_TM == '00:00') {
                    obj.IS_RESV = false;
                } else {
                    obj.IS_RESV = true;
                }
            }
        });
        //

        // console.log('is_dt', is_dt);

        if (!is_dt) {
            // 오늘 예약 못하게 막기
            if (moment(today).isSame(date)) {
                obj.IS_RESV = false;
            }

            //이전날 예약 못하게 막기
            if (!moment(today).isBefore(date)) {
                obj.IS_RESV = false;
            }
        }





        // 예약자수 가져오기!
        if (obj.IS_RESV) {
            //예약 가능한 첫번째 날짜 세팅
            if (isFirst) {
                startDate = obj.DATE;
                isFirst = false;
            }
            //
            await new Promise(function(resolve, reject) {
                const sql = `
                    SELECT
                    COUNT(*) as CNT,
                    (SELECT COUNT(*) FROM MEMB_tbl WHERE ID = A.USER_ID) as IS_MEMBER
                    FROM JINLYOBI_tbl as A
                    WHERE A.DOCTOR_ID = ? AND A.DATE1 = ? AND STATUS = 0`;
                db.query(sql, [doctor_id, date], function(err, rows, fields) {
                    if (!err) {
                        resolve(rows[0]);
                    } else {
                        console.log(err);
                    }
                });
            }).then(function(data) {
                if (data.IS_MEMBER == 0) {
                    obj.RESV_CNT = 0;
                } else {
                    obj.RESV_CNT = data.CNT;
                }
            });
        } else {
            obj.RESV_CNT = 0;
        }


        arr.push(obj);
    }

    res.send({
        list: arr,
        start_date: startDate,
    });
});


router.get('/:DOCTOR_ID/:GAP', async function(req, res, next) {
    const doctorId = req.params.DOCTOR_ID;
    const gap = req.params.GAP;

    var start = moment().add(gap, 'month').format("YYYY-MM-01");
    var end = moment().add(gap, 'month').format("YYYY-MM-") + moment().add(gap, 'month').daysInMonth();

    const date1 = moment(start, "YYYY-MM-DD");
    const date2 = moment(end, "YYYY-MM-DD");
    const diff = date2.diff(date1, 'days');


    var arr = [];
    var obj = {};
    var startDate = '';

    const today = moment().format("YYYY-MM-DD");
    var isFirst = true;


    for (var i=0;i<=diff;i++) {
        var date = moment(start).add(i, 'days').format("YYYY-MM-DD");

        var isHoliday = holidayKR.isSolarHoliday(date.split('-')[0], date.split('-')[1], date.split('-')[2]);
        var yoil = moment(date).format('ddd').toUpperCase();
        if (isHoliday && yoil != 'SUN') {
            yoil = 'HOL';
        }

        //요일별 진료시간 가져오기!
        await new Promise(function(resolve, reject) {
            const sql = `SELECT YOIL, S_TM, E_TM, H_S_TM, H_E_TM FROM JINLYO_TIME_tbl WHERE ID = ? AND YOIL = ? `;
            db.query(sql, [doctorId, yoil], function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0]);
                } else {
                    console.log(err);
                }
            });
        }).then(function(data) {
            if (data) {
                data.DATE = date;
                data.YOIL_CODE = moment(date).day();

                if (data.S_TM == '00:00' && data.E_TM == '00:00') {
                    data.IS_RESV = false;
                } else {
                    data.IS_RESV = true;
                }
                obj = data;
            }
        });
        //

        if (!obj) {
            res.send({
                list: [],
                start_date: startDate,
            });

            return;
        }

        //오늘 예약 못하게 막기
        if (moment(today).isSame(date)) {
            obj.IS_RESV = false;
        }
        //

        //이전날 예약 못하게 막기
        if (!moment(today).isBefore(date)) {
            console.log(today, date);
            obj.IS_RESV = false;
        }
        //

        //예약자수 가져오기!
        if (obj.IS_RESV) {
            //예약 가능한 첫번째 날짜 세팅
            if (isFirst) {
                startDate = obj.DATE;
                isFirst = false;
            }
            //
            await new Promise(function(resolve, reject) {
                const sql = `SELECT COUNT(*) as CNT FROM JINLYOBI_tbl WHERE DOCTOR_ID = ? AND DATE1 = ? `;
                db.query(sql, [doctorId, date], function(err, rows, fields) {
                    if (!err) {
                        resolve(rows[0]);
                    } else {
                        console.log(err);
                    }
                });
            }).then(function(data) {
                obj.RESV_CNT = data.CNT;
            });
        } else {
            obj.RESV_CNT = 0;
        }
        //
        arr.push(obj);
    }

    res.send({
        list: arr,
        start_date: startDate,
    });
});

router.get('/resv_detail/:DOCTOR_ID/:DATE', async function(req, res, next) {
    const doctorId = req.params.DOCTOR_ID;
    const date = req.params.DATE;

    var isHoliday = holidayKR.isSolarHoliday(date.split('-')[0], date.split('-')[1], date.split('-')[2]);
    var yoil = moment(date).format('ddd').toUpperCase();
    if (isHoliday && yoil != 'SUN') {
        yoil = 'HOL';
    }

    var arr = [];
    var obj = {};

    //진료시간 가져오기
    await new Promise(function(resolve, reject) {
        var sql = `SELECT S_TM, E_TM, H_S_TM, H_E_TM FROM JINLYO_TIME_tbl WHERE ID = ? AND YOIL = ?`;
        db.query(sql, [doctorId, yoil], function(err, rows, fields) {
            console.log(rows[0]);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        obj = data;
    });

    //해당일 예약시간 가져오기
    var timeArr = [];
    await new Promise(function(resolve, reject) {
        const sql = `SELECT TIME1 FROM JINLYOBI_tbl WHERE DOCTOR_ID = ? AND DATE1 = ? AND STATUS = 0`;
        db.query(sql, [doctorId, date], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        for (v of data) {
            timeArr.push(v.TIME1);
        }
    });
    //

    //몇분마다 예약잡을건지!!!!
    const min = 5;

    //초기는 -min 전으로 잡는다!!
    var tmp = moment(date + ' ' + obj.S_TM).add(eval('- + min'), 'm').format("HH:mm");
    //

    //휴식시간 마이너스 처리
    const hstm = moment(date + ' ' + obj.H_S_TM).add(eval('- + min'), 'm').format("HH:mm");

    //진료 종료시간 마이너스 처리
    const etm = moment(date + ' ' + obj.E_TM).add(eval('- + min'), 'm').format("HH:mm");

    while (true) {
        var v = moment(date + ' ' + tmp).add(min, 'm').format("HH:mm");

        //휴식시간에 걸리는지 체크
        var isBetween = moment(date + ' ' + v).isBetween(date + ' ' + hstm, date + ' ' + obj.H_E_TM);
        if (!isBetween) {
            //예약됬는지 체크!
            arr.push({
                TIME: v,
                IS_RESV: timeArr.includes(v),
            });
        }
        //

        tmp = v;
        if (v == etm) {
            break;
        }
    }
    res.send(arr);
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

    res.send('api');
});



module.exports = router;
