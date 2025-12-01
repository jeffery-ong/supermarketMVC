const db = require('../db');

async function ensureTables() {
  await db
    .promise()
    .query(
      `
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        number VARCHAR(50) NOT NULL,
        issued_at DATETIME NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        billing TEXT,
        payment_method VARCHAR(50) NOT NULL,
        payment_last4 VARCHAR(8),
        total DECIMAL(10,2) NOT NULL DEFAULT 0,
        INDEX idx_invoices_user (user_id),
        UNIQUE KEY uniq_invoice_number (number),
        CONSTRAINT fk_invoices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `
    );

  await db
    .promise()
    .query(
      `
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        INDEX idx_invoice_items_invoice (invoice_id),
        CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `
    );
}

const init = ensureTables().catch(err =>
  console.error('Failed to ensure invoice tables:', err.message)
);

async function withInit(fn) {
  await init;
  return fn();
}

module.exports = {
  async create(invoice) {
    return withInit(async () => {
      const conn = db.promise();
      const {
        userId,
        number,
        issuedAt,
        customerName,
        billing,
        paymentMethod,
        paymentLast4,
        total,
        items
      } = invoice;

      const [invResult] = await conn.query(
        `INSERT INTO invoices
         (user_id, number, issued_at, customer_name, billing, payment_method, payment_last4, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          number,
          issuedAt,
          customerName,
          billing || null,
          paymentMethod,
          paymentLast4 || null,
          total
        ]
      );
      const invoiceId = invResult.insertId;

      if (Array.isArray(items) && items.length) {
        const values = items.map(i => [
          invoiceId,
          i.name,
          i.quantity,
          i.price,
          i.subtotal
        ]);
        await conn.query(
          `INSERT INTO invoice_items (invoice_id, name, quantity, price, subtotal)
           VALUES ?`,
          [values]
        );
      }

      return invoiceId;
    });
  },

  async getById(id, userId) {
    return withInit(async () => {
      const conn = db.promise();
      const [invRows] = await conn.query(
        userId
          ? 'SELECT * FROM invoices WHERE id = ? AND user_id = ?'
          : 'SELECT * FROM invoices WHERE id = ?',
        userId ? [id, userId] : [id]
      );
      if (!invRows.length) return null;
      const inv = invRows[0];
      const [itemRows] = await conn.query(
        'SELECT name, quantity, price, subtotal FROM invoice_items WHERE invoice_id = ?',
        [inv.id]
      );
      return {
        id: inv.id,
        number: inv.number,
        issuedAt: inv.issued_at,
        customer: {
          name: inv.customer_name,
          billing: inv.billing || ''
        },
        payment: {
          method: inv.payment_method,
          last4: inv.payment_last4 || ''
        },
        items: itemRows.map(r => ({
          name: r.name,
          quantity: r.quantity,
          price: Number(r.price),
          subtotal: Number(r.subtotal)
        })),
        total: Number(inv.total)
      };
    });
  },

  async getLatestForUser(userId) {
    if (!userId) return null;
    return withInit(async () => {
      const conn = db.promise();
      const [invRows] = await conn.query(
        `SELECT * FROM invoices
         WHERE user_id = ?
         ORDER BY issued_at DESC, id DESC
         LIMIT 1`,
        [userId]
      );
      if (!invRows.length) return null;
      const inv = invRows[0];
      const [itemRows] = await conn.query(
        'SELECT name, quantity, price, subtotal FROM invoice_items WHERE invoice_id = ?',
        [inv.id]
      );
      return {
        id: inv.id,
        number: inv.number,
        issuedAt: inv.issued_at,
        customer: {
          name: inv.customer_name,
          billing: inv.billing || ''
        },
        payment: {
          method: inv.payment_method,
          last4: inv.payment_last4 || ''
        },
        items: itemRows.map(r => ({
          name: r.name,
          quantity: r.quantity,
          price: Number(r.price),
          subtotal: Number(r.subtotal)
        })),
        total: Number(inv.total)
      };
    });
  }
};
