$(function () {
    $('#symbol-form').submit(function (evt) {
        evt.preventDefault();
        let symbol = [$('#symbol').val()]
        let Url = `https://api.iextrading.com/1.0/stock/${symbol}`+
                  `/quote?filter=latestPrice`
        $('#price').remove();
        $.ajax({
            url: Url,
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                let tag = `<p id='price'>Price: $${data.latestPrice}</p>`;
                $('#row2').append(tag);
            },
            error: function (req, error) {
                let tag = `<p id='price'>Invalid symbol: "${symbol}"</p>`;
                $('#row2').append(tag);
            }
        });
    });
});
