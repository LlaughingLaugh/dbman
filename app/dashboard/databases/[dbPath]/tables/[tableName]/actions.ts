'use server';

import {
  connectToDb,
  closeDb,
  getTableSchema as getTableSchemaDb, // Renamed to avoid conflict
  getAllRows,
  getOneRow, // For potential future use, or if count needs specific handling
  runQuery,
  TableColumn // Re-export or define if not globally available from db.ts
} from '@/lib/db';
import path from 'path';
import fs from 'fs';

// Define a base directory for database files on the server (consistent with other actions)
const DB_BASE_DIR = path.join(process.cwd(), 'data');

// Ensure the DB_BASE_DIR exists
if (!fs.existsSync(DB_BASE_DIR)) {
  fs.mkdirSync(DB_BASE_DIR, { recursive: true });
}

function getFullDbPath(encodedDbPath: string): string {
  const dbFileName = decodeURIComponent(encodedDbPath);
  if (dbFileName.includes('/') || dbFileName.includes('..')) {
    throw new Error('Invalid database file name. Must not contain path separators.');
  }
  return path.join(DB_BASE_DIR, dbFileName);
}

function sanitizeIdentifier(identifier: string): string {
  // Basic sanitization: ensure it's a valid identifier (alphanumeric + underscore)
  // and quote it to handle spaces or keywords.
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
     // If it's not a simple identifier, quote it. This is a basic measure.
     // For production, a more robust SQL identifier quoting/validation library might be needed.
    return `"${identifier.replace(/"/g, '""')}"`;
  }
  return identifier; // Simple identifiers don't strictly need quotes but it's safer.
}


export interface GetTableInfoAndDataResult {
  success: boolean;
  schema?: TableColumn[];
  data?: any[];
  totalRows?: number;
  error?: string;
  primaryKeyColumns?: string[];
}

export async function getTableInfoAndDataAction(
  encodedDbPath: string,
  encodedTableName: string,
  page: number = 1,
  pageSize: number = 10,
  sortBy?: string,
  sortDirection?: 'ASC' | 'DESC'
): Promise<GetTableInfoAndDataResult> {
  let db;
  const tableName = decodeURIComponent(encodedTableName);
  // Sanitize table name for direct embedding in query (though quoting is generally preferred)
  const safeTableName = `"${tableName.replace(/"/g, '""')}"`;


  try {
    const fullDbPath = getFullDbPath(encodedDbPath);
    db = await connectToDb(fullDbPath);

    const schema = await getTableSchemaDb(db, tableName); // Use original table name for PRAGMA
    if (!schema || schema.length === 0) {
      return { success: false, error: `Table "${tableName}" not found or has no columns.` };
    }
    
    const primaryKeyColumns = schema.filter(col => col.pk > 0).map(col => col.name);


    // Validate sortBy against schema column names
    let orderByClause = '';
    if (sortBy) {
      const columnExists = schema.some(col => col.name === sortBy);
      if (!columnExists) {
        return { success: false, error: `Invalid sort column: ${sortBy}` };
      }
      const safeSortBy = `"${sortBy.replace(/"/g, '""')}"`; // Quote sort by column
      const direction = sortDirection === 'DESC' ? 'DESC' : 'ASC'; // Default to ASC
      orderByClause = `ORDER BY ${safeSortBy} ${direction}`;
    }

    const offset = (page - 1) * pageSize;
    const dataQuery = `SELECT * FROM ${safeTableName} ${orderByClause} LIMIT ? OFFSET ?`;
    const data = await getAllRows(db, dataQuery, [pageSize, offset]);

    const countQuery = `SELECT COUNT(*) as count FROM ${safeTableName}`;
    const totalResult = await getOneRow<{ count: number }>(db, countQuery);
    const totalRows = totalResult?.count || 0;

    return { success: true, schema, data, totalRows, primaryKeyColumns };
  } catch (err: any) {
    console.error(`Error getting table info/data for ${tableName}:`, err);
    return { success: false, error: err.message || 'Failed to fetch table data.' };
  } finally {
    if (db) {
      await closeDb(db);
    }
  }
}

export interface UpdateRowResult {
  success: boolean;
  error?: string;
}

export async function updateRowAction(
  encodedDbPath: string,
  encodedTableName: string,
  primaryKeyCriteria: Record<string, any>, // e.g., { id: 1 } or { part1_id: 'A', part2_id: 'B'}
  updatedValues: Record<string, any>
): Promise<UpdateRowResult> {
  let db;
  const tableName = decodeURIComponent(encodedTableName);
  const safeTableName = `"${tableName.replace(/"/g, '""')}"`;

  if (Object.keys(updatedValues).length === 0) {
    return { success: false, error: 'No values provided for update.' };
  }
   if (Object.keys(primaryKeyCriteria).length === 0) {
    return { success: false, error: 'Primary key criteria missing for update.' };
  }

  const setClauses: string[] = [];
  const setValues: any[] = [];
  for (const key in updatedValues) {
    setClauses.push(`"${key.replace(/"/g, '""')}" = ?`);
    setValues.push(updatedValues[key]);
  }

  const whereClauses: string[] = [];
  const whereValues: any[] = [];
  for (const key in primaryKeyCriteria) {
     whereClauses.push(`"${key.replace(/"/g, '""')}" = ?`);
     whereValues.push(primaryKeyCriteria[key]);
  }

  const query = `UPDATE ${safeTableName} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
  const params = [...setValues, ...whereValues];

  try {
    const fullDbPath = getFullDbPath(encodedDbPath);
    db = await connectToDb(fullDbPath);
    const result = await runQuery(db, query, params);
    if (result.changes === 0) {
        // This could mean the row wasn't found, or values were the same.
        // Depending on desired behavior, this might be an error or just a note.
        console.warn(`Update operation for table ${tableName} with criteria ${JSON.stringify(primaryKeyCriteria)} resulted in 0 changes.`);
        // For now, consider it success if query ran, but client might want to know if 0 rows affected.
    }
    return { success: true };
  } catch (err: any) {
    console.error(`Error updating row in ${tableName}:`, err);
    return { success: false, error: err.message || 'Failed to update row.' };
  } finally {
    if (db) {
      await closeDb(db);
    }
  }
}


export interface InsertRowResult {
  success: boolean;
  error?: string;
  lastID?: number; // lastID from sqlite, typically for autoincrement PKs
}

export async function insertRowAction(
  encodedDbPath: string,
  encodedTableName: string,
  newRowData: Record<string, any>
): Promise<InsertRowResult> {
  let db;
  const tableName = decodeURIComponent(encodedTableName);
  const safeTableName = `"${tableName.replace(/"/g, '""')}"`;

  if (Object.keys(newRowData).length === 0) {
    return { success: false, error: 'No data provided for new row.' };
  }

  const columns = Object.keys(newRowData).map(key => `"${key.replace(/"/g, '""')}"`);
  const placeholders = Object.keys(newRowData).map(() => '?').join(', ');
  const values = Object.values(newRowData);

  const query = `INSERT INTO ${safeTableName} (${columns.join(', ')}) VALUES (${placeholders})`;

  try {
    const fullDbPath = getFullDbPath(encodedDbPath);
    db = await connectToDb(fullDbPath);
    const result = await runQuery(db, query, values);
    return { success: true, lastID: result.lastID };
  } catch (err: any) {
    console.error(`Error inserting row into ${tableName}:`, err);
    return { success: false, error: err.message || 'Failed to insert row.' };
  } finally {
    if (db) {
      await closeDb(db);
    }
  }
}

export interface DeleteRowResult {
  success: boolean;
  error?: string;
}

export async function deleteRowAction(
  encodedDbPath: string,
  encodedTableName: string,
  primaryKeyCriteria: Record<string, any> // e.g., { id: 1 } or { part1_id: 'A', part2_id: 'B'}
): Promise<DeleteRowResult> {
  let db;
  const tableName = decodeURIComponent(encodedTableName);
  const safeTableName = `"${tableName.replace(/"/g, '""')}"`;
  
  if (Object.keys(primaryKeyCriteria).length === 0) {
    return { success: false, error: 'Primary key criteria missing for deletion.' };
  }

  const whereClauses: string[] = [];
  const whereValues: any[] = [];
  for (const key in primaryKeyCriteria) {
     whereClauses.push(`"${key.replace(/"/g, '""')}" = ?`);
     whereValues.push(primaryKeyCriteria[key]);
  }

  const query = `DELETE FROM ${safeTableName} WHERE ${whereClauses.join(' AND ')}`;

  try {
    const fullDbPath = getFullDbPath(encodedDbPath);
    db = await connectToDb(fullDbPath);
    const result = await runQuery(db, query, whereValues);
     if (result.changes === 0) {
        console.warn(`Delete operation for table ${tableName} with criteria ${JSON.stringify(primaryKeyCriteria)} resulted in 0 changes (row not found).`);
    }
    return { success: true };
  } catch (err: any) {
    console.error(`Error deleting row from ${tableName}:`, err);
    return { success: false, error: err.message || 'Failed to delete row.' };
  } finally {
    if (db) {
      await closeDb(db);
    }
  }
}
