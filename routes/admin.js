var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var db = require('../db');
var menus = require('../menu');
var utils = require('../Utils');

//메뉴를 전역변수에 넣어준다!
global.MENUS = menus;
global.SAVE_MENUS;
global.CURRENT_URL;
//

function checkMiddleWare(req, res, next) {
    // if (process.env.NODE_ENV != 'development') {
        if (req.session.ID == null) {
            res.redirect('/admin/login');
            return;
        }
    // }

    CURRENT_URL = req.baseUrl + req.path;

    utils.setSaveMenu(req).then(function(data) {
        SAVE_MENUS = data;
        next();
    });
}

router.get('/', checkMiddleWare, function(req, res, next) {
    db.query("SELECT SHOW_MENU_LINK FROM GRADE_tbl WHERE LEVEL1 = '?'", req.session.LEVEL1, function(err, rows, fields) {
        console.log(rows);
        if (!err) {
            var tmp = rows[0].SHOW_MENU_LINK.substr(1, 9999).split(',');
            res.render('./admin/main', {
                SHOW_MENU_LINK: tmp,
                LEVLE1: req.session.LEVEL1,
            });
        } else {
            res.send(err);
        }
    });
});

router.get('/login', function(req, res, next) {
    res.render('./admin/login', {
        year: new Date().getFullYear(),
        id: req.cookies['id'],
        pw: req.cookies['pw'],
    });
});

router.get('/logout', function(req, res, next) {
    // res.clearCookie('ID', {
    //     path: '/'
    // });
    // res.clearCookie('NAME1', {
    //     path: '/'
    // });
    // res.clearCookie('LEVEL1', {
    //     path: '/'
    // });
    req.session.destroy(function(){
        res.clearCookie('sid');
        res.send('<script type="text/javascript">alert("로그아웃 되었습니다.");location.href="/admin/login"</script>');
    });
});



// POST 는 body 로 받는다!!!
router.post('/login', function(req, res, next) {
    db.query("SELECT IDX, ID, NAME1, LEVEL1 FROM MEMB_tbl WHERE ID = ? AND PASS1 = PASSWORD(?)", [req.body.id, req.body.pw], function(err, rows, fields) {
        if (!err) {
            if (rows[0] != null) {
                //레벨체크
                if (rows[0].LEVEL1 > 2) {
                    res.send('<script type="text/javascript">alert("접근권한이 없습니다.");history.back();</script>');
                    return;
                }
                //

                db.query("UPDATE MEMB_tbl SET LDATE = NOW() WHERE ID = ?", req.body.id);


                req.session.IDX = rows[0].IDX;
                req.session.ID = rows[0].ID;
                req.session.NAME1 = rows[0].NAME1;
                req.session.LEVEL1 = rows[0].LEVEL1;

                if (req.body.remember == 1) {
                    res.cookie('id', rows[0].ID, {
                        maxAge: 60 * 60 * 1000,
                        httpOnly: true,
                        path: '/'
                    });
                    res.cookie('pw', req.body.pw, {
                        maxAge: 60 * 60 * 1000,
                        httpOnly: true,
                        path: '/'
                    });
                } else {
                    res.clearCookie('id', {
                        path: '/'
                    });
                    res.clearCookie('pw', {
                        path: '/'
                    });
                }

                req.session.save(function() {
                    res.redirect('/admin');
                });
            } else {
                res.send('<script type="text/javascript">alert("아이디/패스워드가 일치 하지 않습니다.");history.back();</script>');
                return;
            }
        } else {
            console.log('err', err);
            res.send(err);
        }
    });
});



router.get('/my_profile', checkMiddleWare, function(req, res, next) {
    var sql = "SELECT * FROM MEMB_tbl WHERE IDX = ?";

    db.query(sql, req.session.IDX, function(err, rows, fields) {
        if (!err) {
            res.render('./admin/my_profile', {
                row: rows[0],
            });
        } else {
            console.log(err);
        }
    });
});


router.get('/page/:page', checkMiddleWare, function(req, res, next) {
    res.render('./admin/' + req.params.page, {
        myinfo: req.session,
        board_id: req.params.page,
    });
});

// GET 는 query 로 받는다!!!
router.get('/delete_menu', checkMiddleWare, function(req, res, next) {
    var idx = req.query.IDX;
    db.query('DELETE FROM SAVE_MENU_tbl WHERE IDX = ?', idx, function(err, rows, fields) {
        if (!err) {
            res.redirect('/admin');
        } else {
            console.log('err', err);
            res.send(err);
        }
    });
});


module.exports = router;
