import { Database } from "bun:sqlite";
import { join } from "path";

const dbPath = join(import.meta.dir, "../../talechto.db");

export const db = new Database(dbPath)


export const initDB = () => {

    db.run(`PRAGMA foreign_keys = ON;`);
    db.run("PRAGMA journal_mode = WAL;");

    db.run(`
        CREATE TABLE IF NOT EXISTS users(
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            stripe_customer_id TEXT UNIQUE,
            is_premium INTEGER DEFAULT 0,
            is_admin INTEGER DEFAULT 0,
            premium_until TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );   
    `)

    db.run(`
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            action TEXT,                   -- 'CONVERSION_SUCCESS', 'CONVERSION_ERROR', 'PAYMENT'
            details TEXT,                  -- 'WAV to MP3 - 15MB'
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS daily_usage(
            user_id TEXT NOT NULL,
            day TEXT DEFAULT (CURRENT_DATE),
            count INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, day),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );    
    `);
}
