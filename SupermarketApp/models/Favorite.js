const db = require('../db');

async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS favorites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_product (user_id, product_id),
      INDEX idx_favorites_user (user_id),
      INDEX idx_favorites_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await db.promise().query(sql);
  } catch (err) {
    console.error('Failed to ensure favorites table exists:', err.message);
  }
}

ensureTable();

module.exports = {
  async getForUser(userId) {
    if (!userId) return [];
    const [rows] = await db.promise().query(
      'SELECT product_id FROM favorites WHERE user_id = ?',
      [userId]
    );
    return rows.map(r => Number(r.product_id));
  },

  async set(userId, productId, favorite) {
    if (!userId || !productId) return { affectedRows: 0 };
    if (favorite) {
      const [result] = await db.promise().query(
        'INSERT IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)',
        [userId, productId]
      );
      return result;
    }
    const [result] = await db.promise().query(
      'DELETE FROM favorites WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );
    return result;
  }
};
