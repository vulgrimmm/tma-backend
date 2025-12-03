import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import pkg from "pg";
import CryptoJS from "crypto-js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --------------------------------
// Create table on startup if needed
// --------------------------------
async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id BIGINT PRIMARY KEY,
      settings JSONB NOT NULL
    );
  `;
  try {
    await pool.query(sql);
    console.log("✅ user_settings table is ready");
  } catch (err) {
    console.error("❌ Error creating user_settings table:", err);
  }
}

ensureTable();

// --------------------------------
// Telegram initData verification
// --------------------------------
function verifyInitData(initData, token) {
  const parsed = new URLSearchParams(initData);
  const hash = parsed.get("hash");
  parsed.delete("hash");

  const dataCheckArr = [];
  parsed.forEach((value, key) => {
    dataCheckArr.push(`${key}=${value}`);
  });

  const dataCheckString = dataCheckArr.sort().join("\n");

  const secretKey = CryptoJS.HmacSHA256(token, "WebAppData");
  const checkHash = CryptoJS.HmacSHA256(dataCheckString, secretKey).toString();

  return checkHash === hash;
}

// --------------------------------
// API: Save user settings
// --------------------------------
app.post("/settings/save", async (req, res) => {
  try {
    const { initData, settings } = req.body;

    if (!verifyInitData(initData, process.env.BOT_TOKEN)) {
      return res.status(403).json({ error: "Invalid auth" });
    }

    const params = new URLSearchParams(initData);
    const user = JSON.parse(params.get("user"));
    const userId = user.id;

    await pool.query(
      `INSERT INTO user_settings (user_id, settings)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings`,
      [userId, settings]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Error in /settings/save:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------------------
// API: Load user settings
// --------------------------------
app.post("/settings/load", async (req, res) => {
  try {
    const { initData } = req.body;

    if (!verifyInitData(initData, process.env.BOT_TOKEN)) {
      return res.status(403).json({ error: "Invalid auth" });
    }

    const params = new URLSearchParams(initData);
    const user = JSON.parse(params.get("user"));
    const userId = user.id;

    const result = await pool.query(
      "SELECT settings FROM user_settings WHERE user_id = $1",
      [userId]
    );

    const settings = result.rows[0]?.settings || {};
    res.json({ ok: true, settings });
  } catch (err) {
    console.error("Error in /settings/load:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
