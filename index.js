const request = require('request');

let apiKey = 'JWFEGK7M12L4LOT1';

module.exports = {
    getCurrentPrice: currentPrice,
    twoPlots: function (symbol, call) {
        function secondCall (dict1) {
            recentData(symbol, mode = 'daily', 
                       callback = function (dict2) {
                let current = currentPrice(dict1, function () {});
                let x1 = Object.keys(dict1);
                let y1 = dict1.map(s => s['4. close']);
                let x2 = Object.keys(dict2);
                let y2 = dict2.map(s => s['4. close']);
                console.log('here too')
                if (isEmpty(dict1)) {
                    call(current, 0, 0, 0, 0);
                } else {
                    call(current, x1, y1, x2, y2);
                }
            })
        console.log('got here')  
        recentData(symbol, callback=secondCall);
        }
    }
}

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
        func = 'TIME_SERIES_DAILY_ADJUSTED';
    }

    function getURL () {
        var URL;
        let base = 'https://www.alphavantage.co/query?function='
        if (options.mode === 'intra') {
            URL = base + `${func}&symbol=${symbol}&interval=${options.time}&outputsize=${options.size}&apikey=${apiKey}`;
        } else {
            URL = base + `${func}&symbol=${symbol}&outputsize=${options.size}&apiKey=${apiKey}`;
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

function currentPrice(symbol, callback) {
    function findMostRecent (dict) {
        if (isEmpty(dict)) {
            let msg = symbol + ' is not a valid stock symbol.';
            callback(msg);
        } else {
            const comp = (a, b) => (a > b) ? dict[a]['4. close'] : dict[b]['4. close'];
            callback(Object.keys(dict).reduce(comp));
        }
    }
    recentData(symbol, {}, findMostRecent);
}

function isEmpty (obj) {
    for (var i in obj) {
        return false;
    }
    return true;
}
