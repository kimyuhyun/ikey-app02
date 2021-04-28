var express = require('express');
var router = express.Router();


router.get('/', function(req, res, next) {
    res.render('index', {
        title: 'Express',
        mode: process.env.NODE_ENV,
    });
});

module.exports = router;
