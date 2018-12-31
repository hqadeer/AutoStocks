const request = require('request');

let apiKey = 'JWFEGK7M12L4LOT1';

function getCurrentPrice(symbol) {
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
                findMostRecent(val)
            }
        });
    }
    function findMostRecent (dict) {
        const comp = (a, b) => (a > b) ? dict[a]['4. close'] : dict[b]['4. close'];
        console.log(Object.keys(dict).reduce(comp));
    }
    getURL(inner)
}



function third (hi) {
    console.log('does this run')
}

getCurrentPrice('MSFT')

