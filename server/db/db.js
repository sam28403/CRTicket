import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";

const db = new Database(process.env.DATABASE_PATH || fileURLToPath(new URL("./train.db", import.meta.url)));
db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
                                         id INTEGER PRIMARY KEY AUTOINCREMENT,
                                         username TEXT UNIQUE NOT NULL,
                                         password TEXT NOT NULL,
                                         created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tickets (
                                           id INTEGER PRIMARY KEY AUTOINCREMENT,
                                           user_id INTEGER NOT NULL,
                                           ticket_number TEXT,
                                           train_no TEXT,
                                           departure_station TEXT,
                                           arrival_station TEXT,
                                           travel_date TEXT,
                                           departure_time TEXT,
                                           price REAL,
                                           use_credit INTEGER,
                                           seat_type TEXT,
                                           has_conditioner INTEGER,
                                           seat_no TEXT,
                                           sell_place TEXT,
                                           gate_info TEXT,
                                           message TEXT,
                                           theme TEXT,
                                           distance INTEGER,
                                           created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                           FOREIGN KEY (user_id) REFERENCES users(id)
        );
`);

export default db;
