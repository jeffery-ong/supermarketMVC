const connection = require('../db');
const Product = require('./Product');

module.exports = {
  createOrder: function(userId, cart, total, callback) {
    const sql = 'INSERT INTO orders (user_id, total, created_at) VALUES (?, ?, NOW())';
    connection.query(sql, [userId, total], function(err, result) {
      if (err) return callback(err);
      const orderId = result.insertId;
      callback(null, { orderId });
    });
  },

  decreaseInventory: function(cart, callback) {
    if (!cart || cart.length === 0) {
      return callback(null);
    }

    let completed = 0;
    let hasError = false;

    cart.forEach(function(item) {
      Product.decreaseQuantity(item.productId, item.quantity, function(err, result) {
        if (hasError) return;

        if (err) {
          hasError = true;
          return callback(err);
        }

        if (result.affectedRows === 0) {
          hasError = true;
          return callback(new Error('Insufficient stock for ' + item.productName));
        }
        
        completed++;
        if (completed === cart.length) {
          callback(null);
        }
      });
    });
  }
};