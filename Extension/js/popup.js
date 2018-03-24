const authUrl = 'https://inglec-crypto.firebaseapp.com/auth'

$('#button-test').click(function() {
    console.log('click!');
});

$('#button-decrypt').click(function() {
    $.getJSON(authUrl, function(data) {
        console.log(response);
    });
});
