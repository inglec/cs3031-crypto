const firebase = require('firebase/app');
require('firebase/database');

const app = firebase.initializeApp({
    apiKey: 'AIzaSyCMsV3ctBmToiijOtDKa0VWxZI1BA8zdiE',
    authDomain: 'inglec-crypto.firebaseapp.com',
    databaseURL: 'https://inglec-crypto.firebaseio.com',
    projectId: 'inglec-crypto',
    storageBucket: 'inglec-crypto.appspot.com',
    messagingSenderId: '545331563810'
});

const http = require('http');

const server = http.createServer();
server.on('request', function(request, response) {
    console.log('Received HTTP request');
    console.log(JSON.stringify(request.headers));

    var body = [];
    request.on('data', function(data) {
        body.push(data);
    });
    request.on('end', function() {
        body = Buffer.concat(body);
        console.log(body.toString());
    });
});
server.listen(80);

console.log('Listening on port 80');
