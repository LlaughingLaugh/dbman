import { NextRequest, NextResponse } from 'next/server';
import { getTableSchema, TableSchema } from '@/lib/db';
import path from 'path';
import fs from 'fs';

const dbsDir = path.join(process.cwd(), 'dbs');

export async function GET(
  request: NextRequest,
  { params }: { params: { dbName: string; tableName: string } }
) {
  const { dbName, tableName } = params;

  if (!dbName) {
    return NextResponse.json({ error: 'Database name is required.' }, { status: 400 });
  }
  if (!tableName) {
    return NextResponse.json({ error: 'Table name is required.' }, { status: 400 });
  }

  // Construct the full path to the database file
  // Ensure dbName and tableName are simple filenames/identifiers and not path traversal attempts
  const safeDbName = path.basename(dbName);
  if (safeDbName !== dbName) {
      return NextResponse.json({ error: 'Invalid database name format.' }, { status: 400 });
  }
  // For tableName, we generally don't expect path characters, but sanitize it just in case
  // A more robust sanitization might be needed depending on how table names are formed
  const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
  if (safeTableName !== tableName) {
      return NextResponse.json({ error: 'Invalid table name format.' }, { status: 400 });
  }

  const dbPath = path.join(dbsDir, safeDbName);

  try {
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: `Database ${safeDbName} not found.` }, { status: 404 });
    }

    const schema: TableSchema[] = getTableSchema(dbPath, safeTableName);
    
    if (schema.length === 0) {
        // This could mean the table doesn't exist or has no columns (unlikely for valid tables)
        // Check if table exists to differentiate
        const db = require('better-sqlite3')(dbPath);
        const tableCheckStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?");
        const tableExists = tableCheckStmt.get(safeTableName);
        db.close();

        if (!tableExists) {
            return NextResponse.json({ error: `Table '${safeTableName}' not found in database '${safeDbName}'.` }, { status: 404 });
        }
    }
    
    return NextResponse.json({ schema }, { status: 200 });

  } catch (error) {
    console.error(`Failed to get schema for table ${safeTableName} in ${safeDbName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: `Failed to get table schema: ${errorMessage}` }, { status: 500 });
  }
}
