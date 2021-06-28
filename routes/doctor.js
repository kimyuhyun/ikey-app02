var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var db = require('../db');
var multer = require('multer');
var uniqid = require('uniqid');
var utils = require('../Utils');
var requestIp = require('request-ip');
const moment = require('moment');


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

router.get('/list', checkMiddleWare, async function(req, res, next) {
    var query = '%' + req.query.query + '%';
    var category = '%' + req.query.category + '%';
    var arr = [];

    await new Promise(function(resolve, reject) {
        var arr = [];

        var sql = `
                SELECT
                ID,
                NAME1,
                FILENAME0,
                SOGE,
                HOSPITAL,
                CATEGORYS,
                (SELECT COUNT(*) FROM DOCTOR_FAVORITE_tbl WHERE DOCTOR_ID = A.ID) as FAV_CNT
                FROM MEMB_tbl as A
                WHERE LEVEL1 = 5 `;
        if (query != '%%') {
            sql+= ` AND (NAME1 LIKE ? OR TAGS LIKE ?) `;
            arr.push(query);
            arr.push(query);
        }
        if (category != '%%') {
            sql+= ` AND CATEGORYS LIKE ? `;
            arr.push(category);
        }
        sql += ` ORDER BY NAME1 ASC `;
        console.log(sql);
        db.query(sql, arr, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        arr = data;
    });

    //진료중인이 가져오기!!
    for (row of arr) {
        var gbn = '';
        await new Promise(function(resolve, reject) {
            resolve(getJinlyoGbn(row.ID));
        }).then(function(data) {
            gbn = data;
        });
        row.JINLYO_GBN = gbn;
    }
    //
    res.send(arr);

});

router.get('/list/:ID', checkMiddleWare, async function(req, res, next) {
    const doctorId = req.params.ID;
    const userId = req.query.USER_ID;

    var arr = {};

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.*,
            (SELECT COUNT(*) FROM DOCTOR_FAVORITE_tbl WHERE DOCTOR_ID = A.ID) as FAV_CNT
            FROM MEMB_tbl as A WHERE ID = ?`;
            console.log(sql);
        db.query(sql, doctorId, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr = data;
    });

    delete arr.PASS1;
    delete arr.EMAIL_OK;
    delete arr.EMAIL;
    delete arr.TEL;
    delete arr.HP;
    delete arr.SMS_OK;
    delete arr.POLICY_OK;
    delete arr.REG_TYPE;
    delete arr.SEX;
    delete arr.WDATE;
    delete arr.LDATE;
    delete arr.FCM;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT FROM DOCTOR_FAVORITE_tbl WHERE USER_ID = ? AND DOCTOR_ID = ?`;
        db.query(sql, [userId, doctorId], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0].CNT);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        if (data > 0) {
            arr.IS_FAV = true;
        } else {
            arr.IS_FAV = false;
        }
    });

    var gbn = '';
    await new Promise(function(resolve, reject) {
        resolve(getJinlyoGbn(doctorId));
    }).then(function(data) {
        gbn = data;
    });
    arr.JINLYO_GBN = gbn;

    //병원 위도,경도 가져오기
    if (arr.HOSPITAL_IDX) {
        await new Promise(function(resolve, reject) {
            var sql = `SELECT LAT, LNG FROM HOSPITAL_tbl WHERE IDX = ?`;
            db.query(sql, arr.HOSPITAL_IDX, function(err, rows, fields) {
                console.log(rows);
                if (!err) {
                    resolve(rows[0]);
                } else {
                    console.log(err);
                }
            });
        }).then(function(data) {
            if (data) {
                arr.LAT = data.LAT;
                arr.LNG = data.LNG;
            }
        });
    }
    //


    res.send(arr);
});


router.get('/set_doctor_fav', checkMiddleWare, async function(req, res, next) {
    const userId = req.query.user_id;
    const doctorId = req.query.doctor_id;

    var isFav = false;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT FROM DOCTOR_FAVORITE_tbl WHERE USER_ID = ? AND DOCTOR_ID = ?`;
        db.query(sql, [userId, doctorId], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0].CNT);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        if (data > 0) {
            isFav = true;
        } else {
            isFav = false;
        }
    });

    var sql = '';
    if (isFav) {
        sql = 'DELETE FROM DOCTOR_FAVORITE_tbl WHERE USER_ID = ? AND DOCTOR_ID = ?';
    } else {
        sql = 'INSERT INTO DOCTOR_FAVORITE_tbl SET USER_ID = ?, DOCTOR_ID = ?';
    }
    db.query(sql, [userId, doctorId]);

    res.send({
        is_fav: !isFav,
    });
});

router.get('/get_jinlyi_time/:DOCTOR_ID', async function(req, res, next) {
    const doctorId = req.params.DOCTOR_ID;
    var arr = [];


    await new Promise(function(resolve, reject) {
        var sql = `SELECT * FROM JINLYO_TIME_tbl WHERE ID = ? ORDER BY SORT1 ASC`;
        db.query(sql, doctorId, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr = data;
    });

    var gbn = '';
    await new Promise(function(resolve, reject) {
        resolve(getJinlyoGbn(doctorId));
    }).then(function(data) {
        gbn = data;
    });


    res.send({
        JINLYO_TIME: arr,
        JINLYO_GBN: gbn,
        YOIL: moment().format('ddd').toUpperCase(),
    });
});

async function getJinlyoGbn(doctorId) {
    const yoil = moment().format('ddd').toUpperCase();
    const time = moment().format('HH:mm');

    var gbn = '진료종료';

    //진료시간을 체크 한다!!
    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT FROM JINLYO_TIME_tbl WHERE ID = ? AND YOIL = ? AND ? BETWEEN S_TM AND E_TM`;
        db.query(sql, [doctorId, yoil, time], function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows[0].CNT);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        if (data > 0) {
            gbn = '진료중';
        }
    });
    //

    //휴식시간을 체크 한다!!
    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT FROM JINLYO_TIME_tbl WHERE ID = ? AND YOIL = ? AND ? BETWEEN H_S_TM AND H_E_TM`;
        db.query(sql, [doctorId, yoil, time], function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows[0].CNT);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        if (data > 0) {
            gbn = '휴식중';
        }
    });
    //

    return gbn;
}


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

    res.send('doctor');
});

module.exports = router;
