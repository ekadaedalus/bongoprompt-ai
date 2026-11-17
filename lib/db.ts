import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

// A single SQLite file at data/bongoprompt.db. Built into Node, so there is no server or package to install.
const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { bongoDb?: DatabaseSync };

function open() {
  const db = new DatabaseSync(path.join(dataDir, "bongoprompt.db"));
  // Several processes (dev server, build workers) can open the file at once: wait instead of failing.
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    -- Confirmed trip plans. The id (e.g. BT-7K2QXM) is generated once, on confirm.
    CREATE TABLE IF NOT EXISTS trips (
      id          TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      origin      TEXT,
      destination TEXT NOT NULL,
      checkin     TEXT NOT NULL,
      checkout    TEXT NOT NULL,
      total       INTEGER NOT NULL,
      data        TEXT NOT NULL, -- full TripRecord as JSON
      status      TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'booked', 'completed', 'cancelled')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS trips_by_user ON trips(user_id, created_at);
    -- Real local guides who signed up through "Become a guide". One profile per account.
    CREATE TABLE IF NOT EXISTS guides (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      phone       TEXT NOT NULL,
      city        TEXT NOT NULL,
      city_key    TEXT NOT NULL, -- normalized city for matching, e.g. "coxs bazar"
      specialty   TEXT NOT NULL,
      hourly_rate INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS guides_by_city ON guides(city_key);
  `);

  // Migration: trips created before trip status existed get the column, with every row "upcoming".
  const tripColumns = db.prepare("PRAGMA table_info(trips)").all().map((c) => String(c.name));
  if (!tripColumns.includes("status")) {
    db.exec(
      `ALTER TABLE trips ADD COLUMN status TEXT NOT NULL DEFAULT 'upcoming'
       CHECK (status IN ('upcoming', 'booked', 'completed', 'cancelled'))`
    );
  }
  return db;
}

export const db = globalForDb.bongoDb ?? (globalForDb.bongoDb = open());
