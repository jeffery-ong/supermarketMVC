const Product = require('./Product');

module.exports = {
  getCart: function(session) {
    return session.cart || [];
  },

  addItem: function(session, product, qty, callback) {
    if (!session.cart) session.cart = [];
    
    // Check if product has enough stock
    if (product.quantity < qty) {
      return callback(new Error('Insufficient stock. Only ' + product.quantity + ' available.'));
    }

    const existing = session.cart.find(i => Number(i.productId) === Number(product.id));
    if (existing) {
      const newQty = Number(existing.quantity) + qty;
      if (product.quantity < newQty) {
        return callback(new Error('Insufficient stock. Only ' + product.quantity + ' available.'));
      }
      existing.quantity = newQty;
    } else {
      session.cart.push({
        productId: product.id,
        productName: product.productName,
        price: product.price,
        quantity: qty,
        image: product.image
      });
    }
    
    callback(null);
  },

  updateItem: function(session, productId, qty) {
    const cart = session.cart || [];
    const item = cart.find(i => Number(i.productId) === Number(productId));
    if (item) item.quantity = qty;
  },

  removeItem: function(session, productId) {
    session.cart = (session.cart || []).filter(i => Number(i.productId) !== Number(productId));
  },

  clearCart: function(session) {
    session.cart = [];
  },

  calculateTotal: function(cart) {
    return cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  }
};