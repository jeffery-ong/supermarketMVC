const db = require('../db');

// Ensure description column exists (no-op if already present)
db.promise()
  .query('ALTER TABLE products ADD COLUMN description TEXT')
  .catch(err => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      console.error('Failed to add description column to products:', err.message);
    }
  });
// Add discount columns if missing
db.promise()
  .query('ALTER TABLE products ADD COLUMN discount DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER price')
  .catch(err => {
    if (err && err.code !== 'ER_DUP_FIELDNAME') {
      console.error('Failed to add discount column to products:', err.message);
    }
  });

const hydrate = row => {
  let imagePath = row.image || '';
  if (!imagePath) {
    imagePath = '/images/placeholder-product.jpg';
  } else if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
    imagePath = `/images/${imagePath}`;
  }

  const numericPrice = Number(row.price);
  const discountPct =
    row.discount !== undefined && row.discount !== null ? Number(row.discount) : 0;
  const computedDiscountPrice =
    discountPct > 0 && Number.isFinite(numericPrice)
      ? Number((numericPrice * (1 - discountPct / 100)).toFixed(2))
      : null;

  return {
    id: row.id,
    name: row.name,
    price: numericPrice,
    stock: row.stock,
    image: imagePath,
    description: row.description || '',
    category: row.category || '',
    discount: discountPct,
    discountPrice: computedDiscountPrice,
    offerMessage: '',
    isFavorite: false, // set per-user in controller
    ratingAverage: row.ratingAverage ? Number(row.ratingAverage) : 0,
    ratingCount: row.ratingCount ? Number(row.ratingCount) : 0
  };
};

module.exports = {
  getAll() {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT p.id,
                p.productName       AS name,
                p.quantity          AS stock,
                p.price,
                p.discount,
                p.image,
                p.category,
                p.description,
                COALESCE(AVG(r.rating), 0) AS ratingAverage,
                COUNT(r.id)         AS ratingCount
         FROM products p
         LEFT JOIN product_reviews r ON p.id = r.product_id
         GROUP BY p.id
         ORDER BY p.productName ASC`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(hydrate));
        }
      );
    });
  },

  getById(id) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT p.id,
                p.productName       AS name,
                p.quantity          AS stock,
                p.price,
                p.discount,
                p.image,
                p.category,
                p.description,
                COALESCE(AVG(r.rating), 0) AS ratingAverage,
                COUNT(r.id)         AS ratingCount
         FROM products p
         LEFT JOIN product_reviews r ON p.id = r.product_id
         WHERE p.id = ?
         GROUP BY p.id`,
        [id],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.length ? hydrate(rows[0]) : null);
        }
      );
    });
  },

  create({ name, price, stock, image = '', category = '', description = '', discount = 0 }) {
    return new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO products (productName, quantity, price, discount, image, category, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, stock, price, discount, image, category, description],
        (err, result) => {
          if (err) return reject(err);
          resolve(result.insertId);
        }
      );
    });
  },

  update(id, { name, price, stock, image = '', category = '', description = '', discount = 0 }) {
    return new Promise((resolve, reject) => {
      db.query(
        `UPDATE products
         SET productName = ?, quantity = ?, price = ?, discount = ?, image = ?, category = ?, description = ?
         WHERE id = ?`,
        [name, stock, price, discount, image, category, description, id],
        err => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  },

  delete(id) {
    return new Promise((resolve, reject) => {
      db.query('DELETE FROM products WHERE id = ?', [id], err => {
        if (err) return reject(err);
        resolve();
      });
    });
  },

  setFavorite(id, favorite) {
    return new Promise((resolve, reject) => {
      db.query(
        'UPDATE products SET isFavorite = ? WHERE id = ?',
        [favorite ? 1 : 0, id],
        err => (err ? reject(err) : resolve())
      );
    });
  },

  decreaseQuantity(productId, amount, callback) {
    db.query(
      'UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
      [amount, productId, amount],
      callback
    );
  },

  async decreaseBulk(items = []) {
    // Decrease stock for multiple items, with explicit availability checks
    const normalized = (Array.isArray(items) ? items : [])
      .map(i => ({
        productId: Number(i.product_id ?? i.productId ?? i.id),
        quantity: Number(i.quantity || 0),
        name: i.name || i.productName || ''
      }))
      .filter(i => i.productId && i.quantity > 0);

    if (!normalized.length) return;

    const conn = db.promise();
    for (const item of normalized) {
      const [rows] = await conn.query('SELECT quantity FROM products WHERE id = ?', [item.productId]);
      if (!rows.length) {
        throw new Error(`Product ${item.name || item.productId} not found`);
      }
      const available = Number(rows[0].quantity || 0);
      if (available < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name || `item ${item.productId}`}. Available: ${available}`);
      }
      const [result] = await conn.query(
        'UPDATE products SET quantity = quantity - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
      if (!result || result.affectedRows === 0) {
        throw new Error(`Failed to update stock for ${item.name || `item ${item.productId}`}`);
      }
    }
  }
};
