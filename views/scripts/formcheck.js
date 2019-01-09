$(function () {
    $('#form').submit(function (evt) {
        $(':input').each(function () {
            if ($(this).val() === '') {
                evt.preventDefault();
                window.history.back();
                $(this).css('border-color', 'red');
                $('contentdiv').append("<p class='text-danger pt-3 "+
                                       "text-center'> Empty field! </p");
            }
        });
    });
});
