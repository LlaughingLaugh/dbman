'use server';

import {
  connectToDb,
  closeDb,
  listTables,
  getOneRow, // For COUNT(*)
  // TableColumn might not be directly needed here, but good to have if schema details were required
} from '@/lib/db'; // Assuming db utilities are in app/lib/db.ts
import path from 'path';
import fs from 'fs';

// Define a base directory for database files on the server
const DB_BASE_DIR = path.join(process.cwd(), 'data');

// Ensure the DB_BASE_DIR exists (idempotent)
if (!fs.existsSync(DB_BASE_DIR)) {
  fs.mkdirSync(DB_BASE_DIR, { recursive: true });
  console.log(`Created database directory for insights: ${DB_BASE_DIR}`);
}

// --- Type Definitions ---
export interface TableInfo {
  name: string;
  rowCount: number;
}
export interface DatabaseInsight {
  path: string; // Original path/name provided by user
  fileName: string; // Actual file name used
  tableCount: number;
  totalRows: number;
  tables: TableInfo[];
  error?: string; // For per-database errors
}
export interface InsightStats {
  totalDatabasesProcessed: number;
  totalDatabasesSuccessfullyProcessed: number;
  totalTables: number;
  grandTotalRows: number;
  databases: DatabaseInsight[];
}

export interface GetOverallStatsResult {
  success: boolean;
  stats?: InsightStats;
  error?: string; // For overall errors (e.g., no dbs provided)
}


async function getTableRowCount(db: any, tableName: string): Promise<number> {
  // Quote table name for safety, especially if it contains special characters or keywords
  const safeTableName = `"${tableName.replace(/"/g, '""')}"`;
  const row = await getOneRow<{ count: number }>(db, `SELECT COUNT(*) as count FROM ${safeTableName}`);
  return row?.count || 0;
}

export async function getOverallStatsAction(databaseFileNames: string[]): Promise<GetOverallStatsResult> {
  if (!databaseFileNames || databaseFileNames.length === 0) {
    return { success: false, error: 'No database file names provided.' };
  }

  const overallStats: InsightStats = {
    totalDatabasesProcessed: databaseFileNames.length,
    totalDatabasesSuccessfullyProcessed: 0,
    totalTables: 0,
    grandTotalRows: 0,
    databases: [],
  };

  for (const fileName of databaseFileNames) {
    if (!fileName || fileName.trim() === '') {
      overallStats.databases.push({
        path: fileName,
        fileName: fileName,
        tableCount: 0,
        totalRows: 0,
        tables: [],
        error: 'File name is empty.',
      });
      continue;
    }
     if (fileName.includes('/') || fileName.includes('..')) {
      overallStats.databases.push({
        path: fileName,
        fileName: fileName,
        tableCount: 0,
        totalRows: 0,
        tables: [],
        error: 'Invalid database file name. Must not contain path separators.',
      });
      continue;
    }


    const fullDbPath = path.join(DB_BASE_DIR, fileName);
    let db;
    const dbInsight: DatabaseInsight = {
      path: fileName, // User-provided name
      fileName: fileName, // Actual file name
      tableCount: 0,
      totalRows: 0,
      tables: [],
    };

    try {
      if (!fs.existsSync(fullDbPath)) {
        throw new Error(`Database file not found: ${fileName}`);
      }
      
      db = await connectToDb(fullDbPath);
      const tableNames = await listTables(db);
      dbInsight.tableCount = tableNames.length;
      overallStats.totalTables += tableNames.length;

      for (const tableName of tableNames) {
        const rowCount = await getTableRowCount(db, tableName);
        dbInsight.tables.push({ name: tableName, rowCount });
        dbInsight.totalRows += rowCount;
      }
      overallStats.grandTotalRows += dbInsight.totalRows;
      overallStats.totalDatabasesSuccessfullyProcessed++;

    } catch (err: any) {
      console.error(`Error processing database ${fileName}:`, err);
      dbInsight.error = err.message || 'Failed to process database.';
    } finally {
      if (db) {
        try {
          await closeDb(db);
        } catch (closeErr: any) {
          console.error(`Error closing DB for ${fileName}:`, closeErr);
          // If dbInsight.error is not set, maybe set it here or log prominently
          if (!dbInsight.error) {
            dbInsight.error = `Failed to close database connection for ${fileName}. Stats might be incomplete.`;
          }
        }
      }
    }
    overallStats.databases.push(dbInsight);
  }

  return { success: true, stats: overallStats };
}
