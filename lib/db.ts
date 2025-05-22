import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dbsDir = path.join(process.cwd(), 'dbs');

/**
 * Defines the structure for table schema information.
 */
export interface TableSchema {
  name: string;    // Column name
  type: string;    // Column data type
  pk: boolean;     // True if part of the primary key
  notnull: boolean; // True if the column cannot be null (actually corresponds to `not null` constraint)
}

/**
 * Stores an uploaded database file.
 * Creates the 'dbs' directory if it doesn't exist.
 */
export function storeUploadedDbFile(fileBuffer: Buffer, filename: string): string {
  if (!fs.existsSync(dbsDir)) {
    fs.mkdirSync(dbsDir, { recursive: true });
  }
  const filePath = path.join(dbsDir, filename);
  fs.writeFileSync(filePath, fileBuffer);
  return filePath;
}

/**
 * Connects to a given SQLite database file path.
 */
export function connectToDb(dbPath: string): Database.Database {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found at ${dbPath}`);
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

/**
 * Lists all tables in the given SQLite database.
 */
export function listTables(dbPath: string): string[] {
  const db = connectToDb(dbPath);
  try {
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
    const tables = stmt.all() as { name: string }[];
    return tables.map(table => table.name);
  } finally {
    db.close();
  }
}

/**
 * Retrieves the schema for a specific table in the SQLite database.
 */
export function getTableSchema(dbPath: string, tableName: string): TableSchema[] {
  const db = connectToDb(dbPath);
  try {
    const stmt = db.prepare(`PRAGMA table_info(${tableName});`);
    const rows = stmt.all() as { name: string; type: string; notnull: number; pk: number }[];
    return rows.map(row => ({
      name: row.name,
      type: row.type,
      pk: row.pk === 1,
      notnull: row.notnull === 1,
    }));
  } finally {
    db.close();
  }
}

/**
 * Retrieves the primary key column name for a specific table.
 * Assumes a single primary key. Returns null if no PK or composite PK.
 */
export function getPrimaryKeyColumn(dbPath: string, tableName: string): string | null {
  const schema = getTableSchema(dbPath, tableName);
  const pkColumns = schema.filter(col => col.pk);
  if (pkColumns.length === 1) {
    return pkColumns[0].name;
  }
  return null; // No PK or composite PK
}

/**
 * Fetches data from the specified table with pagination, sorting, and filtering.
 */
export function fetchTableData(
  dbPath: string,
  tableName: string,
  options: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    filters?: Record<string, any>;
  }
): { data: Record<string, any>[]; totalRows: number } {
  const db = connectToDb(dbPath);
  try {
    let query = `SELECT * FROM ${tableName}`;
    let countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
    const params: any[] = [];
    const countParams: any[] = [];

    if (options.filters && Object.keys(options.filters).length > 0) {
      const filterClauses = Object.entries(options.filters)
        .map(([key, value]) => {
          if (value === null || value === 'NULL') {
            return `${key} IS NULL`;
          } else if (typeof value === 'string' && (value.startsWith('%') || value.endsWith('%'))) {
            return `${key} LIKE ?`;
          } else {
            return `${key} = ?`;
          }
        });
      query += ` WHERE ${filterClauses.join(' AND ')}`;
      countQuery += ` WHERE ${filterClauses.join(' AND ')}`;
      Object.values(options.filters).forEach(value => {
        if (!(value === null || value === 'NULL')) {
          params.push(value);
          countParams.push(value);
        }
      });
    }

    const totalRowsStmt = db.prepare(countQuery);
    const { count: totalRows } = totalRowsStmt.get(...countParams) as { count: number };

    if (options.sortBy) {
      const order = options.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      // Basic sanitization for sortBy: allow only alphanumeric and underscore
      const safeSortBy = options.sortBy.replace(/[^a-zA-Z0-9_]/g, '');
      if (safeSortBy) {
        query += ` ORDER BY ${safeSortBy} ${order}`;
      }
    }

    if (options.limit && options.page) {
      const offset = (options.page - 1) * options.limit;
      query += ` LIMIT ? OFFSET ?`;
      params.push(options.limit, offset);
    } else if (options.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }
    
    const stmt = db.prepare(query);
    const data = stmt.all(...params);
    return { data, totalRows };
  } finally {
    db.close();
  }
}

/**
 * Inserts a new row into the table.
 */
export function insertRow(
  dbPath: string,
  tableName: string,
  data: Record<string, any>
): { success: boolean; id?: number | string; error?: string } {
  const db = connectToDb(dbPath);
  try {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const values = Object.values(data);
    const stmt = db.prepare(`INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`);
    const info = stmt.run(...values);
    return { success: true, id: info.lastInsertRowid };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    db.close();
  }
}

/**
 * Updates an existing row identified by rowId (value of the primary key column).
 */
export function updateRow(
  dbPath: string,
  tableName: string,
  rowId: any,
  idColumn: string,
  data: Record<string, any>
): { success: boolean; changes?: number; error?: string } {
  const db = connectToDb(dbPath);
  try {
    const keys = Object.keys(data);
    const setClauses = keys.map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), rowId];
    const stmt = db.prepare(`UPDATE ${tableName} SET ${setClauses} WHERE ${idColumn} = ?`);
    const info = stmt.run(...values);
    return { success: true, changes: info.changes };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    db.close();
  }
}

/**
 * Deletes a row identified by rowId.
 */
export function deleteRow(
  dbPath: string,
  tableName: string,
  rowId: any,
  idColumn: string
): { success: boolean; changes?: number; error?: string } {
  const db = connectToDb(dbPath);
  try {
    const stmt = db.prepare(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`);
    const info = stmt.run(rowId);
    return { success: true, changes: info.changes };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    db.close();
  }
}
