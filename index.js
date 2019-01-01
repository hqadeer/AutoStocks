const request = require('request');

let apiKey = 'JWFEGK7M12L4LOT1';

module.exports = {
    getCurrentPrice: function getCurrentPrice(symbol, callback) {
        function findMostRecent (dict) {
            const comp = (a, b) => (a > b) ? dict[a]['4. close'] : dict[b]['4. close'];
            callback(Object.keys(dict).reduce(comp));
        }
        recentData(symbol, findMostRecent)
    }
}

function recentData(symbol, addOn) {
    /* Obtains the past two hours of prices for the 
       stock specified by symbol and calls addOn function 
       on it
    */ 
    let func = 'TIME_SERIES_INTRADAY';
    let interval = '1min';
    function getURL () {
        var URL = `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&interval=${interval}&apikey=${apiKey}`;
        inner(URL)
    }
    function inner (URL) {
        request(URL, function(err, response, body) {
            if (err) {
                console.log('error:', err);
            } else {
                var stockInfo = JSON.parse(body);
                let val = stockInfo['Time Series (1min)'];
                addOn(val)
            }
        });
    }
    getURL(inner)
}

