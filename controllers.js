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

function currentPrice(symbols, priceCallBack) {
    // Takes a list of stock symbols and results a list of their latest prices.

    symbolUrl = symbols[0]
    for (var symbol of symbols.slice(1)) {
        symbolUrl += `,${symbol}`
    }
    let Url = `https://api.iextrading.com/1.0/stock/market/batch?symbols`+
              `=${symbolUrl}&types=quote&filter=latestPrice,changePercent`
    request(Url, function(err, response, body) {
        errorHandle(err);
        let info = JSON.parse(body);
        let acceptedSymbols = Object.keys(info);
        if (acceptedSymbols.length < symbols.length) {
            wrongSymbols = []
            for (var symbol of symbols) {
                if (!acceptedSymbols.includes(symbol.toUpperCase())) {
                    wrongSymbols.push(symbol);
                }
            }
            priceCallBack(new Error('Invalid symbol(s): ' + wrongSymbols),
                          null);
        } else {
            let vals = acceptedSymbols.map(key => [info[key].quote.latestPrice,
                                           info[key].quote.changePercent]);
            priceCallBack(null, vals);
        }
    });
}

module.exports.updatePrices = function () {
    function update () {
        console.log('updating')
        db.getConn(function (err, conn) {
            errorHandle(err);
            conn.query(
                'SELECT symbol FROM stocks GROUP BY symbol;',
                function (err, results, fields) {
                    let symbols = results.map(row => row.symbol);
                    currentPrice(symbols, function (err, prices) {
                        if (err) {
                            throw err;
                        }
                        for (var i in symbols) {
                            // i is the index
                            conn.query(
                                'UPDATE stocks SET price=?, percent=?'+
                                'WHERE symbol=?',
                                [prices[i][0], prices[i][1], symbols[i]],
                                errorHandle
                            );
                        }
                    });
                    conn.release();
                    errorHandle(err);
                }
            );
        });
    }
    setInterval(update, 10000)
}

module.exports.genTable = function(id, callback) {
    db.getConn(function (err, conn) {
        if (err) {
            callback(err, null);
        } else {
            conn.query(
                'SELECT s.symbol, s.number, s.price, s.percent, s.price * ' +
                    's.number as value, '+
                    'SUM(CASE WHEN h.action = "buy" THEN h.number * h.price '+
                             'ELSE 0 '+
                        'END) as investment, '+
                    'SUM(CASE WHEN h.action = "sell" THEN h.number * h.price '+
                             'ElSE 0 '+
                        'END) + s.number * s.price as gains '+
                'FROM stocks AS s INNER JOIN history AS h '+
                'ON s.symbol = h.symbol AND s.ID = h.ID '+
                'WHERE s.ID=? '+
                'GROUP BY s.symbol, s.number, s.price, s.percent '+
                'ORDER BY value DESC;',
                [id],
                function (err, results, fields) {
                    conn.release();
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, results);
                    }
                }
            );
        }
    });
}

function buy (id, stock, price, shares, buyCallBack) {
    db.getConn(function (err, conn) {
        errorHandle(err);
        conn.query(
            'SELECT balance FROM users WHERE id = ?;',
            [id],
            function (error, results, fields) {
                let balance = results[0].balance;
                if (shares <= 0) {
                    buyCallBack(null, 'Input must be a positive integer!',
                                balance, true);
                }
                if ((price * shares) > balance) {
                    buyCallBack(null, 'Insufficient funds.', balance, true);
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
                                        ?, ?, ?, ?, 0 \
                                    );',
                                    [id, stock, shares, price],
                                    errorHandle
                                );
                            }
                            let msg = `Purchased ${shares} shares of `+
                                      `${stock.toUpperCase()} @ $${price}.`
                            buyCallBack(null, msg, balance - price * shares);
                        }
                    );
                }
                conn.release();
                if (error) {
                    buyCallBack(error, null)
                }
            }
        );
    });
}

function sell (id, symbol, price, number, sellCallBack) {
    console.log('selling');
    db.getConn(function (err, conn) {
        errorHandle(err)
        conn.query(
            'SELECT number FROM stocks WHERE ID=? AND symbol=?;',
            [id, symbol],
            function (error, results, fields) {
                conn.query('SELECT balance FROM users WHERE ID=?;', [id],
                function (e, r, f) {
                    errorHandle(e);
                    let bal = r[0].balance;
                    if (number <= 0) {
                        sellCallBack(null, 'Input must be a positive integer!',
                                     bal, true);
                    } else if (results.length === 0) {
                        sellCallBack(null, 'You do not own any shares of '+
                                           symbol.toUpperCase() +'!',
                                     bal, true);
                    } else if (results[0].number < number) {
                        sellCallBack(null, 'Insufficient shares.', bal, true);
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
                                'DELETE FROM stocks WHERE ID=? AND symbol=?;',
                                [id, symbol],
                                errorHandle
                            );
                        }
                        let msg = `Sold ${number} shares of `+
                                  `${symbol.toUpperCase()} @ $${price}.`;
                        sellCallBack(null, msg, bal + price * number);
                    }
                });
                conn.release();
                if (error) {
                    sellCallBack(error, null)
                }
            }
        );
    });
}

// todo: write custom requests for python wrapper
