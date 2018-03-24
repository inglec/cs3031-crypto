const redditOAuthUrl = 'https://www.reddit.com/api/v1/authorize.compact';
const redditClientId = 'sFi3d924dB6jOA';
const redditClientSecret = 'kp3pWuuA5hVXuUg';
const hostingUrl = 'https://inglec-crypto.firebaseapp.com';
const oAuthUrl = redditOAuthUrl + '?' +
    'client_id=' + redditClientId +
    '&response_type=code' +
    '&state=' + 'random string' +
    '&redirect_uri=' + hostingUrl + '/redirect' +
    '&duration=permanent' +
    '&scope=' + 'identity';

const functions = require('firebase-functions');
const express = require('express');
const admin = require('firebase-admin');
const http = require('http');
const https = require('https');

var accessToken; // Reddit OAuth token

admin.initializeApp(functions.config().firebase);

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

const app = express();
app.get('/auth', function(request, response) {
    if (accessToken) {
        response.json({
            message: 'Signed in to reddit API'
        });
    }
    else {
        response.set('Content-Type', 'text/html');
        response.send('<!DOCTYPE html><html><body><a href="' + oAuthUrl + '">Sign in to reddit api</a></body></html>');
    }
});
app.get('/decrypt', function(request, response) {
    const url = request.query.url; // URL to be decrypted by server.

    response.json({
        url: url,
        redirect: oAuthUrl,
        content: 'Hello'
    });
});
app.get('/redirect', function(request, response) {
    var options = {
        hostname: 'https://www.reddit.com/api/v1/access_token',
        port: 443,
        method: 'POST'
    };

    var httpsRequest = https.request(options, function(httpsResponse) {
        response.send();
    });

    var body = 'grant_type=authorization_code' +
    '&code=' + request.query.code,
    '&redirect_uri=' + hostingUrl + '/redirect';

    response.json({

    });
});

exports.app = functions.https.onRequest(app);
