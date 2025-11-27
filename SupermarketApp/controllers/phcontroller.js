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
    const searchTerm = (req.query.search || '').trim().toLowerCase();

    const hydrated = purchases
      .map(row => ({
        ...row,
        product: productIndex.get(row.productId) || null
      }))
      .filter(row => {
        if (!searchTerm) return true;
        const name = (row.product ? row.product.name : row.productName || '').toLowerCase();
        const idStr = String(row.productId || '').toLowerCase();
        return name.includes(searchTerm) || idStr.includes(searchTerm);
      });


    res.render('purchaseHistory', {
      title: 'Purchase History',
      isAdmin,
      purchases: hydrated,
      search: req.query.search || ''
    });
  } catch (err) {
    next(err);
  }
};
