const express = require('express');
const router = express.Router();
const utils = require('../Utils');
const axios = require('axios');
const qs = require('qs');

//create signature2
var CryptoJS = require('crypto-js');
var SHA256 = require('crypto-js/sha256');
var Base64 = require('crypto-js/enc-base64');

router.get('/send/:hp', async function(req, res, next) {
    var message = req.query.message;

    var user_phone_number = req.params.hp.replace(/-/gi, "");
    console.log(user_phone_number);
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
            content: `${message}`,
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
            msg: '전송완료.'
        });
    }).catch(function (error) {
        console.log(error);
        res.send({
            code: 0,
            msg: error
        });
    });
});



module.exports = router;
