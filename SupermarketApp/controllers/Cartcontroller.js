const Product = require('../models/Product');

const ensureCart = req => {
  if (!Array.isArray(req.session.cart)) req.session.cart = [];
  return req.session.cart;
};

const pushFeedback = (req, key, message) => {
  const storeKey = key === 'error' ? 'cartErrors' : 'cartMessages';
  if (!Array.isArray(req.session[storeKey])) req.session[storeKey] = [];
  req.session[storeKey].push(message);
};

exports.viewCart = (req, res) => {
  const cart = ensureCart(req);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const errors = Array.isArray(req.session.cartErrors) ? req.session.cartErrors : [];
  const messages = Array.isArray(req.session.cartMessages) ? req.session.cartMessages : [];
  req.session.cartErrors = [];
  req.session.cartMessages = [];
  res.render('cart', { title: 'Cart', cart, total, errors, messages });
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

    if (existing) {
      existing.quantity = Math.min(existing.quantity + qty, product.stock);
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        stock: product.stock,
        quantity: Math.min(qty, product.stock)
      });
    }

    pushFeedback(req, 'message', 'Item added to cart.');
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

    item.quantity = Math.min(qty, product.stock);
    pushFeedback(req, 'message', 'Quantity updated.');
    res.redirect('/cart');
  } catch (err) {
    console.error(err);
    pushFeedback(req, 'error', 'Unable to update quantity.');
    res.redirect('/cart');
  }
};

exports.removeItem = (req, res) => {
  const { productId } = req.params;
  const cart = ensureCart(req);
  const index = cart.findIndex(entry => entry.productId === Number(productId));

  if (index !== -1) {
    cart.splice(index, 1);
    pushFeedback(req, 'message', 'Item removed from cart.');
  } else {
    pushFeedback(req, 'error', 'Cart item not found.');
  }

  res.redirect('/cart');
};