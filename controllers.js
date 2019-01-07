const request = require('request');
const db = require('./config/db');
const helpers = require('./config/helpers');
const isEmpty = helpers.isEmpty;
const errorHandle = helpers.errorHandle;

module.exports = {
    getCurrentPrice: currentPrice,
    buy: buy,
    sell: sell
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
            URL = base + `${func}&symbol=${symbol}&interval=${options.time}&`+
                         `outputsize=${options.size}&apikey=${apiKey}`;
        } else {
            URL = base + `${func}&symbol=${symbol}&outputsize=${options.size}`+
                         `&apikey=${apiKey}`;
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
            priceCallBack(dict[Object.keys(dict)[0]]['4. close'])
        }
    }
    recentData(symbol, {}, findMostRecent);
}

function buy (id, stock, price, shares, buyCallBack) {
    db.getConn(function (err, conn) {
        if (err) {
            throw err;
        }
        conn.query(
            'SELECT balance FROM users WHERE id = ?;',
            [id],
            function (error, results, fields) {
                if (error) {
                    console.log(error)
                }
                if ((price * shares) > results.balance) {
                    buyCallBack('Insufficient funds.');
                } else {
                    conn.query(
                        'UPDATE users \
                        SET balance = balance - ? \
                        WHERE id = ?;',
                        [price * shares, id],
                        errorHandle
                    );
                    conn.query(
                        'INSERT INTO history VALUES ( \
                            ?, ?, ?, ?, "buy");',
                        [id, stock, shares, price],
                        errorHandle
                    );
                    conn.query(
                        'SELECT * FROM stocks \
                        WHERE ID=? AND symbol=?;',
                        [id, stock],
                        function (error, results, fields) {
                            if (error) {
                                console.log(error)
                            }
                            if (results.length > 0) {
                                conn.query(
                                    'UPDATE stocks \
                                    SET number = number + ? \
                                    WHERE ID=? AND symbol=?;',
                                    [shares, id, stock],
                                    errorHandle
                                );
                            } else {
                                conn.query(
                                    'INSERT INTO stocks VALUES( \
                                        ?, ?, ?, ? \
                                    );',
                                    [id, stock, shares, price],
                                    errorHandle
                                );
                            }
                            buyCallBack(`Purchased ${shares} shares of`+
                                        `${stock} @ $${price}`);
                        }
                    );
                }
            }
        );
    });
}

function sell (id, symbol, price, number, sellCallBack) {
    db.getConn(function (err, conn) {
        if (err) {
            throw err;
        }
        conn.query(
            'SELECT number FROM stocks WHERE ID=? AND symbol=?;',
            [id, symbol],
            function (error, results, fields) {
                if (error) {
                    console.log(error);
                }
                if (results.number < number) {
                    sellCallBack('Insufficient shares');
                } else {
                    conn.query(
                        'UPDATE users \
                        SET balance = balance + ? \
                        WHERE id = ?;',
                        [price * number, id],
                        errorHandle
                    );
                    conn.query(
                        'INSERT INTO history VALUES ( \
                            ?, ?, ?, ?, "sell");',
                        [id, symbol, number, price],
                        errorHandle
                    );
                    if (results.number > number) {
                        conn.query(
                            'UPDATE stocks \
                            SET number = number - ? \
                            WHERE ID=? AND symbol=?;',
                            [number, id, symbol],
                            errorHandle
                        );
                    } else if (results.number === number) {
                        conn.query(
                            'DELETE FROM stocks WHERE ID=? AND symbol=?',
                            [id, symbol],
                            errorHandle
                        );
                    }
                    sellCallBack(`Sold ${shares} shares of ${stock} @` +
                                 `$${price}`);
                }
            }
        );
    });
}

// todo: background database updates for price every 15 mins
// todo: (frontend): get symbol, price, shares from frontend form
// todo: (frontend and backend): authentication
// todo: (frontend): representing database in html table
// todo: (frontend): aesthetic improvements with bootstrap
// todo: write custom requests for python wrapper
