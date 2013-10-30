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
    exec = require('child_process').exec,
    url = require('url');

/**
 * ========== mochad client ==========
 */

var client;

/**
 * Prevents setupConnection from being called multiple times
 */
var disconnected;

/**
 * Whether a timeout exists for sendNextCommand, aka whether the command loop
 * is running
 */
var cmdLoopRunning = false;

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
    var cmd = 'rf ' + addr + ' ' + value;
    cmdqueue.push(cmd);
    if (!cmdLoopRunning) {
        sendNextCommand();
    }
    callback();
}

/**
 * Send next command in the queue
 */
function sendNextCommand() {
    if (cmdqueue.length > 0) {
        cmdLoopRunning = true;
        var cmd = cmdqueue.shift();
        mochadSafe(cmd);
        setTimeout(sendNextCommand, CMD_PERIOD);
    }
    else {
        cmdLoopRunning = false;
    }
}

setupConnection();

/**
 * ========== Web server ==========
 */

var app = express();
app.use(express.bodyParser());

app.get('/', function(req, res) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write('<h1>Dorm Automation</h1>');
    res.write('<ul>');
    res.write('<li>Fan: <a href="/api/modules/a1?value=on">On</a> <a href="/api/modules/a1?value=off">Off</a></li>');
    res.write('<li>Amp: <a href="/api/modules/a2?value=on">On</a> <a href="/api/modules/a2?value=off">Off</a></li>');
    res.write('<li>Curtis\'s Lamp: <a href="/api/modules/a4?value=on">On</a> <a href="/api/modules/a4?value=off">Off</a></li>');
    res.write('</ul>');
    res.write('<footer><p>&copy; 2013 Kevin Wang</p></footer');
    res.end();
});

app.get('/api/modules/:addr', function(req, res) {
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var addr = req.params.addr;
    var value = query.value;
    // Validate module address (house code A-P, unit code 1-16)
    if (/[A-Pa-p]([1-9]$|1[0-6])/.test(addr) &&
        ['on', 'off'].indexOf(value) != -1) { 
        enqueueX10Command(addr, value, function(err) {
            if (err) {
                res.send(500);
            }
            else {
                res.redirect('/');
            }
        });
    }
    else {
        res.send(400);
    }
    res.end();
});

app.listen(80);
