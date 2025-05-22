import { NextRequest, NextResponse } from 'next/server';
import { listTables } from '@/lib/db';
import path from 'path';
import fs from 'fs';

const dbsDir = path.join(process.cwd(), 'dbs');

export async function GET(
  request: NextRequest,
  { params }: { params: { dbName: string } }
) {
  const { dbName } = params;

  if (!dbName) {
    return NextResponse.json({ error: 'Database name is required.' }, { status: 400 });
  }

  // Construct the full path to the database file
  // Ensure dbName is a simple filename and not a path traversal attempt
  const safeDbName = path.basename(dbName);
  if (safeDbName !== dbName) {
      return NextResponse.json({ error: 'Invalid database name format.' }, { status: 400 });
  }
  const dbPath = path.join(dbsDir, safeDbName);

  try {
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: `Database ${safeDbName} not found.` }, { status: 404 });
    }

    const tables = listTables(dbPath);
    return NextResponse.json({ tables }, { status: 200 });

  } catch (error) {
    console.error(`Failed to list tables for ${safeDbName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: `Failed to list tables: ${errorMessage}` }, { status: 500 });
  }
}
