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


router.post('/create_room', checkMiddleWare, async function(req, res, next) {
    var roomKey = req.body.ROOM_KEY;
    var doctorId = req.body.DOCTOR_ID;
    var userId = req.body.USER_ID;
    var myName = req.body.MY_NAME;
    var myThumb = req.body.MY_THUMB;
    var answer0 = req.body.ANSWER0;
    var answer1 = req.body.ANSWER1;
    var answer2 = req.body.ANSWER2;

    var sql = "";

    //방이 있는지 확인
    var cnt = 0;
    var state = 0;
    await new Promise(function(resolve, reject) {
        sql = "SELECT COUNT(*) as CNT, STATE FROM ROOM_tbl WHERE ROOM_KEY = ?";
        db.query(sql, roomKey, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        cnt = data.CNT;
        state = data.STATE;
    });
    //

    if (cnt == 0) {
        //채팅방 만들고... 채팅방에 초진정보도 넣어준다!!
        sql = `INSERT INTO ROOM_tbl SET
                ROOM_KEY = ?,
                USER_ID = ?,
                DOCTOR_ID = ?,
                LAST_MSG = '',
                STATE = ?,
                WDATE = ?,
                CDATE = NOW(),
                ANSWER0 = ?,
                ANSWER1 = ?,
                ANSWER2 = ? `;
        db.query(sql, [roomKey, userId, doctorId, 0, new Date().getTime(), answer0, answer1, answer2]);


        //닥터에게 푸시 보내주기!!!
        utils.sendPush(res, doctorId, myName + '님 께서 진료 상담 요청 하였습니다.', 'home');
        //

        res.send({
            code: 1,
            msg: '진료 접수 되었습니다.\n접수 현황은 상담 탭에서 확인 할 수 있습니다.'
        });
    } else {
        var msg = '이미 접수된 진료 내역이 있습니다.\n접수 현황은 상담 탭에서 확인 할 수 있습니다.';
        if (state == 3 || state == 2) {
            msg = '차단, 거절등의 사유로 진료불가능 상태입니다.';
        }

        res.send({
            code: 0,
            msg: msg,
        });
    }



});

router.get('/room_list/:ID/:LEVEL1', checkMiddleWare, async function(req, res, next) {
    var id = req.params.ID;
    var level1 = req.params.LEVEL1;
    var sql = "";
    await new Promise(function(resolve, reject) {
        if (level1 == 9) {
            sql = `SELECT
                    A.*,
                    (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as ROOM_NAME,
                    (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as THUMB,
                    (SELECT COUNT(*) FROM TALK_NO_READ_tbl WHERE ID = A.USER_ID AND ROOM_KEY = A.ROOM_KEY) as NO_READ_CNT
                    FROM ROOM_tbl as A
                    WHERE A.USER_ID = ?
                    AND STATE IN (0,1) `;
        } else {
            sql = `SELECT
                    A.*,
                    (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.USER_ID) as ROOM_NAME,
                    (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.USER_ID) as THUMB,
                    (SELECT COUNT(*) FROM TALK_NO_READ_tbl WHERE ID = A.DOCTOR_ID AND ROOM_KEY = A.ROOM_KEY) as NO_READ_CNT
                    FROM ROOM_tbl as A
                    WHERE A.DOCTOR_ID = ?
                    AND STATE IN (0,1) `;
        }

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


router.get('/get_room_info/:ROOM_KEY', checkMiddleWare, async function(req, res, next) {
    var roomKey = req.params.ROOM_KEY;

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.*,
            (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.DOCTOR_ID) as DT_NAME,
            (SELECT NAME1 FROM MEMB_tbl WHERE ID = A.USER_ID) as USER_NAME
            FROM ROOM_tbl as A
            WHERE A.ROOM_KEY = ?`;
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

router.post('/set_room_state', checkMiddleWare, async function(req, res, next) {
    var state = req.body.STATE;
    var roomKey = req.body.ROOM_KEY;
    var yourId = req.body.YOUR_ID;

    await new Promise(function(resolve, reject) {
        var sql = "UPDATE ROOM_tbl SET STATE = ? WHERE ROOM_KEY = ?";
        db.query(sql, [state, roomKey], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows)
            } else {
                console.log(err);
            }
        });
    });



    var msg = "";
    if (state == 1) {
        msg = '진료 상담이 수락 되었습니다.'
    } else if (state == 2) {
        msg = '진료 상담이 거절 되었습니다.'
    } else {
        res.send('');
        return;
    }

    //상대에게 푸시 보내주기!!!
    utils.sendPush(res, yourId, msg, 'rooms');

});



router.get('/del_no_read_count/:ROOM_KEY/:ID', async function(req, res, next) {
    const roomKey = req.params.ROOM_KEY;
    const id = req.params.ID;

    await new Promise(function(resolve, reject) {
        var sql = `DELETE FROM TALK_NO_READ_tbl WHERE ROOM_KEY = ? AND ID = ?`;
        db.query(sql, [roomKey, id],function(err, rows, fields) {
            if (!err) {
                res.send(rows);
            } else {
                console.log(err);
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

    res.send('api');
});



router.post('/file_upload', upload.single('upload_file'), async function(req, res, next) {
    await utils.setResize(req.file).then(function(newFileName) {
        newFileName = process.env.HOST_NAME + '/' + newFileName;
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
