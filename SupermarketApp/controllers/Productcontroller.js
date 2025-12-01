const Product = require('../models/Product');
const Favorite = require('../models/Favorite');

exports.shopping = async (req, res, next) => {
  try {
    const allProducts = await Product.getAll();
    const userId = req.session.user ? req.session.user.id : null;
    const favoriteIds = userId ? await Favorite.getForUser(userId) : [];
    const favoriteSet = new Set(favoriteIds.map(Number));
    const isFav = p => favoriteSet.has(Number(p.id));
    const searchTerm = (req.query.search || '').trim().toLowerCase();
    const sortParamRaw = (req.query.sort || '').toLowerCase();
    const sortOptions = ['price-asc', 'price-desc', 'name-asc', 'name-desc'];
    const sortParam = sortOptions.includes(sortParamRaw) ? sortParamRaw : '';
    const safeNum = val => {
      const cleaned = typeof val === 'string' ? val.replace(/[^0-9.-]+/g, '') : val;
      const n = parseFloat(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    // Mark favorites on the full list
    allProducts.forEach(p => {
      p.isFavorite = isFav(p);
    });

    const favorites = allProducts.filter(p => p.isFavorite);

    // Apply search/sort only to the main (non-favourite) grid
    let working = allProducts.filter(p => !p.isFavorite);
    if (searchTerm) {
      working = working.filter(p => `${p.name}`.toLowerCase().includes(searchTerm));
    }

    const noResults = searchTerm && working.length === 0;

    const sortFns = {
      'price-asc': (a, b) => safeNum(a.price) - safeNum(b.price),
      'price-desc': (a, b) => safeNum(b.price) - safeNum(a.price),
      'name-asc': (a, b) => (a.name || '').localeCompare(b.name || ''),
      'name-desc': (a, b) => (b.name || '').localeCompare(a.name || '')
    };

    if (sortParam && sortFns[sortParam]) {
      working = [...working].sort(sortFns[sortParam]);
    }

    // Ensure stale "not found" flash does not leak into non-empty views
    if (!noResults && res.locals.messages && Array.isArray(res.locals.messages.error)) {
      res.locals.messages.error = res.locals.messages.error.filter(msg => msg !== 'Stuff is not found');
    }

    res.render('shopping', {
      title: 'Shop',
      products: working,
      favorites,
      search: req.query.search || '',
      sort: sortParam,
      noResults
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const userId = req.session.user && Number(req.session.user.id);
    if (Number.isNaN(productId)) {
      return res.redirect('/shopping');
    }
    if (!userId) {
      return res.redirect('/login');
    }

    const product = await Product.getById(productId);
    if (!product) {
      return res.redirect('/shopping');
    }
    const favorites = (await Favorite.getForUser(userId)).map(Number);
    const isCurrentlyFavorite = favorites.includes(productId);

    const favoriteInput = (req.body.favorite ?? req.query.favorite ?? '').toString();
    let favorite;
    if (favoriteInput === '1' || favoriteInput.toLowerCase() === 'true') {
      favorite = true;
    } else if (favoriteInput === '0' || favoriteInput.toLowerCase() === 'false') {
      favorite = false;
    } else {
      favorite = !isCurrentlyFavorite;
    }

    await Favorite.set(userId, productId, favorite);
    // Always return to shopping (or referrer) so the UI reflects the change
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
    const userId = req.session.user ? req.session.user.id : null;
    if (userId) {
      const favs = await Favorite.getForUser(userId);
      product.isFavorite = favs.includes(product.id);
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
