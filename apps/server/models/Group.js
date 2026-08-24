const db = require('../database/db');

class Group {
  static create(name, creatorId, memberIds = []) {
    const stmt = db.prepare(`
      INSERT INTO \`groups\` (name, creator_id)
      VALUES (?, ?)
    `);
    const result = stmt.run(name, creatorId);
    const groupId = result.lastInsertRowid;

    Group.addMember(groupId, creatorId, 'creator');

    if (memberIds.length > 0) {
      const memberStmt = db.prepare(`
        INSERT INTO group_members (group_id, user_id, role)
        VALUES (?, ?, 'member')
      `);
      for (const userId of memberIds) {
        if (userId !== creatorId) {
          try {
            memberStmt.run(groupId, userId);
          } catch (e) {
            // User already in group, skip
          }
        }
      }
    }

    return Group.findById(groupId);
  }

  static findById(id) {
    const stmt = db.prepare(`
      SELECT g.*, u.username as creator_name
      FROM \`groups\` g
      JOIN users u ON g.creator_id = u.id
      WHERE g.id = ?
    `);
    const group = stmt.get(id);
    if (group) {
      group.members = Group.getMembers(id);
    }
    return group;
  }

  static getUserGroups(userId) {
    const stmt = db.prepare(`
      SELECT g.*, u.username as creator_name,
             gm.role,
             (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
      FROM \`groups\` g
      JOIN group_members gm ON g.id = gm.group_id
      JOIN users u ON g.creator_id = u.id
      WHERE gm.user_id = ?
      ORDER BY g.created_at DESC
    `);
    return stmt.all(userId);
  }

  static getMembers(groupId) {
    const stmt = db.prepare(`
      SELECT gm.*, u.username, u.avatar
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.role DESC, gm.joined_at ASC
    `);
    return stmt.all(groupId);
  }

  static addMember(groupId, userId, role = 'member') {
    const stmt = db.prepare(`
      INSERT INTO group_members (group_id, user_id, role)
      VALUES (?, ?, ?)
    `);
    try {
      stmt.run(groupId, userId, role);
      return true;
    } catch (e) {
      return false;
    }
  }

  static removeMember(groupId, userId) {
    const stmt = db.prepare(`
      DELETE FROM group_members
      WHERE group_id = ? AND user_id = ?
    `);
    stmt.run(groupId, userId);
    
    const memberCount = db.prepare(`
      SELECT COUNT(*) as count FROM group_members WHERE group_id = ?
    `).get(groupId).count;
    
    if (memberCount === 0) {
      Group.delete(groupId);
      return 'group_deleted';
    }
    
    return 'member_removed';
  }

  static isMember(groupId, userId) {
    const stmt = db.prepare(`
      SELECT * FROM group_members
      WHERE group_id = ? AND user_id = ?
    `);
    return !!stmt.get(groupId, userId);
  }

  static getMemberRole(groupId, userId) {
    const stmt = db.prepare(`
      SELECT role FROM group_members
      WHERE group_id = ? AND user_id = ?
    `);
    const result = stmt.get(groupId, userId);
    return result ? result.role : null;
  }

  static setAdmin(groupId, userId, isAdmin) {
    const newRole = isAdmin ? 'admin' : 'member';
    const stmt = db.prepare(`
      UPDATE group_members SET role = ?
      WHERE group_id = ? AND user_id = ?
    `);
    stmt.run(newRole, groupId, userId);
  }

  static transferOwner(groupId, newOwnerId) {
    const oldCreatorRole = db.prepare(`
      SELECT role FROM group_members WHERE group_id = ? AND user_id = (
        SELECT creator_id FROM \`groups\` WHERE id = ?
      )
    `).get(groupId, groupId);

    db.prepare(`
      UPDATE group_members SET role = 'admin'
      WHERE group_id = ? AND user_id = (
        SELECT creator_id FROM \`groups\` WHERE id = ?
      )
    `).run(groupId, groupId);

    db.prepare(`
      UPDATE \`groups\` SET creator_id = ? WHERE id = ?
    `).run(newOwnerId, groupId);

    db.prepare(`
      UPDATE group_members SET role = 'creator'
      WHERE group_id = ? AND user_id = ?
    `).run(groupId, newOwnerId);
  }

  static updateName(groupId, name) {
    const stmt = db.prepare(`
      UPDATE \`groups\` SET name = ? WHERE id = ?
    `);
    stmt.run(name, groupId);
  }

  static delete(groupId) {
    db.prepare(`DELETE FROM group_members WHERE group_id = ?`).run(groupId);
    db.prepare(`DELETE FROM \`groups\` WHERE id = ?`).run(groupId);
  }

  static getMemberCount(groupId) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM group_members WHERE group_id = ?
    `);
    return stmt.get(groupId).count;
  }

  static isFull(groupId) {
    const group = db.prepare(`SELECT max_members FROM \`groups\` WHERE id = ?`).get(groupId);
    if (!group) return true;
    return Group.getMemberCount(groupId) >= group.max_members;
  }
}

module.exports = Group;
