const Cart = require('../models/Cart');
const PH = require('../models/ph');

function normalizeCart(rawCart) {
  return rawCart.map((c, idx) => {
    const productId = c.product_id ?? c.productId ?? c.id ?? (c.product && c.product.id);
    if (productId == null) throw new Error('Missing product id at index ' + idx);
    return {
      product_id: productId,
      quantity: c.quantity ?? c.qty ?? 1,
      price: c.price ?? (c.product && c.product.price)
    };
  });
}

module.exports = {
  // Old /checkout route now just sends users to payment flow
  checkout: (req, res) => res.redirect('/payment'),

  showPayment: (req, res) => {
    const user = req.session.user;
    if (!user) return res.redirect('/login');
    const cart = req.session.cart || [];
    if (!cart.length) {
      req.flash('error', 'Cart is empty');
      return res.redirect('/cart');
    }
    const total = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    res.render('payment', { title: 'Payment', cart, total });
  },

  processPayment: async (req, res) => {
    try {
      const user = req.session.user;
      if (!user) return res.redirect('/login');
      const rawCart = req.session.cart || [];
      if (!rawCart.length) {
        req.flash('error', 'Cart is empty');
        return res.redirect('/cart');
      }
      const normalized = normalizeCart(rawCart);
      await PH.createBulk(user.id, normalized);
      req.session.cart = [];
      req.flash('success', 'Payment successful. Order placed.');
      res.redirect('/purchase-history');
    } catch (e) {
      console.error('Payment error:', e.message);
      req.flash('error', e.message || 'Payment failed');
      res.redirect('/payment');
    }
  }
};

