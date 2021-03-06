const jwt = require('jsonwebtoken');
/**
 * Provides JSON Web Token functionality such as token generation and verification.
 * @author Adam Wegrzynek <adam.wegrzynek@cern.ch>
 */
class JwtToken {
  /**
   * Stores secret
   * @constructor
   * @param {object} config - jwt cofiguration object
   */
  constructor(config) {
    config = (typeof config == 'undefined') ? {} : config;
    config.secret = (!config.secret) ? (Math.random()+1).toString(36).substring(7) : config.secret;
    config.expiration = (!config.expiration) ? '1d' : config.expiration;
    config.issuer = (!config.issuer) ? 'o2-ui' : config.issuer;
    config.maxAge = (!config.maxAge) ? '7d' : config.maxAge;

    this._expiration = config.expiration;
    this._maxAge = config.maxAge;
    this._secret = config.secret;
    this._issuer = config.issuer;
  }

  /**
   * Generates encrypted token with user id and access level.
   * Sets expiration time and sings it using secret.
   * @param {number} personid - CERN user id
   * @param {string} username - CERN username
   * @param {number} access - level of access
   * @return {object} generated token
   */
  generateToken(personid, username, access = 0) {
    const payload = {id: personid, username: username, access: access};
    const token = jwt.sign(payload, this._secret, {
      expiresIn: this._expiration,
      issuer: this._issuer
    });
    return token;
  }

  /**
   * When the token expires, this method allows to refresh it.
   * It skips expiration check and verifies (already expired) token based on maxAge parameter
   * (maxAge >> expiration).
   * Then it creates a new token using parameters of the old one and ships it to the user.
   * If maxAge timeouts, the user needs to re-login via OAuth.
   * @param {object} token - expired token
   * @return {object} new token or false in case of failure
   */
  refreshToken(token) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this._secret, {
        issuer: this._issuer,
        ignoreExpiration: true,
        maxAge: this._maxAge
      }, (err, decoded) => {
        if (err) {
          reject(err);
        }
        decoded.newToken = this.generateToken(decoded.id, decoded.username, decoded.access);
        resolve(decoded);
      });
    });
  }

  /**
   * Decrypts user token to verify that is vaild.
   * @param {object} token - token to be verified
   * @return {object} whether operation was successful, if so decoded data are passed as well
   */
  verify(token) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this._secret, {issuer: this._issuer}, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });
  }
}
module.exports = JwtToken;
