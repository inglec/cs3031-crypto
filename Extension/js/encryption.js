// NodeJS modules
const rsa = require('node-rsa'); // RSA encryption library.

const serverUrl = 'https://inglec-crypto.firebaseapp.com';
const serverPublicKey = new rsa('-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8TFBLh5VYqPa40YR/rGUTND1Qsi0DOa32whICYFmzQ61uYKm2IKbvGGQ8Yoai/oS4aeFvw8zfEPtd/ryUQ5qULfxBuE6fVn3T5uxJCYaXR4EAxuRu4WOTa9gl3R27PtkEK2CfpgRcp7rx8/T2I89IcEcKP9PnHMf0InitLVf7D7bSBxMCzWkdYJ7qIl3cnEpGjn7I5sCrQX0iEXIuJIUYw3GTsM1EwUTKg51fRTqqOS4CoWWN/eNy4R6fJs4ckQiaKp2hPYM3U0RVyPOLpYftJwQJJz2WRtMgl+ZPHOL0lIkiP0NpcXCQHK698IppCOhY48D9276WgkibXQcATrIMwIDAQAB-----END PUBLIC KEY-----');


onload = function() {
    // Inject encryption button into submission page
    var html = '';
    html += '<span class="title">encryption group</span>';
    html += '<input id="text-group-id" type="text">';
    html += '<button id="button-encrypt" type="button">Encrypt My Post!</button>';
    html += '<div id="reddecryptor-info" class="roundfield-content" style="color:#c14b4b; display: none;"></div>';
    $('#text-field').append(html);
    $('#button-encrypt').click(encrypt);
}

function encrypt() {
    var title = $('[name=title]').val(); // Get title of post.

    var content = $('.RESDialogContents').html(); // Get HTML if Reddit Enhancement Suite is enabled.
    if (!content) content = $('[name=text]').val(); // Otherwise get plaintext.

    var group = $('#text-group-id').val(); // Get group ID.

    chrome.storage.local.get(['username', 'privateKey'], function(storage) {
        var body = {
            username: storage.username,
            post: {
                title:   title,
                content: content,
                group:   group
            }
        }

        // Encrypt post with server's RSA public key.
        var encrypted = serverPublicKey.encrypt(new Buffer(JSON.stringify(body), 'utf8'), 'base64');

        // POST to server.
        $.post(serverUrl + '/encrypt', {
            encryptedContent: encrypted
        }, function(response) {
            $('#reddecryptor-info').hide(); // Hide error messages.

            var post = JSON.parse(
                new rsa(storage.privateKey).decrypt(new Buffer(response.encryptedContent, 'base64'), 'utf8')
            );
            // Inject encrypted post into DOM.
            $('[name=title]').val(post.title);
            $('[name=text]').val(post.content);
        }).fail(function (error) {
            // Show error message.
            $('#reddecryptor-info').show();
            $('#reddecryptor-info').text('Error: ' + error.responseText);
        })
    });
}
