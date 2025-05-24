import sqlite3 from 'sqlite3';

// Ensure VERBOSE mode for better error messages and stack traces
sqlite3.verbose();

/**
 * Connects to an SQLite database.
 * @param dbFilePath - The file path for the SQLite database.
 * @returns A Promise that resolves with the sqlite3.Database instance.
 */
export function connectToDb(dbFilePath: string): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbFilePath, (err) => {
      if (err) {
        console.error('Error connecting to database:', err.message);
        reject(err);
      } else {
        console.log('Connected to SQLite database:', dbFilePath);
        resolve(db);
      }
    });
  });
}

/**
 * Closes the database connection.
 * @param db - The sqlite3.Database instance.
 * @returns A Promise that resolves when the database is closed.
 */
export function closeDb(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
        reject(err);
      } else {
        console.log('Database connection closed.');
        resolve();
      }
    });
  });
}

/**
 * Executes a SQL query that doesn't return rows (e.g., INSERT, UPDATE, DELETE).
 * @param db - The sqlite3.Database instance.
 * @param query - The SQL query string.
 * @param params - Optional array of parameters for the query.
 * @returns A Promise that resolves with an object containing lastID and changes.
 */
export function runQuery(db: sqlite3.Database, query: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    // db.run() context (this) provides lastID and changes.
    // Using function() {} to preserve `this` context from sqlite3.
    db.run(query, params, function (err) {
      if (err) {
        console.error('Error running query:', query, '| Params:', params, '| Error:', err.message);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

/**
 * Executes a SQL query and returns all rows.
 * @param db - The sqlite3.Database instance.
 * @param query - The SQL query string.
 * @param params - Optional array of parameters for the query.
 * @returns A Promise that resolves with an array of rows.
 */
export function getAllRows<T = any>(db: sqlite3.Database, query: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows: T[]) => {
      if (err) {
        console.error('Error getting all rows:', query, '| Params:', params, '| Error:', err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Executes a SQL query and returns a single row.
 * @param db - The sqlite3.Database instance.
 * @param query - The SQL query string.
 * @param params - Optional array of parameters for the query.
 * @returns A Promise that resolves with a single row or undefined.
 */
export function getOneRow<T = any>(db: sqlite3.Database, query: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row: T | undefined) => {
      if (err) {
        console.error('Error getting one row:', query, '| Params:', params, '| Error:', err.message);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * Lists all tables in the database.
 * @param db - The sqlite3.Database instance.
 * @returns A Promise that resolves with an array of table names.
 */
export function listTables(db: sqlite3.Database): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
    db.all(query, (err, rows: { name: string }[]) => {
      if (err) {
        console.error('Error listing tables:', err.message);
        reject(err);
      } else {
        resolve(rows.map(row => row.name));
      }
    });
  });
}

/**
 * Describes the schema of a table.
 * @param db - The sqlite3.Database instance.
 * @param tableName - The name of the table.
 * @returns A Promise that resolves with an array of column information objects.
 */
export interface TableColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number; // 0 or 1
  dflt_value: any;
  pk: number; // 0 or 1 (1 if part of primary key)
}
export function getTableSchema(db: sqlite3.Database, tableName: string): Promise<TableColumn[]> {
  return new Promise((resolve, reject) => {
    const query = `PRAGMA table_info(${tableName});`;
    db.all(query, (err, rows: TableColumn[]) => {
      if (err) {
        console.error(`Error getting schema for table ${tableName}:`, err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}
