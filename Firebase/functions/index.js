// Node modules
const admin      = require("firebase-admin");
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

admin.initializeApp(functions.config().firebase);
const database = admin.database();

const app = express();
app.use(bodyParser.json());

// Allow CORS for all requests.
app.use('/', function(request, response, next) {
    response.header('Access-Control-Allow-Origin', '*');
    response.header('Access-Control-Allow-Headers', 'X-Requested-With');
    next();
});

// Register a new user.
app.post('/register', function(request, response) {
    // Decrypt body of request using RSA.
    var body = JSON.parse(
        rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    );

    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                response.status(409);
                response.send('Username already taken');
            }
            else {
                // Store new user.
                database.ref('users/' + body.username).set({
                    hashedPassword: cryptoJS.SHA512(body.password).toString()
                });

                response.status(200);
                response.send('Success');
            }
        }
    );
});

// Log in an existing user.
app.post('/login', function(request, response) {
    // Decrypt body of request using RSA.
    var body = JSON.parse(
        rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    );

    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                var hashedPassword = cryptoJS.SHA512(body.password).toString();
                if (user.hashedPassword === hashedPassword) {
                    database.ref('users/' + body.username).set({
                        hashedPassword: hashedPassword,
                        publicKey: body.publicKey // Update public key of user.
                    });

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
        }
    );
});

// Encrypt a Reddit post for a group.
app.post('/encrypt', function(request, response) {
    // Decrypt body of request using RSA.
    var body = JSON.parse(
        rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    );

    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                // Check if user is a member of the group being posted to.
                database.ref('groups/' + body.post.group)
                    .once('value')
                    .then(function(snapshot) {
                        var group = snapshot.val();
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
                );
            }
            else {
                response.status(401);
                response.send('Incorrect Username');
            }
        }
    );
});

function encryptPost(post) {
    var encryptedPostContent = cryptoJS.AES.encrypt(JSON.stringify(post), aesKey).toString();
    var encryptedPost = {
        title: '#inglec-crypto:' + post.group,
        content: encryptedPostContent
    };
    return encryptedPost;
}

// Decrypt a Reddit post for a group.
app.post('/decrypt', function(request, response) {
    // Decrypt body of request using RSA.
    var body = JSON.parse(
        rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    );

    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();
            if (user) {
                // Request Reddit post
                https.get(body.url + '.json', function(redditResponse) {
                    if (redditResponse.statusCode === 200) { // OK
                        var buffer = [];
                        redditResponse.on('data', function(data) {
                            buffer.push(data);
                        });
                        redditResponse.on('end', function() {
                            buffer = Buffer.concat(buffer);
                            var encryptedPost = JSON.parse(buffer.toString());

                            var post = decryptPost(encryptedPost);

                            database.ref('groups/' + post.group)
                                .once('value')
                                .then(function(snapshot) {
                                    var group = snapshot.val();

                                    if (group.users[body.username]) {
                                        // Encrypt encrypted post with user's RSA public key.
                                        var userKey = new rsa(user.publicKey);
                                        var encryptedResponse = userKey.encrypt(new Buffer(JSON.stringify(post)), 'base64');

                                        response.status(200);
                                        response.json({
                                            publicKey: user.publicKey, // TODO remove
                                            encryptedContent: encryptedResponse
                                        });
                                    }
                                    else {
                                        response.status(403);
                                        response.send('Not a Group Member');
                                    }
                                }
                            );
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
        }
    );
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
