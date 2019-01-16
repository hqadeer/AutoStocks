$(function () {
    $.ajax({
        url: `https://api.iextrading.com/1.0/stock/${globals.symbol}/chart/5y`+
             '?filter=date,close',
        type: 'GET',
        datatype: 'json',
        success: function (a) {
            let symbol = globals.symbol;
            let x = [], y = [];
            let data = a.map(row => {x.push(row.date); y.push(row.close);});
            let chart_data = [{
                type: 'scatter',
                mode: 'lines',
                name: `${symbol.toUpperCase()} price`,
                x: x,
                y: y
            }];
            let layout = {
                title: `${symbol.toUpperCase()} Price: History`,
                xaxis: {
                    autorange: true,
                    rangeselector: { buttons: [
                        {
                            count: 1,
                            label: '1m',
                            step: 'month',
                            stepmode: 'backward'
                        },
                        {
                            count: 6,
                            label: '6m',
                            step: 'month',
                            stepmode: 'backward'
                        },
                        {
                            count: 1,
                            label: '1y',
                            step: 'year',
                            stepmode: 'backward'
                        },
                        {
                            count: 2,
                            label: '2y',
                            step: 'year',
                            stepmode: 'backward'
                        },
                        { step: 'all' }
                    ]},
                    type: 'date'
                },
                yaxis: {
                    autorange: true,
                    type: 'linear'
                }
            };
            Plotly.newPlot('graph2', chart_data, layout);
        },
        error: function (req, err) {
            $('#graph2').html('<p class="text-danger">Could not load graph</p>');
        }
    });
});
