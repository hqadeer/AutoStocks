let globals = {}

$(function () {
    let price, symbol;
    let flag = false;
    $('#symbol-form').submit(function (evt) {
        evt.preventDefault();
        globals.symbol = $('#symbol').val();
        symbol = globals.symbol;
        let Url = `https://api.iextrading.com/1.0/stock/${symbol}`+
                  `/quote?filter=latestPrice`;
        $('#row2').removeClass('text-info');
        $('#row2').removeClass('text-danger');
        $('#row2').addClass('slightly-larger');
        $.ajax({
            url: Url,
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                price = data.latestPrice;
                let tag = `<p id='price'>Price: $${price}</p>`;
                $('#graph1').empty();
                $('#graph2').empty();
                $('#row2').addClass('text-info');
                $('#row2').html(tag);
                $('#row2-5').html('<a id="graph" href="#">Load Graphs</a>');
                let form = '<form class="form-inline" id="buysell">'+
                           '<div class="form-group">'+
                           '<input type="number" id="shares" class="form-control">'+
                           '<div class="button-group-sm" role="group">'+
                           '<button type="submit" id="buy" class="btn btn-secondary">Buy</button>'+
                           '<button type="submit" id="sell" class="btn btn-secondary">Sell</button>'+
                           '</div>'+
                           '</div>'+
                           '</form>';
                $('#form2').html(form);
            },
            error: function (req, error) {
                let tag = `<p id='price'>Invalid symbol: "${symbol}"</p>`;
                $('#row2').addClass('text-danger');
                $('#row2').html(tag);
                $('#row2.5').empty();
            }
        });
    });
    format = (number, mode) => {
        let base = number.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        if (mode === '$') {
            return mode + base;
        } else if (mode === '%') {
            return base + mode;
        }
    }
    function drawTable () {
        $.ajax({
            url: 'http://localhost:4800/table',
            type: 'POST',
            dataType: 'json',
            success: function (data) {
                let sum = parseFloat($('#balance').text().substring(7));
                if (data.length > 0) {
                    flag = false;
                    // Formatting and sum computation
                    data.forEach(row => {
                        sum += row.value
                        row.roi = format((100 * ((row.gains - row.investment)
                                          / row.investment)), '%')
                        row.symbol = row.symbol.toUpperCase();
                        for (e of ['price', 'value', 'investment']) {
                            row[e] = format(row[e], '$');
                        }
                        row.percent = format(100 * row.percent, '%');
                    });
                    let table = '<div class="container mt-3 table-responsive-sm scrollable-div" id="table-container">'+
                                '<table class="table table-striped">'+
                                  '<thead>'+
                                    '<tr>'+
                                      '<th scope="col">Stock</th>'+
                                      '<th scope="col"># of Shares</th>'+
                                      '<th scope="col">Current Price</th>'+
                                      '<th scope="col">Price Today</th>'+
                                      '<th scope="col">Value</th>'+
                                      '<th scope="col">Investment</th>'+
                                      '<th scope="col">ROI</th>'+
                                    '</tr>'+
                                  '</thead>'+
                                  '<tbody>';
                    for (let row of data) {
                        let tRow = '<tr>';
                        for (let key of Object.keys(row)) {
                            if (key != 'gains') {
                                tRow += `<td>${row[key]}</td>`;
                            }
                        }
                        tRow += '</tr>';
                        table += tRow;
                    }
                    table += '</tbody>'+
                             '</table>'+
                             '</div>';
                    $('#row4').removeClass('text-danger pt-2');
                    $('#row4').html(table);
                } else {
                    $('#row4').empty();
                    flag = true;
                }
                console.log(sum)
                let worth = format(sum, '$');
                let roi = format(100 * ((sum - 100000) / 100000), '%');
                let color;
                if (sum > 100000) {
                    color = 'text-success';
                } else {
                    color = 'text-danger';
                }
                $('#roi').removeClass('text-success');
                $('#roi').removeClass('text-danger');
                $('#roi').addClass(color);
                $('#worth').text('Worth: ' + worth);
                $('#roi').text('ROI: ' + roi);
            },
            error: function (req, error) {
                $('#row4').addClass('text-danger pt-2');
                $('#row4').html('<p>An error occurred while '+
                                'loading the table.</p>');
            }
        });
    }
    function buysell (event, type) {
        event.preventDefault();
        let number = $('#shares').val();
        $('#row2').removeClass('text-info');
        $('#row2').removeClass('text-danger');
        $('#row2').removeClass('slightly-larger');
        $('#form2').empty();
        $('#row2-5').empty()
        $('#graph1').empty();
        $('#graph2').empty();
        $.ajax({
            url: `http://localhost:4800/${type}`,
            type: 'POST',
            data: { number: number, price: price, symbol: symbol },
            dataType: 'json',
            success: function (data) {
                if (data.failed) {
                    $('#row2').addClass('text-danger');
                } else {
                    $('#row2').addClass('text-info');
                }
                $('#row2').html(data.message);
                $('#balance').text('Cash: $'+data.balance.toFixed(2));
                console.log('here');
                setTimeout(timeTable, 500);
            },
            error: function (req, error) {
                $('#row2').addClass('text-danger');
                $('#row2').html('An error occurred.');
            }
        });
    }
    function timeTable() {
        drawTable()
        if (!flag) {
            setTimeout(timeTable, 10000);
        }
    }
    timeTable();
    $(document).on('click', '#buy', evt => buysell(evt, "buy"));
    $(document).on('click', '#sell', evt => buysell(evt, "sell"));
    $(document).on('click', '#graph', () => {
        if ($('#graph').text() === 'Load Graphs') {
            $('#graph').text('Hide Graphs');
            $('#graph1').attr('hidden', false);
            $('#graph2').attr('hidden', false);
            $('#graph1').html('<script src="js/graph1.js"></script>');
            $('#graph2').html('<script src="js/graph2.js"></script>');
            $('#graph1').slideDown('slow');
            $('#graph2').slideDown('slow');
        } else {
            $('#graph').text('Load Graphs');
            $('#graph1').attr('hidden', true);
            $('#graph2').attr('hidden', true);
            $('#graph1').slideUp('fast');
            $('#graph2').slideUp('fast');
        }
    });
});
