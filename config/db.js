const mysql = require('mysql');
const errorHandle = require('./helpers').errorHandle;

var pool = mysql.createPool({
    connectionLimit: 10,
    host : 'localhost',
    database: 'portfolios',
    user: 'local',
    password: 'password',
    insecureAuth: true
});

module.exports.init = function initDatabase () {
    pool.query(
        'CREATE TABLE IF NOT EXISTS users ( \
            ID varchar(255) UNIQUE NOT NULL, \
            salt varchar(255) NOT NULL, \
            hash TEXT NOT NULL, \
            balance numeric(16, 2) UNSIGNED DEFAULT 100000.00, \
            PRIMARY KEY (ID) \
        );',
        errorHandle
    );
    pool.query(
        'CREATE TABLE IF NOT EXISTS stocks ( \
            ID varchar(255), \
            symbol varchar(255), \
            number int, \
            price numeric(16, 2) UNSIGNED, \
            percent double DEFAULT 0.00\
        );',
        errorHandle
    );
    pool.query(
        'CREATE TABLE IF NOT EXISTS history ( \
            ID varchar(255), \
            symbol varchar(255), \
            number int, \
            price numeric(16, 2) UNSIGNED, \
            action varchar(255) \
        );',
        errorHandle
    );
    console.log('Database connection and initialization successful.');
}

module.exports.getConn = function(callback) {
    pool.getConnection(function (err, conn) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, conn);
        }
    });
};
