const User = require('../models/User');

function sanitizeRole(role = '') {
  const val = String(role).toLowerCase();
  return val === 'admin' ? 'admin' : 'user';
}

module.exports = {
  async list(req, res, next) {
    try {
      const users = await User.getAll();
      res.render('users', {
        title: 'Users',
        users,
        currentUserId: req.session.user.id
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.redirect('/users');

      const target = await User.findById(id);
      const normalized = target ? User.normalizeUser(target) : null;
      if (!normalized) {
        req.flash('error', 'User not found');
        return res.redirect('/users');
      }

      const { username, email, contact, address, role } = req.body;
      const cleanRole = role !== undefined ? sanitizeRole(role) : normalized.role;
      if (normalized.role === 'admin' && cleanRole !== 'admin') {
        req.flash('error', 'Admins cannot be demoted to user');
        return res.redirect('/users');
      }
      await User.update(id, { username, email, contact, address, role: cleanRole });

      if (req.session.user && req.session.user.id === id) {
        Object.assign(req.session.user, { username, email, contact, address, role: cleanRole });
      }

      req.flash('success', 'User updated');
      res.redirect('/users');
    } catch (err) {
      console.error('Update user error:', err);
      req.flash('error', 'Update failed');
      res.redirect('/users');
    }
  },

  async promote(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.redirect('/users');

      await User.setRole(id, 'admin');
      if (req.session.user && req.session.user.id === id) {
        req.session.user.role = 'admin';
      }

      req.flash('success', 'User promoted to admin');
      res.redirect('/users');
    } catch (err) {
      console.error('Promote user error:', err);
      req.flash('error', 'Promotion failed');
      res.redirect('/users');
    }
  },

  async demote(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.redirect('/users');

      const target = await User.findById(id);
      const normalized = target ? User.normalizeUser(target) : null;
      if (!normalized) {
        req.flash('error', 'User not found');
        return res.redirect('/users');
      }
      if (normalized.role === 'admin') {
        req.flash('error', 'Admins cannot be demoted to user');
        return res.redirect('/users');
      }

      await User.setRole(id, 'user');
      if (req.session.user && req.session.user.id === id) {
        req.session.user.role = 'user';
      }

      req.flash('success', 'User demoted to user');
      res.redirect('/users');
    } catch (err) {
      console.error('Demote user error:', err);
      req.flash('error', 'Demotion failed');
      res.redirect('/users');
    }
  },

  async remove(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.redirect('/users');

      if (req.session.user && req.session.user.id === id) {
        req.flash('error', 'You cannot remove your own account while logged in.');
        return res.redirect('/users');
      }

      const target = await User.findById(id);
      const normalized = target ? User.normalizeUser(target) : null;
      if (!normalized) {
        req.flash('error', 'User not found');
        return res.redirect('/users');
      }
      if (normalized.role === 'admin') {
        req.flash('error', 'Admins cannot remove other admins');
        return res.redirect('/users');
      }

      await User.remove(id);
      req.flash('success', 'User removed');
      res.redirect('/users');
    } catch (err) {
      console.error('Delete user error:', err);
      req.flash('error', 'Delete failed');
      res.redirect('/users');
    }
  }
};
