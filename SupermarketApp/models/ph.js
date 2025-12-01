const db = require('../db');

let schemaPromise;

const mapPurchase = row => {
  const quantity = Number(row.quantity || 0);
  const unitPrice = Number(
    row.unit_price ??
    row.priceAtPurchase ??
    (row.total && quantity ? row.total / quantity : 0)
  );
  const total = Number(
    row.stored_total ??
    row.computed_total ??
    row.total ??
    unitPrice * quantity
  );

  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity,
    priceAtPurchase: unitPrice,
    total,
    purchasedAt: row.purchased_at
  };
};

async function loadSchema() {
  if (!schemaPromise) {
    schemaPromise = db
      .promise()
      .query('SHOW COLUMNS FROM purchase_history')
      .then(([rows]) => {
        const fields = rows.map(r => r.Field);
        const hasTotalColumn = fields.includes('total');
        const priceColumn = fields.includes('priceAtPurchase')
          ? 'priceAtPurchase'
          : fields.includes('price')
            ? 'price'
            : hasTotalColumn
              ? 'total'
              : null;
        return { hasTotalColumn, priceColumn };
      })
      .catch(err => {
        console.error('Failed to inspect purchase_history schema:', err.message);
        return { hasTotalColumn: false, priceColumn: 'priceAtPurchase' };
      });
  }
  return schemaPromise;
}

module.exports = {
  async getByUser(userId) {
    const schema = await loadSchema();
    const unitPriceSelect = schema.priceColumn
      ? `ph.${schema.priceColumn} AS unit_price`
      : 'NULL AS unit_price';
    const storedTotalSelect = schema.hasTotalColumn ? 'ph.total AS stored_total' : 'NULL AS stored_total';
    const computedTotalSelect = schema.priceColumn
      ? `COALESCE(${schema.hasTotalColumn ? 'ph.total' : 'NULL'}, ph.${schema.priceColumn} * ph.quantity) AS computed_total`
      : `${schema.hasTotalColumn ? 'ph.total' : 'NULL'} AS computed_total`;

    const [rows] = await db.promise().query(
      `SELECT ph.id, ph.user_id, ph.product_id, ph.quantity, ph.purchased_at,
              ${unitPriceSelect},
              ${storedTotalSelect},
              ${computedTotalSelect},
              p.productName AS product_name
       FROM purchase_history ph
       JOIN products p ON p.id = ph.product_id
       WHERE ph.user_id = ?
       ORDER BY ph.purchased_at DESC, ph.id DESC`,
      [userId]
    );
    return rows.map(mapPurchase);
  },

  async getAll() {
    const schema = await loadSchema();
    const unitPriceSelect = schema.priceColumn
      ? `ph.${schema.priceColumn} AS unit_price`
      : 'NULL AS unit_price';
    const storedTotalSelect = schema.hasTotalColumn ? 'ph.total AS stored_total' : 'NULL AS stored_total';
    const computedTotalSelect = schema.priceColumn
      ? `COALESCE(${schema.hasTotalColumn ? 'ph.total' : 'NULL'}, ph.${schema.priceColumn} * ph.quantity) AS computed_total`
      : `${schema.hasTotalColumn ? 'ph.total' : 'NULL'} AS computed_total`;

    const [rows] = await db.promise().query(
      `SELECT ph.id, ph.user_id, ph.product_id, ph.quantity, ph.purchased_at,
              ${unitPriceSelect},
              ${storedTotalSelect},
              ${computedTotalSelect},
              p.productName AS product_name
       FROM purchase_history ph
       JOIN products p ON p.id = ph.product_id
       ORDER BY ph.purchased_at DESC, ph.id DESC`
    );
    return rows.map(mapPurchase);
  },

  async createBulk(userId, cartItems = []) {
    if (!userId || !Array.isArray(cartItems) || cartItems.length === 0) {
      return { affectedRows: 0 };
    }

    const schema = await loadSchema();
    const hasPriceColumn = !!schema.priceColumn;
    const hasTotalColumn = !!schema.hasTotalColumn;
    const columns = ['user_id', 'product_id', 'quantity'];
    if (hasPriceColumn) columns.push(schema.priceColumn);
    if (hasTotalColumn && schema.priceColumn !== 'total') columns.push('total');

    const rows = cartItems
      .filter(item => item && (item.productId || item.product_id) && item.quantity)
      .map(item => {
        const productId = item.productId || item.product_id;
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || item.unitPrice || 0);
        const total = price * qty;
        const base = [userId, productId, qty];
        if (hasPriceColumn) base.push(schema.priceColumn === 'total' ? total : price);
        if (hasTotalColumn && schema.priceColumn !== 'total') base.push(total);
        return base;
      });

    if (!rows.length) return { affectedRows: 0 };

    const sql = `
      INSERT INTO purchase_history (${columns.join(', ')})
      VALUES ?`;
    const [result] = await db.promise().query(sql, [rows]);
    return result;
  }
};
