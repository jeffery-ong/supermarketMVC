const Review = require('../models/Review');

module.exports = {
  async listUserReviews(req, res, next) {
    try {
      const userId = req.session.user && req.session.user.id;
      if (!userId) return res.redirect('/login');
      const reviews = await Review.getForUser(userId);
      res.render('myReviews', { title: 'My Reviews', reviews });
    } catch (err) {
      next(err);
    }
  }
};
