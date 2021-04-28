const sharp = require('sharp');
const fs = require('fs');
var db = require('./db');
var requestIp = require('request-ip');

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
            var destWidth = 300;
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
}

module.exports = new Utils();
