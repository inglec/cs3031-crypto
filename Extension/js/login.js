// NodeJS modules
const cryptoJS = require('crypto-js');
const rsa      = require('node-rsa');

const serverUrl = 'https://inglec-crypto.firebaseapp.com';
const serverPublicKey = new rsa('-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8TFBLh5VYqPa40YR/rGUTND1Qsi0DOa32whICYFmzQ61uYKm2IKbvGGQ8Yoai/oS4aeFvw8zfEPtd/ryUQ5qULfxBuE6fVn3T5uxJCYaXR4EAxuRu4WOTa9gl3R27PtkEK2CfpgRcp7rx8/T2I89IcEcKP9PnHMf0InitLVf7D7bSBxMCzWkdYJ7qIl3cnEpGjn7I5sCrQX0iEXIuJIUYw3GTsM1EwUTKg51fRTqqOS4CoWWN/eNy4R6fJs4ckQiaKp2hPYM3U0RVyPOLpYftJwQJJz2WRtMgl+ZPHOL0lIkiP0NpcXCQHK698IppCOhY48D9276WgkibXQcATrIMwIDAQAB-----END PUBLIC KEY-----');

// Check if user is still logged in.
chrome.storage.local.get(['username', 'privateKey'], function(value) {
    if (value.username && value.privateKey) {
        window.location = 'menu.html';
    }
});

$('#button-sign-in').click(function() {
    var message = $('#message');
    message.show();
    message.attr('class','alert alert-info');
    message.text('Logging in... Please wait.');

    var username = $('#username').val();
    var password = $('#password').val();

    message.text('Generating RSA keys...');
    var keys = generateKeyPair(); // Generate new RSA key-pair.

    var postData = {
        username: username,
        password: password,
        publicKey: keys.publicKey
    };
    var encryptedPost = serverPublicKey.encrypt(new Buffer(JSON.stringify(postData), 'utf8'), 'base64');

    message.text('Authenticating with server...');
    $.post(serverUrl + '/login', {
        encryptedContent: encryptedPost
    }, function(response) {
        // Username and password are correct.
        chrome.storage.local.set({
            username: username,
            privateKey: keys.privateKey
        }, function() {
            message.text('Success!');
            window.location = 'menu.html';
        });
    }).fail(function(error) {
        var message = $('#message');
        message.attr('class','alert alert-danger');
        message.text(error.responseText);
        message.show();
    });
});

$('#button-register').click(function() {
    var message = $('#message');
    message.show();
    message.attr('class','alert alert-info');
    message.text('Registering new user... Please wait.');

    var username = $('#username').val();
    var password = $('#password').val();

    var user = {
        username: username,
        password: password
    };
    var encryptedUser = serverPublicKey.encrypt(new Buffer(JSON.stringify(user), 'utf8'), 'base64');

    $.post(serverUrl + '/register', {
        encryptedContent: encryptedUser
    }, function(response) {
        message.text('Successfully registered! Please sign in.');
    }).fail(function(error) {
        message.attr('class','alert alert-danger');
        message.text(error.responseText);
    });
});

// Function to generate 2048-bit RSA private-public key pair.
function generateKeyPair() {
    console.log('Generating keys...');
    var key = new rsa().generateKeyPair(2048, 65537); // Generate 2048-bit key
    console.log('Keys generated');

    return {
        publicKey: key.exportKey('public'), // 'pkcs8-public-pem'
        privateKey: key.exportKey('private') // 'pkcs1-private-pem'
    };
}
