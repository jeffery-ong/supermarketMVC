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
    category: '',
    discount: 0,
    offerMessage: '',
    isFavorite: false // set per-user in controller
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
                image
         FROM products
         ORDER BY productName ASC`,
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
                image
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

  create({ name, price, stock, image = '' }) {
    return new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO products (productName, quantity, price, image)
         VALUES (?, ?, ?, ?)`,
        [name, stock, price, image],
        (err, result) => {
          if (err) return reject(err);
          resolve(result.insertId);
        }
      );
    });
  },

  update(id, { name, price, stock, image = '' }) {
    return new Promise((resolve, reject) => {
      db.query(
        `UPDATE products
         SET productName = ?, quantity = ?, price = ?, image = ?
         WHERE id = ?`,
        [name, stock, price, image, id],
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
