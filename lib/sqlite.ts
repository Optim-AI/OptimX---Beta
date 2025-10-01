// lib/sqlite.ts
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";

const DB_PATH = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), "google_ads_tokens.sqlite");

let dbPromise: Promise<any>;

async function getDb() {
  if (!dbPromise) {
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });
    const db = await dbPromise;
    await db.run(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        scope TEXT,
        token_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS profiles (
        email TEXT PRIMARY KEY,
        name TEXT,
        picture TEXT,
        locale TEXT,
        data_json TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  return dbPromise;
}

export async function saveTokenForUser(email: string, tokens: any) {
  const db = await getDb();
  await db.run(
    `INSERT INTO oauth_tokens(email, access_token, refresh_token, scope, token_json)
     VALUES (?, ?, ?, ?, ?)`,
    [email, tokens.access_token || null, tokens.refresh_token || null, tokens.scope || null, JSON.stringify(tokens)]
  );
}

export async function getLatestTokenForUser(email: string) {
  const db = await getDb();
  return db.get(`SELECT * FROM oauth_tokens WHERE email = ? ORDER BY id DESC LIMIT 1`, [email]);
}

export async function upsertProfile(email: string, profile: any) {
  const db = await getDb();
  await db.run(
    `INSERT INTO profiles(email, name, picture, locale, data_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name,
       picture = excluded.picture,
       locale = excluded.locale,
       data_json = excluded.data_json,
       updated_at = CURRENT_TIMESTAMP`,
    [email, profile.name || null, profile.picture || null, profile.locale || null, JSON.stringify(profile)]
  );
}

export async function getProfile(email: string) {
  const db = await getDb();
  return db.get(`SELECT * FROM profiles WHERE email = ?`, [email]);
}
