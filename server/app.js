// Dependencies
var net = require('net'),
    express = require('express');

// mochad client
var client;

function setupConnection() {
    client = net.connect({port: 1099}, function() {
        console.log('Connection successful');
    });

    client.on('error', function(e) {
        console.log('Connection error: ' + e.code);
        console.log('Retrying in 1 second...');
        setTimeout(setupConnection, 1000);
    });
}

setupConnection();

// Web server
var app = express();

app.get('/', function(req, res) {
    res.send({hello: 'world'});
});

app.listen(3000);
