const ProductController = require('./Productcontroller');

const SupermarketController = {
  // Inventory (admin) - list all products
  inventory: function(req, res) {
    ProductController.getAll(function(err, products) {
      if (err) {
        console.error('Inventory load error:', err);
        return res.status(500).render('error', { message: 'Unable to load inventory', error: err });
      }
      return res.render('inventory', { products: products || [], user: req.session.user });
    });
  },

  // Shopping page (user) - list all products
  shopping: function(req, res) {
    ProductController.getAll(function(err, products) {
      if (err) {
        console.error('Shopping load error:', err);
        return res.status(500).render('error', { message: 'Unable to load products', error: err });
      }
      return res.render('shopping', { products: products || [], user: req.session.user });
    });
  },

  // Show product detail
  getById: function(req, res) {
    const productId = parseInt(req.params.id, 10);
    ProductController.getById(productId, function(err, product) {
      if (err) {
        console.error('Product load error:', err);
        return res.status(500).render('error', { message: 'Unable to load product', error: err });
      }
      if (!product) {
        return res.status(404).render('error', { message: 'Product not found', error: {} });
      }
      return res.render('product', { product, user: req.session.user });
    });
  },

  // Render add product form
  showAdd: function(req, res) {
    return res.render('addProduct', { user: req.session.user });
  },

  // Add product (handles file upload via req.file)
  add: function(req, res) {
    const { productName, quantity, price } = req.body;
    const image = req.file ? req.file.filename : null;

    if (!productName || !quantity || !price) {
      req.flash('error', 'All fields are required');
      return res.redirect('/addProduct');
    }

    const productData = { productName, quantity: parseInt(quantity), price: parseFloat(price), image };
    ProductController.create(productData, function(err) {
      if (err) {
        console.error('Product add error:', err);
        req.flash('error', 'Failed to add product');
        return res.redirect('/addProduct');
      }
      req.flash('success', 'Product added successfully');
      return res.redirect('/inventory');
    });
  },

  // Render update product form
  showUpdate: function(req, res) {
    const productId = parseInt(req.params.id, 10);
    ProductController.getById(productId, function(err, product) {
      if (err || !product) {
        req.flash('error', 'Product not found');
        return res.redirect('/inventory');
      }
      return res.render('updateProduct', { product, user: req.session.user });
    });
  },

  // Update product (preserve existing image if no new upload)
  update: function(req, res) {
    const productId = parseInt(req.params.id, 10);
    const { productName, quantity, price } = req.body;
    const image = req.file ? req.file.filename : req.body.existingImage;

    if (!productName || !quantity || !price) {
      req.flash('error', 'All fields are required');
      return res.redirect('/updateProduct/' + productId);
    }

    const productData = { productName, quantity: parseInt(quantity), price: parseFloat(price), image };
    ProductController.update(productId, productData, function(err) {
      if (err) {
        console.error('Product update error:', err);
        req.flash('error', 'Failed to update product');
        return res.redirect('/updateProduct/' + productId);
      }
      req.flash('success', 'Product updated successfully');
      return res.redirect('/inventory');
    });
  },

  // Delete product
  delete: function(req, res) {
    const productId = parseInt(req.params.id, 10);
    ProductController.delete(productId, function(err) {
      if (err) {
        console.error('Product delete error:', err);
        req.flash('error', 'Failed to delete product');
        return res.redirect('/inventory');
      }
      req.flash('success', 'Product deleted successfully');
      return res.redirect('/inventory');
    });
  },

  // Home page - no products needed, just show carousel
  home: function(req, res) {
    return res.render('home', { user: req.session && req.session.user });
  }
};

module.exports = SupermarketController;