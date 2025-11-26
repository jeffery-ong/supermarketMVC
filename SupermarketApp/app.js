require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const multer = require('multer');
const connection = require('./db');
const UserModel = require('./models/User');

const Authcontroller = require('./controllers/Authcontroller');
const Productcontroller = require('./controllers/Productcontroller');
const Cartcontroller = require('./controllers/Cartcontroller');
const Checkoutcontroller = require('./controllers/Checkoutcontroller');
const phcontroller = require('./controllers/phcontroller');

const app = express();

// parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// static + views
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// persistent session store
const sessionStore = new MySQLStore(
  {
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 min
    expiration: 1000 * 60 * 60 * 24 // 24h
  },
  connection
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      secure: false,
      httpOnly: true
    }
  })
);

app.use(flash());

// locals
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.messages = {
    error: req.flash('error'),
    success: req.flash('success')
  };
  next();
});

// Multer (for product images if needed)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/images'),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safe);
  }
});
function fileFilter(req, file, cb) {
  if (!/image\/(png|jpe?g|gif)/.test(file.mimetype)) return cb(new Error('Invalid image type'));
  cb(null, true);
}
const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });

// auth middleware
function checkAuthenticated(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// DIAGNOSTICS - Add this before routes
console.log('=== DIAGNOSTICS ===');
console.log('Authcontroller:', Object.keys(Authcontroller));
console.log('Productcontroller:', Object.keys(Productcontroller));
console.log('Cartcontroller:', Object.keys(Cartcontroller));
console.log('Checkoutcontroller:', Object.keys(Checkoutcontroller));
console.log('phcontroller:', Object.keys(phcontroller));
console.log('Type of Productcontroller.shopping:', typeof Productcontroller.shopping);
console.log('Type of checkAuthenticated:', typeof checkAuthenticated);
console.log('==================');

// ROUTES (your existing routes)
app.get('/login', Authcontroller.showLogin);
app.post('/login', loadLoginUser, Authcontroller.login);
app.get('/register', Authcontroller.showRegister);
app.post('/register', Authcontroller.register);
app.get('/logout', Authcontroller.logout);

app.get('/shopping', checkAuthenticated, Productcontroller.shopping);
app.get('/product/:id', checkAuthenticated, Productcontroller.viewProduct);

app.get('/inventory', checkAuthenticated, Productcontroller.inventory);
app.get('/inventory/add', checkAuthenticated, Productcontroller.showAdd);
app.post('/inventory/add', checkAuthenticated, upload.single('image'), Productcontroller.add);
app.get('/inventory/edit/:id', checkAuthenticated, Productcontroller.showEdit);
app.post('/inventory/edit/:id', checkAuthenticated, upload.single('image'), Productcontroller.edit);
app.get('/inventory/delete/:id', checkAuthenticated, Productcontroller.delete);

app.get('/addProduct', checkAuthenticated, Productcontroller.showAdd);
app.post('/addProduct', checkAuthenticated, upload.single('image'), Productcontroller.add);

app.get('/cart', Cartcontroller.viewCart);
app.post('/cart/add', Cartcontroller.addToCart);
app.post('/cart/update/:productId', Cartcontroller.updateQuantity);
app.post('/cart/remove/:productId', Cartcontroller.removeItem);

app.post('/checkout', checkAuthenticated, Checkoutcontroller.checkout);

app.get('/purchase-history', checkAuthenticated, phcontroller.view);

app.get('/', (req, res) => res.render('home', { title: 'Home' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Error', message: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));

async function loadLoginUser(req, res, next) {
  if (req.method !== 'POST') return next();
  const identifier = (req.body.identifier || '').trim();
  if (!identifier) return next();
  try {
    req.loginUser = await UserModel.findByIdentifier(identifier);
    next();
  } catch (err) {
    next(err);
  }
}
