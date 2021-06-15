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


router.post('/user_login', checkMiddleWare, async function(req, res, next) {
    var id = req.body.ID;
    var name1 = req.body.NAME1;
    var filename0 = req.body.FILENAME0;

    if (filename0 != '') {
        filename0 = filename0 + '|프로필이미지';
    }

    //처음 가입자는 무조건 레벨 9
    await new Promise(function(resolve, reject) {
        var sql = `INSERT INTO MEMB_tbl SET ID = ?, NAME1 = ?, FILENAME0 = ?, LEVEL1 = 9, WDATE = NOW(), LDATE = NOW()`;
        db.query(sql, [id, name1, filename0], function(err, rows, fields) {
            if (!err) {
                resolve(1);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.send({
            code: 1,
            ID: id,
            LEVEL1: 9,
            NAME1: name1,
        });
    });
});

router.get('/myinfo/:ID', checkMiddleWare, async function(req, res, next) {
    var id = req.params.ID;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT ID, LEVEL1, NAME1, FILENAME0, WDATE FROM MEMB_tbl WHERE ID = ?`;
        db.query(sql, id, function(err, rows, fields) {
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

router.post('/myinfo/:ID', checkMiddleWare, async function(req, res, next) {
    var id = req.params.ID;
    var records = new Array();
    var sql = '';
    for (key in req.body) {
        if (req.body[key] != '') {
            sql += key + '= ?, ';
            records.push(req.body[key]);
        }
    }
    records.push(id);
    sql = "UPDATE MEMB_tbl SET " + sql + " LDATE = NOW() WHERE ID = ?";
    await db.query(sql, records, function(err, rows, fields) {
        if (!err) {
            res.send({
                code: 1,
                msg: '수정되었습니다.'
            });
        } else {
            res.send(err);
        }
    });
});

router.get('/is_member/:ID', checkMiddleWare, async function(req, res, next) {
    var id = req.params.ID;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT, LEVEL1, NAME1, HP, FILENAME0 FROM MEMB_tbl WHERE ID = ? AND LEVEL1 = 9`;
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                if (rows[0].CNT > 0) {
                    var sql = `UPDATE MEMB_tbl SET LDATE = NOW() WHERE ID = ?`;
                    db.query(sql, id);
                }
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });
});

router.post('/doctor_login', async function(req, res, next) {
    var id = req.body.ID;
    var pw = req.body.PASS1;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT, ID, NAME1, FILENAME0, LEVEL1 FROM MEMB_tbl WHERE ID = ? AND PASS1 = PASSWORD(?)`;
        console.log(id, pw);
        db.query(sql, [id, pw], function(err, rows, fields) {
            if (!err) {
                if (rows[0].CNT > 0) {
                    if (rows[0].LEVEL1 == 5) {
                        var sql = `UPDATE MEMB_tbl SET LDATE = NOW() WHERE ID = ?`;
                        db.query(sql, id);
                        rows[0].CODE = 1;
                        resolve(rows[0]);
                    } else if (rows[0].LEVEL1 == 6) {
                        resolve({ CODE: 0, MSG: "심사 대기중 입니다." });
                    } else {
                        resolve({ CODE: 0, MSG: "일반회원 접근!!" });
                    }
                } else {
                    resolve({ CODE: 0, MSG: "일치하는 회원정보가 없습니다." });
                }
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });
});


router.get('/doctor_id_check', async function(req, res, next) {
    var id = req.query.ID;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT FROM MEMB_tbl WHERE ID = ?`;
        db.query(sql, id, function(err, rows, fields) {
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

router.post('/update_fcm_token', checkMiddleWare, async function(req, res, next) {
    var id = req.body.ID;
    var fcm = req.body.FCM;

    await new Promise(function(resolve, reject) {
        var sql = `UPDATE MEMB_tbl SET FCM = ? WHERE ID = ?`;
        db.query(sql, [fcm, id], function(err, rows, fields) {
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


router.get('/alarm/:ID', checkMiddleWare, async function(req, res, next) {
    const id = req.params.ID;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT MESSAGE, IS_READ, WDATE FROM ALARM_tbl WHERE ID = ?`;
        db.query(sql, id, function(err, rows, fields) {
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

router.get('/all_read_alarm/:ID', checkMiddleWare, async function(req, res, next) {
    const id = req.params.ID;

    await new Promise(function(resolve, reject) {
        var sql = `UPDATE ALARM_tbl SET IS_READ = 1 WHERE ID = ?`;
        db.query(sql, id, function(err, rows, fields) {
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

router.get('/is_alarm_no_read/:ID', checkMiddleWare, async function(req, res, next) {
    const id = req.params.ID;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT FROM ALARM_tbl WHERE ID = ? AND IS_READ = 0`;
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0].CNT);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.send({
            cnt: data,
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

    res.send('member');
});



module.exports = router;
