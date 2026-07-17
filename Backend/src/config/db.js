import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool, types } = pg;

// Tell pg to parse TIMESTAMP WITHOUT TIME ZONE (OID 1114) as UTC instead of local time
types.setTypeParser(1114, str => new Date(str + "Z"));

const connectionConfig =String( process.env.DATABASE_URL) 
  ? { connectionString: String(process.env.DATABASE_URL) }
  : {
      host: process.env.PG_HOST || "localhost",
      port: parseInt(process.env.PG_PORT || "5432", 10),
      user: process.env.PG_USER || "postgres",
      password: String(process.env.PG_PASSWORD || ""),
      database: process.env.PG_DATABASE || "securetalk",
    };

const sslConfig = process.env.DATABASE_URL 
  ? { rejectUnauthorized: false }
  : (process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : false);

const pool = new Pool({
  ...connectionConfig,
  ssl: sslConfig,
});

pool.query("SELECT 1")
  .then(() => console.log("📦 Database connected"))
  .catch(err => {
    console.error("❌ Database connection failed:", err.message);
    console.error("   Config method:", process.env.DATABASE_URL ? "DATABASE_URL" : "Individual PG_* vars");
    console.error("   Connection string:", process.env.DATABASE_URL ? "***" : `${process.env.PG_HOST || "localhost"}:${process.env.PG_PORT || "5432"}`);
    process.exit(1);
  });

export default pool;
