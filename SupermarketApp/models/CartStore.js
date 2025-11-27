const db = require('../db');

async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS cart (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY cart_user_product (user_id, product_id),
      INDEX idx_cart_user (user_id),
      INDEX idx_cart_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await db.promise().query(sql);
  } catch (err) {
    console.error('Failed to ensure cart table exists:', err.message);
  }
}

ensureTable();

module.exports = {
  async upsertItem(userId, productId, quantity) {
    if (!userId || !productId || !quantity) return { affectedRows: 0 };
    const sql = `
      INSERT INTO cart (user_id, product_id, quantity, added_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        quantity = quantity + VALUES(quantity),
        added_at = NOW()
    `;
    const [result] = await db.promise().query(sql, [userId, productId, quantity]);
    return result;
  },

  async setQuantity(userId, productId, quantity) {
    if (!userId || !productId || !quantity) return { affectedRows: 0 };
    const [result] = await db.promise().query(
      'UPDATE cart SET quantity = ?, added_at = NOW() WHERE user_id = ? AND product_id = ?',
      [quantity, userId, productId]
    );
    return result;
  },

  async removeItem(userId, productId) {
    if (!userId || !productId) return { affectedRows: 0 };
    const [result] = await db.promise().query(
      'DELETE FROM cart WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );
    return result;
  },

  async clearUser(userId) {
    if (!userId) return { affectedRows: 0 };
    const [result] = await db.promise().query('DELETE FROM cart WHERE user_id = ?', [userId]);
    return result;
  }
};
