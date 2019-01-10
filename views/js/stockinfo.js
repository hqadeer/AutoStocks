$(function () {
    $('#symbol-form').submit(function (evt) {
        evt.preventDefault();
        let symbol = [$('#symbol').val()]
        let Url = `https://api.iextrading.com/1.0/stock/${symbol}`+
                  `/quote?filter=latestPrice`
        $.ajax({
            url: Url,
            type: 'GET',
            dataType: 'json',
            success: function (data) {
                console.log(data);
            },
            error: function (req, error) {
                console.log(error);
            }
        });
        console.log(Url);
    });
});
