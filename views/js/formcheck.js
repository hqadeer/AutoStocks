$(function () {
    console.log('here')
    $('submit').click(function () {
        console.log('here');
        $(':input').each(function () {
            if ($(this).val() === '') {
                alert('got here');
                evt.preventDefault();
                window.history.back();
                $(this).css('border-color', 'red');
                $('contentdiv').append("<p class='text-danger pt-3 "+
                                       "text-center'> Empty field! </p");
            }
        });
    });
});
