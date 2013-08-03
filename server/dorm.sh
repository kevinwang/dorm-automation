#!/bin/sh
# Starts and stops dorm automation server
#

case "$1" in
start)
    start-stop-daemon --start --background --exec /usr/local/bin/node /home/pi/dorm-automation/server/app.js
;;

stop)
    start-stop-daemon --stop --exec /usr/local/bin/node /home/pi/dorm-automation/server/app.js
;;

restart)
    $0 stop
    $0 start
;;

status)
    if pidof -o %PPID /usr/local/bin/node > /dev/null; then
        echo "Running"
        exit 0
    else
        echo "Not running"
        exit 1
    fi
;;

*)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
esac
