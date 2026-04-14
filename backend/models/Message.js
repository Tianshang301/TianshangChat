const db = require('../database/db');

class Message {
  static create(data) {
    const stmt = db.prepare(`
      INSERT INTO messages (sender_id, sender_name, sender_avatar, content, audio_url, duration, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.senderId,
      data.senderName,
      data.senderAvatar || null,
      data.content || null,
      data.audioUrl || null,
      data.duration || null,
      data.type || 'text'
    );
    return { id: result.lastInsertRowid, ...data };
  }

  static getHistory(days = 7, limit = 500) {
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE timestamp >= datetime('now', '-${days} days')
      ORDER BY timestamp ASC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  static getHistoryBefore(beforeTimestamp, limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE timestamp < ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(beforeTimestamp, limit).reverse();
  }

  static getAll(limit = 1000) {
    const stmt = db.prepare(`
      SELECT * FROM messages
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(limit).reverse();
  }
}

module.exports = Message;
