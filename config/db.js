// Module handles MySQL database connections

const mysql = require('mysql');
const errorHandle = require('./helpers').errorHandle;

// Create MySQL pool to dynamically allocate database connections
var pool = mysql.createPool({
    connectionLimit: 10,
    host : 'localhost',
    database: 'portfolios',
    user: 'local',
    password: 'password',
    insecureAuth: true
});

module.exports.init = function initDatabase () {
    /* Initialize database with three tables: users, stocks, and histories.

       users ---- info on all usernames; stores user salt, hash, and balance as
                  well
       stocks --- data for current holdings of each user; check code for table
                  schema
       history -- history of all transactions made by all users; check code for
                  table schema
    */

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
            action varchar(255), \
            transactionID int NOT NULL AUTO_INCREMENT\
        );',
        errorHandle
    );
    pool.query(
        'CREATE TABLE IF NOT EXISTS queue ( '+
            'ID varchar(255), '+
            'symbol varchar(255), '+
            'number int, '+
            'action varchar(255)'+
        ');',
        errorHandle
    )
    console.log('Database connection and initialization successful.');
}

module.exports.getConn = () => new Promise(function (resolve, reject) {
    /* Obtain database connection; run query within callback function

       Returns a promise; if it resolves, the result is the connection.
    */

    pool.getConnection(function (err, conn) {
        if (err) {
            reject(err);
        } else {
            resolve(conn);
        }
    });
});
