const db = require('../database/db');

class Message {
  static create(data) {
    const stmt = db.prepare(`
      INSERT INTO messages (sender_id, sender_name, sender_avatar, recipient_id, group_id, content, audio_url, duration, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.senderId,
      data.senderName,
      data.senderAvatar || null,
      data.recipientId || null,
      data.groupId || null,
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
        AND recipient_id IS NULL AND group_id IS NULL
      ORDER BY timestamp ASC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  static getHistoryBefore(beforeTimestamp, limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE timestamp < ?
        AND recipient_id IS NULL AND group_id IS NULL
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(beforeTimestamp, limit).reverse();
  }

  static getAll(limit = 1000) {
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE recipient_id IS NULL AND group_id IS NULL
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(limit).reverse();
  }

  static getPrivateHistory(userId1, userId2, days = 30, limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
        AND timestamp >= datetime('now', '-${days} days')
      ORDER BY timestamp ASC
      LIMIT ?
    `);
    return stmt.all(userId1, userId2, userId2, userId1, limit);
  }

  static getPrivateList(userId, limit = 50) {
    const stmt = db.prepare(`
      SELECT 
        CASE 
          WHEN sender_id = ? THEN recipient_id 
          ELSE sender_id 
        END as other_user_id,
        u.username as other_username,
        u.avatar as other_avatar,
        MAX(timestamp) as last_message_time,
        (SELECT content FROM messages m2 
         WHERE (m2.sender_id = ? AND m2.recipient_id = CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END
                OR m2.sender_id = CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AND m2.recipient_id = ?)
         ORDER BY timestamp DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM messages 
         WHERE sender_id != ? AND recipient_id = ? AND is_read = 0) as unread_count
      FROM messages
      JOIN users u ON u.id = CASE 
          WHEN sender_id = ? THEN recipient_id 
          ELSE sender_id 
        END
      WHERE (recipient_id = ? OR sender_id = ?)
        AND group_id IS NULL
      GROUP BY other_user_id
      ORDER BY last_message_time DESC
      LIMIT ?
    `);
    return stmt.all(userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, limit);
  }

  static getGroupHistory(groupId, days = 30, limit = 500) {
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE group_id = ?
        AND timestamp >= datetime('now', '-${days} days')
      ORDER BY timestamp ASC
      LIMIT ?
    `);
    return stmt.all(groupId, limit);
  }

  static getGroupHistoryBefore(groupId, beforeTimestamp, limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE group_id = ? AND timestamp < ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(groupId, beforeTimestamp, limit).reverse();
  }

  static markAsRead(messageId) {
    const stmt = db.prepare(`UPDATE messages SET is_read = 1 WHERE id = ?`);
    stmt.run(messageId);
  }

  static markPrivateAsRead(recipientId, senderId) {
    const stmt = db.prepare(`
      UPDATE messages SET is_read = 1
      WHERE recipient_id = ? AND sender_id = ? AND is_read = 0
    `);
    stmt.run(recipientId, senderId);
  }

  static getUnreadCount(userId) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE recipient_id = ? AND is_read = 0
    `);
    return stmt.get(userId).count;
  }

  static markGroupAsRead(groupId, userId) {
    const stmt = db.prepare(`
      UPDATE messages SET is_read = 1
      WHERE group_id = ? AND sender_id != ?
    `);
    stmt.run(groupId, userId);
  }
}

module.exports = Message;
