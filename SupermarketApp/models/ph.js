const db = require('../db');

const mapPurchase = row => ({
  id: row.id,
  userId: row.user_id,
  productId: row.product_id,
  productName: row.product_name,
  quantity: row.quantity,
  total: Number(row.total),
  purchasedAt: row.purchased_at
});

module.exports = {
  async getByUser(userId) {
    const [rows] = await db.promise().query(
      `SELECT ph.*, p.productName AS product_name
       FROM purchase_history ph
       JOIN products p ON p.id = ph.product_id
       WHERE ph.user_id = ?
       ORDER BY ph.purchased_at DESC, ph.id DESC`,
      [userId]
    );
    return rows.map(mapPurchase);
  },

  async getAll() {
    const [rows] = await db.promise().query(
      `SELECT ph.*, p.productName AS product_name
       FROM purchase_history ph
       JOIN products p ON p.id = ph.product_id
       ORDER BY ph.purchased_at DESC, ph.id DESC`
    );
    return rows.map(mapPurchase);
  },

  async createBulk(userId, cartItems = []) {
    if (!userId || !Array.isArray(cartItems) || cartItems.length === 0) {
      return { affectedRows: 0 };
    }

    const rows = cartItems
      .filter(item => item && item.productId && item.quantity)
      .map(item => [
        userId,
        item.productId,
        item.quantity,
        Number(item.price || 0) * Number(item.quantity || 0)
      ]);

    if (!rows.length) return { affectedRows: 0 };

    const sql = `
      INSERT INTO purchase_history (user_id, product_id, quantity, total)
      VALUES ?`;
    const [result] = await db.promise().query(sql, [rows]);
    return result;
  }
};