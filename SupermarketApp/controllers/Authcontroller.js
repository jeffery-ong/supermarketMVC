const User = require('../models/User');

module.exports = {
  showRegister(req, res) {
    res.render('register', { title: 'Register' });
  },

  async register(req, res) {
    try {
      const { username, email, contact, address, password } = req.body;
      if (!username || !email || !contact || !address || !password) {
        req.flash('error', 'All fields are required');
        return res.redirect('/register');
      }
      const id = await User.create({ username, email, contact, address, password });
      req.session.user = { id, username, email, contact, address, role: 'user' };
      req.session.save(() => res.redirect('/shopping'));
    } catch (err) {
      console.error('Register error:', err);
      req.flash('error', 'Registration failed');
      res.redirect('/register');
    }
  },

  showLogin(req, res) {
    res.render('login', { title: 'Login' });
  },

  async login(req, res) {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        req.flash('error', 'Username or email and password required');
        return res.redirect('/login');
      }
      const user = await User.findByIdentifier(identifier);
      if (!user) {
        req.flash('error', 'Account not found');
        return res.redirect('/login');
      }
      const validPassword = User.verifyPassword(password, user.password);
      if (!validPassword) {
        req.flash('error', 'Error! Wrong password entered. Try again!');
        return res.redirect('/login');
      }
      const role = (user.role || 'user').toLowerCase();
      req.session.user = {
        id: user.id,
        username: user.username,
        role,
        email: user.email,
        contact: user.contact,
        address: user.address
      };
      req.session.save(() => {
        if (role === 'admin') return res.redirect('/admin');
        res.redirect('/shopping');
      });
    } catch (err) {
      console.error('Login error:', err);
      req.flash('error', 'Login failed');
      res.redirect('/login');
    }
  },

  logout(req, res) {
    req.session.destroy(() => res.redirect('/login'));
  }
};
