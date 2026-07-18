import pool from './src/config/db.js';

async function migrate() {
  try {
    await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent'");
    console.log("Migration successful");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
