const request = require('request');
const mysql = require('mysql');

module.exports = {
    getCurrentPrice: currentPrice,
    initDB: initDatabase
}

var conn = mysql.createConnection({
    host : 'localhost',
    database: 'portfolios',
    user: 'local',
    password: 'password',
    insecureAuth: true
})

conn.connect(function (err) {
    if (err) {
        console.log('Database connection error: ' + err.stack);
    } else {
        console.log('Database connection successful.')
    }
})

function initDatabase () {
    function errorHandle (error, results, fields) {
        if (error) {
            console.log(error);
        }
    }
    conn.query(
        'CREATE TABLE IF NOT EXISTS users ( \
            ID int NOT NULL AUTO_INCREMENT, \
            username varchar(255) NOT NULL, \
            hash varchar(255) NOT NULL, \
            PRIMARY KEY (ID)\
        );',
        errorHandle
    )
    conn.query(
        'CREATE TABLE IF NOT EXISTS stocks ( \
            symbol varchar(255), \
            number int \
        );',
        errorHandle
    )
    conn.query(
        'CREATE TABLE IF NOT EXISTS history ( \
            symbol varchar(255), \
            number int, \
            price int, \
            action varchar(255) \
        );',
        errorHandle
    )
}

let apiKey = 'F24C5SOKOYQUBV6K';

function recentData(symbol, options, callback) {
    /* Obtains the past two hours of prices for the
       stock specified by symbol and calls callback function
       on it
    */

    // Defaults
    if (typeof options.time === "undefined") {
        options.time = '1min'
    }
    if (typeof options.mode === "undefined") {
        options.mode = 'intra'
    }
    if (typeof options.size === "undefined") {
        options.size = 'compact'
    }
    var func;
    if (options.mode === 'intra') {
        func = 'TIME_SERIES_INTRADAY';
    } else {
        func = 'TIME_SERIES_DAILY';
    }

    function getURL () {
        var URL;
        let base = 'https://www.alphavantage.co/query?function='
        if (options.mode === 'intra') {
            URL = base + `${func}&symbol=${symbol}&interval=${options.time}&outputsize=${options.size}&apikey=${apiKey}`;
        } else {
            URL = base + `${func}&symbol=${symbol}&outputsize=${options.size}&apikey=${apiKey}`;
        }
        inner(URL);
    }
    function inner (URL) {
        request(URL, function(err, response, body) {
            if (err) {
                console.log('error:', err);
            } else {
                var stockInfo = JSON.parse(body);
                if (options.mode !== 'intra') {
                    options.time = 'Daily'
                }
                let val = stockInfo[`Time Series (${options.time})`];
                callback(val);
            }
        })
    }
    getURL(inner);
}

function currentPrice(symbol, priceCallBack) {
    function findMostRecent (dict) {
        if (isEmpty(dict)) {
            let msg = symbol + ' is not a valid stock symbol.';
            priceCallBack(msg);
        } else {
            const comp = (a, b) => (a > b) ? dict[a]['4. close'] : dict[b]['4. close'];
            priceCallBack(dict[Object.keys(dict)[0]]['4. close'])
        }
    }
    recentData(symbol, {}, findMostRecent);
}

function buy (stock, price, shares, balance, buyCallBack) {
    if ((price * shares) > balance) {
        buyCallBack('insufficent funds')
    } else {

    }
}

function isEmpty (obj) {
    for (var i in obj) {
        return false;
    }
    return true;
}
