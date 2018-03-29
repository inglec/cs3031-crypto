onload = function() {
    chrome.storage.local.get(['username', 'privateKey'], function(value) {
        $('#welcome').text('Welcome ' + value.username + '!');
    });
}

$('#button-sign-out').click(function() {
    chrome.storage.local.clear(function() {
        window.location = 'login.html';
    });
});
