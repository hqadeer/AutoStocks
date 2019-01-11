$(function () {
    $('#symbol-form').submit(function (evt) {
        evt.preventDefault();
        let symbol = [$('#symbol').val()];
        let Url = `https://api.iextrading.com/1.0/stock/${symbol}`+
                  `/quote?filter=latestPrice`;
        $('#price').remove();
        $.ajax({
            url: Url,
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                let tag = `<p id='price'>Price: $${data.latestPrice}</p>`;
                $('#row2').append(tag);
                let form = '<form class="form-inline" action="buy" method="post">'+
                           '<div class="form-group">'+
                           '<input type="number" class="form-control">'+
                           '<div class="button-group-sm" role="group">'+
                           '<button type="button" class="btn btn-secondary">Buy</button>'+
                           '<button type="button" class="btn btn-secondary">Sell</button>'+
                           '</div>'+
                           '</div>'+
                           '</form>';
                $('#form2').append(form);
            },
            error: function (req, error) {
                let tag = `<p id='price'>Invalid symbol: "${symbol}"</p>`;
                $('#row2').append(tag);
            }
        });
    });
});
