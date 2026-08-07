import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config();

// Ensure local database folder exists (/tmp on Vercel serverless, .data locally)
const dataDir = process.env.VERCEL ? path.join('/tmp', '.data') : path.join(process.cwd(), '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Embedded PGlite instance for seamless zero-dependency local execution
export const pglite = new PGlite(path.join(dataDir, 'local.db'));

export const db = drizzle({ client: pglite, schema });

// Force WAL flush to disk so data survives server restarts
export async function syncDb() {
  try {
    await pglite.exec('CHECKPOINT');
  } catch {
    // Ignore checkpoint errors
  }
}

// Auto-initialize schema tables if they don't exist
export async function initDbSchema() {
  await pglite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255),
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'student',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      teacher_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      ielts_type VARCHAR(20) NOT NULL DEFAULT 'task2',
      assignment_mode VARCHAR(20) NOT NULL DEFAULT 'full',
      focus_label TEXT,
      prompt_text TEXT NOT NULL,
      image_url TEXT,
      timer_minutes INTEGER,
      min_timer_minutes INTEGER,
      start_date TIMESTAMP,
      due_date TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;

    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      student_id INTEGER NOT NULL REFERENCES users(id),
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      content TEXT NOT NULL DEFAULT '',
      word_count INTEGER NOT NULL DEFAULT 0,
      paste_attempt_count INTEGER NOT NULL DEFAULT 0,
      suspicious_burst_flag BOOLEAN NOT NULL DEFAULT false,
      submitted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      teacher_id INTEGER NOT NULL REFERENCES users(id),
      band_score VARCHAR(10) NOT NULL,
      comments TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
}
