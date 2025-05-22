import { NextRequest, NextResponse } from 'next/server';
import { fetchTableData, getPrimaryKeyColumn } from '@/lib/db';
import path from 'path';
import fs from 'fs';

const dbsDir = path.join(process.cwd(), 'dbs');

// Helper to sanitize database and table names
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { dbName: string; tableName: string } }
) {
  const { dbName: rawDbName, tableName: rawTableName } = params;

  // Sanitize dbName and tableName
  const dbName = path.basename(rawDbName);
  if (dbName !== rawDbName) {
      return NextResponse.json({ error: 'Invalid database name format.' }, { status: 400 });
  }
  const tableName = sanitizeName(rawTableName);
  if (tableName !== rawTableName) {
      return NextResponse.json({ error: 'Invalid table name format.' }, { status: 400 });
  }

  const dbPath = path.join(dbsDir, dbName);

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: `Database ${dbName} not found.` }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const sortBy = searchParams.get('sortBy') || undefined; // Let db function handle default if any
  const sortOrder = searchParams.get('sortOrder') as 'ASC' | 'DESC' | undefined;

  const filters: Record<string, any> = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith('filter_')) {
      const filterKey = key.substring('filter_'.length);
      // Sanitize filterKey to prevent injection if it's used directly in SQL construction
      // However, better-sqlite3 uses prepared statements which mitigates this for values.
      // Keys are trickier, ensure they are valid column names if possible, or use a schema check.
      // For now, basic sanitization on key.
      const sanitizedFilterKey = sanitizeName(filterKey);
      if (sanitizedFilterKey !== filterKey) {
          // Or handle as an error, depending on security posture
          console.warn(`Potentially unsafe filter key detected and sanitized: ${filterKey} to ${sanitizedFilterKey}`);
      }
      filters[sanitizedFilterKey] = value;
    }
  });

  try {
    const { data, totalRows } = fetchTableData(dbPath, tableName, {
      page,
      limit,
      sortBy,
      sortOrder,
      filters,
    });

    return NextResponse.json({
      data,
      totalRows,
      totalPages: Math.ceil(totalRows / limit),
      currentPage: page,
      limit,
    });
  } catch (error) {
    console.error(`Failed to fetch data for table ${tableName} in ${dbName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    // Check if the error is due to a non-existent table
    if (errorMessage.toLowerCase().includes('no such table')) {
        return NextResponse.json({ error: `Table '${tableName}' not found in database '${dbName}'.` }, { status: 404 });
    }
    return NextResponse.json({ error: `Failed to fetch table data: ${errorMessage}` }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { dbName: string; tableName: string } }
) {
  const { dbName: rawDbName, tableName: rawTableName } = params;

  // Sanitize dbName and tableName
  const dbName = path.basename(rawDbName);
  if (dbName !== rawDbName) {
    return NextResponse.json({ error: 'Invalid database name format.' }, { status: 400 });
  }
  const tableName = sanitizeName(rawTableName);
  if (tableName !== rawTableName) {
    return NextResponse.json({ error: 'Invalid table name format.' }, { status: 400 });
  }
  
  const dbPath = path.join(dbsDir, dbName);

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: `Database ${dbName} not found.` }, { status: 404 });
  }

  try {
    const body = await request.json();
    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'Request body cannot be empty.' }, { status: 400 });
    }

    // It's good practice to ensure that all keys in `body` are valid column names for `tableName`.
    // This requires fetching the schema and comparing. For now, we'll proceed with caution.
    // Sanitize keys in body (simple sanitization)
    const sanitizedBody: Record<string, any> = {};
    for (const key in body) {
        const sanitizedKey = sanitizeName(key);
        // Potentially disallow if sanitizedKey !== key, or log a warning
        if (sanitizedKey !== key) {
            console.warn(`Potentially unsafe key in POST data detected and sanitized: ${key} to ${sanitizedKey}`);
        }
        sanitizedBody[sanitizedKey] = body[key];
    }


    const { insertRow } = await import('@/lib/db'); // Dynamically import to ensure fresh copy if needed
    const result = insertRow(dbPath, tableName, sanitizedBody);

    if (result.success) {
      return NextResponse.json({ message: 'Row inserted successfully.', id: result.id }, { status: 201 });
    } else {
      // Check for specific SQLite errors if needed (e.g., UNIQUE constraint failed)
      // result.error might contain "UNIQUE constraint failed: table.column"
      if (result.error?.includes('UNIQUE constraint failed')) {
        return NextResponse.json({ error: `Failed to insert row: UNIQUE constraint failed. ${result.error}` }, { status: 409 }); // 409 Conflict
      }
      if (result.error?.includes('NOT NULL constraint failed')) {
        return NextResponse.json({ error: `Failed to insert row: NOT NULL constraint failed. ${result.error}` }, { status: 400 });
      }
      if (result.error?.toLowerCase().includes('no such table')) {
        return NextResponse.json({ error: `Table '${tableName}' not found in database '${dbName}'.` }, { status: 404 });
      }
      return NextResponse.json({ error: `Failed to insert row: ${result.error}` }, { status: 500 });
    }
  } catch (error) {
    console.error(`Failed to insert data into table ${tableName} in ${dbName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    if (error instanceof SyntaxError && errorMessage.includes('JSON')) {
        return NextResponse.json({ error: 'Invalid JSON format in request body.' }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to insert data: ${errorMessage}` }, { status: 500 });
  }
}
