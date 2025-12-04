const PH = require('../models/ph');
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');

const LOW_STOCK_THRESHOLD = 20;

function formatCurrency(num) {
  return Number(num || 0).toFixed(2);
}

module.exports = {
  async dashboard(req, res, next) {
    try {
      const [purchases, users, products] = await Promise.all([
        PH.getAll(),
        User.getAll(),
        Product.getAll()
      ]);

      const userMap = new Map(users.map(u => [u.id, u]));
      const totals = purchases.reduce(
        (acc, p) => {
          acc.revenue += Number(p.total || 0);
          acc.orders += 1;
          const prodKey = p.productId;
          acc.productTotals.set(prodKey, (acc.productTotals.get(prodKey) || 0) + Number(p.quantity || 0));
          const userKey = p.userId;
          acc.customerSpend.set(userKey, (acc.customerSpend.get(userKey) || 0) + Number(p.total || 0));
          return acc;
        },
        { revenue: 0, orders: 0, productTotals: new Map(), customerSpend: new Map() }
      );

      const bestProductId = [...totals.productTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const bestProduct = products.find(p => p.id === bestProductId) || null;
      const bestProductSold = bestProductId ? totals.productTotals.get(bestProductId) : 0;

      const topCustomerId = [...totals.customerSpend.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const topCustomer = topCustomerId ? userMap.get(topCustomerId) : null;
      const topCustomerSpent = topCustomerId ? totals.customerSpend.get(topCustomerId) : 0;

      const lowStockCount = products.filter(p => Number(p.stock ?? 0) <= LOW_STOCK_THRESHOLD).length;

      const recentOrders = purchases.slice(0, 6).map(p => {
        const customer = userMap.get(p.userId) || {};
        const product = products.find(prod => prod.id === p.productId) || {};
        return {
          id: p.id,
          productName: product.name || 'Product #' + p.productId,
          user: customer.username || customer.email || 'User #' + p.userId,
          email: customer.email || '',
          total: formatCurrency(p.total || 0),
          purchasedAt: p.purchasedAt
        };
      });

      res.render('adminDashboard', {
        title: 'Admin Dashboard',
        stats: {
          revenue: formatCurrency(totals.revenue),
          orders: totals.orders,
          users: users.length,
          products: products.length,
          lowStock: lowStockCount,
          lowStockThreshold: LOW_STOCK_THRESHOLD
        },
        bestProduct: bestProduct
          ? { name: bestProduct.name, sold: bestProductSold, revenue: formatCurrency(bestProductSold * bestProduct.price) }
          : null,
        topCustomer: topCustomer
          ? { name: topCustomer.username || topCustomer.name, email: topCustomer.email, spent: formatCurrency(topCustomerSpent) }
          : null,
        recentOrders
      });
    } catch (err) {
      next(err);
    }
  },

  async revenue(req, res, next) {
    try {
      const purchases = await PH.getAll();
      const daily = purchases.reduce((acc, p) => {
        const d = new Date(p.purchasedAt);
        const key = d.toISOString().slice(0, 10);
        acc[key] = (acc[key] || 0) + Number(p.total || 0);
        return acc;
      }, {});
      const series = Object.entries(daily)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, total]) => ({ date, total: formatCurrency(total) }));

      res.render('adminRevenue', {
        title: 'Revenue',
        totalRevenue: formatCurrency(purchases.reduce((s, p) => s + Number(p.total || 0), 0)),
        series
      });
    } catch (err) {
      next(err);
    }
  }
};
