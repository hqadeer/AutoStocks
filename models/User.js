const crypto = require('crypto');
const conn = require('../controllers').conn;

class User {
    constructor (attr) {
        this.username = attr.username;
        this.salt = attr.salt;
        this.hash = attr.hash;
    }

    verify (password) {
        let testHash =
        crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
        return (tetstHash === this.hash)
    }
}

module.exports.register = function (username, password, regCallback) {
    function hash (password, hashCallback) {
        let salt = crypto.randomBytes(16).toString('hex');
        let hash =
        crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
        regCallback(username, salt, hash)
    }
    conn.query(
        'SELECT * FROM users WHERE ID=?', [username],
        function (error, results, fields) {
            if (error) {
                console.log(error);
            }
            if (results.length > 0) {
                regCallback('Username is taken');
            } else {
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
                regCallback(`Registered user ${username}`);
            }
        }
    );
}
