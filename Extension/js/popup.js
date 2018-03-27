// NodeJS modules
const rsa = require('node-rsa');

const serverUrl = 'https://inglec-crypto.firebaseapp.com';
const serverPublicKey = new rsa('-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8TFBLh5VYqPa40YR/rGUTND1Qsi0DOa32whICYFmzQ61uYKm2IKbvGGQ8Yoai/oS4aeFvw8zfEPtd/ryUQ5qULfxBuE6fVn3T5uxJCYaXR4EAxuRu4WOTa9gl3R27PtkEK2CfpgRcp7rx8/T2I89IcEcKP9PnHMf0InitLVf7D7bSBxMCzWkdYJ7qIl3cnEpGjn7I5sCrQX0iEXIuJIUYw3GTsM1EwUTKg51fRTqqOS4CoWWN/eNy4R6fJs4ckQiaKp2hPYM3U0RVyPOLpYftJwQJJz2WRtMgl+ZPHOL0lIkiP0NpcXCQHK698IppCOhY48D9276WgkibXQcATrIMwIDAQAB-----END PUBLIC KEY-----');

$('#button-encrypt').click(function() {
    var body = {
        username: 'inglec', // TODO change
        post: {
            title:   $('[name=title]').val(),
            content: $('.RESDialogContents').html(),
            group:   'group 18' // TODO change
        }
    }

    console.log(body);

    /*
    var encrypted = serverPublicKey.encrypt(new Buffer(JSON.stringify(body)), 'base64');
    $.post(serverUrl + '/encrypt', encrypted, function(response) {
        console.log(response);
    });
    */
});

$('#button-decrypt').click(function() {
    $.getJSON(authUrl, function(data) {
        console.log(response);
    });
});
