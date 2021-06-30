const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const fs = require('fs');
const db = require('../db');
const multer = require('multer');
const uniqid = require('uniqid');
const utils = require('../Utils');
const moment = require('moment');


var upload = multer({
    storage: multer.diskStorage({
        destination: function(req, file, cb) {
            var date = new Date();
            var month = eval(date.getMonth() + 1);
            if (eval(date.getMonth() + 1) < 10) {
                month = "0" + eval(date.getMonth() + 1);
            }
            var dir = 'data/' + date.getFullYear() + "" + month;
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            cb(null, dir);
        },
        filename: function(req, file, cb) {
            var tmp = file.originalname.split('.');
            var mimeType = tmp[tmp.length - 1];
            if ('php|phtm|htm|cgi|pl|exe|jsp|asp|inc'.includes(mimeType)) {
                mimeType = mimeType + "x";
            }
            cb(null, uniqid(file.filename) + '.' + mimeType);
        }
    })
});

async function checkMiddleWare(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var rows;
    await new Promise(function(resolve, reject) {
        var sql = `SELECT VISIT FROM ANALYZER_tbl WHERE IP = ? ORDER BY IDX DESC LIMIT 0, 1`;
        db.query(sql, ip, function(err, rows, fields) {
            if (!err) {
                resolve(rows);
            }
        });
    }).then(function(data){
        rows = data;
    });

    await new Promise(function(resolve, reject) {
        var sql = `INSERT INTO ANALYZER_tbl SET IP = ?, AGENT = ?, VISIT = ?, WDATE = NOW()`;
        if (rows.length > 0) {
            var cnt = rows[0].VISIT + 1;
            db.query(sql, [ip, req.headers['user-agent'], cnt], function(err, rows, fields) {
                resolve(cnt);
            });
        } else {
            db.query(sql, [ip, req.headers['user-agent'], 1], function(err, rows, fields) {
                resolve(1);
            });
        }
    }).then(function(data) {
        console.log(data);
    });

    //현재 접속자 파일 생성
    var memo = new Date().getTime() + "|S|" + req.baseUrl + req.path;
    fs.writeFile('./liveuser/'+ip, memo, function(err) {
        console.log(memo);
    });
    //
    next();
}

router.get('/list', checkMiddleWare, async function(req, res, next) {
    const boardId = req.query.BOARD_ID;
    const id = req.query.ID;
    var page = req.query.PAGE;

    page = page * 20;

    var arr = [];
    arr.push(boardId);

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.IDX,
            A.BOARD_ID,
            A.ID,
            A.TITLE,
            A.NAME1,
            A.FILENAME0,
            A.SEE,
            A.WDATE,
            A.COMMENT,
            (SELECT COUNT(*) FROM BOARD_tbl WHERE PARENT_IDX = A.IDX AND STEP = 2) as REPLY_CNT,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX) as LIKE1,
            (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.ID) as USER_THUMB
            FROM
            BOARD_tbl as A
            WHERE STEP = 1
            AND BOARD_ID = ? `;
        if (id != '') {
            sql += ` AND ID = ? `;
            arr.push(id);
        }
        sql += ` ORDER BY IDX DESC `;
        sql += ` LIMIT ` + page + `, 20 `;



        db.query(sql, arr, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                resolve(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });

});


router.get('/list/:IDX/:ID', checkMiddleWare, async function(req, res, next) {
    const idx = req.params.IDX;
    const id = req.params.ID;

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.*,
            (SELECT COUNT(*) FROM BOARD_tbl WHERE PARENT_IDX = A.IDX AND STEP = 2) as REPLY_CNT,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX) as LIKE1,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX AND ID = ?) as IS_LIKE1,
            (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.ID) as USER_THUMB
            FROM
            BOARD_tbl as A
            WHERE IDX = ?
            ORDER BY IDX DESC
        `;
        db.query(sql, [id, idx], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                resolve(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });

    //조회수 업데이트
    db.query("UPDATE BOARD_tbl SET SEE = SEE + 1 WHERE IDX = ?", idx);
    //

});

router.get('/reply/:IDX/:ID/:IS_LIKE1_SORT', checkMiddleWare, async function(req, res, next) {
    const idx = req.params.IDX;
    const id = req.params.ID;
    const isLike1Sort1 = req.params.IS_LIKE1_SORT;

    var arr = [];
    var tmpArr = [];

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.*,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX) as LIKE1_CNT,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX AND ID = ?) as IS_LIKE1,
            (SELECT COUNT(*) FROM BOARD_tbl WHERE PARENT_IDX = A.IDX AND STEP = 3) as REPLY_CNT,
            (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.ID) as USER_THUMB
            FROM BOARD_tbl as A
            WHERE A.STEP = 2
            AND A.PARENT_IDX = ? `;
        if (isLike1Sort1 == 1) {
            sql += `ORDER BY LIKE1_CNT DESC`;
        } else {
            sql += `ORDER BY A.IDX ASC`;
        }
        db.query(sql, [id, idx], function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
                resolve(err);
            }
        });
    }).then(function(data) {
        tmpArr = data;
    });

    for (obj of tmpArr) {
        arr.push(obj);

        await new Promise(function(resolve, reject) {
            var sql = `
                SELECT
                A.*,
                (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX) as LIKE1_CNT,
                (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX AND ID = ?) as IS_LIKE1,
                (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.ID) as USER_THUMB,
                0 as REPLY_CNT
                FROM BOARD_tbl as A
                WHERE A.STEP = 3
                AND A.PARENT_IDX = ?
                ORDER BY A.IDX ASC
            `;
            db.query(sql, [id, obj.IDX], function(err, rows, fields) {
                // console.log(rows);
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                    resolve(err);
                }
            });
        }).then(function(data) {
            for (obj2 of data) {
                arr.push(obj2);
            }
        });
    }

    res.send(arr);
});

router.get('/re_reply/:IDX/:ID', checkMiddleWare, async function(req, res, next) {
    const idx = req.params.IDX;
    const id = req.params.ID;

    var arr = [];
    var tmpArr = [];

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.*,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX) as LIKE1_CNT,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX AND ID = ?) as IS_LIKE1,
            (SELECT COUNT(*) FROM BOARD_tbl WHERE PARENT_IDX = A.IDX AND STEP = 3) as REPLY_CNT,
            (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.ID) as USER_THUMB
            FROM BOARD_tbl as A
            WHERE A.STEP = 2
            AND A.IDX = ?
            ORDER BY A.IDX ASC
        `;
        db.query(sql, [id, idx], function(err, rows, fields) {
            // console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        tmpArr = data;
    });

    for (obj of tmpArr) {
        arr.push(obj);

        await new Promise(function(resolve, reject) {
            var sql = `
                SELECT
                A.*,
                (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX) as LIKE1_CNT,
                (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX AND ID = ?) as IS_LIKE1,
                (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.ID) as USER_THUMB,
                0 as REPLY_CNT
                FROM BOARD_tbl as A
                WHERE A.STEP = 3
                AND A.PARENT_IDX = ?
                ORDER BY A.IDX ASC
            `;
            db.query(sql, [id, obj.IDX], function(err, rows, fields) {
                // console.log(rows);
                if (!err) {
                    resolve(rows);
                } else {
                    console.log(err);
                    resolve(err);
                }
            });
        }).then(function(data) {
            for (obj2 of data) {
                arr.push(obj2);
            }
        });
    }
    res.send(arr);
});

router.get('/set_like1/:IDX/:ID', checkMiddleWare, async function(req, res, next) {
    const idx = req.params.IDX;
    const id = req.params.ID;
    var cnt = 0;
    var arr = {};

    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT FROM BOARD_LIKE_tbl WHERE BOARD_IDX = ? AND ID = ?`;
        db.query(sql, [idx, id], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        cnt = data.CNT;
    });

    var sql = '';
    if (cnt == 0) {
        sql = `INSERT INTO BOARD_LIKE_tbl SET BOARD_IDX = ?, ID = ?`;
    } else {
        sql = `DELETE FROM BOARD_LIKE_tbl WHERE BOARD_IDX = ? AND ID = ?`;
    }

    await new Promise(function(resolve, reject) {
        db.query(sql, [idx, id], function(err, rows, fields) {
            if (!err) {
                sql = `SELECT COUNT(*) as CNT FROM BOARD_LIKE_tbl WHERE BOARD_IDX = ?`;
                db.query(sql, idx, function(err, rows, fields) {
                    if (!err) {
                        resolve(rows[0]);
                    } else {
                        console.log(err);
                    }
                });
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr.cnt = data.CNT;
    });

    await new Promise(function(resolve, reject) {
        var sql = `SELECT COUNT(*) as CNT FROM BOARD_LIKE_tbl WHERE BOARD_IDX = ? AND ID = ?`;
        db.query(sql, [idx, id], function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        arr.is_me = data.CNT;
    });

    res.send(arr);
});


router.get('/cscenter/:ID', checkMiddleWare, async function(req, res, next) {
    const userId = req.params.ID;

    await new Promise(function(resolve, reject) {
        var sql = `
            SELECT
            A.*,
            (SELECT COUNT(*) FROM BOARD_tbl WHERE PARENT_IDX = A.IDX AND STEP = 2) as REPLY_CNT,
            (SELECT COUNT(*) FROM BOARD_LIKE_tbl WHERE BOARD_IDX = A.IDX) as LIKE1,
            (SELECT FILENAME0 FROM MEMB_tbl WHERE ID = A.ID) as USER_THUMB
            FROM
            BOARD_tbl as A
            WHERE STEP = 1
            AND BOARD_ID = 'cscenter'
            AND ID = ?
            ORDER BY IDX DESC
        `;
        db.query(sql, userId, function(err, rows, fields) {
            console.log(rows);
            if (!err) {
                resolve(rows);
            } else {
                console.log(err);
            }
        });
    }).then(function(data) {
        res.send(data);
    });

});


router.get('/', checkMiddleWare, async function(req, res, next) {

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
