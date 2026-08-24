const jwt = require('jsonwebtoken');
const db = require('../database/db');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET environment variable not set. Using ephemeral random key.');
  console.warn('All existing sessions will be invalidated on server restart.');
  console.warn('Set JWT_SECRET in .env for persistent sessions.');
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const session = db.prepare(`
      SELECT * FROM sessions 
      WHERE token = ? AND expires_at > datetime('now')
    `).get(token);

    if (!session) {
      return res.status(401).json({ error: 'Token expired or invalid' });
    }

    req.user = { id: decoded.id, username: decoded.username };
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, username: decoded.username };
    req.token = token;
  } catch (error) {
    // Token invalid, continue without user
  }
  
  next();
}

module.exports = { authMiddleware, optionalAuth, JWT_SECRET };
