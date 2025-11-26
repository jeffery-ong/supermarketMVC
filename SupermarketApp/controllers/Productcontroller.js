const Product = require('../models/Product');

exports.shopping = async (req, res, next) => {
  try {
    const products = await Product.getAll();
    const topSellers = products.filter(p => p.isFavorite);
    res.render('shopping', {
      title: 'Shop',
      products,
      topSellers
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.redirect('/shopping');
    }
    const productId = parseInt(req.params.id, 10);
    const favorite = req.body.favorite === '1';
    await Product.setFavorite(productId, favorite);
    res.redirect(req.get('referer') || '/shopping');
  } catch (err) {
    console.error('toggleFavorite error:', err);
    res.redirect('/shopping');
  }
};

exports.viewProduct = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const product = await Product.getById(id);
    if (!product) {
      return res.status(404).render('error', { title: 'Error', message: 'Product not found' });
    }
    res.render('product', { title: product.name, product });
  } catch (e) {
    console.error(e);
    res.status(500).render('error', { title: 'Error', message: 'Load failed' });
  }
};

exports.inventory = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.redirect('/shopping');
    }
    const products = await Product.getAll();
    res.render('inventory', { title: 'Inventory', products });
  } catch (e) {
    console.error(e);
    res.render('inventory', { title: 'Inventory', products: [] });
  }
};

exports.showAdd = (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/shopping');
  }
  res.render('addProduct', { title: 'Add Product' });
};

exports.add = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.redirect('/shopping');
    }
    const { name, quantity, price } = req.body;
    const stock = Number(quantity);
    const numericPrice = Number(price);
    const imageFile = req.file ? req.file.filename : '';

    if (!name || Number.isNaN(numericPrice) || Number.isNaN(stock)) {
      req.flash('error', 'All fields required');
      return res.redirect('/addProduct');
    }

    await Product.create({ name, price: numericPrice, stock, image: imageFile });
    req.flash('success', 'Product added');
    res.redirect('/inventory');
  } catch (e) {
    console.error(e);
    req.flash('error', 'Add failed');
    res.redirect('/addProduct');
  }
};

exports.showEdit = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.redirect('/shopping');
    }
    const id = parseInt(req.params.id);
    const product = await Product.getById(id);
    if (!product) {
      return res.redirect('/inventory');
    }
    res.render('editProduct', { title: 'Edit Product', product });
  } catch (e) {
    console.error(e);
    res.redirect('/inventory');
  }
};

exports.edit = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.redirect('/shopping');
    }
    const id = parseInt(req.params.id, 10);
    const existing = await Product.getById(id);
    if (!existing) {
      return res.redirect('/inventory');
    }
    const { name, quantity, price } = req.body;
    const stock = Number(quantity);
    const numericPrice = Number(price);
    const existingFile = (existing.image || '').replace(/^\/images\//, '');
    const imageFile = req.file ? req.file.filename : existingFile;

    await Product.update(id, { name, price: numericPrice, stock, image: imageFile });
    req.flash('success', 'Product updated');
    res.redirect('/inventory');
  } catch (e) {
    console.error(e);
    req.flash('error', 'Update failed');
    res.redirect('/inventory');
  }
};

exports.delete = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.redirect('/shopping');
    }
    const id = parseInt(req.params.id);
    await Product.delete(id);
    req.flash('success', 'Product deleted');
    res.redirect('/inventory');
  } catch (e) {
    console.error(e);
    req.flash('error', 'Delete failed');
    res.redirect('/inventory');
  }
};