// Node modules
const functions  = require('firebase-functions');
const express    = require('express'); // http://expressjs.com/
const bodyParser = require('body-parser');
const https      = require('https');
const fs         = require('fs');
const cryptoJS   = require('crypto-js'); // https://www.npmjs.com/package/crypto-js
const rsa        = require('node-rsa'); // https://github.com/rzcoder/node-rsa

// Encryption Keys
const rsaKey = new rsa(fs.readFileSync('keys/server-private-key.pem', 'utf8'));
const aesKey = fs.readFileSync('keys/server-symmetric-key.txt', 'utf8');

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

/*
 * users = {
 *     inglec: {
 *         hashedPassword: "string",
 *         publicKey: "string"
 *     }
 * }
 */
 var users = {};

/*
 * groups = {
 *     1723847: {
 *         users: {
 *             inglec: true
 *         }
 *     }
 * }
 */
 var groups = {};

const app = express();
app.use(bodyParser.json());

app.post('/register', function(request, response) {
    // Decrypt body of request using RSA.
    var body = JSON.parse(
        rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    );

    var user = users[body.username];
    if (user) {
        response.status(409);
        response.send('Username already taken');
    }
    else {
        // Store new user
        user.hashedPassword = cryptoJS.SHA512(body.password).toString();

        response.status(200);
        response.send('Success');
    }
});

app.post('/login', function(request, response) {
    // Decrypt body of request using RSA.
    var body = JSON.parse(
        rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    );

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

/*
 * request.body = {
 *     encryptedContent: "RSA-encrypted string"
 * }
 *
 * body = {
 *     username: "user",
 *     post: {
 *         title: "Post Title"
 *         content: "This is a test post",
 *         group: "groupID"
 *     }
 * }
 */
app.post('/encrypt', function(request, response) {
    // Decrypt body of request using RSA.
    var body = JSON.parse(
        rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    );

    var user = users[body.username];
    if (user) {
        // Check if user is a member of the group being posted to.
        var group = groups[body.post.group];
        if (group && group.users[body.username]) {
            // Encrypt post with AES
            var encryptedPost = encryptPost(body.post);

            // Encrypt encrypted post with user's RSA public key.
            var userKey = new rsa(user.publicKey, 'utf8');
            var encryptedResponse = userKey.encrypt(encryptPost);

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

/*
 * request.body = {
 *     encryptedContent: "RSA-encrypted string"
 * }
 *
 * body = {
 *     username: "user",
 *     url: "https://www.reddit.com/r/tcdcrypto/comments/85u0p5/hai_unencrypted/"
 * }
 */
app.post('/decrypt', function(request, response) {
    // Decrypt body of request using RSA.
    var body = JSON.parse(
        rsaKey.decrypt(new Buffer(request.body.encryptedContent, 'base64'), 'utf8')
    );

    var user = users[username];
    if (user) {
        // Request Reddit post
        var url = require('url').parse(body.url);
        var options = {
            method: 'GET',
            hostname: url.hostname,
            path: url.pathname + '.json',
            port: 443
        };
        https.request(options, function(redditResponse) {
            if (redditResponse.statusCode === 200) {
                var buffer = [];
                redditResponse.on('data', function(data) {
                    buffer.push(data);
                });
                redditResponse.on('end', function() {
                    buffer = Buffer.concat(buffer);
                    var json = JSON.parse(buffer.toString());
                    var post = decryptPost(json);

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
        }).end();
    }
    else {
        response.status(401);
        response.send('Incorrect Username');
    }
});

function encryptPost(post, group) {
    // TODO

    return JSON.stringify({});
}

/*
 * returns: {
 *     group: "groupID",
 *     title: "Title",
 *     content: "This is an unencrypted post."
 * }
 */
function decryptPost(json) {
    // TODO

    /*
    var encrypted = cryptoJS.AES.encrypt('hello', key).toString();
    var decrypted = cryptoJS.AES.decrypt(encrypted, key).toString(cryptoJS.enc.Utf8);
    */

    // Get post
    var post = json[0].data.children[0];
    var comments = json[1].data.children;

    var title = post.data.title;
    var text = post.data.selftext;

    return {
        group: "groupID",
        title: post.data.title,
        content: post.data.selftext
    };
}

function desanitiseHtml(html) {
    html = html.replace(/&gt;/g, '>');
    html = html.replace(/&lt;/g, '<');
    html = html.replace(/&quot;/g, '"');
    html = html.replace(/&apos;/g, "'");
    html = html.replace(/&amp;/g, '&');
    return html;
}

exports.app = functions.https.onRequest(app);
