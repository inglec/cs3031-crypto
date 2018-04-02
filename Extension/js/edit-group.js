// NodeJS modules
const rsa = require('node-rsa'); // RSA encryption library.

const serverUrl = 'https://inglec-crypto.firebaseapp.com';
const serverPublicKey = new rsa('-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8TFBLh5VYqPa40YR/rGUTND1Qsi0DOa32whICYFmzQ61uYKm2IKbvGGQ8Yoai/oS4aeFvw8zfEPtd/ryUQ5qULfxBuE6fVn3T5uxJCYaXR4EAxuRu4WOTa9gl3R27PtkEK2CfpgRcp7rx8/T2I89IcEcKP9PnHMf0InitLVf7D7bSBxMCzWkdYJ7qIl3cnEpGjn7I5sCrQX0iEXIuJIUYw3GTsM1EwUTKg51fRTqqOS4CoWWN/eNy4R6fJs4ckQiaKp2hPYM3U0RVyPOLpYftJwQJJz2WRtMgl+ZPHOL0lIkiP0NpcXCQHK698IppCOhY48D9276WgkibXQcATrIMwIDAQAB-----END PUBLIC KEY-----');

const message = $('#message');

var groupName;

onload = function() {
    groupName = getParameterByName('group');
    $('#heading').html('<a href="menu.html"><span class="oi oi-arrow-circle-left"></span></a> Edit <b>' + groupName + '</b>');

    getGroupMembers();
}

function getGroupMembers() {
    // Get group users.
    chrome.storage.local.get(['username', 'privateKey', 'publicKey'], function(storage) {
        var body = {
            username: storage.username,
            publicKey: storage.publicKey, // Acts as session token.
            group: groupName
        };
        var encrypted = serverPublicKey.encrypt(new Buffer(JSON.stringify(body), 'utf8'), 'base64');

        $.post(serverUrl + '/getgroupmembers', {
            encryptedContent: encrypted
        },
        function(response) {
            var group = JSON.parse(
                new rsa(storage.privateKey).decrypt(new Buffer(response.encryptedContent, 'base64'), 'utf8')
            );

            // Create HTML table from data.
            var html = '';
            for (var i = 0; i < group.members.length; i++) {
                html += '<tr>';
                html += '<td>' + (i+1) + '</td>';
                html += '<td>' + group.members[i] + '<a href="remove-member.html?group=' + groupName + '&member=' + group.members[i] + '"><span class="oi oi-trash float-right"></span></a></td>';
                html += '</tr>';
            }
            $('#members').html(html);
        });
    });
}

$('#button-add-to-group').click(function() {
    var member = $('#input-add-user').val(); // Get user from input field.

    chrome.storage.local.get(['username', 'privateKey', 'publicKey'], function(storage) {
        var body = {
            username: storage.username,
            publicKey: storage.publicKey,
            group: groupName,
            member: member
        };
        var encrypted = serverPublicKey.encrypt(new Buffer(JSON.stringify(body), 'utf8'), 'base64');

        $.post(serverUrl + '/addgroupmember', {
            encryptedContent: encrypted
        },
        function(response) {
            message.hide(); // Hide error message.
            $('#input-add-user').val(''); // Clear field
            getGroupMembers();
        }).fail(function(error) {
            message.show();
            message.attr('class','alert alert-danger');
            message.text(error.responseText);
        });
    });
});

$('#button-delete-group').click(function() {
    chrome.storage.local.get(['username', 'privateKey', 'publicKey'], function(storage) {
        var body = {
            username: storage.username,
            publicKey: storage.publicKey,
            group: groupName
        };
        var encrypted = serverPublicKey.encrypt(new Buffer(JSON.stringify(body), 'utf8'), 'base64');

        $.post(serverUrl + '/deletegroup', {
            encryptedContent: encrypted
        },
        function(response) {
            window.location = 'menu.html';
        });
    });
});

// https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}
