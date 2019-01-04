const request = require('request');
const mysql = require('mysql');

module.exports = {
    getCurrentPrice: currentPrice,
    initDB: initDatabase
}

var conn = mysql.createPool({
    connectionLimit: 10,
    host : 'localhost',
    database: 'portfolios',
    user: 'local',
    password: 'password',
    insecureAuth: true
})

function errorHandle (error, results, fields) {
    if (error) {
        console.log(error);
    }
}

function initDatabase () {
    conn.query(
        'CREATE TABLE IF NOT EXISTS users ( \
            ID int NOT NULL AUTO_INCREMENT, \
            username varchar(255) NOT NULL, \
            hash varchar(255) NOT NULL, \
            balance numeric DEFAULT 100000, \
            PRIMARY KEY (ID) \
        );',
        errorHandle
    )
    conn.query(
        'CREATE TABLE IF NOT EXISTS stocks ( \
            ID int, \
            symbol varchar(255), \
            number int \
        );',
        errorHandle
    )
    conn.query(
        'CREATE TABLE IF NOT EXISTS history ( \
            ID int, \
            symbol varchar(255), \
            number int, \
            price int, \
            action varchar(255) \
        );',
        errorHandle
    )
    console.log('Database connection and initialization successful.')
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

function buy (id, stock, price, shares, buyCallBack) {
    if ((price * shares) > balance) {
        buyCallBack('Insufficient Funds.');
    } else {
        newBalance = balance - (price * shares);
        conn.query(
            'INSERT INTO history VALUES ( \
                ?, ?, ?, ?, "buy");',
            [id, stock, shares, price],
            errorHandle
        );
        conn.query(
            'INSERT INTO'
        )
    }
}

function isEmpty (obj) {
    for (var i in obj) {
        return false;
    }
    return true;
}
