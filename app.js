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

module.exports = app;
