const Cart = require('../models/Cart');
const CartStore = require('../models/CartStore');
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
      const cardNumberRaw = (req.body.cardNumber || '').trim();
      const cardNumber = cardNumberRaw.replace(/\D/g, '');
      if (cardNumber.length !== 16) {
        req.flash('error', 'Card number must be 16 digits.');
        return res.redirect('/payment');
      }
      const cvv = (req.body.cvv || '').replace(/\D/g, '');
      if (cvv.length !== 3) {
        req.flash('error', 'CVV must be 3 digits.');
        return res.redirect('/payment');
      }
      const expiry = (req.body.expiry || '').trim();
      const expiryMatch = expiry.match(/^(\d{2})\/?(\d{2})$/);
      if (!expiryMatch) {
        req.flash('error', 'Expiry must be in MM/YY format.');
        return res.redirect('/payment');
      }
      const month = Number(expiryMatch[1]);
      const year = Number(expiryMatch[2]);
      if (month < 1 || month > 12 || year < 25) {
        req.flash('error', 'Expiry date is invalid or already expired.');
        return res.redirect('/payment');
      }
      const items = rawCart.map((item, idx) => {
        const price = Number(item.price || (item.product && item.product.price) || 0);
        const quantity = item.quantity || 1;
        return {
          name: item.name || (item.product && item.product.name) || `Item ${idx + 1}`,
          quantity,
          price,
          subtotal: price * quantity
        };
      });
      const total = items.reduce((sum, i) => sum + i.subtotal, 0);
      const invoice = {
        number: `INV-${Date.now()}`,
        issuedAt: new Date().toISOString(),
        customer: {
          name: req.body.cardName || user.name || user.username || 'Customer',
          billing: (req.body.billing || '').trim()
        },
        payment: {
          method: 'Card',
          last4: cardNumber.slice(-4)
        },
        items,
        total
      };
      const normalized = normalizeCart(rawCart);
      await PH.createBulk(user.id, normalized);
      try {
        await CartStore.clearUser(user.id);
      } catch (dbErr) {
        console.error('Failed to clear cart table for user:', dbErr.message);
      }
      req.session.cart = [];
      req.flash('success', 'Payment successful. Order placed.');
      res.render('invoice', { title: 'Invoice', invoice });
    } catch (e) {
      console.error('Payment error:', e.message);
      req.flash('error', e.message || 'Payment failed');
      res.redirect('/payment');
    }
  }
};

