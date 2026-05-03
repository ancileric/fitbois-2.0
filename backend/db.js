const { createClient } = require("@libsql/client");
const path = require("path");

const localDbPath = path.join(__dirname, "database", "fitbois.db");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${localDbPath}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = {
  async all(sql, params = []) {
    const result = await client.execute({ sql, args: params });
    return result.rows;
  },

  async get(sql, params = []) {
    const result = await client.execute({ sql, args: params });
    return result.rows[0] || null;
  },

  async run(sql, params = []) {
    const result = await client.execute({ sql, args: params });
    return {
      changes: result.rowsAffected,
      lastID: Number(result.lastInsertRowid),
    };
  },

  async exec(sql) {
    await client.execute(sql);
  },
};

module.exports = db;
