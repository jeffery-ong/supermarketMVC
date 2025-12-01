const Invoice = require('../models/Invoice');

exports.view = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.redirect('/invoice');
    const userId = req.session.user ? req.session.user.id : null;
    const invoice = await Invoice.getById(id, userId);
    if (!invoice) {
      return res.status(404).render('error', { title: 'Error', message: 'Invoice not found' });
    }
    res.render('invoice', { title: 'Invoice', invoice });
  } catch (err) {
    console.error('Invoice view error:', err.message);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load invoice' });
  }
};

exports.latest = async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');
    const userId = req.session.user.id;
    const lastId = req.session.lastInvoiceId;

    if (lastId) {
      const latest = await Invoice.getById(lastId, userId);
      if (latest) return res.redirect(`/invoice/${lastId}`);
    }

    const invoice = await Invoice.getLatestForUser(userId);
    if (invoice) {
      req.session.lastInvoiceId = invoice.id;
      return res.redirect(`/invoice/${invoice.id}`);
    }

    req.flash('error', 'No invoices found. Complete a checkout to view your invoice.');
    res.redirect('/shopping');
  } catch (err) {
    console.error('Invoice latest error:', err.message);
    res.status(500).render('error', { title: 'Error', message: 'Failed to load invoice' });
  }
};
