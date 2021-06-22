var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var db = require('../db');
var multer = require('multer');
var uniqid = require('uniqid');
var utils = require('../Utils');
var bcrypt = require('bcrypt');
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

async function getMembInfo(token) {
    var id = ''
    var info = {};

    await new Promise(function(resolve, reject) {
        sql = 'SELECT MEMB_ID FROM RCP_TOKEN_tbl WHERE TOKEN = ?';
        db.query(sql, token, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        // console.log(data);
        id = data.MEMB_ID;
    });

    await new Promise(function(resolve, reject) {
        var sql = `SELECT ID, NAME1, FILENAME0, HOSPITAL FROM MEMB_tbl WHERE ID = ? `;
        db.query(sql, id, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        data.token = token;
        // console.log(data);
        info = data;
    });

    return info;
}


router.get('/get_rcp_url/:DOCTOR_ID', async function(req, res, next) {
    var doctorId = req.params.DOCTOR_ID;
    var cnt = 0;
    var token = '';

    await new Promise(function(resolve, reject) {
        var sql = "SELECT COUNT(*) as CNT, TOKEN FROM RCP_TOKEN_tbl WHERE MEMB_ID = ?";
        db.query(sql, doctorId, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        cnt = data.CNT;
        token = data.TOKEN;
    });

    if (cnt == 0) {
        await new Promise(function(resolve, reject) {
            bcrypt.hash(doctorId, 10, function(err, encrypted) {
                if (err) {
                    resolve(err);
                } else {
                    resolve(encrypted);
                }
            });
        }).then(function(data) {
            token = data;
        });

        token = replaceAll(token, "/", "");
        token = replaceAll(token, ".", "");
        token = replaceAll(token, "$", "");

        sql = "INSERT INTO RCP_TOKEN_tbl SET MEMB_ID = ?, TOKEN = ? ";
        db.query(sql, [doctorId, token]);
    }

    res.send({
        TOKEN: token,
    });
});


router.get('/:TOKEN', async function(req, res, next) {
    var token = req.params.TOKEN;
    var userId = req.query.USER_ID;
    var sql = '';
    var info = {};
    var userList = [];
    var jinlyobiList = [];

    await new Promise(function(resolve, reject) {
        resolve(getMembInfo(token));
    }).then(function(data) {
        info = data;
    });

    await new Promise(function(resolve, reject) {
        sql = `
            SELECT
            (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.USER_ID) as USER_NAME,
            (SELECT ID FROM MEMB_tbl WHERE ID = A.USER_ID) as USER_ID
            FROM
            ROOM_tbl as A
            WHERE A.DOCTOR_ID = ?
            ORDER BY WDATE DESC`;
        db.query(sql, info.ID, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        userList = data;
    });

    // 자바스크립트 자료형에서 false로 반환되는 값은
    // "", null, undefined, 0, NaN 이 있고
    // 나머지는 모두 true
    if (userId) {
        await new Promise(function(resolve, reject) {
            sql = `
                SELECT
                A.*,
                (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.USER_ID) as USER_NAME,
                (SELECT ID FROM MEMB_tbl WHERE ID = A.USER_ID) as USER_ID
                FROM
                JINLYOBI_tbl as A
                WHERE A.DOCTOR_ID = ?
                AND A.USER_ID = ?
                ORDER BY A.WDATE DESC`;
            db.query(sql, [info.ID, userId], function(err, rows, fields) {
                console.log(rows);
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                }
            });
        }).then(function(data) {
            jinlyobiList = data;
        });
    }

    res.render('./rcp/main', {
        info: info,
        userId: userId,
        userList: userList,
        jinlyobiList: jinlyobiList,
    });
});

router.get('/:TOKEN/:IDX', async function(req, res, next) {
    var token = req.params.TOKEN;
    var idx = req.params.IDX;
    var userId = req.query.USER_ID;
    var info = {};

    await new Promise(function(resolve, reject) {
        resolve(getMembInfo(token));
    }).then(function(data) {
        info = data;
    });

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.*,
            (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.USER_ID) as USER_NAME
            FROM
            JINLYOBI_tbl as A
            WHERE A.IDX = ?`;
        db.query(sql, idx, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.render('./rcp/modify', {
            info: info,
            row: data,
        });
    });
});

router.get('/:TOKEN/add/:USER_ID', async function(req, res, next) {
    var token = req.params.TOKEN;
    var userId = req.params.USER_ID;
    var info = {};

    await new Promise(function(resolve, reject) {
        resolve(getMembInfo(token));
    }).then(function(data) {
        info = data;
    });

    //환자 리스트 불러오기
    await new Promise(function(resolve, reject) {
        var sql = `SELECT NAME1 FROM MEMB_tbl WHERE ID = ?`;
        db.query(sql, userId, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.render('./rcp/add', {
            info: info,
            userName: data.NAME1,
            userId: userId,
        });
    });


});


router.get('/:TOKEN/delete/:IDX/:USER_ID', async function(req, res, next) {
    var token = req.params.TOKEN;
    var idx = req.params.IDX;
    var userId = req.params.USER_ID;
    var info = {};

    await new Promise(function(resolve, reject) {
        resolve(getMembInfo(token));
    }).then(function(data) {
        info = data;
    });

    await new Promise(function(resolve, reject) {
        var sql = `DELETE FROM JINLYOBI_tbl WHERE IDX = ? AND DOCTOR_ID = ? AND USER_ID = ?`;
        db.query(sql, [idx, info.ID, userId], function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                res.redirect('/rcp/' + token + '?USER_ID=' + userId);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {

    });

});


router.post('/write', upload.fields([{ name: 'RECIPE' }, { name: 'RECEIPT' }]), async function(req, res, next) {
    var token = req.query.token;
    var idx = req.body.IDX;
    var userId = req.body.USER_ID;
    var statusMsg = req.body.STATUS_MSG;

    if (req.files['RECIPE']) {
        await utils.setResize(req.files['RECIPE'][0]).then(function(newFileName) {
            newFileName = process.env.HOST_NAME + '/' + newFileName;
            console.log('newFileName', newFileName);
            req.body.RECIPE = newFileName;
        });
    }

    if (req.files['RECEIPT']) {
        await utils.setResize(req.files['RECEIPT'][0]).then(function(newFileName) {
            newFileName = process.env.HOST_NAME + '/' + newFileName;
            console.log('newFileName', newFileName);
            req.body.RECEIPT = newFileName;
        });
    }

    // delete req.body.UPLOADED_FILES;
    req.body.PRICE = replaceAll(req.body.PRICE, ',', '');

    var sql = ""
    var records = new Array();

    for (key in req.body) {
        if (req.body[key] != '') {
            sql += key + '= ?, ';
            records.push(req.body[key]);
        }
    }

    // console.log(records);return;

    if (idx == null) {
        sql = "INSERT INTO JINLYOBI_tbl SET " + sql + " WDATE = NOW(), LDATE = NOW()";
        db.query(sql, records, async function(err, rows, fields) {
            if (!err) {
                await new Promise(function(resolve, reject) {
                    sendPush(userId, statusMsg);
                    resolve();
                });
                res.redirect('/rcp/' + token + '?USER_ID=' + userId);
            } else {
                res.send(err);
            }
        });
    } else {
        records.push(idx);
        sql = "UPDATE JINLYOBI_tbl SET " + sql + " LDATE = NOW() WHERE IDX = ?";
        await db.query(sql, records, function(err, rows, fields) {
            if (!err) {
                res.redirect('/rcp/' + token + '?USER_ID=' + userId);
            } else {
                res.send(err);
            }
        });
    }
    // console.log(sql, records);
});



router.get('/', async function(req, res, next) {

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

async function sendPush(id, msg) {
    var fcmArr = [];
    await new Promise(function(resolve, reject) {
        var sql = "SELECT FCM FROM MEMB_tbl WHERE ID = ?"
        db.query(sql, id, function(err, rows, fields) {
            console.log(rows[0].FCM);
            if (!err) {
                resolve(rows[0].FCM);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        fcmArr.push(data);
    });

    var fields = {};
    fields['notification'] = {};
    fields['data'] = {};

    fields['registration_ids'] = fcmArr;
    fields['notification']['title'] = process.env.APP_NAME;
    fields['notification']['body'] = msg;
    fields['notification']['click_action'] = 'NOTI_CLICK'; //액티비티 다이렉트 호출
    fields['priority'] = 'high';
    fields['data']['menu_flag'] = 'jinlyo_list';               //키값은 대문자 안먹음..

    var request = require('request');
    var options = {
        'method': 'POST',
        'url': 'https://fcm.googleapis.com/fcm/send',
        'headers': {
            'Content-Type': 'application/json',
            'Authorization': 'key=' + process.env.FCM_SERVER_KEY
        },
        body: JSON.stringify(fields)
    };
    request(options, function (error, response) {
        console.log(response.body);
        //알림내역저장
        var sql = "INSERT INTO ALARM_tbl SET ID = ?, MESSAGE = ?, WDATE = NOW()";
        db.query(sql, [id, msg]);
        //
    });
    //
}

function replaceAll(str, searchStr, replaceStr) {
    return str.split(searchStr).join(replaceStr);
}

module.exports = router;
