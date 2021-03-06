const EventEmitter = require('events');
const zmq = require('zeromq');
const log = new (require('./../log/Log.js'))('ZeroMQ');

/**
 * ZeroMQ client that communicates with Control Master prcess via one of two supported
 * socket patterns (sub and req).
 * @author Adam Wegrzynek <adam.wegrzynek@cern.ch>
 */
class ZeroMQClient extends EventEmitter {
  /**
   * Connects to ZeroMQ socket and binds class methods to ZeroMQ events.
   * @param {string} ip - hostname
   * @param {number} port - port number
   * @param {bool} type - socket type, true = sub. false = req
   * @construct
   */
  constructor(ip, port, type) {
    super();

    this.connected = false;
    this.socket = zmq.socket(type);
    this.socket.monitor(1000); // monitor socket every 1s
    this.socket.setsockopt(zmq.ZMQ_RECONNECT_IVL, 2000);
    this.socket.on('connect', (fd, endpoint) => this.connect(endpoint));
    this.socket.on('close', (fd, endpoint) => this.disconnect(endpoint));
    this.socket.on('disconnect', (fd, endpoint) => this.disconnect(endpoint));
    this.socket.on('connect_delay', () => {
      log.debug('Connection to the socket is pending...');
    });

    this.socket.on('connect_retry', () => {
      log.info('Socket is being reconnected...');
      this.connected = false;
    });

    this.socket.connect('tcp://' + ip + ':' + port);
    log.debug('Connecting to tcp://' + ip + ':' + port + '...');
    if (type == 'sub') {
      this.socket.subscribe('');
    }
    this.socket.on('message', (message) => this.onmessage(message));
  }

  /**
   * On-connect event handler.
   * @param {string} endpoint
   */
  connect(endpoint) {
    log.info('Connected to ' + endpoint);
    this.connected = true;
  }

  /**
   * On-disconnect event handler.
   * @param {string} endpoint
   */
  disconnect(endpoint) {
    if (this.connected) {
      log.error('Disconnected from ' + endpoint);
    }
    this.connected = false;
  }

  /**
   * On-message event handler.
   * @param {string} message
   */
  onmessage(message) {
    if (typeof message === 'undefined') {
      log.debug('Cannot send undefined message');
      return;
    }
    this.emit('message', message.toString());
  }

  /**
   * Sends message via socket.
   * @param {string} message
   */
  send(message) {
    if (!this.connected) {
      log.debug('Could not send message as socket is not open');
      return;
    }
    this.socket.send(message);
  }
}
module.exports = ZeroMQClient;
