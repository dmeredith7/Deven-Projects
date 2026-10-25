'use strict';

const crypto = require('node:crypto');
const { createShop } = require('./db');
const { isEmail } = require('./channels');
const { HttpError } = require('./orders');

const SESSION_DAYS = 30;
const RESET_MINUTES = 60;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(salt, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

// Used when the email doesn't exist so login takes the same time either way.
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const future = (ms) => new Date(Date.now() + ms).toISOString();

function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (pw.length > 200) throw new HttpError(400, 'Password is too long');
}

function cleanEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!isEmail(e)) throw new HttpError(400, 'A valid email address is required');
  return e;
}

// Simple in-memory limiter for login and password-reset attempts.
function createLimiter({ max, windowMs }) {
  const hits = new Map();
  return {
    check(key) {
      const now = Date.now();
      const h = hits.get(key);
      if (h && now - h.start < windowMs && h.count >= max) {
        throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.');
      }
    },
    fail(key) {
      const now = Date.now();
      const h = hits.get(key);
      if (!h || now - h.start >= windowMs) hits.set(key, { start: now, count: 1 });
      else h.count++;
      if (hits.size > 10000) for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, shop_id: u.shop_id };
}

function createAuth(db, notifier, { publicUrl = process.env.PUBLIC_URL || '' } = {}) {
  const loginLimiter = createLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
  const resetLimiter = createLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

  function createSession(userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      sha256(token), userId, future(SESSION_DAYS * 864e5)
    );
    return token;
  }

  function userForToken(token) {
    if (!token) return null;
    const row = db
      .prepare(
        `SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
      )
      .get(sha256(token));
    if (!row) return null;
    if (row.expires_at < new Date().toISOString()) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
      return null;
    }
    return row;
  }

  function destroySession(token) {
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  }

  function signup({ shop_name, name, email, password }) {
    const shopName = String(shop_name || '').trim();
    const userName = String(name || '').trim();
    if (!shopName) throw new HttpError(400, 'Business name is required');
    if (!userName) throw new HttpError(400, 'Your name is required');
    const e = cleanEmail(email);
    checkPassword(password);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) {
      throw new HttpError(409, 'An account with that email already exists. Try logging in.');
    }
    db.exec('BEGIN');
    try {
      const shopId = createShop(db, shopName);
      const r = db
        .prepare("INSERT INTO users (shop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'owner')")
        .run(shopId, userName, e, hashPassword(password));
      db.exec('COMMIT');
      const userId = Number(r.lastInsertRowid);
      return { token: createSession(userId), user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)) };
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  function login({ email, password }, ip = '') {
    const e = String(email || '').trim().toLowerCase();
    const key = `${ip}|${e}`;
    loginLimiter.check(key);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(e);
    const ok = verifyPassword(String(password || ''), user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      loginLimiter.fail(key);
      throw new HttpError(401, 'Incorrect email or password');
    }
    loginLimiter.reset(key);
    return { token: createSession(user.id), user: publicUser(user) };
  }

  // Always answers the same way so it can't be used to discover accounts.
  async function forgotPassword({ email }, ip = '') {
    const e = String(email || '').trim().toLowerCase();
    resetLimiter.check(ip);
    resetLimiter.fail(ip);
    const user = isEmail(e) ? db.prepare('SELECT * FROM users WHERE email = ?').get(e) : null;
    if (user) {
      const token = crypto.randomBytes(32).toString('base64url');
      db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
      db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
        sha256(token), user.id, future(RESET_MINUTES * 60 * 1000)
      );
      const link = `${publicUrl.replace(/\/+$/, '') || 'http://localhost:' + (process.env.PORT || 3000)}/login.html#reset=${token}`;
      await notifier.sendSystemEmail({
        to: user.email,
        subject: 'Reset your password',
        text: `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset your Dry Cleaner CRM password. Use this link within ${RESET_MINUTES} minutes:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
      });
    }
    return { ok: true };
  }

  function resetPassword({ token, password }) {
    checkPassword(password);
    const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(sha256(String(token || '')));
    if (!row || row.expires_at < new Date().toISOString()) {
      throw new HttpError(400, 'This reset link is invalid or has expired. Please request a new one.');
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), row.user_id);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    return { token: createSession(row.user_id) };
  }

  function changePassword(user, { current_password, new_password }) {
    if (!verifyPassword(String(current_password || ''), user.password_hash)) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    checkPassword(new_password);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), user.id);
    return { ok: true };
  }

  // Team management (owners only; enforced by the API layer).
  function listTeam(shopId) {
    return db.prepare('SELECT id, name, email, role, created_at FROM users WHERE shop_id = ? ORDER BY id').all(shopId);
  }

  function addTeamMember(shopId, { name, email, password, role }) {
    const userName = String(name || '').trim();
    if (!userName) throw new HttpError(400, 'Name is required');
    const e = cleanEmail(email);
    checkPassword(password);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(e)) throw new HttpError(409, 'That email is already in use');
    const r = db
      .prepare('INSERT INTO users (shop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(shopId, userName, e, hashPassword(password), role === 'owner' ? 'owner' : 'staff');
    return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(Number(r.lastInsertRowid)));
  }

  function removeTeamMember(shopId, actingUserId, id) {
    const u = db.prepare('SELECT * FROM users WHERE id = ? AND shop_id = ?').get(id, shopId);
    if (!u) throw new HttpError(404, 'User not found');
    if (u.id === actingUserId) throw new HttpError(400, "You can't remove yourself");
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    return { ok: true };
  }

  return {
    signup, login, forgotPassword, resetPassword, changePassword,
    userForToken, destroySession, listTeam, addTeamMember, removeTeamMember, publicUser,
  };
}

module.exports = { createAuth, hashPassword, verifyPassword, SESSION_DAYS };
