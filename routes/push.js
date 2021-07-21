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

router.get('/send/:id/:msg/:menu_flag', async function(req, res, next) {
    const id = req.params.id;
    const msg = req.params.msg;
    const menu_flag = req.params.menu_flag;

    utils.sendPush(res, id, msg, menu_flag);
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
