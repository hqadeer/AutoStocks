const mysql = require('mysql');

var pool = mysql.createPool({
    connectionLimit: 10,
    host : 'localhost',
    database: 'portfolios',
    user: 'local',
    password: 'password',
    insecureAuth: true
});

function errorHandle (error, results, fields) {
    if (error) {
        throw error;
    }
}

module.exports.init = function initDatabase () {
    pool.query(
        'CREATE TABLE IF NOT EXISTS users ( \
            ID varchar(255) UNIQUE NOT NULL, \
            salt varchar(255) NOT NULL, \
            hash varchar(255) NOT NULL, \
            balance numeric DEFAULT 100000, \
            PRIMARY KEY (ID) \
        );',
        errorHandle
    );
    pool.query(
        'CREATE TABLE IF NOT EXISTS stocks ( \
            ID int, \
            symbol varchar(255), \
            number int, \
            price numeric \
        );',
        errorHandle
    );
    pool.query(
        'CREATE TABLE IF NOT EXISTS history ( \
            ID int, \
            symbol varchar(255), \
            number int, \
            price int, \
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
