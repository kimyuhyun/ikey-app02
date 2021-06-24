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
const axios = require('axios');

// http://52.79.237.255/push/send/naver_avoJmSbrvKjIOUFNta1HmWyfqJBWzG6GYXVCdHbVExw/푸시테스트
// http://localhost:3000/push/send/naver_avoJmSbrvKjIOUFNta1HmWyfqJBWzG6GYXVCdHbVExw/푸시테스트

router.get('/send/:id/:msg', async function(req, res, next) {
    const id = req.params.id;
    const msg = req.params.msg;


    var fcmArr = [];
    await new Promise(function(resolve, reject) {
        var sql = "SELECT FCM, IS_ALARM FROM MEMB_tbl WHERE ID = ?"
        db.query(sql, id, function(err, rows, fields) {
            // console.log(rows[0]);
            if (!err) {
                if (rows[0]) {
                    if (rows[0].IS_ALARM == 1) {
                        resolve(rows[0].FCM);
                    } else {
                        res.send({ IS_ALARM: 0 });
                    }
                } else {
                    res.send({ IS_ALARM: 0 });
                }
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

    var config = {
        method: 'post',
        url: 'https://fcm.googleapis.com/fcm/send',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'key=' + process.env.FCM_SERVER_KEY
        },
        data: JSON.stringify(fields),
    };

    axios(config).then(function (response) {
        res.send(response.data);
        //알림내역저장
        if (response.data.success == 1) {
            const sql = "INSERT INTO ALARM_tbl SET ID = ?, MESSAGE = ?, WDATE = NOW()";
            db.query(sql, [id, msg]);
        }
        //
    }).catch(function (error) {
        console.log(error);
        res.send('err: ' + error);
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

    res.send('push');
});



module.exports = router;
