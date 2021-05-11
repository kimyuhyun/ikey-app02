process.env.NODE_ENV = (process.env.NODE_ENV && (process.env.NODE_ENV).trim().toLowerCase() == 'production') ? 'production' : 'development';

var createError = require('http-errors');
var express = require('express');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var path = require('path');
var cookieParser = require('cookie-parser');
var requestIp = require('request-ip');
var logger = require('morgan');
var db = require('./db');

var indexRouter = require('./routes/index');
var adminRouter = require('./routes/admin');
var crudRouter = require('./routes/crud');
var analyzerRouter = require('./routes/analyzer');
var apiRouter = require('./routes/api');
var pharmacyRouter = require('./routes/pharmacy');
var doctorRouter = require('./routes/doctor');


var app = express();


app.use(requestIp.mw());
app.use(session({
    key: 'sid',
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    store: new MySQLStore(db.connAccount),
    cookie: {
        maxAge: 24000 * 60 * 60 // 쿠키 유효기간 24시간
    }
}));

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/data', express.static('data'));

app.use('/', indexRouter);
app.use('/admin', adminRouter);
app.use('/crud', crudRouter);
app.use('/analyzer', analyzerRouter);
app.use('/api', apiRouter);
app.use('/pharmacy', pharmacyRouter);
app.use('/doctor', doctorRouter);



// catch 404 and forward to error handler
app.use(function(req, res, next) {
    // res.status(404).send('페이지가 없습니다.');
    // res.status(500).send('500 에러');
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    console.log('ENV', process.env.NODE_ENV);
    console.log('ENV', req.app.get('env'));

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    app.locals.hostname = 'http://' + process.env.HOST_NAME;


    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

/*** Socket.IO 추가 ***/
// 소켓 서버를 생성한다.
app.io = require('socket.io')({
    allowEIO3: true,
});

app.io.on('connection', function(socket) {
    // console.log('Socket ID : ' + socket.id + ', Connect');
    socket.on('clientRoom', function(data) {
        console.log('Client Room', data);
        socket.join(data);
	});

    socket.on('clientMessage', async function(data) {
        console.log('Client Message', data);

        //lastMsg 업데이트
        var lastMsg = "";
        if (data.MSG_TYPE == 1) {
            lastMsg = '이미지';
        } else if (data.MSG_TYPE == 2) {
            lastMsg = '진료비 청구';
        } else {
            lastMsg = data.MSG;
        }

        await new Promise(function(resolve, reject) {
            var sql = `UPDATE ROOM_tbl SET
                        LAST_MSG = ?,
                        WDATE = ?
                        WHERE ROOM_KEY = ?`;
            db.query(sql, [lastMsg, data.WDATE, data.ROOM_KEY], function(err, rows, fields) {
                if (!err) {
                    resolve(1);
                } else {
                    console.log(err);
                }
            });
        }).then();

        //DB에 저장 해준다!!
        await new Promise(function(resolve, reject) {
            var sql = ""
            var records = [];
            for (key in data) {
                if (data[key] != 'null') {
                    sql += key + '= ?, ';
                }
                records.push(data[key]);
            }
            sql = "INSERT INTO TALK_tbl SET " + sql + " CDATE = NOW() ";
            db.query(sql, records, function(err, rows, fields) {
                // console.log(rows);
                if (!err) {
                    resolve(1);
                } else {
                    console.log(err);
                }
            });
        }).then();



        socket.to(data.ROOM_KEY).emit('serverMessage', data);
	});

});


module.exports = app;
