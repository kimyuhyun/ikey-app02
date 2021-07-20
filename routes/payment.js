const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const db = require('../db');
const utils = require('../Utils');
const axios = require('axios');
const qs = require('qs');
const crypto = require('crypto');

// http://localhost:3000/payment?amount=1000&user_id=naver_33776508&jinlyobi_idx=34

router.get('/', async function(req, res, next) {
    const { user_id, amount, jinlyobi_idx } = req.query;
    let hp = '';
    let user_name = '';
    let row = {};

    await new Promise(function(resolve, reject) {
        var sql = `SELECT NAME1, HP FROM MEMB_tbl WHERE ID = ?`;
        db.query(sql, user_id, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        if (data) {
            user_name = data.NAME1;
            if (data.HP != '') {
                hp = utils.decrypto(data.HP);
            }
        } else {
            user_name = '임시테스터';
            hp = '010-3333-3333';
        }
    });

    res.render('./payment/payment.html', {
        amount: amount,
        user_id: user_id,
        user_name: user_name,
        hp: hp,
        jinlyobi_idx: jinlyobi_idx,
    });
});





router.get('/complete', async function(req, res, next) {
    const { jinlyobi_idx, user_id, imp_uid, merchant_uid, imp_success } = req.query;
    var access_token = '';

    await new Promise(function(resolve, reject) {
        /* 액세스 토큰(access token) 발급 */
        var data = qs.stringify({
            'imp_key': process.env.imp_key,
            'imp_secret': process.env.imp_secret,
        });

        var config = {
            method: 'post',
            url: 'https://api.iamport.kr/users/getToken',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data : data
        };

        axios(config).then(function (res) {
            access_token = res.data.response.access_token;
            resolve();
        }).catch(function (error) {
            res.send(error);
        });
    }).then();



    var config = {
        method: 'get',
        url: 'https://api.iamport.kr/payments/' + imp_uid,
        headers: {
            'Authorization': access_token
        },
    };

    axios(config).then(async function (response) {
        console.log(response.data.response);
        if (response.data.response.status == 'paid') {
            const receipt_url = response.data.response.receipt_url;
            const imp_uid = response.data.response.imp_uid;
            const buyer_name = response.data.response.buyer_name;


            await new Promise(function(resolve, reject) {
                var sql = `UPDATE JINLYOBI_tbl SET IS_PAYMENT = 1, STATUS_MSG = '진료비 수납이 완료되었습니다.', receipt_url = ?, imp_uid = ?, buyer_name = ? WHERE IDX = ? AND USER_ID = ?`;
                db.query(sql, [receipt_url, imp_uid, buyer_name, jinlyobi_idx, user_id], function(err, rows, fields) {
                    if (!err) {
                        resolve();
                    }
                });
            }).then(function(data) {
                res.render('./payment/payment_ok.html', {
                    result: 'finish'
                });
            });
        }
    }).catch(function (error) {
        res.send(error);
    });

});


router.get('/app_use_pirce_complete', async function(req, res, next) {
    const { user_id, imp_uid, merchant_uid, imp_success } = req.query;
    var access_token = '';

    await new Promise(function(resolve, reject) {
        /* 액세스 토큰(access token) 발급 */
        var data = qs.stringify({
            'imp_key': process.env.imp_key,
            'imp_secret': process.env.imp_secret,
        });

        var config = {
            method: 'post',
            url: 'https://api.iamport.kr/users/getToken',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data : data
        };

        axios(config).then(function (res) {
            access_token = res.data.response.access_token;
            resolve();
        }).catch(function (error) {
            res.send(error);
        });
    }).then();



    var config = {
        method: 'get',
        url: 'https://api.iamport.kr/payments/' + imp_uid,
        headers: {
            'Authorization': access_token
        },
    };

    axios(config).then(async function (response) {
        console.log(response.data.response);
        if (response.data.response.status == 'paid') {
            const app_use_receipt_url = response.data.response.receipt_url;
            res.render('./payment/payment_ok.html', {
                result: 'finish|' + app_use_receipt_url,
            });
        }
    }).catch(function (error) {
        res.send(error);
    });

});



module.exports = router;
