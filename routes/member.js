const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const multer = require('multer');
const uniqid = require('uniqid');
const utils = require('../Utils');
const requestIp = require('request-ip');
const moment = require('moment');
const crypto = require('crypto');
const axios = require('axios');
const qs = require('qs');

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


router.post('/user_login', checkMiddleWare, async function(req, res, next) {
    const id = req.body.ID;
    const name1 = req.body.NAME1;
    const filename0 = req.body.FILENAME0;
    var hp = req.body.HP;



    //핸드폰번호 암호화
    hp = utils.crypto(hp);
    //


    //처음 가입자는 무조건 레벨 9
    await new Promise(function(resolve, reject) {
        var sql = `INSERT INTO MEMB_tbl SET ID = ?, NAME1 = ?, FILENAME0 = ?, HP = ?, LEVEL1 = 9, WDATE = NOW(), LDATE = NOW()`;
        db.query(sql, [id, name1, filename0, hp], function(err, rows, fields) {
            if (!err) {
                resolve(1);
            } else {
                console.log(err);
                res.send(err);
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
        var sql = `SELECT ID, LEVEL1, NAME1, FILENAME0, HP, IS_ALARM, WDATE FROM MEMB_tbl WHERE ID = ?`;
        db.query(sql, id, function(err, rows, fields) {
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        console.log(data);

        if (data.HP != '') {
            //핸드폰번호 복호화
            data.HP = utils.decrypto(data.HP);
            //
        }
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
                    var sql = `UPDATE MEMB_tbl SET LDATE = NOW(), IS_LOGOUT = 0 WHERE ID = ?`;
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


router.post('/doctor_register', checkMiddleWare, async function(req, res, next) {
    var sql = ''
    var records = new Array();

    var hp = req.body.HP;

    //핸드폰번호 암호화
    hp = utils.crypto(hp);
    //

    req.body.HP = hp;


    for (key in req.body) {
        if (req.body[key]) {
            if (key == 'PASS1') {
                if (req.body.PASS1 != '') {
                    sql += key + '= PASSWORD(?), ';
                    records.push(req.body[key]);
                }
            } else {
                sql += key + '= ?, ';
                records.push(req.body[key]);
            }
        }
    }

    // console.log(records);return;

    sql = "INSERT INTO MEMB_tbl SET " + sql + " WDATE = NOW(), LDATE = NOW()";
    await db.query(sql, records, function(err, rows, fields) {
        if (!err) {
            console.log(rows);
            var arr = new Object();
            arr['code'] = 1;
            arr['insertId'] = rows.insertId;
            arr['msg'] = '등록 되었습니다.';
            res.send(arr);
        } else {
            res.send(err);
        }
    });






});



router.get('/set_alarm/:ID/:IS_ALARM', checkMiddleWare, async function(req, res, next) {
    const id = req.params.ID;
    const isAlarm = req.params.IS_ALARM;

    await new Promise(function(resolve, reject) {
        const sql = `UPDATE MEMB_tbl SET IS_ALARM = ? WHERE ID = ?`;
        db.query(sql, [isAlarm, id]);
        resolve();
    }).then(function(data) {
        res.send({
            IS_ALARM: isAlarm
        });
    });
});


router.get('/alarm/:ID', checkMiddleWare, async function(req, res, next) {
    const id = req.params.ID;

    await new Promise(function(resolve, reject) {
        var sql = `SELECT MESSAGE, IS_READ, WDATE FROM ALARM_tbl WHERE ID = ? ORDER BY IDX DESC`;
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

router.post('/leave', checkMiddleWare, async function(req, res, next) {
    const id = req.body.ID;
    const sql = "DELETE FROM MEMB_tbl WHERE ID = ?";

    await db.query(sql, id, function(err, rows, fields) {
        if (!err) {
            console.log(rows);
            res.send({
                code: 1,
                msg: '삭제 되었습니다.'
            });
        } else {
            res.send(err);
        }
    });
});


router.get('/set_logout/:ID', async function(req, res, next) {
    const id = req.params.ID;

    await new Promise(function(resolve, reject) {
        const sql = `UPDATE MEMB_tbl SET IS_LOGOUT = 1 WHERE ID = ?`;
        db.query(sql, id, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                res.send({
                    code: 1,
                    msg: '로그아웃 되었습니다.'
                });
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {

    });
});

router.get('/find_id/:hp', checkMiddleWare, async function(req, res, next) {
    var hp = req.params.hp;
    var id = '';
    var code = 0;

    hp = utils.crypto(hp);

    await new Promise(function(resolve, reject) {
        var sql = `SELECT ID FROM MEMB_tbl WHERE HP = ? AND LEVEL1 in (5,6)`;
        db.query(sql, hp, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {

        if (data) {
            id = data.ID;
            code = 1;
        }
    });

    res.send({
        code: code,
        id: id,
    });
});

router.get('/find_pw/:id/:hp', checkMiddleWare, async function(req, res, next) {
    var id = req.params.id;
    var hp = req.params.hp;
    var cnt = 0;

    hp = utils.crypto(hp);

    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as cnt FROM MEMB_tbl WHERE ID = ? AND HP = ? AND LEVEL1 in (5,6)`;
        db.query(sql, [id, hp], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0].cnt);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        cnt = data;
    });

    if (cnt == 1) {
        //회원이 있다면 패스워드 변경한다!!
        var pw = '248367';

        var sql = `UPDATE MEMB_tbl SET PASS1 = PASSWORD(?) WHERE ID = ?`;
        db.query(sql, [pw, id], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                pwModifiedSendSMS(res, hp, pw);
            } else {
                console.log(err);
            }
        });

    } else {
        res.send({
            code: 0,
            msg: '일치하는 회원정보가 없습니다.',
        });
    }

});


function pwModifiedSendSMS(res, hp, pw) {
    hp = utils.decrypto(hp);

    hp = hp.replace(/-/gi, "");

    //create signature2
    var CryptoJS = require('crypto-js');
    var SHA256 = require('crypto-js/sha256');
    var Base64 = require('crypto-js/enc-base64');

    const date = Date.now().toString();
	const uri = process.env.uri;
	const secretKey = process.env.secretKey;
	const accessKey = process.env.accessKey;
	const method = 'POST';
	const space = ' ';
	const newLine = "\n";
	const url = `https://sens.apigw.ntruss.com/sms/v2/services/${uri}/messages`;
	const url2 = `/sms/v2/services/${uri}/messages`;

	const  hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);

	hmac.update(method);
	hmac.update(space);
	hmac.update(url2);
	hmac.update(newLine);
	hmac.update(date);
	hmac.update(newLine);
	hmac.update(accessKey);

	const hash = hmac.finalize();
	const signature = hash.toString(CryptoJS.enc.Base64);

    var config = {
        method: 'post',
        url: url,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-ncp-iam-access-key': accessKey,
			'x-ncp-apigw-timestamp': date,
			'x-ncp-apigw-signature-v2': signature,
        },
        data: {
			type: 'SMS',
            contentType: 'COMM',
			countryCode: '82',
			from: '0518919170',
			content: `${process.env.APP_NAME} 변경된 패스워드는 [${pw}] 입니다.`,
			messages: [
				{
					to: `${hp}`
				}
			],
		}
    };

    axios(config).then(function (response) {
        res.send({
            code: 1,
            msg: '패스워드가 변경되어 문자메시지로 전송되었습니다.',
        });
    }).catch(function (error) {
        console.log(error);
        res.send({
            code: 0,
            msg: '핸드폰 번호가 올바르지 않습니다.'
        });
    });
}

router.get('/', checkMiddleWare, async function(req, res, next) {
/*
    const cipher = crypto.createCipher('aes-256-cbc', 'ikey001');
    var result = cipher.update('010-5181-8701', 'utf8', 'base64');
    result += cipher.final('base64');

    console.log(result);


    const decipher = crypto.createDecipher('aes-256-cbc', 'ikey001');
    let result2 = decipher.update(result, 'base64', 'utf8'); // 암호화할문 (base64, utf8이 위의 cipher과 반대 순서입니다.)
    result2 += decipher.final('utf8'); // 암호화할문장 (여기도 base64대신 utf8)

    console.log(result2);
*/
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
