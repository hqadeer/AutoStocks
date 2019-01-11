$(function () {
    let price, symbol;
    $('#symbol-form').submit(function (evt) {
        evt.preventDefault();
        symbol = [$('#symbol').val()];
        let Url = `https://api.iextrading.com/1.0/stock/${symbol}`+
                  `/quote?filter=latestPrice`;
        $('#price').remove();
        $('#row2').addClass('slightly-larger')
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
    function buysell (event, type) {
        evt.preventDefault();
        let number = $('#shares').val();
        $('#row2').empty();
        $('#row2').removeClass('text-info');
        $('#row2').removeClass('text-danger');
        $('#row2').removeClass('slightly-larger');
        $('#form2').empty();
        $.ajax({
            url: `http://localhost:4800/${type}`,
            type: 'POST',
            data: { shares: number, price: price, symbol: symbol },
            dataType: 'json',
            success: function (data) {
                if (data.failed) {
                    $('#row2').addClass('text-danger');
                } else {
                    $('#row2').addClass('text-info');
                }
                $('#row2').append(data.message);
                $('#balance').val(data.balance);
            },
            error: function (req, error) {
                $('#row2').addClass('text-danger');
                $('#row2').append('An error occurred.');
            }
        });
    }
    $(document).on('submit', '#buy', evt => buysell(evt, "buy"));
    $(document).on('submit', '#sell', evt => buysell(evt, "sell"));
});
