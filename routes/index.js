var express = require('express');
var router = express.Router();


router.get('/', function(req, res, next) {
    res.render('index', {
        title: 'Express',
        mode: process.env.NODE_ENV,
    });
});


router.get('/chat', function(req, res, next) {
    res.render('chat', {
        title: 'chat tutorial'
    });

});

module.exports = router;