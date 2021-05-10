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



router.get('/is_member/:ID', checkMiddleWare, async function(req, res, next) {
    var id = req.params.ID;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT, LEVEL1, NAME1, HP, FILENAME0 FROM MEMB_tbl WHERE ID = ?`;
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


router.post('/login', checkMiddleWare, async function(req, res, next) {
    var id = req.body.ID;
    var hp = req.body.HP;
    var name1 = req.body.NAME1;
    var filename0 = req.body.FILENAME0;

    if (filename0 != '') {
        filename0 = filename0 + '|프로필이미지';
    }

    //처음 가입자는 무조건 레벨 9
    await new Promise(function(resolve, reject) {
        var sql = `INSERT INTO MEMB_tbl SET ID = ?, NAME1 = ?, FILENAME0 = ?, HP = ?, LEVEL1 = 9, WDATE = NOW(), LDATE = NOW()`;
        console.log(sql, [id, name1, filename0, hp]);
        db.query(sql, [id, name1, filename0, hp], function(err, rows, fields) {
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
            HP: hp,
        });
    });
});


router.get('/search_friends/:LEVEL1', checkMiddleWare, async function(req, res, next) {
    var query = '%' + req.query.query + '%';
    var level1 = req.params.LEVEL1;

    //의사는 환자만 검색되게, 환자는 의사만 검색되게
    if (level1 == 5) {
        level1 = 9;
    } else if (level1 == 9) {
        level1 = 5;
    }

    await new Promise(function(resolve, reject) {
        var sql = `SELECT ID, NAME1, FILENAME0, SOGE, HOSPITAL FROM MEMB_tbl WHERE NAME1 LIKE ? AND LEVEL1 = ? ORDER BY NAME1 ASC`;
        db.query(sql, [query, level1], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });
});

router.get('/get_friends/:ID', checkMiddleWare, async function(req, res, next) {
    var id = req.params.ID;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT
                    B.ID,
                    B.NAME1,
                    B.FILENAME0,
                    B.HP,
                    B.HOSPITAL,
                    B.SOGE
                    FROM FRIENDS_tbl as A, MEMB_tbl as B
                    WHERE A.YOUR_ID = B.ID
                    AND A.MY_ID = ?`;
        db.query(sql, id, function(err, rows, fields) {
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

router.get('/get_talk_details', checkMiddleWare, async function(req, res, next) {
    var roomKey = req.query.ROOM_KEY;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT * FROM TALK_tbl WHERE ROOM_KEY = ? ORDER BY WDATE ASC`;
        db.query(sql, roomKey, function(err, rows, fields) {
            // console.log(rows);
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



router.post('/file_upload', upload.single('upload_file'), async function(req, res, next) {
    await utils.setResize(req.file).then(function(newFileName) {
        console.log('newFileName', newFileName);
        res.send(newFileName);
    });
});

router.get('/file_upload', function(req, res, next) {
    var html = `
        <div>`+process.env.HOST_NAME+`</div>
        <form method='post' action='./file_upload' enctype='multipart/form-data'>
            <input type='file' name='upload_file' />
            <input type='submit'>
        </form>
    `;

    res.send(html);
});


module.exports = router;
