/* Contains most of the backend code; organization here was probably not ideal */


const request = require('request');
const db = require('./config/db');
const helpers = require('./config/helpers');
const errorHandle = helpers.errorHandle;
const TRANSACTION_FEE = 4.95; // Transaction fee for all buys and sells.

let numInQueue = 0;

module.exports = {
    getCurrentPrice: currentPrice,
    buy: buy,
    sell: sell
};

let apiKey = 'F24C5SOKOYQUBV6K'; // Key for AlphaVantage


function getData(symbol, options, callback) {
    /* Obtains the past two hours of prices for the
       stock specified by symbol and calls callback function
       on it.

       Note: This uses AlphaVantage API instead of IEX. AlphaVantage has
       currently been deprecated because of its rate limitations, but
       it might be used later for less frequent queries.
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
        let base = 'https://www.alphavantage.co/query?function=';
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

function currentPrice (symbols) {
    /* Obtain the current price and daily price change of one or more stocks.

       @param symbols -- list of one or more stock symbols
       Returns a promise with result as aj object with the symbols as keys and a
       two-item array of current price and price change as values
    */
    return new Promise(function (resolve, reject) {
        let symbolUrl = symbols[0];
        for (let symbol of symbols.slice(1)) {
            symbolUrl += `,${symbol}`
        }
        let Url = `https://api.iextrading.com/1.0/stock/market/batch?symbols`+
            `=${symbolUrl}&types=quote&filter=latestPrice,changePercent`;
        request(Url, function(err, response, body) {
            if (err) {
                reject(err);
            }
            let info = JSON.parse(body);
            let acceptedSymbols = Object.keys(info);
            if (acceptedSymbols.length < symbols.length) {
                let wrongSymbols = [];
                for (let symbol of symbols) {
                    if (!acceptedSymbols.includes(symbol.toUpperCase())) {
                        wrongSymbols.push(symbol);
                    }
                }
                reject(new Error('Invalid symbol(s): ' + wrongSymbols));
            } else {
                let vals = acceptedSymbols.map(key => [info[key].quote.latestPrice,
                           info[key].quote.changePercent]);
                resolve(vals);
            }
        });
    });
}

module.exports.updatePrices = function () {
    /* Update database stock prices and percent changes in the background
       every five seconds
    */

    function update () {
        console.log('updating');
        db.getConn().then(conn => {
            conn.query(
                'SELECT symbol FROM stocks GROUP BY symbol;',
                function (err, results) {
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
        }).catch(errorHandle);
    }
    setInterval(update, 5000);
};

module.exports.genTable = function(id, callback) {
    /* Queries history and stock tables of database to return data for display
       table on website.

       Columns:
       symbol -- stock symbol
       number -- number of shares currently owned
       percent -- latest daily change in stock price, in percentage
       value -- product of stock's current price and number of shares owned
       investment -- sum of all money ever spent buying a stock
       gains -- sum current value of stock owned, as well as all money ever made
                by selling a stock
    */

    db.getConn().then(conn => {
        conn.query(
            'SELECT s.symbol, s.number, s.price, s.percent, s.price * ' +
            's.number as value, ' +
            'SUM(CASE WHEN h.action = "buy" THEN h.number * h.price ' +
            'ELSE 0 ' +
            'END) as investment, ' +
            'SUM(CASE WHEN h.action = "sell" THEN h.number * h.price ' +
            'ElSE 0 ' +
            'END) + s.number * s.price as gains ' +
            'FROM stocks AS s INNER JOIN history AS h ' +
            'ON s.symbol = h.symbol AND s.ID = h.ID ' +
            'WHERE s.ID=? ' +
            'GROUP BY s.symbol, s.number, s.price, s.percent ' +
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
        )
    }).catch(errorHandle);
};

function buy (id, symbol, number) {
    /* Purchase stocks right now if market is open; otherwise, queue purchase
       for later.

       done takes 4 parameters:
       error -- error raised during execution; if no error was raised, this is
                null
       message (string) -- message; invalid purchases (i.e. negative inputs, or
                  insufficient funds) are returned as messages, not errors.
       balance (float) -- will be null for queued purchases
       failed (boolean) -- true if transaction did not complete (i.e., because
                           of insufficient funds)
    */
    return new Promise((resolve, reject) => {
        if (isMarketOpen()) {
            currentPrice([symbol]).then(result => {
                return buyNow(id, symbol, result[id][0], number)
            }).then(result => resolve(result)).catch(
                err => reject(err));
        } else {
            queue({id: id, symbol: symbol, number: number, type: "buy"}).then(
                result => resolve(result)).catch(err => reject(err));
        }
    });
}

function sell (id, symbol, number) {
    /* Sell stocks right now if market is open; otherwise, queue sale
       for later.

       done takes 4 parameters:
       error -- error raised during execution; if no error was raised, this is
                null
       message (string) -- message; invalid purchases (i.e. negative inputs, or
                  insufficient funds) are returned as messages, not errors.
       balance (float) -- will be null for queued purchases
       failed (boolean) -- true if transaction did not complete (i.e., because
                           of insufficient funds)
    */

    return new Promise((resolve, reject) => {
        if (isMarketOpen()) {
            currentPrice([symbol]).then(result => {
                return sellNow(id, symbol, result[id][0], number)
            }).then(result => resolve(result)).catch(
                err => reject(err));
        } else {
            queue({id: id, symbol: symbol, number: number, type: "buy"}).then(
                result => resolve(result)).catch(err => reject(err));
        }
    });
}

module.exports.processQueue = () => {
    return new Promise((resolve, reject) => {
        if (!isMarketOpen()) {
            resolve(null);
        } else {
            db.getConn().then(conn => {
                conn.query(
                    'SELECT * FROM queue',
                    (error, results) => {
                        if (error) {
                            throw error;
                        }
                        doBuySells(results).then(messages => resolve(messages))
                            .catch(err => reject(err))
                    }
                );
            }).catch(err => reject(err));
        }
    });
};

function doBuySells (purchases) {
    /* Takes all purchases from queue and executes them.

       Done takes 2 parameters:
       errorMessages -- array of messages returned from all failed transactions
       balance -- new account balance after everything on queue is processed
    */

    let promises = [];
    let messages = [];
    let finalBalance = null;

    function rowHandler (row) {
        return new Promise((resolve, reject) => {
            let method;
            if (row.action === "buy") {
                method = buyNow;
            } else {
                method = sellNow;
            }
            currentPrice([row.ID]).then(result => {
                return method(result[row.ID][0]);
            }).then(result => {
                messages.push(result.message);
                if (result.balance) {
                    finalBalance = result.balance;
                    numInQueue--;
                }
                resolve(result.message);
            }).catch(err => reject(err));
        });
    }

    for (let row of purchases) {
        promises.push(rowHandler(row));
    }

    return new Promise((resolve, reject) => {
        Promise.all(promises).then(() => resolve(messages)).catch(err => {
            reject(err);
        });
    });

}

function queue (purchase) {
    /* Log future purchase into database; throw error if any */

    if (numInQueue >= 1000) {
        return;
    }
    db.getConn().then(conn => {
        errorHandle(err);
        conn.query(
            'INSERT INTO QUEUE (ID, symbol, number, action)'+
            'VALUES (?, ?, ?, ?);',
            Object.values(purchase),
            (error, results, fields) => {
                conn.release();
                numInQueue++;
                errorHandle();
            }
        );
    }).catch(errorHandle);
}

function buyNow (id, stock, price, shares) {
    /* Buy a stock for a particular user now

       id -- username of purchaser
       stock -- symbol being purchased
       price -- current price of share (will be deprecated for realistic delay)
       shares -- number of shares being purchased
       buyCallback -- callback function

       callback takes 4 parameters:
       error -- error raised during execution; if no error was raised, this is
                null
       message (string) -- message; invalid purchases (i.e. negative inputs, or
                  insufficient funds) are returned as messages, not errors.
       balance (float) -- new account balance after transaction; null if same
       failed (boolean) -- true if transaction did not complete (i.e., because
                           of insufficient funds)
    */

    return new Promise((resolve, reject) => {
        db.getConn().then(conn => {
            conn.query(
                'SELECT balance FROM users WHERE id = ?;',
                [id],
                function (error, results) {
                    if (error) {
                        reject(error);
                    }
                    let balance = results[0].balance;
                    if (shares <= 0) {
                        resolve({message: 'Input must be a positive integer!'});
                    }
                    if ((price * shares) > balance) {
                        resolve({message: 'Insufficient funds.'});
                    } else {
                        conn.query(
                            'UPDATE users \
                            SET balance = balance - ? \
                            WHERE id = ?;',
                            [price * shares, id],
                            error => reject(error)
                        );
                        conn.query(
                            'INSERT INTO history VALUES ( \
                                ?, ?, ?, ?, "buy");',
                            [id, stock, shares, price],
                            error => reject(error)
                        );
                        conn.query(
                            'SELECT * FROM stocks \
                            WHERE ID=? AND symbol=?;',
                            [id, stock],
                            function (error, results) {
                                if (error) {
                                    reject(error);
                                }
                                if (results.length > 0) {
                                    conn.query(
                                        'UPDATE stocks \
                                        SET number = number + ? \
                                        WHERE ID=? AND symbol=?;',
                                        [shares, id, stock],
                                        error => reject(error)
                                    );
                                } else {
                                    conn.query(
                                        'INSERT INTO stocks VALUES( \
                                            ?, ?, ?, ?, 0 \
                                        );',
                                        [id, stock, shares, price],
                                        error => reject(error)
                                    );
                                }
                                let msg = `Purchased ${shares} shares of ` +
                                    `${stock.toUpperCase()} @ $${price}.`;
                                resolve({
                                    message: msg, balance: balance - price * shares,
                                    success: true
                                });
                            }
                        );
                    }
                    conn.release();
                }
            );
        }).catch(err => reject(err));
    })
}

function sellNow (id, symbol, price, number, sellCallBack) {
    /* Sell a stock for a particular user now

       id -- username of seller
       symbol -- symbol being sold
       price -- current price of share (will be deprecated for realistic delay)
       number -- number of shares being sold
       sellCallBack -- callback function

       callback takes 4 parameters:
       error -- error raised during execution; if no error was raised, this is
                null
       message (string) -- message; invalid purchases (i.e. negative inputs, or
                  insufficient funds) are returned as messages, not errors.
       balance (float) -- new account balance after transaction; null if same
       failed (boolean) -- true if transaction did not complete (i.e., because
                           of insufficient funds)
    */

    return new Promise((resolve, reject) => {
        db.getConn().then(conn => {
        conn.query(
            'SELECT number FROM stocks WHERE ID=? AND symbol=?;',
            [id, symbol],
            function (error, results) {
                conn.query('SELECT balance FROM users WHERE ID=?;', [id],
                    function (e, r, f) {
                        if (e) { reject(e); }
                        let bal = r[0].balance;
                        if (number <= 0) {
                            resolve({ message: 'Input must be a positive integer!' });
                        } else if (results.length === 0) {
                            resolve({ message: 'You do not own any shares of '+
                                symbol.toUpperCase() +'!' });
                        } else if (results[0].number < number) {
                            resolve({ message: 'Insufficient shares.'});
                        } else {
                            conn.query(
                                'UPDATE users \
                                SET balance = balance + ? \
                                WHERE id = ?;',
                                [price * number, id],
                                err => reject(err)
                            );
                            conn.query(
                                'INSERT INTO history VALUES ( \
                                    ?, ?, ?, ?, "sell");',
                                [id, symbol, number, price],
                                err => reject(err)
                            );
                            if (results[0].number > number) {
                                conn.query(
                                    'UPDATE stocks \
                                    SET number = number - ? \
                                    WHERE ID=? AND symbol=?;',
                                    [number, id, symbol],
                                    err => reject(err)
                                );
                            } else if (results[0].number === number) {
                                conn.query(
                                    'DELETE FROM stocks WHERE ID=? AND symbol=?;',
                                    [id, symbol],
                                    err => reject(err)
                                );
                            }
                            let msg = `Sold ${number} shares of `+
                                `${symbol.toUpperCase()} @ $${price}.`;
                            resolve({ message: msg, balance: bal + price * number, success: true });
                        }
                    });
                conn.release();
                if (error) {
                    reject(error);
                }
            }
        );
        }).catch(err => reject(error));
    });
}

function isMarketOpen () {
    /* Checks whether US stock market is currently open. Checks against
       federal holidays as well. This was annoying to code.
    */

    let d = new Date();
    let date = d.getDate();
    let day = d.getDay();
    let month = d.getMonth();
    let hour = d.getHour();
    let min = d.getMinute();
    if (hour + (min / 60) < 6.5 || hour + (min / 60) > 13) { // Market hours
        return false;
    } else if (day == 0 || day == 6) { // Weekend
        return false;
    } else if (month == 0 && date == 1) { // New Year's
        return false;
    } else if (month == 0 && day == 1 && date <= 21 && date > 14) { // MLK day
        return false;
    } else if (month == 1 && day == 1 && date <= 21 && date > 14) { // President's day
        return false;
    } else if (month == 4 && day == 1 && date > 24) { // Memorial day
        return false;
    } else if (month == 6 && date == 3 && hour > 10) { // Early close on 7/3
        return false;
    } else if (month == 6 && date == 4) { // 4th of July
        return false;
    } else if (month == 8 && day == 1 && date < 8) { // Labor day
        return false;
    } else if (month == 10 && day == 4 && date > 21 && date < 29) { // Thanksgiving day
        return false;
    } else if (month == 10 && day == 5 && date > 22 && date < 30 && hour > 10) {
        return false; // Early close after Thanksgiving
    } else if (month == 11 && day == 24 && hour > 10) { // Early close on Xmas eve
        return false;
    } else if (month == 11 && day == 25) { // Christmas
        return false;
    } else {
        return true;
    }
}
