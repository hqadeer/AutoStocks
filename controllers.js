/* Contains most of the buy/sell code */

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

/**
  *  Obtains the past two hours of prices for the
  *  stock specified by symbol and calls callback function
  *  on it.
  *
  *  Note: This uses AlphaVantage API instead of IEX. AlphaVantage has
  *  currently been deprecated because of its rate limitations, but
  *  it might be used later for less frequent queries.
  */
function getData(symbol, options, callback) {
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

/**
 *  Obtain the current price and daily price change of one or more stocks.
 *
 *  @param {Array} symbols - list of one or more stock symbols
 *  @returns {Promise} Promise object representing Array of price-percentChange pairs
 */
function currentPrice (symbols) {
    return new Promise(function (resolve, reject) {
        let symbolUrl = symbols[0];
        for (let symbol of symbols.slice(1)) {
            symbolUrl += `,${symbol}`
        }
        let Url = `https://api.iextrading.com/1.0/stock/market/batch?symbols`+
            `=${symbolUrl}&types=quote&filter=latestPrice,changePercent`;
        request(Url, function (err, response, body) {
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

/**
 *  Update database stock prices and percent changes in the background
 *  every five seconds
 */
module.exports.updatePrices = function () {
    function update () {
        console.log('updating');
        db.getConn()
        .then(conn => {
            conn.query(
                'SELECT symbol FROM stocks GROUP BY symbol;',
                function (err, results) {
                    errorHandle(err);
                    let symbols = results.map(row => row.symbol);
                    currentPrice(symbols)
                    .then(prices => {
                        for (let i in symbols) {
                            conn.query(
                                'UPDATE stocks SET price=?, percent=?'+
                                'WHERE symbol=?',
                                [prices[i][0], prices[i][1], symbols[i]],
                                errorHandle
                            );
                        }
                    })
                    .catch(err => throw err);
                    conn.release();
                }
            );
        })
        .catch(errorHandle);
    }
    setInterval(update, 5000);
};

/**
 *  Queries history and stock tables of database to return data for display
 *  table on website.
 *
 *  Table columns:
 *  symbol -- stock symbol
 *  number -- number of shares currently owned
 *  percent -- latest daily change in stock price, in percentage
 *  value -- product of stock's current price and number of shares owned
 *  investment -- sum of all money ever spent buying a stock
 *  gains -- sum current value of stock owned, as well as all money ever made
 *           by selling a stock
 */
module.exports.genTable = function(id) {
    return new Promise((resolve, reject) => {
        db.getConn()
        .then(conn => {
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
                function (err, results) {
                    conn.release();
                    if (err) {
                        reject(err);
                    }
                    resolve(results);
                }
            )
        })
        .catch(err => reject(err));
    });
};

/**
 *  Purchase stocks right now if market is open; queue them for later otherwise.
 *
 *  @param id {string} - username of logged-in user
 *  @param symbol {string} - stock symbol
 *  @param number {int} - number of shares being purchased
 *  @returns {string} - message for user
 */
function buy (id, symbol, number) {
    return new Promise((resolve, reject) => {
        if (isMarketOpen()) {
            currentPrice([symbol])
            .then(result => {
                return buyNow(id, symbol, result[id][0] + TRANSACTION_FEE, number)
            })
            .then(result => resolve(result))
            .catch(err => reject(err));
        } else {
            queue({id: id, symbol: symbol, number: number, type: "buy"})
            .then(result => resolve(result))
            .catch(err => reject(err));
        }
    });
}

/**
 *  Sell stocks right now if market is open; queue them for later otherwise.
 *
 *  @param id {string} - username of logged-in user
 *  @param symbol {string} - stock symbol
 *  @param number {int} - number of shares being purchased
 *  @returns {string} - message for user
 */
function sell (id, symbol, number) {
    return new Promise((resolve, reject) => {
        if (isMarketOpen()) {
            currentPrice([symbol])
            .then(result => { return sellNow(id, symbol, result[id][0], number) })
            .then(result => resolve(result))
            .catch(err => reject(err));
        } else {
            queue({id: id, symbol: symbol, number: number, type: "buy"})
            .then(result => resolve(result))
            .catch(err => reject(err));
        }
    });
}

/**
 * Process all pending transactions on queue if market is open.
 *
 * @returns {Promise} - Promise representing array of messages from failed transactions
 *                      if market is open; Promise representing null otherwise.
 */
module.exports.processQueue = () => {
    return new Promise((resolve, reject) => {
        if (!isMarketOpen()) {
            resolve(null);
        } else {
            db.getConn()
            .then(conn => {
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
            })
            .catch(err => reject(err));
        }
    });
};

/**
 * Execute an array of purchases; serves as a helper method for processQueue
 *
 * @param {Array} purchases - list of purchases from queue table in database
 * @returns {Promise} - Promise representing list of messages from failed transactions
 */
function doBuySells (purchases) {
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
                resolve(result.transactionID + ". " + result.message);
            }).catch(err => reject(err));
        });
    }

    for (let row of purchases) {
        promises.push(rowHandler(row));
    }

    return new Promise((resolve, reject) => {
        Promise.all(promises)
        .then(() => resolve(messages))
        .catch(err => { reject(err); });
    });

}

/**
 * Queue purchase for future transaction.
 *
 * @param {Object} purchase - fields are username (id), symbol, number,
 *                            and action
 */
function queue (purchase) {
    if (numInQueue >= 1000) {
        return;
    }
    db.getConn()
    .then(conn => {
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
    })
    .catch(err => reject(err));
}

/**
 * Buy shares of a stock right now.
 *
 * @param id {string} - username of purchaser
 * @param stock {string} - symbol of purchased stock
 * @param price {number} - price per share
 * @param shares {number} - number of shares purchased
 * @returns {Promise} - Promise representing object of user message, new balance,
 *                      and boolean indicator of whether transaction succeeded
 */
function buyNow (id, stock, price, shares) {
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
        })
        .catch(err => reject(err));
    })
}

/**
 * Sell shares of a stock right now.
 *
 * @param id {string} - username of seller
 * @param stock {string} - symbol of sold stock
 * @param price {number} - price per share
 * @param shares {number} - number of shares sold
 * @returns {Promise} - Promise representing object of user message, new balance,
 *                      and boolean indicator of whether transaction succeeded
 */
function sellNow (id, symbol, price, number) {
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
        })
        .catch(err => reject(err));
    });
}

/**
 * Checks whether US Stock Market is currently open
 *
 * @returns {boolean}
 */
function isMarketOpen () {
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
