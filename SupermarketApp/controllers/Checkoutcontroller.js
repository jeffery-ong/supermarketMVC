const Cart = require('../models/Cart');
const CartStore = require('../models/CartStore');
const PH = require('../models/ph');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const User = require('../models/User');

function normalizeCart(rawCart) {
  return rawCart.map((c, idx) => {
    const productId = c.product_id ?? c.productId ?? c.id ?? (c.product && c.product.id);
    if (productId == null) throw new Error('Missing product id at index ' + idx);
    return {
      product_id: Number(productId),
      quantity: Number(c.quantity ?? c.qty ?? 1),
      price: Number(c.price ?? (c.product && c.product.price) ?? 0),
      name: c.name || (c.product && c.product.name) || c.productName
    };
  });
}

async function hydrateCart(rawCart) {
  const cleaned = normalizeCart(rawCart);
  const validItems = [];
  const missing = [];
  for (const item of cleaned) {
    const product = await Product.getById(item.product_id);
    if (!product) {
      missing.push(item);
      continue;
    }
    const qty = Math.min(Math.max(1, item.quantity || 1), product.stock);
    if (qty <= 0) {
      missing.push(item);
      continue;
    }
    validItems.push({
      product_id: product.id,
      quantity: qty,
      price: product.price,
      name: product.name,
      product
    });
  }
  return { validItems, missing };
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
      const userId = Number(user.id);
      if (!Number.isFinite(userId)) {
        req.flash('error', 'Session expired. Please login again.');
        return res.redirect('/login');
      }
      const dbUser = await User.findById(userId);
      if (!dbUser) {
        req.session.destroy(() => {
          req.flash('error', 'Account not found. Please login again.');
          res.redirect('/login');
        });
        return;
      }
      const rawCart = Array.isArray(req.session.cart) ? req.session.cart : [];
      if (!rawCart.length) {
        req.flash('error', 'Cart is empty');
        return res.redirect('/cart');
      }

      const { validItems, missing } = await hydrateCart(rawCart);
      if (missing.length) {
        req.session.cart = validItems.map(i => ({
          productId: i.product_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          product: i.product
        }));
        req.flash('error', 'Some items were removed or unavailable. Please review your cart.');
        return res.redirect('/cart');
      }
      if (!validItems.length) {
        req.session.cart = [];
        req.flash('error', 'Cart is empty');
        return res.redirect('/cart');
      }

      // Ensure cart in session reflects validated items
      req.session.cart = validItems.map(i => ({
        productId: i.product_id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        product: i.product
      }));
      const method = (req.body.method || 'card').toLowerCase();
      const isQr = method === 'paynow' || method === 'paylah' || method === 'qr';
      let cardNumber = '';
      if (!isQr) {
        const cardNumberRaw = (req.body.cardNumber || '').trim();
        cardNumber = cardNumberRaw.replace(/\D/g, '');
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
      }
      const items = validItems.map((item, idx) => ({
        name: item.name || `Item ${idx + 1}`,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity
      }));
      const total = items.reduce((sum, i) => sum + i.subtotal, 0);
      const issuedAt = new Date();
      const invoice = {
        number: `INV-${Date.now()}`,
        issuedAt,
        customer: {
          name: req.body.cardName || user.name || user.username || 'Customer',
          billing: (req.body.billing || '').trim()
        },
        payment: {
          method: isQr ? 'PayNow / PayLah QR' : 'Card',
          last4: isQr ? '' : cardNumber.slice(-4)
        },
        items,
        total
      };
      const normalized = validItems.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        price: i.price
      }));
      await PH.createBulk(userId, normalized);
      let savedInvoice = invoice;
      let invoiceId;
      try {
        invoiceId = await Invoice.create({
          userId: user.id,
          number: invoice.number,
          issuedAt,
          customerName: invoice.customer.name,
          billing: invoice.customer.billing,
          paymentMethod: invoice.payment.method,
          paymentLast4: invoice.payment.last4,
          total: invoice.total,
          items
        });
        const fetched = await Invoice.getById(invoiceId, user.id);
        if (fetched) savedInvoice = fetched;
        req.session.lastInvoiceId = invoiceId;
      } catch (dbInvoiceErr) {
        console.error('Failed to persist invoice:', dbInvoiceErr.message);
      }
      try {
        await CartStore.clearUser(user.id);
      } catch (dbErr) {
        console.error('Failed to clear cart table for user:', dbErr.message);
      }
      req.session.cart = [];
      req.flash('success', 'Payment successful. Order placed.');
      if (invoiceId) {
        return res.redirect(`/invoice/${invoiceId}`);
      }
      res.render('invoice', { title: 'Invoice', invoice: savedInvoice });
    } catch (e) {
      console.error('Payment error:', e.message);
      req.flash('error', e.message || 'Payment failed');
      res.redirect('/payment');
    }
  }
};

