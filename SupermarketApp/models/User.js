const db = require('../db');
const crypto = require('crypto');

function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const h = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}$${h}`;
}

function verify(password, stored) {
  if (!stored) return false;

  if (!stored.includes('$')) {
    const value = stored.trim();

    if (/^[a-f0-9]{32}$/i.test(value)) {
      return crypto.createHash('md5').update(password).digest('hex') === value;
    }
    if (/^[a-f0-9]{40}$/i.test(value)) {
      return crypto.createHash('sha1').update(password).digest('hex') === value;
    }
    if (/^[a-f0-9]{64}$/i.test(value)) {
      return crypto.createHash('sha256').update(password).digest('hex') === value;
    }
    if (/^[a-f0-9]{128}$/i.test(value)) {
      return crypto.createHash('sha512').update(password).digest('hex') === value;
    }

    return value === password;
  }

  const [salt, hashed] = stored.split('$');
  if (!salt || !hashed) return false;

  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  const storedBuf = Buffer.from(hashed, 'hex');
  const derivedBuf = Buffer.from(derived, 'hex');

  return storedBuf.length === derivedBuf.length && crypto.timingSafeEqual(storedBuf, derivedBuf);
}

function findByIdentifier(identifier) {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
      [identifier, identifier],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0] || null);
      }
    );
  });
}

function normalizeUser(row = {}) {
  return {
    id: row.id ?? row.user_id ?? row.userId ?? null,
    username: row.username ?? row.user_name ?? row.name ?? '',
    email: row.email ?? row.user_email ?? null,
    contact: row.contact ?? row.phone ?? row.user_contact ?? null,
    address: row.address ?? row.user_address ?? null,
    role: row.role ?? row.user_role ?? 'user'
  };
}

module.exports = {
  authenticate(identifier, password) {
    return findByIdentifier(identifier).then(user => {
      if (!user) return null;
      return verify(password, user.password) ? user : null;
    });
  },

  create({ username, email, contact, address, password, role = 'user' }) {
    return new Promise((resolve, reject) => {
      const stored = hash(password);
      const columns = ['username', 'password', 'role'];
      const values = [username, stored, role];

      if (email) { columns.push('email'); values.push(email); }
      if (contact) { columns.push('contact'); values.push(contact); }
      if (address) { columns.push('address'); values.push(address); }

      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders})`;

      db.query(sql, values, (err, result) => {
        if (err) return reject(err);
        resolve(result.insertId);
      });
    });
  },

  findByIdentifier,
  verifyPassword: verify,
  normalizeUser,

  findById(id) {
    return new Promise((resolve, reject) => {
      db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id], (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0] || null);
      });
    });
  },

  getAll() {
    return new Promise((resolve, reject) => {
      db.query('SELECT id, username, email, contact, address, role FROM users ORDER BY username ASC', (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(normalizeUser));
      });
    });
  },

  update(id, fields = {}) {
    const allowed = ['username', 'email', 'contact', 'address', 'role'];
    const entries = Object.entries(fields).filter(([key, val]) => allowed.includes(key) && val !== undefined);
    if (!entries.length) return Promise.resolve();

    const columns = entries.map(([key]) => `${key} = ?`).join(', ');
    const values = entries.map(([, val]) => val);
    values.push(id);

    return new Promise((resolve, reject) => {
      db.query(`UPDATE users SET ${columns} WHERE id = ?`, values, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  },

  setRole(id, role) {
    return new Promise((resolve, reject) => {
      db.query('UPDATE users SET role = ? WHERE id = ?', [role, id], err => {
        if (err) return reject(err);
        resolve();
      });
    });
  },

  remove(id) {
    return new Promise((resolve, reject) => {
      db.query('DELETE FROM users WHERE id = ?', [id], err => {
        if (err) return reject(err);
        resolve();
      });
    });
  },

  updateProfile(id, { username, email, contact, address }) {
    const fields = [];
    const values = [];

    if (username !== undefined) { fields.push('username = ?'); values.push(username); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (contact !== undefined) { fields.push('contact = ?'); values.push(contact); }
    if (address !== undefined) { fields.push('address = ?'); values.push(address); }

    if (!fields.length) return Promise.resolve();
    values.push(id);

    return new Promise((resolve, reject) => {
      db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  },

  setPassword(id, newPassword) {
    const hashed = hash(newPassword);
    return new Promise((resolve, reject) => {
      db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, id], err => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
};
