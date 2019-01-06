const crypto = require('crypto');
const conn = require('../controllers').conn;

module.exports.register = function (username, password) {
    function hash (password, hashCallback) {
        let salt = crypto.randomBytes(16).toString('hex');
        let hash =
        crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
        regCallback(username, salt, hash)
    }
    hash (password, function (username, salt, hash) {
        conn.query(
            'INSERT INTO users (ID, salt, hash)'+
            'VALUES (?, ?, ?);',
            [username, salt, hash],
            function (error, results, fields) {
                if (error) {
                    console.log(error);
                }
            }
        );
    });
}
