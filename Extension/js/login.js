// NodeJS modules
const rsa = require('node-rsa'); // RSA encryption library.

const serverUrl = 'https://inglec-crypto.firebaseapp.com';
const serverPublicKey = new rsa('-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8TFBLh5VYqPa40YR/rGUTND1Qsi0DOa32whICYFmzQ61uYKm2IKbvGGQ8Yoai/oS4aeFvw8zfEPtd/ryUQ5qULfxBuE6fVn3T5uxJCYaXR4EAxuRu4WOTa9gl3R27PtkEK2CfpgRcp7rx8/T2I89IcEcKP9PnHMf0InitLVf7D7bSBxMCzWkdYJ7qIl3cnEpGjn7I5sCrQX0iEXIuJIUYw3GTsM1EwUTKg51fRTqqOS4CoWWN/eNy4R6fJs4ckQiaKp2hPYM3U0RVyPOLpYftJwQJJz2WRtMgl+ZPHOL0lIkiP0NpcXCQHK698IppCOhY48D9276WgkibXQcATrIMwIDAQAB-----END PUBLIC KEY-----');


const message = $('#message'); // Common UI element for outputting messages to user.

// Check if user is still logged in.
chrome.storage.local.get(['username', 'privateKey'], function(storage) {
    if (storage.username && storage.privateKey) {
        window.location = 'menu.html'; // Navigate to main menu.
    }
});

$('#button-sign-in').click(function() {
    message.show();
    message.attr('class','alert alert-info');
    message.text('Generating RSA keys...');

    // Get user info from text fields.
    var username = $('#username').val();
    var password = $('#password').val();

    setTimeout(function() {
        var keys = generateKeyPair(); // Generate new RSA key-pair for user.

        // Encrypt POST data with server's RSA public key.
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
                publicKey: keys.publicKey,
                privateKey: keys.privateKey
            }, function() {
                message.attr('class','alert alert-success');
                message.text('Success!');
                window.location = 'menu.html'; // Navigate to main menu.
            });
        }).fail(function(error) {
            message.attr('class','alert alert-danger');
            message.text(error.responseText);
        });
    }, 0);
});

$('#button-register').click(function() {
    message.show();
    message.attr('class','alert alert-info');
    message.text('Registering new user... Please wait.');

    // Get user data from text fields.
    var username = $('#username').val();
    var password = $('#password').val();

    // Encrypt POST data with server's RSA public key.
    var user = {
        username: username,
        password: password
    };
    var encryptedUser = serverPublicKey.encrypt(new Buffer(JSON.stringify(user), 'utf8'), 'base64');

    $.post(serverUrl + '/register', {
        encryptedContent: encryptedUser
    }, function(response) {
        // User successfully registered.
        message.attr('class','alert alert-success');
        message.text('Successfully registered! Please sign in.');

        $('#password').val(''); // Clear password field.
    }).fail(function(error) {
        message.attr('class','alert alert-danger');
        message.text(error.responseText);
    });
});

// Function to generate 2048-bit RSA private-public key pair.
function generateKeyPair() {
    var key = new rsa().generateKeyPair(2048, 65537); // Generate 2048-bit key

    return {
        publicKey: key.exportKey('public'), // 'pkcs8-public-pem'
        privateKey: key.exportKey('private') // 'pkcs1-private-pem'
    };
}
