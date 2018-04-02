// Node modules
const admin      = require('firebase-admin');
const functions  = require('firebase-functions');
const express    = require('express'); // http://expressjs.com/
const bodyParser = require('body-parser');
const https      = require('https');
const fs         = require('fs');
const cryptoJS   = require('crypto-js'); // https://www.npmjs.com/package/crypto-js
const rsa        = require('node-rsa'); // https://github.com/rzcoder/node-rsa

// Encryption Keys
const rsaKey = new rsa(functions.config().keys.serverprivatekey); // Used for decrypting incoming requests.
const aesKey = functions.config().keys.serversymmetrickey; // Used for encrypting / decrypting Reddit posts.

const encryptedPrefix = '#reddecryptor:'; // Prefix to determine encrypted Reddit posts.

// Module initialisation
admin.initializeApp(functions.config().firebase); // Load Firebase project config.
const database = admin.database(); // Firebase Realtime Database.

const app = express();
app.use(bodyParser.json()); // Middleware for handling POST JSON requests.

// Allow CORS for all requests.
app.use('/', function(request, response, next) {
    response.header('Access-Control-Allow-Origin', '*');
    response.header('Access-Control-Allow-Headers', 'X-Requested-With');
    next();
});

/**
 * Decrypt body of request using RSA private key.
 */
function decryptRequestBody(request) {
    var buffer = new Buffer(request.body.encryptedContent, 'base64');
    var decrypted = rsaKey.decrypt(buffer, 'utf8');
    return JSON.parse(decrypted);
}

app.post('/register', function(request, response) {
    var body = decryptRequestBody(request);

    // Fetch user from database.
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

app.post('/login', function(request, response) {
    var body = decryptRequestBody(request);

    // Fetch user from database.
    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                var hashedPassword = cryptoJS.SHA512(body.password).toString();
                if (user.hashedPassword === hashedPassword) {
                    database.ref('users/' + body.username).update({
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

app.post('/encrypt', function(request, response) {
    var body = decryptRequestBody(request);

    // Fetch user from database.
    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                // Fetch group from database.
                database.ref('groups/' + body.post.group)
                    .once('value')
                    .then(function(snapshot) {
                        var group = snapshot.val();

                        // Check if group exists.
                        if (group) {
                            // Check if user is a member or admin of the group being posted to.
                            if (group.admin === body.username || (group.members && group.members[body.username])) {
                                // Encrypt Reddit post with AES.
                                var encryptedPost = encryptPost(body.post);

                                // Encrypt encrypted post with users RSA public key in base 64.
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
                            response.status(404);
                            response.send('Group Does Not Exist');
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

/**
 * Encrypt Reddit post with AES.
 */
function encryptPost(post) {
    var encryptedPostContent = cryptoJS.AES.encrypt(JSON.stringify(post), aesKey).toString();
    var encryptedPost = {
        title: encryptedPrefix + post.group,
        content: encryptedPostContent
    };
    return encryptedPost;
}

app.post('/decrypt', function(request, response) {
    var body = decryptRequestBody(request);

    // Fetch user from database.
    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                // Remove search parameters from URL.
                var url = require('url').parse(body.url);
                var redditUrl = url.protocol + '//' + url.hostname + url.pathname + '.json';

                // Send HTTPS GET request for Reddit post in JSON format.
                https.get(redditUrl, function(redditResponse) {
                    if (redditResponse.statusCode === 200) { // OK
                        var buffer = [];
                        redditResponse.on('data', function(data) {
                            buffer.push(data);
                        });
                        redditResponse.on('end', function() {
                            buffer = Buffer.concat(buffer); // Concatonate received data.

                            var encryptedPost = JSON.parse(buffer.toString());
                            var post = decryptPost(encryptedPost); // Decrypt Reddit post.

                            // Fetch group from database.
                            database.ref('groups/' + post.group)
                                .once('value')
                                .then(function(snapshot) {
                                    var group = snapshot.val();

                                    // Check if group exists.
                                    if (group) {
                                        // Check if user is a member or admin of group.
                                        if (group.admin === body.username || (group.members && group.members[body.username])) {
                                            // Encrypt encrypted post with user's RSA public key.
                                            var userKey = new rsa(user.publicKey);
                                            var encryptedResponse = userKey.encrypt(new Buffer(JSON.stringify(post)), 'base64');

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
                                        response.status(404);
                                        response.send('Group Does Not Exist');
                                    }
                                }
                            );
                        });
                    }
                    else { // Reddit server error.
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

/**
 * Decrypt a Reddit post with AES.
 */
function decryptPost(encryptedPost) {
    var post = encryptedPost[0].data.children[0];

    var group = post.data.title.split(encryptedPrefix)[1]; // Extract group name from post title.
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

app.post('/getgroups', function(request, response) {
    var body = decryptRequestBody(request);

    // Fetch user from database.
    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                // Treat public key as session token.
                if (body.publicKey === user.publicKey) {
                    // Fetch all groups from database.
                    database.ref('groups/')
                        .once('value')
                        .then(function(snapshot) {
                            var groups = snapshot.val();
                            var groupNames = Object.keys(groups);

                            var userGroups = {
                                admin: [], // Groups where user is an administrator.
                                members: [] // Groups where user is a member.
                            }

                            // Determine which groups the user is an admin or member of.
                            for (var i = 0; i < groupNames.length; i++) {
                                var group = groupNames[i];
                                if (groups[group].admin === body.username)
                                    userGroups.admin.push(group);
                                else if (groups[group].members && groups[group].members[body.username])
                                    userGroups.members.push(group);
                            }

                            // Encrypt group data with user's RSA public key.
                            var userKey = new rsa(user.publicKey);
                            var encryptedResponse = userKey.encrypt(new Buffer(JSON.stringify(userGroups)), 'base64');

                            response.status(200);
                            response.json({
                                encryptedContent: encryptedResponse
                            });
                        }
                    );
                }
                else {
                    response.status(401);
                    response.send('Public key does not match');
                }
            }
            else {
                response.status(401);
                response.send('User does not exist');
            }
        }
    );
});

app.post('/getgroupmembers', function(request, response) {
    var body = decryptRequestBody(request);

    // Fetch group from database.
    database.ref('groups/' + body.group)
        .once('value')
        .then(function(snapshot) {
            var group = snapshot.val();

            if (group) {
                // Only respond to the group admin.
                if (group.admin === body.username) {
                    var responseBody = { members: [] }
                    if (group.members) {
                        var members = Object.keys(group.members);
                        for (var i = 0; i < members.length; i++) {
                            responseBody.members.push(members[i]);
                        }
                    }

                    // Fetch user from database.
                    database.ref('users/' + body.username)
                        .once('value')
                        .then(function(snapshot) {
                            var user = snapshot.val();

                            if (user) {
                                // Treat public key as session token.
                                if (body.publicKey === user.publicKey) {
                                    // Encrypt group data with user's RSA public key.
                                    var userKey = new rsa(user.publicKey);
                                    var encryptedResponse = userKey.encrypt(new Buffer(JSON.stringify(responseBody)), 'base64');

                                    response.status(200);
                                    response.json({
                                        encryptedContent: encryptedResponse
                                    });
                                }
                                else {
                                    response.status(401);
                                    response.send('Public key does not match');
                                }
                            }
                            else {
                                response.status(401);
                                response.send('User does not exist');
                            }
                        }
                    );
                }
                else {
                    response.status(401);
                    response.send('Not the group admin.');
                }
            }
            else {
                response.status(404);
                response.send('Group Does Not Exist');
            }
        }
    );
});

app.post('/addgroupmember', function(request, response) {
    var body = decryptRequestBody(request);

    // Fetch user from database.
    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                // Treat public key as session token.
                if (body.publicKey === user.publicKey) {
                    // Fetch group from database.
                    database.ref('groups/' + body.group)
                        .once('value')
                        .then(function(snapshot) {
                            var group = snapshot.val();

                            if (group) {
                                // Only let the admin add users to the group.
                                if (group.admin === body.username) {
                                    // Check if new member is an existing user.
                                    database.ref('users/' + body.member)
                                        .once('value')
                                        .then(function(snapshot) {
                                            user = snapshot.val();

                                            if (user) {
                                                // Add new group member.
                                                database.ref('groups/' + body.group + '/members').update({
                                                    [body.member]: 'true'
                                                });

                                                response.status(200);
                                                response.send('Success');
                                            }
                                            else {
                                                response.status(401);
                                                response.send('User does not exist');
                                            }
                                        }
                                    );
                                }
                                else {
                                    response.status(401);
                                    response.send('Not the group admin.');
                                }
                            }
                            else {
                                response.status(404);
                                response.send('Group Does Not Exist');
                            }
                        }
                    );
                }
                else {
                    response.status(401);
                    response.send('Public key does not match');
                }
            }
            else {
                response.status(401);
                response.send('User does not exist');
            }
        }
    );
});

app.post('/creategroup', function(request, response) {
    var body = decryptRequestBody(request);

    // Fetch user from database.
    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                // Treat public key as session token.
                if (body.publicKey === user.publicKey) {
                    // Fetch group from database.
                    database.ref('groups/' + body.group)
                        .once('value')
                        .then(function(snapshot) {
                            var group = snapshot.val();

                            if (group) {
                                response.status(409);
                                response.send('Group Already Exists!');
                            }
                            else {
                                // Create new group.
                                database.ref('groups/' + body.group).set({
                                    admin: body.username,
                                    members: {}
                                });

                                response.status(200);
                                response.send('Success');
                            }
                        }
                    );
                }
                else {
                    response.status(401);
                    response.send('Public key does not match');
                }
            }
            else {
                response.status(401);
                response.send('User does not exist');
            }
        }
    );
});

app.post('/removegroupmember', function(request, response) {
    var body = decryptRequestBody(request);

    // Fetch user from database.
    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                // Treat public key as session token.
                if (body.publicKey === user.publicKey) {
                    // Fetch group from database.
                    database.ref('groups/' + body.group)
                        .once('value')
                        .then(function(snapshot) {
                            var group = snapshot.val();

                            if (group) {
                                // Only group admin can remove a user.
                                if (group.admin === body.username) {
                                    // Remove member from group.
                                    database.ref('groups/' + body.group + '/members').update({
                                        [body.member]: null
                                    });

                                    response.status(200);
                                    response.send('Success');
                                }
                                else {
                                    response.status(401);
                                    response.send('Not the group admin.');
                                }
                            }
                            else {
                                response.status(404);
                                response.send('Group Does Not Exist');
                            }
                        }
                    );
                }
                else {
                    response.status(401);
                    response.send('Public key does not match');
                }
            }
            else {
                response.status(401);
                response.send('User does not exist');
            }
        }
    );
});

app.post('/leavegroup', function(request, response) {
    var body = decryptRequestBody(request);

    // Fetch user from database.
    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                // Treat public key as session token.
                if (body.publicKey === user.publicKey) {
                    // Fetch group from database.
                    database.ref('groups/' + body.group)
                        .once('value')
                        .then(function(snapshot) {
                            var group = snapshot.val();

                            if (group) {
                                // Remove user from group.
                                database.ref('groups/' + body.group + '/members').update({
                                    [body.username]: null
                                });

                                response.status(200);
                                response.send('Success');
                            }
                            else {
                                response.status(404);
                                response.send('Group Does Not Exist');
                            }
                        }
                    );
                }
                else {
                    response.status(401);
                    response.send('Public key does not match');
                }
            }
            else {
                response.status(401);
                response.send('User does not exist');
            }
        }
    );
});

app.post('/deletegroup', function(request, response) {
    var body = decryptRequestBody(request);

    // Fetch user from database.
    database.ref('users/' + body.username)
        .once('value')
        .then(function(snapshot) {
            var user = snapshot.val();

            if (user) {
                // Treat public key as session token.
                if (body.publicKey === user.publicKey) {
                    // Fetch group from database.
                    database.ref('groups/' + body.group)
                        .once('value')
                        .then(function(snapshot) {
                            var group = snapshot.val();

                            if (group) {
                                // Only group admin can delete group.
                                if (group.admin === body.username) {
                                    // Delete group.
                                    database.ref('groups/').update({
                                        [body.group]: null
                                    });

                                    response.status(200);
                                    response.send('Success');
                                }
                                else {
                                    response.status(401);
                                    response.send('Not the group admin.');
                                }
                            }
                            else {
                                response.status(404);
                                response.send('Group Does Not Exist');
                            }
                        }
                    );
                }
                else {
                    response.status(401);
                    response.send('Public key does not match');
                }
            }
            else {
                response.status(401);
                response.send('User does not exist');
            }
        }
    );
});

exports.app = functions.https.onRequest(app);
