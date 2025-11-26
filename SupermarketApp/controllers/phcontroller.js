const PH = require('../models/ph');
const Product = require('../models/Product');

exports.view = async (req, res, next) => {
  try {
    if (!req.session.user) return res.redirect('/login');
    const isAdmin = req.session.user.role === 'admin';
    const userId = req.session.user.id;

    const purchases = isAdmin ? await PH.getAll() : await PH.getByUser(userId);
    const products = await Product.getAll();
    const productIndex = new Map(products.map(p => [p.id, p]));

    const hydrated = purchases.map(row => ({
      ...row,
      product: productIndex.get(row.productId) || null
    }));

    
    res.render('purchaseHistory', {
      title: 'Purchase History',
      isAdmin,
      purchases: hydrated
    });
  } catch (err) {
    next(err);
  }
};