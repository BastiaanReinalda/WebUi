const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const helmet = require('helmet');
const log = new (require('./../log/Log.js'))('HTTP');
const JwtToken = require('./../jwt/token.js');
const OAuth = require('./oauth.js');
const path = require('path');
const url = require('url');
const bodyParser = require('body-parser');

/**
 * HTTPS server that handles OAuth and provides REST API.
 * Each request is authenticated with JWT token.
 * @author Adam Wegrzynek <adam.wegrzynek@cern.ch>
 */
class HttpServer {
  /**
   * Sets up the server, routes and binds HTTP and HTTPS sockets.
   * @param {object} httpConfig - configuration of HTTP server
   * @param {object} jwtConfig - configuration of JWT
   * @param {object} oAuthConfig - configuration of oAuth
   */
  constructor(httpConfig, jwtConfig, oAuthConfig = null) {
    this.app = express();
    this.configureHelmet(httpConfig.hostname);

    this.jwt = new JwtToken(jwtConfig);
    if (oAuthConfig != null) {
      this.oauth = new OAuth(oAuthConfig);
    }
    this.specifyRoutes();

    if (httpConfig.tls) {
      const credentials = {
        key: fs.readFileSync(httpConfig.key),
        cert: fs.readFileSync(httpConfig.cert)
      };
      this.server = https.createServer(credentials, this.app).listen(httpConfig.portSecure);
      this.enableHttpRedirect();
      log.info(`Secure server listening on port ${httpConfig.portSecure}`);
    } else {
      this.server = http.createServer(this.app).listen(httpConfig.port);
      log.info(`Server listening on port ${httpConfig.port}`);
    }

    this.templateData = {};
  }

  /**
   * Configures Helmet rules to increase web app secuirty
   * @param {string} hostname whitelisted hostname for websocket connection
   * @param {number} port secure port number
   */
  configureHelmet(hostname) {
    // Sets "X-Frame-Options: DENY" (doesn't allow to be in any iframe)
    this.app.use(helmet.frameguard({action: 'deny'}));
    // Sets "Strict-Transport-Security: max-age=5184000 (60 days) (stick to HTTPS)
    this.app.use(helmet.hsts({
      maxAge: 5184000
    }));
    // Sets "Referrer-Policy: same-origin"
    this.app.use(helmet.referrerPolicy({policy: 'same-origin'}));
    // Sets "X-XSS-Protection: 1; mode=block"
    this.app.use(helmet.xssFilter());
    // Removes X-Powered-By header
    this.app.use(helmet.hidePoweredBy());
    // Disable DNS prefetching
    this.app.use(helmet.dnsPrefetchControl());
    // Disables external resourcers
    this.app.use(helmet.contentSecurityPolicy({
      directives: {
        /* eslint-disable */
        defaultSrc: ["'self'", "data:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'wss://' + hostname + ':*', 'ws://' + hostname + ':*']
        /* eslint-enable */
      }
    }));
  }

  /**
   * Passes key-value parameters that are available on front-end side
   * @param {string} key
   * @param {string} value
   */
  passAsUrl(key, value) {
    this.templateData[key] = value;
  }

  /**
   * Specified routes and their callbacks.
   */
  specifyRoutes() {
    // Routes of authorization
    if (this.oauth) {
      this.app.get('/', (req, res, next) => this.oAuthAuthorize(req, res, next));
      this.app.get('/callback', (emitter, code) => this.oAuthCallback(emitter, code));
    } else {
      this.app.get('/', (req, res, next) => this.addDefaultUserData(req, res, next));
    }

    // Router for static files (can grow with addStaticPath)
    // eslint-disable-next-line
    this.routerStatics = express.Router();
    this.addStaticPath(path.join(__dirname, '../../Frontend'));
    this.app.use(this.routerStatics);

    // Router for public API (can grow with get, post and delete)
    // eslint-disable-next-line
    this.routerPublic = express.Router();
    this.routerPublic.use(bodyParser.json()); // parse json body for API calls
    this.app.use('/api', this.routerPublic);

    // Router for secure API (can grow with get, post and delete)
    // eslint-disable-next-line
    this.router = express.Router();
    this.router.use((req, res, next) => this.jwtVerify(req, res, next));
    this.router.use(bodyParser.json()); // parse json body for API calls
    this.app.use('/api', this.router);

    // Catch-all if no controller handled request
    this.app.use((req, res, next) => {
      log.debug(`Page was not found: ${req.originalUrl}`);
      res.status(404).sendFile(path.join(__dirname, '../../Frontend/404.html'));
    });

    // Error handler when a controller crashes
    this.app.use((err, req, res, next) => {
      log.error(`Request ${req.originalUrl} failed: ${err.message || err}`);
      log.trace(err);
      res.status(500).sendFile(path.join(__dirname, '../../Frontend/500.html'));
    });
  }

  /**
   * Adds default user details when skipping OAuth flow
   * @param {object} req
   * @param {object} res
   * @param {object} next - serves static paths
   * @return {object} redirection
   */
  addDefaultUserData(req, res, next) {
    const query = req.query;
    if (!query.token) {
      query.personid = 0;
      query.name = 'Anonymous';
      query.token = this.jwt.generateToken(query.personid, query.name);

      const homeUrlAuthentified = url.format({pathname: '/', query: query});
      return res.redirect(homeUrlAuthentified);
    }
    return this.oAuthAuthorize(req, res, next);
  }

  /**
   * Serves local static path under specified URI path
   * @param {string} localPath - local directory to be served
   * @param {string} uriPath - URI path (optional, '/' as default)
   */
  addStaticPath(localPath, uriPath = '') {
    if (!fs.existsSync(localPath)) {
      throw new Error(`static path ${localPath} does not exist`);
    }
    this.routerStatics.use(path.join('/', uriPath), express.static(localPath));
  }

  /**
   * Adds GET route with authentification (req.query.token must be provided)
   * @param {string} path - path that the callback will be bound to
   * @param {function} callback - function (that receives req and res parameters)
   * @param {function} options
   * @param {function} options.public - true to remove token verification
   */
  get(path, callback, options = {}) {
    if (options.public) {
      this.routerPublic.get(path, callback);
      return;
    }

    this.router.get(path, callback);
  }

  /**
   * Adds POST route with authentification (req.query.token must be provided)
   * @param {string} path - path that the callback will be bound to
   * @param {function} callback - function (that receives req and res parameters)
   * @param {function} options
   * @param {function} options.public - true to remove token verification
   */
  post(path, callback, options = {}) {
    if (options.public) {
      this.routerPublic.post(path, callback);
      return;
    }

    this.router.post(path, callback);
  }

  /**
   * Adds DELETE route with authentification (req.query.token must be provided)
   * @param {string} path - path that the callback will be bound to
   * @param {function} callback - function (that receives req and res parameters)
   * @param {function} options
   * @param {function} options.public - true to remove token verification
   */
  delete(path, callback, options = {}) {
    if (options.public) {
      this.routerPublic.delete(path, callback);
      return;
    }

    this.router.delete(path, callback);
  }

  /**
   * Redirects HTTP to HTTPS.
   */
  enableHttpRedirect() {
    this.app.use(function(req, res, next) {
      if (!req.secure) {
        return res.redirect('https://' + req.headers.host + req.url);
      }
      next();
    });
  }

  /**
   * Handles oAuth authentication flow (default path of the app: '/')
   * - If query.code is valid embeds the token and grants the access to the application
   * - Redirects to the OAuth flow if query.code is not present (origin path != /callback)
   * - Prints out an error when code is not valid
   * The query arguments are serialized and kept in the 'state' parameter through OAuth process
   * @param {object} req - HTTP request
   * @param {object} res - HTTP response
   * @param {object} next - serves static paths when OAuth suceeds
   * @return {object} redirects to OAuth flow or displays the page if JWT token is valid
   */
  oAuthAuthorize(req, res, next) {
    const query = req.query; // User's arguments
    const token = req.query.token;

    if (token && this.jwt.verify(token)) {
      next();
    } else {
      // Save query params and redirect to the OAuth flow
      const state = new Buffer(JSON.stringify(query)).toString('base64');
      return res.redirect(this.oauth.getAuthorizationUri(state));
    }
  }

  /**
   * oAuth allback route - when successfully authorized (/callback)
   * Redirects to the application deserializes the query parameters from state variable
   * and injects them to the url
   * @param {object} req - HTTP request
   * @param {object} res - HTTP response
   * @return {object} redirect to address with re-included query string
   */
  oAuthCallback(req, res) {
    const code = req.query.code;
    const state = req.query.state; // base64
    if (!code || !state) {
      return res.status(400).send('code and state required');
    }

    const query = JSON.parse(new Buffer(state, 'base64').toString('ascii'));

    this.oauth.createTokenAndProvideDetails(code)
      .then((details) => {
        query.personid = details.user.personid;
        query.name = details.user.name;

        // Generates JWT token and adds it to the details object
        query.token = this.jwt.generateToken(details.user.personid, details.user.username, 1);

        // Concatanates details from oAuth flow with data directly passed by user
        Object.assign(query, this.templateData);

        const homeUrlAuthentified = url.format({pathname: '/', query: query});
        return res.redirect(homeUrlAuthentified);
      })
      .catch((error) => {
        // Handles invalid oAuth code parameters
        log.warn(`OAuth failed: ${error.message}`);
        res.status(401).send(
          `OAuth failed: ${error.message}, beware refreshing the page with one-time code parameter`
        );
      });
  }

  /**
   * HTTPs server getter.
   * @return {object} - HTTPs server
   */
  get getServer() {
    return this.server;
  }

  /**
   * Verifies JWT token synchronously.
   * @todo use promises or generators to call it asynchronously!
   * @param {object} req - HTTP request
   * @param {object} res - HTTP response
   * @param {function} next - passes control to next matching route
   */
  jwtVerify(req, res, next) {
    this.jwt.verify(req.query.token)
      .then((data) => {
        req.decoded = data.decoded;
        req.session = {
          personid: data.id,
          name: data.username
        };
        next();
      }, (error) => {
        log.warn(`${error.name} : ${error.message}`);
        res.status(403).json({message: error.name});
      });
  }
}
module.exports = HttpServer;
