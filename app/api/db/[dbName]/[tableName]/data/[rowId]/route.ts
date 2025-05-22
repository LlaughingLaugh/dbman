import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryKeyColumn, updateRow, deleteRow } from '@/lib/db';
import path from 'path';
import fs from 'fs';

const dbsDir = path.join(process.cwd(), 'dbs');

// Helper to sanitize database and table names
function sanitizeName(name: string): string {
  // Allow alphanumeric, underscore. Disallow anything else.
  // For rowId, it could be numeric or string, so allow more but still be cautious.
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

// More permissive sanitizer for rowId, as it can be numbers or strings, but still block typical path traversal or SQL injection characters.
function sanitizeRowId(id: string): string {
    // Remove characters that are problematic in file paths or SQL, but allow common ID characters.
    // This is a basic example; more robust validation/sanitization might be needed based on expected ID formats.
    return id.replace(/[\/\.\;\`\']/g, '');
}


export async function PUT(
  request: NextRequest,
  { params }: { params: { dbName: string; tableName: string; rowId: string } }
) {
  const { dbName: rawDbName, tableName: rawTableName, rowId: rawRowId } = params;

  // Sanitize dbName and tableName
  const dbName = path.basename(rawDbName);
  if (dbName !== rawDbName) {
    return NextResponse.json({ error: 'Invalid database name format.' }, { status: 400 });
  }
  const tableName = sanitizeName(rawTableName);
   if (tableName !== rawTableName) {
    return NextResponse.json({ error: 'Invalid table name format.' }, { status: 400 });
  }
  const rowId = sanitizeRowId(rawRowId);
  if (rowId !== rawRowId) {
      // If sanitization changed the rowId, it might be an attempt to use invalid characters.
      // Depending on the expected format of rowIds, you might reject this.
      // For now, we'll proceed with the sanitized version but log a warning.
      console.warn(`RowId '${rawRowId}' was sanitized to '${rowId}'.`);
      if (!rowId) { // If sanitization results in an empty string
          return NextResponse.json({ error: 'Invalid row ID format after sanitization.' }, { status: 400 });
      }
  }


  const dbPath = path.join(dbsDir, dbName);

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: `Database ${dbName} not found.` }, { status: 404 });
  }

  const idColumn = getPrimaryKeyColumn(dbPath, tableName);
  if (!idColumn) {
    return NextResponse.json({ error: `Primary key not found or is composite for table ${tableName}. Updates by arbitrary ID not supported.` }, { status: 400 });
  }

  try {
    const body = await request.json();
    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'Request body cannot be empty for update.' }, { status: 400 });
    }

    // Sanitize keys in body
    const sanitizedBody: Record<string, any> = {};
    for (const key in body) {
        const sanitizedKey = sanitizeName(key);
        if (sanitizedKey !== key) {
            console.warn(`Potentially unsafe key in PUT data detected and sanitized: ${key} to ${sanitizedKey}`);
        }
        // It's crucial that idColumn is not part of the SET body, as it's used in WHERE.
        // Or, if it is, ensure it matches the rowId from the path, or handle appropriately.
        // For simplicity, we'll filter it out if present, as PK updates are often restricted.
        if (sanitizedKey === idColumn) {
            console.warn(`Attempt to update primary key column '${idColumn}' in PUT request body was ignored.`);
            continue; 
        }
        sanitizedBody[sanitizedKey] = body[key];
    }
    
    if (Object.keys(sanitizedBody).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update after sanitization or PK column removal.' }, { status: 400 });
    }

    const result = updateRow(dbPath, tableName, rowId, idColumn, sanitizedBody);

    if (result.success) {
      if (result.changes === 0) {
        return NextResponse.json({ message: `No row found with ID ${rowId} in table ${tableName}, or data was the same.`, changes: 0 }, { status: 404 });
      }
      return NextResponse.json({ message: 'Row updated successfully.', changes: result.changes }, { status: 200 });
    } else {
      // Handle specific errors like UNIQUE constraints, etc.
      if (result.error?.includes('UNIQUE constraint failed')) {
        return NextResponse.json({ error: `Failed to update row: UNIQUE constraint failed. ${result.error}` }, { status: 409 });
      }
       if (result.error?.includes('NOT NULL constraint failed')) {
        return NextResponse.json({ error: `Failed to update row: NOT NULL constraint failed. ${result.error}` }, { status: 400 });
      }
      if (result.error?.toLowerCase().includes('no such table')) {
        return NextResponse.json({ error: `Table '${tableName}' not found in database '${dbName}'.` }, { status: 404 });
      }
      return NextResponse.json({ error: `Failed to update row: ${result.error}` }, { status: 500 });
    }
  } catch (error) {
    console.error(`Failed to update data in table ${tableName} in ${dbName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
     if (error instanceof SyntaxError && errorMessage.includes('JSON')) {
        return NextResponse.json({ error: 'Invalid JSON format in request body.' }, { status: 400 });
    }
    return NextResponse.json({ error: `Failed to update data: ${errorMessage}` }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { dbName: string; tableName: string; rowId: string } }
) {
  const { dbName: rawDbName, tableName: rawTableName, rowId: rawRowId } = params;

  // Sanitize dbName and tableName
  const dbName = path.basename(rawDbName);
  if (dbName !== rawDbName) {
    return NextResponse.json({ error: 'Invalid database name format.' }, { status: 400 });
  }
  const tableName = sanitizeName(rawTableName);
   if (tableName !== rawTableName) {
    return NextResponse.json({ error: 'Invalid table name format.' }, { status: 400 });
  }
  const rowId = sanitizeRowId(rawRowId);
   if (rowId !== rawRowId) {
      console.warn(`RowId '${rawRowId}' was sanitized to '${rowId}'.`);
      if (!rowId) { 
          return NextResponse.json({ error: 'Invalid row ID format after sanitization.' }, { status: 400 });
      }
  }

  const dbPath = path.join(dbsDir, dbName);

  if (!fs.existsSync(dbPath)) {
    return NextResponse.json({ error: `Database ${dbName} not found.` }, { status: 404 });
  }

  const idColumn = getPrimaryKeyColumn(dbPath, tableName);
  if (!idColumn) {
    return NextResponse.json({ error: `Primary key not found or is composite for table ${tableName}. Deletes by arbitrary ID not supported.` }, { status: 400 });
  }

  try {
    const result = deleteRow(dbPath, tableName, rowId, idColumn);

    if (result.success) {
      if (result.changes === 0) {
        return NextResponse.json({ message: `No row found with ID ${rowId} in table ${tableName}.`, changes: 0 }, { status: 404 });
      }
      return NextResponse.json({ message: 'Row deleted successfully.', changes: result.changes }, { status: 200 });
    } else {
      // Handle specific errors if necessary
      if (result.error?.toLowerCase().includes('no such table')) {
        return NextResponse.json({ error: `Table '${tableName}' not found in database '${dbName}'.` }, { status: 404 });
      }
      return NextResponse.json({ error: `Failed to delete row: ${result.error}` }, { status: 500 });
    }
  } catch (error) {
    console.error(`Failed to delete data from table ${tableName} in ${dbName}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: `Failed to delete data: ${errorMessage}` }, { status: 500 });
  }
}
