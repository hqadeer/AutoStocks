$(function () {
    $.ajax({
        url: `https://api.iextrading.com/1.0/stock/${globals.symbol}/chart/1d`+
             '?filter=date,marketAverage,minute',
        type: 'GET',
        datatype: 'json',
        success: function (a) {
            let symbol = globals.symbol;
            let x = [], y = [];
            let data = a.map(row => {
                x.push(row.minute);
                y.push(row.marketAverage);
            });
            let chart_data = [{
                type: 'scatter',
                mode: 'lines',
                name: `${symbol.toUpperCase()} price`,
                x: x,
                y: y
            }];
            let layout = {
                title: `${symbol.toUpperCase()} Price: Past Day`,
                xaxis: {
                    autorange: true,
                    rangeselector: { buttons: [
                        {
                            count: 1,
                            label: '1hr',
                            step: 'hour',
                            stepmode: 'backward'
                        },
                        {
                            count: 6,
                            label: '6hr',
                            step: 'hour',
                            stepmode: 'backward'
                        },
                        { step: 'all' }
                    ]},
                    type: 'time'
                },
                yaxis: {
                    autorange: true,
                    type: 'linear'
                }
            };
            Plotly.newPlot('graph1', chart_data, layout);
        },
        error: function (req, err) {
            $('#graph1').html('<p class="text-danger">Could not load graph</p>');
        }
    });
});
