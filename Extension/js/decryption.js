// NodeJS modules
const rsa = require('node-rsa'); // RSA encryption library.

const serverUrl = 'https://inglec-crypto.firebaseapp.com';
const serverPublicKey = new rsa('-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8TFBLh5VYqPa40YR/rGUTND1Qsi0DOa32whICYFmzQ61uYKm2IKbvGGQ8Yoai/oS4aeFvw8zfEPtd/ryUQ5qULfxBuE6fVn3T5uxJCYaXR4EAxuRu4WOTa9gl3R27PtkEK2CfpgRcp7rx8/T2I89IcEcKP9PnHMf0InitLVf7D7bSBxMCzWkdYJ7qIl3cnEpGjn7I5sCrQX0iEXIuJIUYw3GTsM1EwUTKg51fRTqqOS4CoWWN/eNy4R6fJs4ckQiaKp2hPYM3U0RVyPOLpYftJwQJJz2WRtMgl+ZPHOL0lIkiP0NpcXCQHK698IppCOhY48D9276WgkibXQcATrIMwIDAQAB-----END PUBLIC KEY-----');

onload = function() {
    // Inject decryption button into post page
    var html = "<li><a id='button-decrypt' href='#'>decrypt post</a></li>";
    $('.buttons').append(html);
    $('#button-decrypt').click(decrypt);
}

function decrypt() {
    chrome.storage.local.get(['username', 'privateKey'], function(storage) {
        var body = {
            username: storage.username,
            url: window.location.href
        };

        // Encrypt POST body with server's public key.
        var encrypted = serverPublicKey.encrypt(new Buffer(JSON.stringify(body), 'utf8'), 'base64');

        $.post(serverUrl + '/decrypt', {
            encryptedContent: encrypted
        },
        function(response) {
            var post = JSON.parse(
                new rsa(storage.privateKey).decrypt(new Buffer(response.encryptedContent, 'base64'), 'utf8')
            );
            // Inject decrypted post into DOM.
            $('[data-event-action=title]').text(post.title); // Title
            $('.expando').find('.md').html(post.content); // Content
        }).fail(function(error) {
            $('.expando').find('.md').html('<p style="color: red;">Error: ' + error.responseText + '</p>');
        });
    });

    return false; // Disable link redirect from button click.
};
