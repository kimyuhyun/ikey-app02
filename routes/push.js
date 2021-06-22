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


router.get('/send/:id/:msg', async function(req, res, next) {
    const id = req.params.id;
    const msg = req.params.msg;


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
        res.send({
            error: error,
            body: response.body,
        });
        
        //알림내역저장
        const sql = "INSERT INTO ALARM_tbl SET ID = ?, MESSAGE = ?, WDATE = NOW()";
        db.query(sql, [id, msg]);
        //
    });
    //
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
