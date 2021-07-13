process.env.NODE_ENV = (process.env.NODE_ENV && (process.env.NODE_ENV).trim().toLowerCase() == 'production') ? 'production' : 'development';

const createError = require('http-errors');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const db = require('./db');
const request = require('request');

const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
const crudRouter = require('./routes/crud');
const analyzerRouter = require('./routes/analyzer');
const apiRouter = require('./routes/api');
const pharmacyRouter = require('./routes/pharmacy');
const doctorRouter = require('./routes/doctor');
const memberRouter = require('./routes/member');
const jinlyoRouter = require('./routes/jinlyo');
const rcpRouter = require('./routes/rcp');
const pushRouter = require('./routes/push');
const tmpRouter = require('./routes/tmp');
const articleRouter = require('./routes/article');
const termsRouter = require('./routes/terms');
const paymentRouter = require('./routes/payment');
const certRouter = require('./routes/cert');
const calendarRouter = require('./routes/calendar');
const resvRouter = require('./routes/resv');


const app = express();

app.use(session({
    key: 'sid',
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    store: new MySQLStore(db.connAccount),
    cookie: {
        maxAge: 24000 * 60 * 60 // 쿠키 유효기간 24시간
        // maxAge: 1000 * 60 * 60 // 쿠키 유효기간 1시간
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
app.use('/member', memberRouter);
app.use('/jinlyo', jinlyoRouter);
app.use('/rcp', rcpRouter);
app.use('/push', pushRouter);
app.use('/tmp', tmpRouter);
app.use('/article', articleRouter);
app.use('/terms', termsRouter);
app.use('/payment', paymentRouter);
app.use('/cert', certRouter);
app.use('/calendar', calendarRouter);
app.use('/resv', resvRouter);



// catch 404 and forward to error handler
app.use(function(req, res, next) {
    // res.status(404).send('페이지가 없습니다.');
    // res.status(500).send('500 에러');
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    console.log('ENV', process.env.NODE_ENV);

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    app.locals.hostname = process.env.HOST_NAME;
    app.locals.APP_NAME = '진료상담';

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

//catch unCaughtException
process.on("uncaughtException", function(err) {
    console.error("uncaughtException (Node is alive)", err);

});



/*** Socket.IO 추가 ***/
// 소켓 서버를 생성한다.
app.io = require('socket.io')(9000, {
    allowEIO3: true,
    upgrade: false,
    // transports: ['websocket'],
});

app.io.on('connection', function(socket) {
    socket.on('clientRoom', function(data) {
        console.log('clientRoom', data);
        socket.join(data);
	});

    socket.on('disconnect', function() {
        console.log('*************disconnected from ', socket.id);
    });

    socket.on('clientMessage', async function(data) {
        console.log(socket.disconnected);
        // socket.to(data.ROOM_KEY).emit('disconnectMessage',

        //푸시보낼 데이터 정리
        const roomKey = data.ROOM_KEY;
        const roomName = data.ROOM_NAME;
        delete data.ROOM_NAME;

        const doctorId = data.DOCTOR_ID;
        delete data.DOCTOR_ID;

        const userId = data.USER_ID;
        delete data.USER_ID;

        const receiver = data.RECEIVER;
        delete data.RECEIVER;

        const sender_name = data.WRITER_NAME;
        //

        // console.log('clientMessage', data);
        socket.to(data.ROOM_KEY).emit('serverMessage', data);

        //lastMsg 업데이트
        var lastMsg = "";
        if (data.MSG_TYPE == 1) {
            lastMsg = '사진';
        } else {
            lastMsg = data.MSG;
        }

        await new Promise(function(resolve, reject) {
            const sql = `UPDATE ROOM_tbl SET
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
        //

        //no read 테이블에 넣어주기
        await new Promise(function(resolve, reject) {
            const sql = "INSERT INTO TALK_NO_READ_tbl SET ROOM_KEY = ?, ID = ? ";
            db.query(sql, [roomKey, receiver], function(err, rows, fields) {
                if (!err) {
                    resolve(1);
                } else {
                    console.log(err);
                }
            });
        }).then();
        //



        //푸시도 날려준다!!!
        var fcmArr = [];
        await new Promise(function(resolve, reject) {
            const sql = "SELECT FCM, IS_ALARM FROM MEMB_tbl WHERE ID = ?"
            db.query(sql, receiver, function(err, rows, fields) {
                // console.log(rows[0]);
                if (!err) {
                    if (rows[0]) {
                        if (rows[0].IS_ALARM == 1) {
                            resolve(rows[0].FCM);
                        } else {
                            console.log('IS_ALARM: 0');
                        }
                    } else {
                        console.log('IS_ALARM: 0');
                    }
                } else {
                    console.log(err);
                }
            });
        }).then(function(data) {
            fcmArr.push(data);
        });

        //사진 url 처리!!
        if (data.MSG_TYPE == 1) {
            data.MSG = '사진';
        }
        //

        const fields = {};
        fields['notification'] = {};
        fields['data'] = {};

        fields['registration_ids'] = fcmArr;
        fields['notification']['title'] = sender_name;
        fields['notification']['body'] = data.MSG;
        fields['notification']['click_action'] = 'chating_message'; //액티비티 다이렉트 호출
        fields['priority'] = 'high';
        fields['data']['menu_flag'] = 'talk';               //키값은 대문자 안먹음..
        fields['data']['room_key'] = roomKey;               //키값은 대문자 안먹음..


        const options = {
            'method': 'POST',
            'url': 'https://fcm.googleapis.com/fcm/send',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'key=' + process.env.FCM_SERVER_KEY
            },
            body: JSON.stringify(fields)
        };
        request(options, function (error, response) {
            // console.log(error);
            // console.log(response.body);
        });
        //

	});

});


module.exports = app;
