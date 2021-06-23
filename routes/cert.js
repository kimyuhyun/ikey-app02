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
    var user_phone_number = req.params.HP.replace(/-/gi, "");
	var user_auth_number = req.params.AUTH_NUM;
	var resultCode = 404;

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
			from: '01051818701',
			content: `${process.env.APP_NAME} 인증번호는\n[${user_auth_number}] 입니다.`,
			messages: [
				{
					to: `${user_phone_number}`
				}
			],
		}
    };

    axios(config).then(function (response) {
        res.send(response.data);
    }).catch(function (error) {
        console.log(error);
        res.send('err: ' + signature);
    });
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



module.exports = router;
