const { createClient } = require("@libsql/client");
const path = require("path");

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("❌ Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars");
  process.exit(1);
}

const localDbPath = path.join(__dirname, "..", "database", "fitbois.db");

const local = createClient({ url: `file:${localDbPath}` });
const remote = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

async function migrateTable(tableName, columns) {
  const rows = (await local.execute(`SELECT * FROM ${tableName}`)).rows;
  if (rows.length === 0) {
    console.log(`  ⏭️  ${tableName}: 0 rows (skipped)`);
    return 0;
  }

  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;

  let migrated = 0;
  for (const row of rows) {
    const args = columns.map((col) => row[col] ?? null);
    await remote.execute({ sql, args });
    migrated++;
  }

  console.log(`  ✅ ${tableName}: ${migrated} rows`);
  return migrated;
}

async function main() {
  console.log("🚀 Migrating data from local SQLite to Turso...\n");
  console.log(`  Local:  ${localDbPath}`);
  console.log(`  Remote: ${TURSO_URL}\n`);

  let total = 0;

  total += await migrateTable("users", [
    "id", "name", "avatar", "start_date", "current_consistency_level",
    "clean_weeks", "missed_weeks", "total_points", "is_active",
    "special_starting_level", "reactivated_at_week", "created_at", "updated_at",
  ]);

  total += await migrateTable("goals", [
    "id", "user_id", "category", "description", "is_difficult",
    "is_completed", "completed_date", "created_date", "updated_at",
  ]);

  total += await migrateTable("workout_days", [
    "id", "user_id", "week", "day_of_week", "date",
    "is_completed", "workout_type", "notes", "marked_by", "timestamp",
  ]);

  total += await migrateTable("weekly_plans", [
    "id", "user_id", "week", "committed_days", "committed_at",
    "created_by", "created_at", "updated_at",
  ]);

  total += await migrateTable("admin_settings", [
    "id", "challenge_start_date", "challenge_end_date",
    "current_week", "is_active", "updated_at",
  ]);

  console.log(`\n✅ Migration complete! ${total} total rows migrated.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
