/**
 * Create the tables on a database that hasn't got them yet.
 *
 * The shape comes from ../schema.js — the same DDL the server runs on boot, so
 * this script cannot drift from it the way its hand-copied version did.
 */
const db = require("../db");
const { DDL, INDEXES, MIGRATIONS } = require("../schema");

async function initDatabase() {
  console.log("🚀 Initializing FitBros 3.0 Database...");

  await db.execMultiple(DDL);
  for (const sql of MIGRATIONS) {
    try {
      await db.exec(sql);
    } catch (err) {
      if (!String(err.message).includes("duplicate column")) throw err;
    }
  }
  await db.execMultiple(INDEXES);

  const row = await db.get("SELECT COUNT(*) as count FROM users");
  console.log(`📊 Current users in database: ${row.count}`);
  console.log("✅ Database initialization complete!");
}

initDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Database initialization failed:", err);
    process.exit(1);
  });
