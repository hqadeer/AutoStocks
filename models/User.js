// Class and utility functions for Users

// Dependencies
const crypto = require('crypto');
const db = require('../config/db');
const conn = require('../controllers');

class User {
    // User class; takes id, salt, and hash as input. Used for password-checking.

    constructor (attr) {
        this.id = attr.ID;
        this.salt = attr.salt;
        this.hash = attr.hash;
    }

    verify (password) {
        let testHash =
        crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
        return (testHash === this.hash)
    }
}

module.exports.register = function (username, password) {
    /* Takes username and password (and callback function) as input; registers
       user.

       Callback function takes two inputs: error and user. Values can be null if
       not applicable.
    */

    function hash (password) {
        // Helper function to generate a salt and hash a password
        return new Promise((resolve, reject) => {
            try {
                let salt = crypto.randomBytes(16).toString('hex');
                let hash = crypto.pbkdf2Sync(password, salt, 10000, 512,
                    'sha512').toString('hex');
                resolve({ ID: username, salt: salt, hash: hash });
            } catch (err) {
                reject(err);
            }
        });
    }

    return new Promise((resolve, reject) => {
        db.getConn().then(conn => {
            conn.query(
                'SELECT * FROM users WHERE ID=?', [username],
                function (error, results) {
                    if (results.length > 0) {
                        resolve(null);
                    } else {
                        hash(password).then(user => {
                        conn.query(
                            'INSERT INTO users (ID, salt, hash)' +
                            'VALUES (?, ?, ?);',
                            Object.values(user),
                            function (error, results, fields) {
                                if (error) {
                                    reject(error)
                                } else {
                                    resolve(new User(user));
                                }
                            }
                        );
                        }).catch(err => reject(err));
                    }
                    conn.release();
                    if (error) {
                        reject(error);
                    }
                }
            );
        });
    });
}

module.exports.findUser = function (username) {
    /* Find user with given username and call callback function on corresponding
       user object.

       findCallback takes error and User object as input. Either could be null
       if applicable.
    */
    return new Promise((resolve, reject) => {
        db.getConn().then(conn => {
        conn.query(
            'SELECT ID, salt, hash FROM users WHERE ID=?', [username],
            function (error, results) {
                conn.release();
                if (error) {
                    reject(error);
                } else if (results.length === 0) {
                    resolve(null);
                } else {
                    resolve(new User(results[0]));
                }
            }
        );
        });
    })

}
