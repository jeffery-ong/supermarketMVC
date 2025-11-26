const db = require('../db');

const hydrate = row => {
  let imagePath = row.image || '';
  if (!imagePath) {
    imagePath = '/images/placeholder-product.jpg';
  } else if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
    imagePath = `/images/${imagePath}`;
  }

  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    stock: row.stock,
    image: imagePath,
    category: row.category || '',
    discount: Number(row.discountPercentage || 0),
    offerMessage: row.offerMessage || '',
    isFavorite: Boolean(row.isFavorite || 0)
  };
};

module.exports = {
  getAll() {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT id,
                productName       AS name,
                quantity          AS stock,
                price,
                image,
                category,
                discountPercentage,
                offerMessage,
                COALESCE(isFavorite, 0) AS isFavorite
         FROM products
         ORDER BY COALESCE(isFavorite, 0) DESC, productName ASC`,
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
        `SELECT id,
                productName       AS name,
                quantity          AS stock,
                price,
                image,
                category,
                discountPercentage,
                offerMessage,
                COALESCE(isFavorite, 0) AS isFavorite
         FROM products
         WHERE id = ?`,
        [id],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.length ? hydrate(rows[0]) : null);
        }
      );
    });
  },

  create({ name, price, stock, image = '', category = '', discount = 0, offerMessage = '' }) {
    return new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO products (productName, quantity, price, image, category, discountPercentage, offerMessage)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, stock, price, image, category, discount, offerMessage],
        (err, result) => {
          if (err) return reject(err);
          resolve(result.insertId);
        }
      );
    });
  },

  update(id, { name, price, stock, image = '', category = '', discount = 0, offerMessage = '' }) {
    return new Promise((resolve, reject) => {
      db.query(
        `UPDATE products
         SET productName = ?, quantity = ?, price = ?, image = ?, category = ?, discountPercentage = ?, offerMessage = ?
         WHERE id = ?`,
        [name, stock, price, image, category, discount, offerMessage, id],
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
  }
};
