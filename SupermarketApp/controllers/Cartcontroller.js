const Product = require('../models/Product');
const CartStore = require('../models/CartStore');
const User = require('../models/User');

const GST_RATE = 0.09;
const DELIVERY_FEE = 5;
const DELIVERY_THRESHOLD = 50;
const round2 = num => Math.round(Number(num || 0) * 100) / 100;

const ensureCart = req => {
  if (!Array.isArray(req.session.cart)) req.session.cart = [];
  return req.session.cart;
};

async function ensureDbUser(req) {
  const userId = req.session.user && Number(req.session.user.id);
  if (!userId) return null;
  try {
    const exists = await User.findById(userId);
    return exists ? userId : null;
  } catch (err) {
    console.error('Failed to verify user for cart persist:', err.message);
    return null;
  }
}

const pushFeedback = (req, key, message) => {
  const storeKey = key === 'error' ? 'cartErrors' : 'cartMessages';
  if (!Array.isArray(req.session[storeKey])) req.session[storeKey] = [];
  req.session[storeKey].push(message);
};

exports.viewCart = (req, res) => {
  const cart = ensureCart(req);
  const searchTerm = (req.query.search || '').trim().toLowerCase();
  const filteredCart = searchTerm
    ? cart.filter(item => item.name.toLowerCase().includes(searchTerm))
    : cart;
  const subtotal = round2(
    filteredCart.reduce(
      (sum, item) => round2(sum + round2((item.price || 0) * (item.quantity || 1))),
      0
    )
  );
  const gst = round2(subtotal * GST_RATE);
  const preDeliveryTotal = round2(subtotal + gst);
  const deliveryFee = preDeliveryTotal >= DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = round2(preDeliveryTotal + deliveryFee);
  const errors = Array.isArray(req.session.cartErrors) ? req.session.cartErrors : [];
  const messages = Array.isArray(req.session.cartMessages) ? req.session.cartMessages : [];
  req.session.cartErrors = [];
  req.session.cartMessages = [];
  res.render('cart', {
    title: 'Cart',
    cart: filteredCart,
    subtotal,
    gst,
    deliveryFee,
    total,
    errors,
    messages,
    search: req.query.search || ''
  });
};

exports.addToCart = async (req, res) => {
  const { productId, quantity } = req.body;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  try {
    const product = await Product.getById(productId);
    if (!product) {
      pushFeedback(req, 'error', 'Product not found.');
      return res.redirect('/shopping');
    }

    const cart = ensureCart(req);
    const existing = cart.find(item => item.productId === product.id);
    // Re-sync stock on the cart item so the UI max reflects latest inventory
    if (existing) existing.stock = product.stock;

    const currentQty = existing ? existing.quantity : 0;
    const available = Math.max(0, product.stock - currentQty);
    if (available <= 0) {
      pushFeedback(req, 'error', 'No more stock available for this item.');
      return res.redirect('/shopping');
    }

    const addQty = Math.min(qty, available);
    if (existing) {
      existing.quantity = currentQty + addQty;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        stock: product.stock,
        quantity: addQty
      });
    }

    // Persist to DB for logged-in users
    const userId = await ensureDbUser(req);
    if (userId) {
      try {
        await CartStore.upsertItem(userId, product.id, qty);
      } catch (dbErr) {
        console.error('Failed to persist cart item:', dbErr.message);
      }
    } else if (req.session.user) {
      console.warn('Skipping cart persist: session user missing in DB');
    }

    if (addQty < qty) {
      pushFeedback(req, 'error', `Only ${addQty} left in stock. Added what was available.`);
    } else {
      pushFeedback(req, 'message', 'Item added to cart.');
    }
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    pushFeedback(req, 'error', 'Unable to add item to cart.');
    res.redirect('/shopping');
  }
};

exports.updateQuantity = async (req, res) => {
  const { productId } = req.params;
  const qty = Math.max(1, parseInt(req.body.quantity, 10) || 1);

  try {
    const cart = ensureCart(req);
    const item = cart.find(entry => entry.productId === Number(productId));
    if (!item) {
      pushFeedback(req, 'error', 'Cart item not found.');
      return res.redirect('/cart');
    }

    const product = await Product.getById(productId);
    if (!product) {
      pushFeedback(req, 'error', 'Product not found.');
      return res.redirect('/cart');
    }

    const clampedQty = Math.min(qty, product.stock);
    item.quantity = clampedQty;

    const userId = await ensureDbUser(req);
    if (userId) {
      try {
        await CartStore.setQuantity(userId, product.id, item.quantity);
      } catch (dbErr) {
        console.error('Failed to update cart quantity:', dbErr.message);
      }
    } else if (req.session.user) {
      console.warn('Skipping cart persist: session user missing in DB');
    }

    if (clampedQty < qty) {
      pushFeedback(req, 'error', `Only ${clampedQty} left in stock for ${item.name}. Quantity adjusted.`);
    } else {
      pushFeedback(req, 'message', 'Quantity updated.');
    }
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    pushFeedback(req, 'error', 'Unable to update quantity.');
    res.redirect('/cart');
  }
};

exports.removeItem = async (req, res) => {
  const { productId } = req.params;
  const cart = ensureCart(req);
  const index = cart.findIndex(entry => entry.productId === Number(productId));

  if (index !== -1) {
    cart.splice(index, 1);
    pushFeedback(req, 'message', 'Item removed from cart.');

    const userId = await ensureDbUser(req);
    if (userId) {
      try {
        await CartStore.removeItem(userId, Number(productId));
      } catch (dbErr) {
        console.error('Failed to remove cart item:', dbErr.message);
      }
    } else if (req.session.user) {
      console.warn('Skipping cart persist: session user missing in DB');
    }
  } else {
    pushFeedback(req, 'error', 'Cart item not found.');
  }

  res.redirect('/cart');
};
