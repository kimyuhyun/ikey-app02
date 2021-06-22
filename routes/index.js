var express = require('express');
var router = express.Router();
var db = require('../db');

router.get('/', function(req, res, next) {

    setInterval(function () {
        db.query('SELECT 1');
        console.log('SELECT 1');
    }, 5000);


    res.render('index', {
        title: process.env.APP_NAME,
        mode: process.env.NODE_ENV,
    });
});


router.get('/chat', function(req, res, next) {
    res.render('chat', {
        title: 'chat tutorial'
    });

});

module.exports = router;
