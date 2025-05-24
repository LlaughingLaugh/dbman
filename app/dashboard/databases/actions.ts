'use server';

import { connectToDb, listTables, closeDb } from '@/lib/db'; // Adjusted path
import path from 'path';
import fs from 'fs';

// Define a base directory for database files on the server
const DB_BASE_DIR = path.join(process.cwd(), 'data');

// Ensure the DB_BASE_DIR exists
if (!fs.existsSync(DB_BASE_DIR)) {
  fs.mkdirSync(DB_BASE_DIR, { recursive: true });
}

export interface ConnectResult {
  success: boolean;
  path: string;
  tables?: string[];
  error?: string;
}

export async function connectToDatabaseAndListTables(dbFileName: string): Promise<ConnectResult> {
  if (!dbFileName || dbFileName.trim() === '') {
    return { success: false, path: dbFileName, error: 'Database file name cannot be empty.' };
  }
  if (dbFileName.includes('/') || dbFileName.includes('..')) {
    return { success: false, path: dbFileName, error: 'Invalid database file name. Must not contain path separators.' };
  }

  const fullDbPath = path.join(DB_BASE_DIR, dbFileName);

  // Check if the file exists, if not, connectToDb will create it.
  // We could add a check here if we only want to connect to existing DBs.
  // For now, we allow creation.

  let db;
  try {
    db = await connectToDb(fullDbPath);
    const tables = await listTables(db);
    return { success: true, path: dbFileName, tables };
  } catch (err: any) {
    console.error(`Error in server action for ${dbFileName}:`, err);
    return { success: false, path: dbFileName, error: err.message || 'Failed to connect or list tables.' };
  } finally {
    if (db) {
      try {
        await closeDb(db);
      } catch (closeErr: any) {
        console.error(`Error closing DB in server action for ${dbFileName}:`, closeErr);
        // Potentially log this, but the primary error (if any) from connect/listTables is more important to return.
      }
    }
  }
}
