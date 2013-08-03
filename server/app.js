/*
 * Dorm automation server. Uses a queue to limit command frequency because
 * mochad often becomes unresponsive if commands are launched in quick
 * succession.
 */

// Dependencies
var net = require('net'),
    express = require('express'),
    exec = require('child_process').exec;

// mochad client
var client;

/*
 * Prevents setupConnection from being called multiple times
 */
var disconnected;

/*
 * Command (and callback) queue
 */
var cmdqueue = []

/*
 * Create socket connection to mochad
 */
function setupConnection() {
    disconnected = false;
    client = net.connect({port: 1099}, function() {
        console.log('Connection successful');
    });

    client.setNoDelay();

    client.on('error', function(e) {
        if (!disconnected) {
            disconnected = true;
            console.log('Connection error: ' + e.code);
            console.log('Retrying in 1 second...');
            setTimeout(setupConnection, 1000);
        }
    });
}

/*
 * Try to send a command, and restart mochad if it fails
 */
function mochadSafe(cmdobj) {
    var lastBytesRead = client.bytesRead; // Check for acknowledgment
    console.log('Command: ' + cmdobj.cmd);
    client.write(cmdobj.cmd + '\n', null, cmdobj.callback);
    setTimeout(function() {
        if (client.bytesRead == lastBytesRead) {
            cmdqueue.unshift(cmdobj);
            console.log('mochad unresponsive, restarting...');
            exec('pkill -9 mochad; mochad', function() {
                console.log('mochad restarted');
            });
        }
    }, 250);
}

/*
 * Add command to queue
 */
function enqueueX10Command(addr, value, callback) {
    var cmd = 'pl ' + addr + ' ' + value;
    cmdqueue.push({cmd: cmd, callback: callback});
}

/*
 * Make sure mochad is still alive
 */
function mochadHeartbeat() {
    mochadSafe({cmd: 'st'});
}

/*
 * Send next command on the queue, or send heartbeat if queue is empty
 */
function sendNextCommand() {
    setTimeout(sendNextCommand, 2000);
    if (cmdqueue.length == 0) {
        mochadHeartbeat();
        return;
    }
    var cmdobj = cmdqueue.shift();
    mochadSafe(cmdobj);
}

setupConnection();
setTimeout(sendNextCommand, 2000);

// Web server
var app = express();
app.use(express.bodyParser());

app.get('/', function(req, res) {
    res.send({hello: 'world'});
});

app.put('/api/modules/:addr', function(req, res) {
    if (['on', 'off'].indexOf(req.body.value) != -1) { 
        enqueueX10Command(req.params.addr, req.body.value, function(err) {
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
