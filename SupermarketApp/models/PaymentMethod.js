const db = require('../db');

async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS payment_methods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      card_name VARCHAR(255),
      last4 VARCHAR(4) NOT NULL,
      label VARCHAR(100),
      expiry VARCHAR(5),
      cvv VARCHAR(4),
      CONSTRAINT fk_payment_methods_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await db.promise().query(sql);
  } catch (err) {
    console.error('Failed to ensure payment_methods table:', err.message);
  }
}

const ready = ensureTable();

module.exports = {
  async getByUser(userId) {
    if (!userId) return null;
    await ready;
    const [rows] = await db.promise().query(
      'SELECT user_id, card_name, last4, label, expiry, cvv FROM payment_methods WHERE user_id = ? LIMIT 1',
      [userId]
    );
    return rows[0] || null;
  },

  async upsert(userId, { cardNumber, cardLabel, cardName, expiry, cvv }) {
    if (!userId) return;
    await ready;
    const current = await this.getByUser(userId);

    let last4 = current ? current.last4 : null;
    const digits = (cardNumber || '').replace(/\D/g, '');
    if (digits) {
      if (digits.length !== 16) return;
      last4 = digits.slice(-4);
    }
    if (!last4) return;

    const cName = (cardName || '').trim();
    const label = (cardLabel || '').trim();
    const exp = (expiry || '').trim();
    const cvvClean = (cvv || '').replace(/\D/g, '').slice(0, 4) || null;

    const sql = `
      INSERT INTO payment_methods (user_id, card_name, last4, label, expiry, cvv)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        card_name = VALUES(card_name),
        last4 = VALUES(last4),
        label = VALUES(label),
        expiry = VALUES(expiry),
        cvv = VALUES(cvv)
    `;
    await db.promise().query(sql, [userId, cName || null, last4, label || null, exp || null, cvvClean]);
  },

  async removeByUser(userId) {
    if (!userId) return;
    await ready;
    await db.promise().query('DELETE FROM payment_methods WHERE user_id = ?', [userId]);
  }
};
