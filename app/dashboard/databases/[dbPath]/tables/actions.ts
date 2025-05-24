'use server';

import { connectToDb, listTables, runQuery, closeDb } from '@/lib/db';
import path from 'path';
import fs from 'fs';

// Define a base directory for database files on the server
const DB_BASE_DIR = path.join(process.cwd(), 'data');

// Ensure the DB_BASE_DIR exists (idempotent)
if (!fs.existsSync(DB_BASE_DIR)) {
  fs.mkdirSync(DB_BASE_DIR, { recursive: true });
  console.log(`Created database directory: ${DB_BASE_DIR}`);
}

function getFullDbPath(encodedDbPath: string): string {
  const dbFileName = decodeURIComponent(encodedDbPath);
  if (dbFileName.includes('/') || dbFileName.includes('..')) {
    throw new Error('Invalid database file name. Must not contain path separators.');
  }
  return path.join(DB_BASE_DIR, dbFileName);
}

export interface ListTablesResult {
  success: boolean;
  tables?: string[];
  error?: string;
}

export async function listTablesAction(encodedDbPath: string): Promise<ListTablesResult> {
  let db;
  try {
    const fullDbPath = getFullDbPath(encodedDbPath);
    db = await connectToDb(fullDbPath);
    const tables = await listTables(db);
    return { success: true, tables };
  } catch (err: any) {
    console.error(`Error listing tables for ${decodeURIComponent(encodedDbPath)}:`, err);
    return { success: false, error: err.message || 'Failed to list tables.' };
  } finally {
    if (db) {
      try {
        await closeDb(db);
      } catch (closeErr: any) {
        console.error(`Error closing DB while listing tables for ${decodeURIComponent(encodedDbPath)}:`, closeErr);
      }
    }
  }
}

export interface ColumnDefinition {
  name: string;
  type: string; // e.g., TEXT, INTEGER, REAL, BLOB
  primaryKey: boolean;
  notNull: boolean;
}

export interface CreateTableResult {
  success: boolean;
  error?: string;
}

export async function createTableAction(
  encodedDbPath: string,
  tableName: string,
  columns: ColumnDefinition[]
): Promise<CreateTableResult> {
  if (!tableName || tableName.trim() === '') {
    return { success: false, error: 'Table name cannot be empty.' };
  }
  if (columns.length === 0) {
    return { success: false, error: 'Table must have at least one column.' };
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    return { success: false, error: 'Invalid table name. Use letters, numbers, and underscores, starting with a letter or underscore.' };
  }
  for (const col of columns) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col.name)) {
      return { success: false, error: `Invalid column name: ${col.name}. Use letters, numbers, and underscores, starting with a letter or underscore.` };
    }
  }


  const columnDefs = columns.map(col => {
    let def = `"${col.name}" ${col.type.toUpperCase()}`; // Ensure type is uppercase, quote names
    if (col.primaryKey) {
      def += ' PRIMARY KEY';
    }
    if (col.notNull) {
      def += ' NOT NULL';
    }
    return def;
  });

  // Check for multiple primary keys if not using COMPOSITE PK syntax explicitly
  const pkCount = columns.filter(col => col.primaryKey).length;
  let createTableQuery: string;

  if (pkCount > 1) {
    // Create a composite primary key
    const pkColumns = columns.filter(col => col.primaryKey).map(col => `"${col.name}"`).join(', ');
    // Redefine columnDefs without individual PRIMARY KEY constraints for composite PK
    const columnDefsWithoutIndividualPK = columns.map(col => {
        let def = `"${col.name}" ${col.type.toUpperCase()}`;
        // NOT NULL constraint can still be individual
        if (col.notNull && !col.primaryKey) { // PK columns in a composite key are implicitly NOT NULL
             def += ' NOT NULL';
        } else if (col.primaryKey && col.notNull) { // if explicitly marked as not null and also pk
             def += ' NOT NULL';
        }
        return def;
    });
    createTableQuery = `CREATE TABLE "${tableName}" (${columnDefsWithoutIndividualPK.join(', ')}, PRIMARY KEY (${pkColumns}))`;
  } else {
    createTableQuery = `CREATE TABLE "${tableName}" (${columnDefs.join(', ')})`;
  }
  
  console.log("Executing SQL:", createTableQuery);


  let db;
  try {
    const fullDbPath = getFullDbPath(encodedDbPath);
    db = await connectToDb(fullDbPath);
    await runQuery(db, createTableQuery);
    return { success: true };
  } catch (err: any) {
    console.error(`Error creating table ${tableName} in ${decodeURIComponent(encodedDbPath)}:`, err);
    return { success: false, error: err.message || `Failed to create table ${tableName}.` };
  } finally {
    if (db) {
      try {
        await closeDb(db);
      } catch (closeErr: any)
      {
        console.error(`Error closing DB after creating table for ${decodeURIComponent(encodedDbPath)}:`, closeErr);
      }
    }
  }
}

export interface DeleteTableResult {
  success: boolean;
  error?: string;
}

export async function deleteTableAction(encodedDbPath: string, tableName: string): Promise<DeleteTableResult> {
  if (!tableName || tableName.trim() === '') {
    return { success: false, error: 'Table name cannot be empty for deletion.' };
  }
   if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    return { success: false, error: 'Invalid table name for deletion.' };
  }

  const dropTableQuery = `DROP TABLE IF EXISTS "${tableName}"`; // Use IF EXISTS for safety, quote name

  let db;
  try {
    const fullDbPath = getFullDbPath(encodedDbPath);
    db = await connectToDb(fullDbPath);
    await runQuery(db, dropTableQuery);
    return { success: true };
  } catch (err: any) {
    console.error(`Error deleting table ${tableName} from ${decodeURIComponent(encodedDbPath)}:`, err);
    return { success: false, error: err.message || `Failed to delete table ${tableName}.` };
  } finally {
    if (db) {
      try {
        await closeDb(db);
      } catch (closeErr: any) {
         console.error(`Error closing DB after deleting table for ${decodeURIComponent(encodedDbPath)}:`, closeErr);
      }
    }
  }
}
