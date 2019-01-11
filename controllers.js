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
              `=${symbolUrl}&types=quote&filter=latestPrice`
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
            let vals = acceptedSymbols.map(key => info[key].quote.latestPrice);
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
                    errorHandle(err);
                    let symbols = results.map(row => row.symbol);
                    currentPrice(symbols, function (err, prices) {
                        if (err) {
                            throw err;
                        }
                        for (var i in symbols) {
                            // i is the index
                            conn.query(
                                'UPDATE stocks SET price=? WHERE symbol=?',
                                [prices[i], symbols[i]],
                                errorHandle
                            );
                        }
                    });
                }
            );
        });
    }
    setInterval(update, 10000)
}

function buy (id, stock, price, shares, buyCallBack) {
    db.getConn(function (err, conn) {
        errorHandle(err)
        conn.query(
            'SELECT balance FROM users WHERE id = ?;',
            [id],
            function (error, results, fields) {
                if (error) {
                    buyCallBack(error, null)
                }
                let balance = results[0].balance;
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
                                        ?, ?, ?, ? \
                                    );',
                                    [id, stock, shares, price],
                                    errorHandle
                                );
                            }
                            let msg = `Purchased ${shares} shares of ${stock}`+
                                      ` @ $${price}`
                            buyCallBack(null, msg, balance - price * shares);
                        }
                    );
                }
            }
        );
    });
}

function sell (id, symbol, price, number, sellCallBack) {
    db.getConn(function (err, conn) {
        errorHandle(err)
        conn.query(
            'SELECT number FROM stocks WHERE ID=? AND symbol=?;',
            [id, symbol],
            function (error, results, fields) {
                if (error) {
                    sellCallBack(error, null)
                }
                conn.query('SELECT balance FROM users WHERE ID=?', [id],
                function (e, r, f) {
                    let bal = r[0].balance;
                    if (results[0].number < number) {
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
                                'DELETE FROM stocks WHERE ID=? AND symbol=?',
                                [id, symbol],
                                errorHandle
                            );
                        }
                        let msg = `Sold ${number} shares of ${symbol} @`+
                                  ` $${price.toFixed(2)}`;
                        sellCallBack(null, msg, bal + price * number);
                    }
                })
            }
        );
    });
}

// todo: (frontend): representing database in html table
// todo: write custom requests for python wrapper
