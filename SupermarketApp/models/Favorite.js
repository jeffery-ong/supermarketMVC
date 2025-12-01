const db = require('../db');

const PRIMARY_TABLE = 'users_favourite';
const LEGACY_TABLE = 'favorites';
let tableName = PRIMARY_TABLE;
let initPromise;

async function tableExists(name) {
  const [rows] = await db.promise().query('SHOW TABLES LIKE ?', [name]);
  return rows.length > 0;
}

async function createPrimaryTable() {
  await db
    .promise()
    .query(
      `
      CREATE TABLE IF NOT EXISTS ${PRIMARY_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_product (user_id, product_id),
        INDEX idx_users_favourite_user (user_id),
        INDEX idx_users_favourite_product (product_id),
        CONSTRAINT fk_users_favourite_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_users_favourite_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `
    );
}

async function copyLegacyToPrimary() {
  await db
    .promise()
    .query(
      `INSERT IGNORE INTO ${PRIMARY_TABLE} (user_id, product_id, created_at)
       SELECT user_id, product_id, COALESCE(created_at, NOW()) FROM ${LEGACY_TABLE}`
    );
}

initPromise = (async () => {
  try {
    const hasPrimary = await tableExists(PRIMARY_TABLE);
    const hasLegacy = await tableExists(LEGACY_TABLE);
    if (!hasPrimary) {
      await createPrimaryTable();
      if (hasLegacy) {
        await copyLegacyToPrimary();
      }
    }
    tableName = hasPrimary ? PRIMARY_TABLE : hasLegacy ? LEGACY_TABLE : PRIMARY_TABLE;
  } catch (err) {
    console.error('Failed to initialize favourites table:', err.message);
  }
})();

async function ensureReady() {
  if (initPromise) {
    await initPromise;
  }
}

module.exports = {
  async getForUser(userId) {
    await ensureReady();
    if (!userId) return [];
    const [rows] = await db
      .promise()
      .query(`SELECT product_id FROM ${tableName} WHERE user_id = ?`, [userId]);
    return rows.map(r => Number(r.product_id));
  },

  async set(userId, productId, favorite) {
    await ensureReady();
    if (!userId || !productId) return { affectedRows: 0 };
    if (favorite) {
      const [result] = await db
        .promise()
        .query(
          `INSERT IGNORE INTO ${tableName} (user_id, product_id) VALUES (?, ?)`,
          [userId, productId]
        );
      return result;
    }
    const [result] = await db
      .promise()
      .query(`DELETE FROM ${tableName} WHERE user_id = ? AND product_id = ?`, [
        userId,
        productId
      ]);
    return result;
  }
};
