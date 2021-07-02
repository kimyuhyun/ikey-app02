var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var db = require('../db');


router.get('/around', async function(req, res, next) {
    var myLat = req.query.my_lat;
    var myLng = req.query.my_lng;

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.*,
            (6371*acos(cos(radians(` + myLat + `))*cos(radians(LAT))*cos(radians(LNG)-radians(` + myLng + `))+sin(radians(` + myLat + `))*sin(radians(LAT)))) AS DISTANCE
            FROM PHARMACY_tbl as A
            ORDER BY DISTANCE ASC LIMIT 0, 10 `;
        db.query(sql, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function(data){
        res.send(data);
    });
});

router.get('/list', async function(req, res, next) {
    var myLat = req.query.my_lat;
    var myLng = req.query.my_lng;
    var lat1 = req.query.lat1;
    var lat2 = req.query.lat2;
    var lng1 = req.query.lng1;
    var lng2 = req.query.lng2;

    await new Promise(function(resolve, reject) {
        // var sql = `
        //     SELECT
        //     A.*,
        //     (6371*acos(cos(radians(` + myLat + `))*cos(radians(LAT))*cos(radians(LNG)-radians(` + myLng + `))+sin(radians(` + myLat + `))*sin(radians(LAT)))) AS DISTANCE
        //     FROM PHARMACY_tbl as A
        //     WHERE LAT >= ` + lat1 + ` AND LNG >= ` + lng1 + ` AND LAT <= ` + lat2 + ` AND LNG <= ` + lng2 + `
        //     ORDER BY DISTANCE ASC
        // `;
        var sql = `
            SELECT * FROM (
                SELECT
                A.IDX,
                A.NAME1,
                A.ADDR,
                A.TEL,
                A.LAT,
                A.LNG,
                (6371*acos(cos(radians(` + myLat + `))*cos(radians(LAT))*cos(radians(LNG)-radians(` + myLng + `))+sin(radians(` + myLat + `))*sin(radians(LAT)))) AS DISTANCE
                FROM PHARMACY_tbl as A) as Z
            WHERE Z.DISTANCE <= 2
            ORDER BY Z.DISTANCE ASC `;
        console.log(sql);
        db.query(sql, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function(data){
        res.send(data);
    });
});


router.get('/list/:IDX', async function(req, res, next) {
    var idx = req.params.IDX;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT * FROM PHARMACY_tbl WHERE IDX = ?`;
        db.query(sql, idx, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });
});

router.get('/hlist', async function(req, res, next) {
    var myLat = req.query.my_lat;
    var myLng = req.query.my_lng;
    var lat1 = req.query.lat1;
    var lat2 = req.query.lat2;
    var lng1 = req.query.lng1;
    var lng2 = req.query.lng2;

    await new Promise(function(resolve, reject) {
        // var sql = `
        //     SELECT
        //     A.*,
        //     (6371*acos(cos(radians(` + myLat + `))*cos(radians(LAT))*cos(radians(LNG)-radians(` + myLng + `))+sin(radians(` + myLat + `))*sin(radians(LAT)))) AS DISTANCE
        //     FROM PHARMACY_tbl as A
        //     WHERE LAT >= ` + lat1 + ` AND LNG >= ` + lng1 + ` AND LAT <= ` + lat2 + ` AND LNG <= ` + lng2 + `
        //     ORDER BY DISTANCE ASC
        // `;
        var sql = `
            SELECT * FROM (
                SELECT
                A.IDX,
                A.NAME1,
                A.ADDR,
                A.GRADE,
                A.TEL,
                A.LAT,
                A.LNG,
                (6371*acos(cos(radians(` + myLat + `))*cos(radians(LAT))*cos(radians(LNG)-radians(` + myLng + `))+sin(radians(` + myLat + `))*sin(radians(LAT)))) AS DISTANCE
                FROM HOSPITAL_tbl as A) as Z
            WHERE Z.DISTANCE <= 2
            ORDER BY Z.DISTANCE ASC `;
        console.log(sql);
        db.query(sql, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function(data){
        res.send(data);
    });
});


router.get('/get_hospital', async function(req, res, next) {
    const q = '%' + req.query.q + '%';

    await new Promise(function(resolve, reject) {
        const sql = `
            SELECT
            IDX,
            NAME1,
            ADDR,
            GRADE,
            TEL
            FROM HOSPITAL_tbl
            WHERE (NAME1 LIKE ? OR ADDR LIKE ?)
            ORDER BY NAME1 ASC `;
        db.query(sql, [q, q], function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function(data){
        res.send(data);
    });
});


router.get('/hlist/:IDX', async function(req, res, next) {
    var idx = req.params.IDX;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT * FROM HOSPITAL_tbl WHERE IDX = ?`;
        db.query(sql, idx, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });
});

router.get('/hospital_search', async function(req, res, next) {
    var q = '%' + req.query.q + '%';
    await new Promise(function(resolve, reject) {
        var sql = `SELECT IDX, NAME1, ADDR, TEL FROM HOSPITAL_tbl WHERE NAME1 LIKE ?`;
        db.query(sql, q, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                res.send(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });
});




module.exports = router;
