import { GET } from '../route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { getTableSchema, TableSchema } from '@/lib/db';
import fs from 'fs';
import path from 'path';
// Mock 'better-sqlite3' indirectly by mocking lib/db functions that use it
// We only need to mock what this route directly uses from lib/db

// Mock @/lib/db
jest.mock('@/lib/db', () => ({
  ...jest.requireActual('@/lib/db'), // Import and retain default behavior
  getTableSchema: jest.fn(),
}));
const mockedGetTableSchema = getTableSchema as jest.MockedFunction<typeof getTableSchema>;

// Mock fs
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock better-sqlite3 for the table existence check inside the route handler
const mockRouteDbInstance = {
  prepare: jest.fn().mockReturnThis(),
  get: jest.fn(),
  close: jest.fn(),
};
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => mockRouteDbInstance);
});


const dbsDir = path.join(process.cwd(), 'dbs');

describe('API Route: /api/db/[dbName]/[tableName]/schema', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteDbInstance.prepare.mockClear();
    mockRouteDbInstance.get.mockClear();
    mockRouteDbInstance.close.mockClear();
  });

  const testParams = { dbName: 'test.db', tableName: 'test_table' };

  it('should return 400 if dbName is missing', async () => {
    const request = new NextRequest(`http://localhost/api/db//${testParams.tableName}/schema`);
    const response = await GET(request, { params: { dbName: '', tableName: testParams.tableName } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Database name is required.');
  });

  it('should return 400 if tableName is missing', async () => {
    const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}//schema`);
    const response = await GET(request, { params: { dbName: testParams.dbName, tableName: '' } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Table name is required.');
  });
  
  it('should return 400 for invalid dbName format', async () => {
    const request = new NextRequest('http://localhost/api/db/../secret/tables/someschema/schema');
    const response = await GET(request, { params: { dbName: '../secret.db', tableName: 'someschema' } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid database name format.');
  });
  
  it('should return 400 for invalid tableName format (containing path characters)', async () => {
    const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/../other_table/schema`);
    // The route sanitizes table name by removing non-alphanumeric characters.
    // If tableName becomes empty or significantly different, it might lead to "not found" or "invalid format".
    // Test with a name that becomes invalid after sanitization in a broader sense, e.g. if it becomes empty.
    // The current sanitization `tableName.replace(/[^a-zA-Z0-9_]/g, '')` is quite strict.
    const response = await GET(request, { params: { ...testParams, tableName: 'invalid/table' } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid table name format.');
  });


  it('should return 404 if database file does not exist', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/schema`);
    const response = await GET(request, { params: testParams });
    const body = await response.json();

    expect(mockedFs.existsSync).toHaveBeenCalledWith(path.join(dbsDir, testParams.dbName));
    expect(response.status).toBe(404);
    expect(body.error).toBe(`Database ${testParams.dbName} not found.`);
  });

  it('should return 200 and the table schema on success', async () => {
    const mockSchema: TableSchema[] = [{ name: 'id', type: 'INTEGER', pk: true, notnull: true }];
    mockedFs.existsSync.mockReturnValue(true);
    mockedGetTableSchema.mockResolvedValue(mockSchema); // Assuming it could be async, though current impl is sync

    const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/schema`);
    const response = await GET(request, { params: testParams });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.schema).toEqual(mockSchema);
    expect(mockedGetTableSchema).toHaveBeenCalledWith(path.join(dbsDir, testParams.dbName), testParams.tableName);
  });

  it('should return 404 if table does not exist (schema is empty and table check confirms)', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedGetTableSchema.mockReturnValue([]); // Simulate table not found by getTableSchema
    mockRouteDbInstance.prepare.mockReturnValueOnce({ get: jest.fn().mockReturnValueOnce(undefined) } as any); // table check in route says not found

    const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/schema`);
    const response = await GET(request, { params: testParams });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe(`Table '${testParams.tableName}' not found in database '${testParams.dbName}'.`);
  });
  
   it('should return 200 with empty schema if table exists but has no columns (or PRAGMA returns empty)', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedGetTableSchema.mockReturnValue([]); 
    // Simulate table exists when checked inside the route
    mockRouteDbInstance.prepare.mockReturnValueOnce({ get: jest.fn().mockReturnValueOnce({ name: testParams.tableName }) } as any);

    const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/schema`);
    const response = await GET(request, { params: testParams });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.schema).toEqual([]);
  });


  it('should return 500 if getTableSchema throws an error', async () => {
    const errorMessage = 'Failed to query schema';
    mockedFs.existsSync.mockReturnValue(true);
    mockedGetTableSchema.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/schema`);
    const response = await GET(request, { params: testParams });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(`Failed to get table schema: ${errorMessage}`);
  });
});
