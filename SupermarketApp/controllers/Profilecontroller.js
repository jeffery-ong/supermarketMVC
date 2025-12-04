const User = require('../models/User');
const PaymentMethod = require('../models/PaymentMethod');

module.exports = {
  async show(req, res, next) {
    try {
      const user = await User.findById(req.session.user.id);
      const normalized = user ? User.normalizeUser(user) : null;
      if (!normalized) {
        req.flash('error', 'Profile not found');
        return res.redirect('/login');
      }
      const isAdmin = (normalized.role || '').toLowerCase() === 'admin';
      if (isAdmin) {
        await PaymentMethod.removeByUser(req.session.user.id);
      }
      const payment = isAdmin ? null : await PaymentMethod.getByUser(req.session.user.id);
      res.render('profile', {
        title: 'Profile',
        profile: normalized,
        cardInfo: payment || {}
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res) {
    try {
      const id = req.session.user.id;
      const role = (req.session.user.role || '').toLowerCase();
      const {
        username = '',
        email = '',
        contact = '',
        address = '',
        cardNumber = '',
        cardName = '',
        cardLabel = '',
        expiry = '',
        cvv = ''
      } = req.body;

      if (!username.trim()) {
        req.flash('error', 'Username is required');
        return res.redirect('/profile');
      }

      await User.updateProfile(id, {
        username: username.trim(),
        email: email.trim(),
        contact: contact.trim(),
        address: address.trim()
      });

      Object.assign(req.session.user, {
        username: username.trim(),
        email: email.trim(),
        contact: contact.trim(),
        address: address.trim()
      });

      if (role === 'admin') {
        await PaymentMethod.removeByUser(id);
      } else {
        // Persist payment method (stores last4/label/expiry/cvv, never full number)
        await PaymentMethod.upsert(id, {
          cardNumber,
          cardName,
          cardLabel,
          expiry,
          cvv
        });
      }

      req.flash('success', 'Profile updated');
      res.redirect('/profile');
    } catch (err) {
      console.error('Profile update error:', err);
      req.flash('error', 'Failed to update profile');
      res.redirect('/profile');
    }
  },

  async changePassword(req, res) {
    try {
      const id = req.session.user.id;
      const { currentPassword = '', newPassword = '', confirmPassword = '' } = req.body;

      if (!newPassword || newPassword.length < 6) {
        req.flash('error', 'New password must be at least 6 characters');
        return res.redirect('/profile');
      }
      if (newPassword !== confirmPassword) {
        req.flash('error', 'Passwords do not match');
        return res.redirect('/profile');
      }

      const user = await User.findById(id);
      if (!user || !User.verifyPassword(currentPassword, user.password)) {
        req.flash('error', 'Current password is incorrect');
        return res.redirect('/profile');
      }

      await User.setPassword(id, newPassword);
      req.flash('success', 'Password updated');
      res.redirect('/profile');
    } catch (err) {
      console.error('Password change error:', err);
      req.flash('error', 'Failed to change password');
      res.redirect('/profile');
    }
  }
};
