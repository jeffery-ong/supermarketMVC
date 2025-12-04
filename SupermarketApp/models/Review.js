const db = require('../db');

async function ensureTable() {
  // Use product_reviews table (new), ignore old reviews table if present
  const sql = `
    CREATE TABLE IF NOT EXISTS product_reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      rating TINYINT NOT NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_product_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_product_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await db.promise().query(sql);
  } catch (err) {
    console.error('Failed to ensure product_reviews table:', err.message);
  }
}

const ready = ensureTable();

module.exports = {
  async getForProduct(productId, limit = 20) {
    if (!productId) return [];
    await ready;
    const [rows] = await db
      .promise()
      .query(
        `SELECT r.id, r.user_id, r.product_id, r.rating, r.comment, r.created_at, u.username
         FROM product_reviews r
         JOIN users u ON u.id = r.user_id
         WHERE r.product_id = ?
         ORDER BY r.created_at DESC
         LIMIT ?`,
        [productId, limit]
      );
    return rows;
  },

  async create({ userId, productId, rating, comment }) {
    if (!userId || !productId) return null;
    await ready;
    const cleanRating = Math.min(5, Math.max(1, Number(rating) || 0));
    const trimmed = (comment || '').trim();
    const limitedComment = trimmed.slice(0, 1000);
    const [result] = await db
      .promise()
      .query(
        'INSERT INTO product_reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)',
        [userId, productId, cleanRating, limitedComment || null]
      );
    return result.insertId;
  },

  async getForUser(userId) {
    if (!userId) return [];
    await ready;
    const [rows] = await db
      .promise()
      .query(
        `SELECT r.id,
                r.product_id,
                r.rating,
                r.comment,
                r.created_at,
                p.productName AS product_name,
                p.image AS product_image
         FROM product_reviews r
         JOIN products p ON p.id = r.product_id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC`,
        [userId]
      );
    return rows.map(r => {
      let img = r.product_image || '';
      if (!img) {
        img = '/images/placeholder-product.jpg';
      } else if (!img.startsWith('http') && !img.startsWith('/')) {
        const normalized = img.toLowerCase();
        img = `/images/${normalized}`;
      }
      return { ...r, product_image: img };
    });
  },

  async getAverageForProduct(productId) {
    if (!productId) return { average: 0, count: 0 };
    await ready;
    const [[row]] = await db
      .promise()
      .query(
        'SELECT AVG(rating) AS average, COUNT(*) AS count FROM product_reviews WHERE product_id = ?',
        [productId]
      );
    const average = row && row.average ? Number(row.average) : 0;
    const count = row && row.count ? Number(row.count) : 0;
    return { average, count };
  },

  async getAveragesForProductIds(productIds = []) {
    if (!productIds.length) return {};
    await ready;
    const placeholders = productIds.map(() => '?').join(', ');
    const values = productIds;
    const [rows] = await db
      .promise()
      .query(
        `SELECT product_id, AVG(rating) AS average, COUNT(*) AS count
         FROM product_reviews
         WHERE product_id IN (${placeholders})
         GROUP BY product_id`,
        values
      );
    const map = {};
    rows.forEach(r => {
      map[r.product_id] = {
        average: r.average ? Number(r.average) : 0,
        count: r.count ? Number(r.count) : 0
      };
    });
    return map;
  }
};
