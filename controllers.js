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

function getData(symbol, options, callback) {
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
        });
    }
    getURL(inner);
}

function currentPrice(symbol, priceCallBack) {
    let base = 'https://www.alphavantage.co/query?function='
    URL = base + `GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    request(URL, function(err, response, body) {
        if (err) {
            throw err;
        }
        console.log(JSON.parse(body));
        let priceInfo = JSON.parse(body)['Global Quote'];
        if (!priceInfo) {
            priceCallBack(new Error('Invalid symbol: ' + symbol), null);
        } else {
            priceCallBack(null, priceInfo['05. price']);
        }
    });
}

module.exports.updatePrices = function () {
    let done = []
    function update () {
        console.log('updating')
        db.getConn(function (err, conn) {
            if (err) {
                throw err;
            }
            conn.query(
                'SELECT symbol FROM stocks GROUP BY symbol;',
                function (err, results, fields) {
                    if (err) {
                        console.log(err)
                    }
                    if (results.length === done.length) {
                        done = []
                    }
                    for (var row in results) {
                        if (!done.includes(row.symbol)) {
                            done.push(row.symbol);
                            currentPrice(row.symbol, function (err, price) {
                                if (err) {
                                    throw err;
                                }
                                conn.query(
                                    'UPDATE stocks SET price=? WHERE symbol=?;',
                                    [price, row.symbol],
                                    errorHandle
                                );
                            });
                        }
                    }
                }
            );
        });
    }
    setInterval(update, 5000)
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
                    buyCallBack(error, null)
                }
                if ((price * shares) > results[0].balance) {
                    buyCallBack(null, 'Insufficient funds.');
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
                            buyCallBack(null, `Purchased ${shares} shares of`+
                                              ` ${stock} @ $${price}`);
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
                    sellCallBack(error, null)
                }
                if (results[0].number < number) {
                    sellCallBack(null, 'Insufficient shares');
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
                    if (results[0].number > number) {
                        conn.query(
                            'UPDATE stocks \
                            SET number = number - ? \
                            WHERE ID=? AND symbol=?;',
                            [number, id, symbol],
                            errorHandle
                        );
                    } else if (results[0].number === number) {
                        conn.query(
                            'DELETE FROM stocks WHERE ID=? AND symbol=?',
                            [id, symbol],
                            errorHandle
                        );
                    }
                    sellCallBack(null, `Sold ${number} shares of ${symbol} @` +
                                       ` $${price}`);
                }
            }
        );
    });
}

// todo: background database updates for price every 15 mins
// todo: (frontend): representing database in html table
// todo: (frontend): aesthetic improvements with bootstrap
// todo: write custom requests for python wrapper
