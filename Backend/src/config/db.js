import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  user: process.env.PG_USER,
  password: String(process.env.PG_PASSWORD),
  database: process.env.PG_DATABASE,
});
pool.query("SELECT 1")
  .then(() => console.log("✅ Postgres connected"))
  .catch(err => {
    console.error("❌ DB connection error:", err.message);
    process.exit(1);
  });

export default pool;
