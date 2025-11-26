const connection = require('../db');

// Compatibility wrapper: delegate to controllers/Productcontroller so any remaining requires keep working.
const ProductController = require('../controllers/Productcontroller');

module.exports = {
  getAll: ProductController.getAll,
  getById: ProductController.getById,
  add: ProductController.add,
  update: ProductController.update,
  delete: ProductController.delete
};