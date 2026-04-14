const db = require('../database/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

class User {
  static create(username, passwordHash) {
    const stmt = db.prepare(`
      INSERT INTO users (username, password_hash)
      VALUES (?, ?)
    `);
    try {
      const result = stmt.run(username, passwordHash);
      return { id: result.lastInsertRowid, username };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        throw new Error('Username already exists');
      }
      throw error;
    }
  }

  static findByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT id, username, avatar, created_at FROM users WHERE id = ?');
    return stmt.get(id);
  }

  static updateAvatar(userId, avatarUrl) {
    const stmt = db.prepare('UPDATE users SET avatar = ? WHERE id = ?');
    return stmt.run(avatarUrl, userId);
  }

  static async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  static async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  }
}

module.exports = User;
