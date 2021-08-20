var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var db = require('../db');
var menus = require('../menu');
var utils = require('../Utils');
var moment = require('moment');
require('moment-timezone');

//메뉴를 전역변수에 넣어준다!
global.MENUS = menus;
global.SAVE_MENUS;
global.CURRENT_URL;
//

function checkMiddleWare(req, res, next) {
    if (process.env.NODE_ENV != 'development') {
        if (req.session.ID == null) {
            res.redirect('/admin/login');
            return;
        }
    }

    CURRENT_URL = req.baseUrl + req.path;

    utils.setSaveMenu(req).then(function(data) {
        SAVE_MENUS = data;
        next();
    });
}

router.get('/graph1', checkMiddleWare, async function(req, res, next) {
    var gap = 0;
    var arr = new Array();

    while (gap <= 6) {
        var date = moment().subtract(gap, 'd').format('YYYY-MM-DD');
        var hangleDate = moment().subtract(gap, 'd').format('YYYY년MM월DD일');
        var total = 0;

        //총방문자 구하기
        var sql = `SELECT COUNT(DISTINCT IP) AS CNT FROM ANALYZER_tbl WHERE LEFT(WDATE, 10) = '` + date + `'`;
        await new Promise(function(resolve, reject) {
            db.query(sql, function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0].CNT);
                } else {
                    resolve(0);
                }
            });
        }).then(function(data) {
            total = data;
        });
        //

        //신규방문자 구하기
        sql = `SELECT COUNT(DISTINCT IP) AS CNT FROM ANALYZER_tbl WHERE VISIT = 1 AND LEFT(WDATE, 10) = '` + date + `'`;
        await new Promise(function(resolve, reject) {
            db.query(sql, function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0].CNT);
                } else {
                    resolve(0);
                }
            });
        }).then(function(data) {
            arr.push({
                'date': hangleDate,
                'total': total,
                'new': data,
                're': total - data,
            });
            gap++;
        });
        //
    }
    res.render('./admin/graph1', {
        rows: arr.reverse()
    });
});

router.get('/graph2', checkMiddleWare, async function(req, res, next) {
    var gap = 0;
    var arr = new Array();

    while (gap <= 6) {
        var date = moment().subtract(gap, 'd').format('YYYY-MM-DD');
        var hangleDate = moment().subtract(gap, 'd').format('YYYY년MM월DD일');
        var total = 0;

        //트래픽 구하기
        var sql = `SELECT COUNT(IP) AS CNT FROM ANALYZER_tbl WHERE LEFT(WDATE, 10) = '` + date + `'`;
        await new Promise(function(resolve, reject) {
            db.query(sql, function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0].CNT);
                } else {
                    resolve(0);
                }
            });
        }).then(function(data) {
            arr.push({
                'date': hangleDate,
                'traffic': data,
            });
            gap++;
        });
        //
    }
    res.render('./admin/graph2', {
        rows: arr.reverse()
    });
});

router.get('/graph3', checkMiddleWare, async function(req, res, next) {
    var gap = 0;
    var arr = new Array();

    var today = moment().subtract(0, 'd').format('YYYY-MM-DD');
    var yesterday = moment().subtract(1, 'd').format('YYYY-MM-DD');
    var weekago = moment().subtract(6, 'd').format('YYYY-MM-DD');

    var time = "";
    var data1 = 0;
    var data2 = 0;
    var data3 = 0;
    for (var i = 0; i < 24; i++) {
        if (i < 10) {
            time = "0" + i;
        } else {
            time = i;
        }

        //오늘 시간대별 트래픽 구하기
        var sql = `SELECT COUNT(IP) AS CNT FROM ANALYZER_tbl WHERE LEFT(WDATE, 10) = '` + today + `' AND SUBSTR(WDATE, 12, 2) = '` + time + `'`;
        await new Promise(function(resolve, reject) {
            db.query(sql, function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0].CNT);
                } else {
                    resolve(0);
                }
            });
        }).then(function(data) {
            data1 = data;
        });
        //

        //어제 시간대별 트래픽 구하기
        var sql = `SELECT COUNT(IP) AS CNT FROM ANALYZER_tbl WHERE LEFT(WDATE, 10) = '` + yesterday + `' AND SUBSTR(WDATE, 12, 2) = '` + time + `'`;
        await new Promise(function(resolve, reject) {
            db.query(sql, function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0].CNT);
                } else {
                    resolve(0);
                }
            });
        }).then(function(data) {
            console.log(data);
            data2 = data;
        });
        //

        //일주일전 시간대별 트래픽 구하기
        var sql = `SELECT COUNT(IP) AS CNT FROM ANALYZER_tbl WHERE LEFT(WDATE, 10) = '` + weekago + `' AND SUBSTR(WDATE, 12, 2) = '` + time + `'`;
        await new Promise(function(resolve, reject) {
            db.query(sql, function(err, rows, fields) {
                if (!err) {
                    resolve(rows[0].CNT);
                } else {
                    resolve(0);
                }
            });
        }).then(function(data) {
            console.log(data);
            data3 = data;
        });
        //

        arr.push({
            'time': time,
            'today': data1,
            'yesterday': data2,
            'weekago': data3,
        });
    }

    res.render('./admin/graph3', {
        rows: arr
    });
});

router.get('/liveuser', checkMiddleWare, async function(req, res, next) {
    res.render('./admin/liveuser');
});

router.post('/liveuser', checkMiddleWare, function(req, res, next) {
    var arr = new Array();

    fs.readdir('./liveuser', async function(err, filelist) {
        for (file of filelist) {
            await new Promise(function(resolve, reject) {
                fs.readFile('./liveuser/' + file, 'utf8', function(err, data) {
                    resolve(data);
                });
            }).then(function(data) {
                try {
                    if (file != 'dummy') {
                        await new Promise(function(resolve, reject) {
                            var tmp = data.split('|S|');
                            console.log(data);
                            moment.tz.setDefault("Asia/Seoul");
                            var connTime = moment.unix(tmp[0] / 1000).format('YYYY-MM-DD HH:mm');
                            var minDiff = moment.duration(moment(new Date()).diff(moment(connTime))).asMinutes();
                            if (minDiff > 4) {
                                console.log(minDiff);
                                fs.unlink('./liveuser/' + file, function(err) {
                                    console.log(err);
                                    resolve();
                                });
                            } else {
                                resolve();
                            }
                        }).then();

                        arr.push({
                            'id': file,
                            'url': tmp[1],
                            'date': connTime,
                        });
                    }
                    console.log(arr);
                } catch (e) {
                    console.log(e);
                }

            });
        }
        var result = {
            currentTime: moment().format('YYYY-MM-DD HH:mm'),
            list: arr,
        }
        res.send(result);
    });
});


module.exports = router;
