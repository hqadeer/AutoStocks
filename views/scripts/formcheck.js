$(function () {
    $('submit').click(function () {
        $(':input').each(function () {
            if ($(this).val() === '') {
                $(this).css('border-color', 'red');
                $('contentdiv').append("<p class='text-danger pt-3 "+
                                       "text-center'> Empty field </p");
            }
        });
    });
});
