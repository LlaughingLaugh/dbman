import { GET } from '../route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { listTables } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// Mock @/lib/db
jest.mock('@/lib/db', () => ({
  ...jest.requireActual('@/lib/db'), // Import and retain default behavior for other functions if any
  listTables: jest.fn(),
}));
const mockedListTables = listTables as jest.MockedFunction<typeof listTables>;

// Mock fs
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

const dbsDir = path.join(process.cwd(), 'dbs');

describe('API Route: /api/db/[dbName]/tables', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if dbName is missing (though Next.js routing might prevent this)', async () => {
    // This case is hard to test directly as Next.js routing handles parameter presence.
    // If params.dbName is undefined, it would likely be a Next.js 404 or routing error.
    // We'll simulate it by passing undefined, assuming the handler is somehow called this way.
    const request = new NextRequest('http://localhost/api/db//tables'); // Empty dbName in path
    const response = await GET(request, { params: { dbName: '' } }); // Simulate empty dbName
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Database name is required.');
  });

  it('should return 400 for invalid dbName format (e.g., path traversal)', async () => {
    const request = new NextRequest('http://localhost/api/db/../secret/tables');
    // Next.js usually sanitizes path params before they hit the handler.
    // The handler's path.basename check is a secondary measure.
    const response = await GET(request, { params: { dbName: '../secret.db' } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid database name format.');
  });

  it('should return 404 if database file does not exist', async () => {
    const dbName = 'nonexistent.db';
    const expectedDbPath = path.join(dbsDir, dbName);
    mockedFs.existsSync.mockReturnValue(false); // Simulate file not existing

    const request = new NextRequest(`http://localhost/api/db/${dbName}/tables`);
    const response = await GET(request, { params: { dbName } });
    const body = await response.json();

    expect(mockedFs.existsSync).toHaveBeenCalledWith(expectedDbPath);
    expect(response.status).toBe(404);
    expect(body.error).toBe(`Database ${dbName} not found.`);
  });

  it('should return 200 and list of tables on success', async () => {
    const dbName = 'test.db';
    const mockTableList = ['table1', 'table2'];
    mockedFs.existsSync.mockReturnValue(true); // Simulate file existing
    mockedListTables.mockReturnValue(mockTableList);

    const request = new NextRequest(`http://localhost/api/db/${dbName}/tables`);
    const response = await GET(request, { params: { dbName } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tables).toEqual(mockTableList);
    expect(mockedListTables).toHaveBeenCalledWith(path.join(dbsDir, dbName));
  });

  it('should return 500 if listTables throws an error', async () => {
    const dbName = 'error.db';
    const errorMessage = 'Failed to query tables';
    mockedFs.existsSync.mockReturnValue(true);
    mockedListTables.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    const request = new NextRequest(`http://localhost/api/db/${dbName}/tables`);
    const response = await GET(request, { params: { dbName } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(`Failed to list tables: ${errorMessage}`);
  });
});
