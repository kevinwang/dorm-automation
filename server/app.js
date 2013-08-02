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

    client.setNoDelay();

    client.on('error', function(e) {
        console.log('Connection error: ' + e.code);
        console.log('Retrying in 1 second...');
        setTimeout(setupConnection, 1000);
    });
}

function sendX10Command(addr, value, callback) {
    var cmd = 'pl ' + addr + ' ' + value;
    console.log(cmd);
    client.write(cmd + '\n', null, callback);
}

setupConnection();

// Web server
var app = express();
app.use(express.bodyParser());

app.get('/', function(req, res) {
    res.send({hello: 'world'});
});

app.put('/api/modules/:addr', function(req, res) {
    if (['on', 'off'].indexOf(req.body.value) != -1) { 
        sendX10Command(req.params.addr, req.body.value, function(err) {
            if (err) {
                res.send(500);
            }
            else {
                res.send(200);
            }
        });
    }
    else {
        res.send(400);
    }
});

app.listen(80);
