$(function () {
    let price, symbol;
    $('#symbol-form').submit(function (evt) {
        evt.preventDefault();
        symbol = $('#symbol').val();
        let Url = `https://api.iextrading.com/1.0/stock/${symbol}`+
                  `/quote?filter=latestPrice`;
        $('#price').remove();
        $('#row2').empty();
        $('#form2').empty();
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
                $('#row2').addClass('text-info');
                $('#row2').append(tag);
                let form = '<form class="form-inline" id="buysell">'+
                           '<div class="form-group">'+
                           '<input type="number" id="shares" class="form-control">'+
                           '<div class="button-group-sm" role="group">'+
                           '<button type="submit" id="buy" class="btn btn-secondary">Buy</button>'+
                           '<button type="submit" id="sell" class="btn btn-secondary">Sell</button>'+
                           '</div>'+
                           '</div>'+
                           '</form>';
                $('#form2').append(form);
            },
            error: function (req, error) {
                let tag = `<p id='price'>Invalid symbol: "${symbol}"</p>`;
                $('#row2').addClass('text-danger');
                $('#row2').append(tag);
            }
        });
    });
    function drawTable () {
        $.ajax({
            url: 'http://localhost:4800/table',
            type: 'POST',
            dataType: 'json',
            success: function (data) {
                console.log('drawing table');
                if (data.length > 0) {
                    // Formatting
                    data.forEach(row => {
                        row.roi = (100 * ((row.value - row.investment)
                                          / row.investment)).toFixed(2) + '%';
                        row.symbol = row.symbol.toUpperCase();
                        for (e of ['price', 'value', 'investment']) {
                            row[e] = '$' + row[e].toString();
                            if (!row[e].includes('.')) {
                                row[e] = row[e] + '.00';
                            } else if (row[e].split('.')[1].length < 2) {
                                row[e] = row[e] + '0';
                            }
                        }
                    });
                    let table = '<div class="container mt-3 table-responsive-sm scrollable-div" id="table-container">'+
                                '<table class="table table-striped">'+
                                  '<thead>'+
                                    '<tr>'+
                                      '<th scope="col">Stock</th>'+
                                      '<th scope="col"># of Shares</th>'+
                                      '<th scope="col">Current Price</th>'+
                                      '<th scope="col">Value</th>'+
                                      '<th scope="col">Investment</th>'+
                                      '<th scope="col">ROI</th>'+
                                    '</tr>'+
                                  '</thead>'+
                                  '<tbody>';
                    for (let row of data) {
                        let tRow = '<tr>';
                        for (let key of Object.keys(row)) {
                            tRow += `<td>${row[key]}</td>`;
                        }
                        tRow += '</tr>';
                        table += tRow;
                    }
                    table += '</tbody>'+
                             '</table>'+
                             '</div>'
                    $('#row4').empty();
                    $('#row4').append(table);
                } else {
                    $('#row4').empty();
                }
            },
            error: function (req, error) {
                $('#row4').addClass('text-danger pt-2');
                $('#row4').append('<p>An error occurred while '+
                                  'loading the table.</p>');
            }
        });
    }
    function buysell (event, type) {
        event.preventDefault();
        let number = $('#shares').val();
        $('#row2').empty();
        $('#row2').removeClass('text-info');
        $('#row2').removeClass('text-danger');
        $('#row2').removeClass('slightly-larger');
        $('#form2').empty();
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
                $('#row2').append(data.message);
                $('#balance').text('$'+data.balance.toFixed(2));
                console.log('here');
                setTimeout(drawTable, 500);
            },
            error: function (req, error) {
                $('#row2').addClass('text-danger');
                $('#row2').append('An error occurred.');
            }
        });
    }
    drawTable();
    $(document).on('click', '#buy', evt => buysell(evt, "buy"));
    $(document).on('click', '#sell', evt => buysell(evt, "sell"));
});
