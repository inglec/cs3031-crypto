// NodeJS modules
const rsa = require('node-rsa'); // RSA encryption library.

const serverUrl = 'https://inglec-crypto.firebaseapp.com';
const serverPublicKey = new rsa('-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8TFBLh5VYqPa40YR/rGUTND1Qsi0DOa32whICYFmzQ61uYKm2IKbvGGQ8Yoai/oS4aeFvw8zfEPtd/ryUQ5qULfxBuE6fVn3T5uxJCYaXR4EAxuRu4WOTa9gl3R27PtkEK2CfpgRcp7rx8/T2I89IcEcKP9PnHMf0InitLVf7D7bSBxMCzWkdYJ7qIl3cnEpGjn7I5sCrQX0iEXIuJIUYw3GTsM1EwUTKg51fRTqqOS4CoWWN/eNy4R6fJs4ckQiaKp2hPYM3U0RVyPOLpYftJwQJJz2WRtMgl+ZPHOL0lIkiP0NpcXCQHK698IppCOhY48D9276WgkibXQcATrIMwIDAQAB-----END PUBLIC KEY-----');


onload = function() {
    chrome.storage.local.get('username', function(storage) {
        $('#welcome').text('Welcome ' + storage.username + '!');
    });

    getGroups();
}

$('#button-sign-out').click(function() {
    chrome.storage.local.clear(function() {
        window.location = 'login.html'; // Navigate to login page.
    });
});

$('#button-create-group').click(function() {
    var group = $('#input-group-name').val();

    chrome.storage.local.get(['username', 'privateKey'], function(storage) {
        var body = {
            username: storage.username,
            group: group
        };
        var encrypted = serverPublicKey.encrypt(new Buffer(JSON.stringify(body), 'utf8'), 'base64');

        $.post(serverUrl + '/creategroup', {
            encryptedContent: encrypted
        },
        function(response) {
            getGroups(); // Update groups
        });
    });
});

function getGroups() {
    chrome.storage.local.get(['username', 'privateKey'], function(storage) {
        var body = {
            username: storage.username
        };
        var encrypted = serverPublicKey.encrypt(new Buffer(JSON.stringify(body), 'utf8'), 'base64');

        $.post(serverUrl + '/getgroups', {
            encryptedContent: encrypted
        },
        function(response) {
            var groups = JSON.parse(
                new rsa(storage.privateKey).decrypt(new Buffer(response.encryptedContent, 'base64'), 'utf8')
            );

            // Create HTML table from data.
            var html = '';
            for (var i = 0; i < groups.admin.length; i++) {
                html += '<tr>';
                html += '<td>' + (i+1) + '</td>';
                html += '<td>' + groups.admin[i] + '<a href="edit-group.html?group=' + groups.admin[i] + '"><span class="oi oi-cog float-right"></span></a></td>';
                html += '</tr>';
            }
            $('#admin').html(html);

            html = '';
            for (var i = 0; i < groups.members.length; i++) {
                html += '<tr>';
                html += '<td>' + (i+1) + '</td>';
                html += '<td>' + groups.members[i] + '<a href="leave-group.html?group=' + groups.members[i] + '"<span class="oi oi-trash float-right"></span></a></td>';
                html += '</tr>';
            }
            $('#user').html(html);
        });
    });
}
