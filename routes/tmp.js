var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var db = require('../db');

var axios = require('axios');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();


/*
    :ID
    req.params

    get:
    req.query

    post:
    req.body
*/

router.get('/hos', function(req, res, next) {
    var page = req.query.page;
    var config = {
        method: 'get',
        url: 'http://apis.data.go.kr/B551182/hospInfoService/getHospBasisList?serviceKey=7dUTyA8f4KILB2%2BFDrwdkFzu%2BXlmbl7xXK2VNcHOpC%2B6kaBcACZt4athD9u6KyvmWzlCSrAe5kCz7yyX7m2JIA%3D%3D&pageNo='+page+'&numOfRows=10000',
        headers: {
            'Cookie': 'WMONID=DwUhF9L0kMU'
        }
    };


    var url = "location.href='/tmp/hos?page=" + eval(parseInt(page) + 1) + "'";

    res.send(`
        <button style="width: 500px; height: 500px;" onclick="`+url+`">Next ` + eval(parseInt(page) + 1) + `</button>
    `);


    axios(config).then(async function (response) {
        var jsonStr = JSON.stringify(response.data);
        var json = JSON.parse(jsonStr);
        var array = json.response.body.items.item;

        var sql = '';
        // var sql2 = '';
        var i = 0;
        for (obj of array) {
            if (obj.yadmNm != null && obj.addr != null && obj.telno != null && obj.YPos != null && obj.XPos != null) {
                var arr = [];
                arr.push(obj.yadmNm==null?'':obj.yadmNm);
                arr.push(obj.addr==null?'':obj.addr);
                arr.push(obj.telno==null?'':obj.telno);
                arr.push(obj.estbDd==null?'':obj.estbDd);
                arr.push(obj.YPos==null?0:obj.YPos);
                arr.push(obj.XPos==null?0:obj.XPos);

                arr.push(obj.sgguCdNm==null?'':obj.sgguCdNm);
                arr.push(obj.hospUrl==null?'':obj.hospUrl);
                arr.push(obj.clCdNm==null?'':obj.clCdNm);
                arr.push(obj.drTotCnt==null?'':obj.drTotCnt);
                arr.push(obj.gdrCnt==null?'':obj.gdrCnt);
                arr.push(obj.intnCnt==null?'':obj.intnCnt);
                arr.push(obj.resdntCnt==null?'':obj.resdntCnt);
                arr.push(obj.sdrCnt==null?'':obj.sdrCnt);
                //

                // i++;
                //
                // sql2 = `INSERT INTO HOSPITAL_tbl SET
                //         NAME1= '`+arr[0]+`',
                //         ADDR= '`+arr[1]+`'
                //         TEL = '`+arr[2]+`'
                //         CDATE = '`+arr[3]+`'
                //         LAT = `+arr[4]+`,
                //         LNG = `+arr[5]+`,
                //         SSG = '`+arr[6]+`'
                //         WEBSITE = '`+arr[7]+`',
                //         GRADE = '`+arr[8]+`',
                //         DR_CNT = `+arr[9]+`,
                //         GDR_CNT = `+arr[10]+`,
                //         INTN_CNT = `+arr[11]+`,
                //         RESDNT_CNT = `+arr[12]+`,
                //         SDR_CNT = `+arr[13]+`,
                //         WDATE = NOW(),
                //         LDATE = NOW(); <br>`;


                await new Promise(function(resolve, reject) {
                    sql = `INSERT INTO HOSPITAL_tbl SET
                            NAME1= ?,
                            ADDR= ?,
                            TEL = ?,
                            CDATE = ?,
                            LAT = ?,
                            LNG = ?,
                            SSG = ?,
                            WEBSITE = ?,
                            GRADE = ?,
                            DR_CNT = ?,
                            GDR_CNT = ?,
                            INTN_CNT = ?,
                            RESDNT_CNT = ?,
                            SDR_CNT = ?,
                            WDATE = NOW(),
                            LDATE = NOW() `;

                    setTimeout(function() {
                        try {
                            db.query(sql, arr);
                        } catch (e) {
                            console.log(e);
                        } finally {
                            i++;
                            resolve(i);
                        }
                    }, 10);
                }).then(function(data) {
                    console.log(data, array.length);
                });
            }
        }
    }).catch(function (error) {
        console.log(error);
    });


});

router.get('/check', async function(req, res, next) {
    var arr = [];
    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            GROUP_CONCAT(IDX) as IDXS,
            GROUP_CONCAT(NAME1),
            TEL,
            COUNT(*) as CNT
            FROM HOSPITAL_tbl
            GROUP BY TEL
            having CNT > 1
        `;
        db.query(sql, function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);

            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr = data;
    });

    res.send(""+arr.length);
    return;

    var tmp = [];
    var sql = '';
    for (obj of arr) {
        tmp = obj.IDXS.split(',');
        for (var i=1; i<tmp.length; i++) {
            await new Promise(function(resolve, reject) {
                sql = "DELETE FROM HOSPITAL_tbl WHERE IDX = " + tmp[i];
                db.query(sql, function(err, rows, fields) {
                    if (!err) {
                        resolve(sql);
                    } else {
                        resolve(err);
                    }
                });
            }).then(function(data) {
                console.log(data);
            });
        }
    }

});



function parserXml(xml) {
    // console.log('xml', xml);

    parser.parseString(xml, function(err, result) {
        var jsonStr = JSON.stringify(result);
        var json = JSON.parse(jsonStr);
        var array = json.response.body[0].items;

        // var name1 = '', tel='', addr='', lat=0, lng=0, estbDd='',

        var sql = '';
        var i = 0;
        for (obj of array[0].item) {
            // console.log(obj);
            var arr = [];
            arr.push(obj.yadmNm==null?'':obj.yadmNm[0]);
            arr.push(obj.addr==null?'':obj.addr[0]);
            arr.push(obj.telno==null?'':obj.telno[0]);
            arr.push(obj.estbDd==null?'':obj.estbDd[0]);
            arr.push(obj.YPos==null?'':obj.YPos[0]);
            arr.push(obj.XPos==null?'':obj.XPos[0]);
            //
            // console.log(arr);

            sql = `INSERT INTO PHARMACY_tbl SET
                    NAME1= ?,
                    ADDR= ?,
                    TEL = ?,
                    CDATE = ?,
                    LAT = ?,
                    LNG = ? `;
            // db.query(sql, arr, function(err, rows, fields) {
            //     if (err) {
            //         console.log(err);
            //     } else {
            //         i++;
            //         console.log(i);
            //     }
            // });
        }
    });
}

router.get('/place', async function(req, res, next) {
    var config = {
        method: 'get',
        url: 'https://place.map.kakao.com/m/628261614?service=search_m',
        headers: {
            'Cookie': 'WMONID=DwUhF9L0kMU'
        }
    };
    axios(config).then(async function (res) {
        console.log(res);
    }).catch(function(err) {
        console.log(err);
    });

    res.send('api');
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

    res.send('api');
});
module.exports = router;
