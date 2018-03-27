// Node modules
const functions  = require('firebase-functions');
const express    = require('express'); // http://expressjs.com/
const bodyParser = require('body-parser');
const https      = require('https');
const fs         = require('fs');
const cryptoJS   = require('crypto-js'); // https://www.npmjs.com/package/crypto-js
const rsa        = require('node-rsa'); // https://github.com/rzcoder/node-rsa

// Encryption Keys
const rsaKey = new rsa(functions.config().keys.serverprivatekey);
const aesKey = functions.config().keys.serversymmetrickey;

// var key = new rsa().generateKeyPair(2048, 65537); // Generate 2048-bit key
// var publicKey  = key.exportKey('public'); // 'pkcs8-public-pem'
// var privateKey = key.exportKey('private'); // 'pkcs1-private-pem'
// var encrypted  = key.encrypt(new Buffer('hello world'), 'base64');
// var decrypted  = key.decrypt(new Buffer(encrypted, 'base64'), 'utf8');

const redditTypes = {
    'comment':   't1',
    'account':   't2',
    'link':      't3',
    'message':   't4',
    'subreddit': 't5',
    'award':     't6'
};

var users = {
    // Test user
    inglec: {
        // password: "helloworld",
        hashedPassword: '1594244d52f2d8c12b142bb61f47bc2eaf503d6d9ca8480cae9fcf112f66e4967dc5e8fa98285e36db8af1b8ffa8b84cb15e0fbcf836c3deb803c13f37659a60',
        publicKey: '-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAinwIoZMhTT57dgjBzJSr6BpP9D1KYdOXot7XApjLN3WH1j5f7Tm31fc6f3wYP514iX8tOH+1M5GSdv9rtXACU+jsAThaUngtM+bNcOCsGlyft6hUT79UnHINb9JwMI1CVnSBgk7UtCwaaYf7g0aOUbbFeUcwd+ZxiBdeZR58IuOPRZ1FG+ZzUntt/pM8ARI1m820Pbu/5W+CP8JyawC1nHG+SSZmlq8gD7D6pNRJlusTyeoq/J83lgN6SjK5rN4B8kdNmEMdNUPACh5wqigrjAwVDIraG2HmiTvb5A90LYJM+q3c9UWzgolodJeRI5baFGAFROHzf6QPdIrA0wBVNwIDAQAB-----END PUBLIC KEY-----'
    }
};

var groups = {
    // Test groups
    'group 18': {
        users: {
            inglec: true
        }
    }
};

const app = express();
app.use(bodyParser.json());

app.post('/register', function(request, response) {
    // Decrypt body of request using RSA.
    //var body = JSON.parse(
    //    rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    //);
    var body = request.body // TODO remove

    var user = users[body.username];
    if (user) {
        response.status(409);
        response.send('Username already taken');
    }
    else {
        // Store new user
        users[body.username] = {
            hashedPassword: cryptoJS.SHA512(body.password).toString()
        }

        response.status(200);
        response.send('Success');
    }
});

app.post('/login', function(request, response) {
    // Decrypt body of request using RSA.
    //var body = JSON.parse(
    //    rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    //);
    var body = request.body // TODO remove

    var user = users[body.username];
    if (user) {
        var hashedPassword = cryptoJS.SHA512(body.password).toString();
        if (user.hashedPassword === hashedPassword) {
            user.publicKey = body.publicKey; // Update user's public key.

            response.status(200);
            response.send('Success');
        }
        else {
            response.status(401);
            response.send('Incorrect Password');
        }
    }
    else {
        response.status(401);
        response.send('Incorrect Username');
    }
});

app.post('/encrypt', function(request, response) {
    // Decrypt body of request using RSA.
    //var body = JSON.parse(
    //    rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    //);
    var body = request.body // TODO remove

    var user = users[body.username];
    if (user) {
        // Check if user is a member of the group being posted to.
        var group = groups[body.post.group];
        if (group && group.users[body.username]) {
            // Encrypt post with AES.
            var encryptedPost = encryptPost(body.post);

            // Encrypt post with users RSA public key in base 64.
            var userKey = new rsa(user.publicKey);
            var encryptedResponse = userKey.encrypt(new Buffer(JSON.stringify(encryptedPost)), 'base64');

            response.status(200);
            response.json({
                encryptedContent: encryptedResponse
            });
        }
        else {
            response.status(403);
            response.send('Not a Group Member');
        }
    }
    else {
        response.status(401);
        response.send('Incorrect Username');
    }
});

function encryptPost(post) {
    var encryptedPostContent = cryptoJS.AES.encrypt(JSON.stringify(post), aesKey).toString();
    var encryptedPost = {
        title: '#inglec-crypto:' + post.group,
        content: encryptedPostContent
    };
    return encryptedPost;
}

app.post('/decrypt', function(request, response) {
    // Decrypt body of request using RSA.
    //var body = JSON.parse(
    //    rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    //);
    var body = request.body // TODO remove

    var user = users[body.username];
    if (user) {
        // Request Reddit post
        var url = require('url').parse(body.url);
        var options = {
            method: 'GET',
            hostname: url.hostname,
            path: url.pathname + '.json', // Return JSON response.
            port: 443
        };
        https.request(options, function(redditResponse) {
            if (redditResponse.statusCode === 200) { // OK
                var buffer = [];
                redditResponse.on('data', function(data) {
                    buffer.push(data);
                });
                redditResponse.on('end', function() {
                    buffer = Buffer.concat(buffer);
                    var encryptedPost = JSON.parse(buffer.toString());
                    var post = decryptPost(encryptedPost);

                    var group = groups[post.group];
                    if (group.users[body.username]) {
                        // Encrypt encrypted post with user's RSA public key.
                        var userKey = new rsa(user.publicKey, 'utf8');
                        var encryptedResponse = userKey.encrypt(post);

                        response.status(200);
                        response.json({
                            encryptedContent: encryptedResponse
                        });
                    }
                    else {
                        response.status(403);
                        response.send('Not a Group Member');
                    }
                });
            }
            else {
                response.status(redditResponse.statusCode);
                response.send(redditResponse.statusMessage);
            }
        }).end(); // Send HTTPS request.
    }
    else {
        response.status(401);
        response.send('Incorrect Username');
    }
});

function decryptPost(encryptedPost) {
    var post = encryptedPost[0].data.children[0];
    
    var group = post.data.title.split('#inglec-crypto:')[1];
    var encryptedContent = post.data.selftext;
    var decryptedPost = JSON.parse(
        cryptoJS.AES.decrypt(encryptedContent, aesKey).toString(cryptoJS.enc.Utf8)
    );

    return {
        group: group,
        title: decryptedPost.title,
        content: decryptedPost.content
    };
}

exports.app = functions.https.onRequest(app);
