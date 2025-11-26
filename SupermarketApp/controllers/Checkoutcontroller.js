const Cart = require('../models/Cart');
const PH = require('../models/ph');

module.exports = {
  checkout: async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.redirect('/login');
      const rawCart = req.session.cart || [];
      if (!rawCart.length) {
        req.flash('error', 'Cart is empty');
        return res.redirect('/cart');
      }
      const normalized = rawCart.map((c, idx) => {
        const productId = c.product_id ?? c.productId ?? c.id ?? (c.product && c.product.id);
        if (productId == null) throw new Error('Missing product id at index ' + idx);
        return {
          product_id: productId,
          quantity: c.quantity ?? c.qty ?? 1,
          price: c.price ?? (c.product && c.product.price)
        };
      });
      await PH.createBulk(user.id, normalized);
      req.session.cart = [];
      req.flash('success', 'Checkout complete');
      res.redirect('/purchase-history');
    } catch (e) {
      console.error('Checkout error:', e.message);
      req.flash('error', e.message || 'Checkout failed');
      res.redirect('/cart');
    }
  }
};

