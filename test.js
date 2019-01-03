
Plotly = require('plotly');

function graph () {
    var URL = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=msft&interval=15min&outputsize=full&apikey=F24C5SOKOYQUBV6K`;
    Plotly.d3.json(URL, function(err, data) {
        var vals = [{
            x: [Object.keys(data['Time Series (15min)'])],
            y: Object.values(data['Time Series (15min)']).map(s => s['4. close'])
        }]
        console.log(vals)
        var layout = {
            title: 'Current Price'
        }
        Plotly.plot('recent', vals, layout); 
    })
}

graph()



