/**
 * Dorm automation server. Uses a queue to limit command frequency because
 * mochad often becomes unresponsive if commands are launched in quick
 * succession.
 *
 * @author Kevin Wang <kevin@kevinwang.com>
 */

/**
 * Dependencies
 */
var net = require('net'),
    express = require('express'),
    exec = require('child_process').exec;

/**
 * ========== mochad client ==========
 */

var client;

/**
 * Prevents setupConnection from being called multiple times
 */
var disconnected;

/**
 * Command queue
 */
var cmdqueue = []

/**
 * Command sending period, in ms
 */
var CMD_PERIOD = 1750;

/**
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

/**
 * Try to send a command, and restart mochad if it fails
 */
function mochadSafe(cmd) {
    var lastBytesRead = client.bytesRead; // Check for acknowledgment
    console.log('Command: ' + cmd);
    client.write(cmd + '\n', null);
    setTimeout(function() {
        if (client.bytesRead == lastBytesRead) {
            cmdqueue.unshift(cmd);
            console.log('mochad unresponsive, restarting...');
            exec('pkill -9 mochad; /usr/local/bin/mochad', function() {
                console.log('mochad restarted');
            });
        }
    }, 250);
}

/**
 * Add command to queue
 */
function enqueueX10Command(addr, value, callback) {
    var cmd = 'pl ' + addr + ' ' + value;
    cmdqueue.push(cmd);
    callback();
}

/**
 * Make sure mochad is still alive
 */
function mochadHeartbeat() {
    mochadSafe('st');
}

/**
 * Send next command on the queue, or send heartbeat if queue is empty
 */
function sendNextCommand() {
    setTimeout(sendNextCommand, CMD_PERIOD);
    if (cmdqueue.length == 0) {
        mochadHeartbeat();
        return;
    }
    var cmd = cmdqueue.shift();
    mochadSafe(cmd);
}

setupConnection();
sendNextCommand();

/**
 * ========== Web server ==========
 */

var app = express();
app.use(express.bodyParser());

app.get('/', function(req, res) {
    res.send({hello: 'world'});
});

app.put('/api/modules/:addr', function(req, res) {
    var addr = req.params.addr;
    var value = req.body.value;
    // Validate module address (house code A-P, unit code 1-16)
    if (/[A-Pa-p]([1-9]$|1[0-6])/.test(addr) && ['on', 'off'].indexOf(value) != -1) { 
        enqueueX10Command(addr, value, function(err) {
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
