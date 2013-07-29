// Dependencies
var net = require('net'),
    express = require('express'),
    exec = require('child_process').exec;

// mochad client
var client;

function setupConnection() {
    client = net.connect({port: 1099}, function() {
        console.log('Connection successful');
    });

    client.on('error', function(e) {
        console.log('Connection error: ' + e.code);
        console.log('Restarting mochad; retrying in 3 seconds...');
        exec('mochad');
        setTimeout(setupConnection, 3000);
    });
}

setupConnection();

// Web server
var app = express();

app.get('/', function(req, res) {
    res.send({hello: 'world'});
});

app.listen(3000);
