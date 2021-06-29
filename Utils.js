const sharp = require('sharp');
const fs = require('fs');
const db = require('./db');
const requestIp = require('request-ip');
const axios = require('axios');

class Utils {
    setSaveMenu(req) {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (req.query.NAME1 != null) {
                db.query('SELECT * FROM SAVE_MENU_tbl WHERE LINK = ? AND ID = ?', [CURRENT_URL, req.session.ID], function(err, rows, fields) {
                    if (!err) {
                        if (rows.length == 0) {
                            var sql = `
                                INSERT INTO SAVE_MENU_tbl SET
                                ID = ?,
                                NAME1 = ?,
                                LINK = ? `;
                            console.log(sql, [req.session.ID, req.query.NAME1, CURRENT_URL]);
                            db.query(sql, [req.session.ID, req.query.NAME1, CURRENT_URL], function(err, rows, fields) {
                                self.getSaveMenu(req).then(function(data) {
                                    resolve(data);
                                });
                            });
                        } else {
                            self.getSaveMenu(req).then(function(data) {
                                resolve(data);
                            });
                        }
                    } else {
                        console.log('err', err);
                        res.send(err);
                    }
                });
            } else {
                self.getSaveMenu(req).then(function(data) {
                    resolve(data);
                });
            }
        });
    }

    getSaveMenu(req) {
        return new Promise(function(resolve, reject) {
            console.log(req.session);
            if (req.session.ID != null) {
                db.query("SELECT * FROM SAVE_MENU_tbl WHERE ID = ?", req.session.ID, function(err, rows, fields) {
                    if (!err) {
                        resolve(rows);
                    } else {
                        console.log('err', err);
                        res.send(err);
                    }
                });
            } else {
                resolve(0);
            }
        });
    }

    setResize(file) {
        var self = this;
        return new Promise(function(resolve, reject) {
            // console.log(file);
            var destWidth = 800;
            var tmp = file.originalname.split('.');
            var mimeType = tmp[tmp.length - 1];
            tmp = file.filename.split('.');
            var filename = tmp[0];
            var resizeFile = file.destination + '/' + filename + '_resize.' + mimeType;

            if ('jpg|jpeg|png|gif'.includes(mimeType)) {
                var img = new sharp(file.path);
                img.metadata().then(function(meta) {
                    if (meta.width <= destWidth) {
                        resolve(file.path);
                    } else {
                        var rs = self.execResize(file, destWidth, resizeFile);
                        resolve(rs);
                    }
                });
            } else {
                resolve(file.path);
            }
        });
    }

    execResize(file, destWidth, resizeFile) {
        try {
            sharp(file.path)
                .resize({
                    width: destWidth
                })
                .withMetadata()
                .toFile(resizeFile, function(err, info) {
                    if (!err) {
                        // console.log('info', info);
                        //원본파일 삭제!!
                        fs.unlink(file.path, function(err) {
                            if (err) {
                                throw err
                            }
                        });
                        //
                    } else {
                        throw err
                    }
                });
        } catch (e) {
            console.log('ImageResize Error', e);
        } finally {
            return resizeFile;
        }
    }

    getWidth(file) {
        return new Promise(function(resolve, reject) {
            var img = new sharp(file.path);
            img.metadata().then(function(meta) {
                resolve(meta.width);
            });
        });
    }

    async sendPush(res, id, msg, menu_flag) {
        var fcmArr = [];
        await new Promise(function(resolve, reject) {
            var sql = "SELECT FCM FROM MEMB_tbl WHERE ID = ? AND IS_ALARM = 1 AND IS_LOGOUT = 0"
            db.query(sql, id, function(err, rows, fields) {
                console.log(rows.length);
                if (!err) {
                    if (rows.length > 0) {
                        resolve(rows[0].FCM);
                    } else {
                        res.send(id + '의 IS_ALARM, IS_LOGOUT 값을 체크해보세요.');
                    }
                } else {
                    console.log(err);
                }
            });
        }).then(function(data) {
            fcmArr.push(data);
        });

        var fields = {};
        fields['notification'] = {};
        fields['data'] = {};

        fields['registration_ids'] = fcmArr;
        fields['notification']['title'] = process.env.APP_NAME;
        fields['notification']['body'] = msg;
        fields['notification']['click_action'] = 'NOTI_CLICK'; //액티비티 다이렉트 호출
        fields['priority'] = 'high';
        fields['data']['menu_flag'] = menu_flag;               //키값은 대문자 안먹음..

        var config = {
            method: 'post',
            url: 'https://fcm.googleapis.com/fcm/send',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'key=' + process.env.FCM_SERVER_KEY
            },
            data: JSON.stringify(fields),
        };

        axios(config).then(function (response) {
            res.send(response.data);
            //알림내역저장
            if (response.data.success == 1) {
                const sql = "INSERT INTO ALARM_tbl SET ID = ?, MESSAGE = ?, WDATE = NOW()";
                db.query(sql, [id, msg]);
            }
            //
        }).catch(function (error) {
            console.log(error);
            res.send('err: ' + error);
        });
    }
}

module.exports = new Utils();
