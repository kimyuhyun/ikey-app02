var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var db = require('../db');
var multer = require('multer');
var uniqid = require('uniqid');
var utils = require('../Utils');
const axios = require('axios');
const qs = require('qs');

//create signature2
var CryptoJS = require('crypto-js');
var SHA256 = require('crypto-js/sha256');
var Base64 = require('crypto-js/enc-base64');

router.get('/sms/:HP/:AUTH_NUM', async function(req, res, next) {
    const hp = req.params.HP;
    var user_phone_number = req.params.HP.replace(/-/gi, "");
	var user_auth_number = req.params.AUTH_NUM;
	var resultCode = 404;


    //하이픈 제거 체크
    const tmp = hp.split("-");
    if (tmp.length < 3) {
        res.send({
            code: 0,
            msg: `핸드폰 번호가 올바르지 않습니다. '-' 하이픈을 포함해서 입력해주세요.`
        });
        return;
    }


    //핸드폰번호 중복체크
    let cnt = 0;
    await new Promise(function(resolve, reject) {
        const sql = `SELECT COUNT(*) as CNT FROM MEMB_tbl WHERE HP = ?`;
        db.query(sql, utils.crypto(hp), function(err, rows, fields) {
            console.log(rows[0]);
            if (!err) {
                resolve(rows[0].CNT);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        cnt = data;
    });

    if (cnt > 0) {
        res.send({
            code: 0,
            msg: '중복되는 핸드폰번호가 있습니다.'
        });
        return;
    }

    return;

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
			content: `${process.env.APP_NAME} 인증번호는\n[${user_auth_number}] 입니다.`,
			messages: [
				{
					to: `${user_phone_number}`
				}
			],
		}
    };

    axios(config).then(function (response) {
        res.send({
            code: 1,
        });
    }).catch(function (error) {
        console.log(error);
        res.send({
            code: 0,
            msg: '핸드폰 번호가 올바르지 않습니다.'
        });
    });
});

router.get('/', async function(req, res, next) {

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
