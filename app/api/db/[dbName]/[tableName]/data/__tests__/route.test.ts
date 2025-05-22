import { GET, POST } from '../route'; // Adjust path
import { NextRequest } from 'next/server';
import { fetchTableData, insertRow, getTableSchema } from '@/lib/db'; // Assuming getTableSchema might be used for validation if added
import fs from 'fs';
import path from 'path';

// Mock @/lib/db
jest.mock('@/lib/db', () => ({
  ...jest.requireActual('@/lib/db'),
  fetchTableData: jest.fn(),
  insertRow: jest.fn(),
  getTableSchema: jest.fn(), // If you decide to validate keys against schema
}));
const mockedFetchTableData = fetchTableData as jest.MockedFunction<typeof fetchTableData>;
const mockedInsertRow = insertRow as jest.MockedFunction<typeof insertRow>;
const mockedGetTableSchema = getTableSchema as jest.MockedFunction<typeof getTableSchema>;


// Mock fs
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

const dbsDir = path.join(process.cwd(), 'dbs');

describe('API Route: /api/db/[dbName]/[tableName]/data', () => {
  const testParams = { dbName: 'test.db', tableName: 'test_table' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(true); // Assume DB file exists for most tests
  });

  describe('GET', () => {
    it('should return 404 if database file does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`);
      const response = await GET(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body.error).toBe(`Database ${testParams.dbName} not found.`);
    });

    it('should fetch and return table data with default pagination', async () => {
      const mockDataResult = { data: [{ id: 1 }], totalRows: 1 };
      mockedFetchTableData.mockReturnValue(mockDataResult);

      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`);
      const response = await GET(request, { params: testParams });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(mockedFetchTableData).toHaveBeenCalledWith(
        path.join(dbsDir, testParams.dbName),
        testParams.tableName,
        { page: 1, limit: 10, sortBy: undefined, sortOrder: undefined, filters: {} }
      );
      expect(body.data).toEqual(mockDataResult.data);
      expect(body.totalRows).toBe(mockDataResult.totalRows);
      expect(body.totalPages).toBe(1);
      expect(body.currentPage).toBe(1);
    });

    it('should handle query parameters for pagination, sorting, and filtering', async () => {
      const mockDataResult = { data: [{ id: 2, name: 'Sorted' }], totalRows: 10 };
      mockedFetchTableData.mockReturnValue(mockDataResult);

      const url = new URL(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`);
      url.searchParams.set('page', '2');
      url.searchParams.set('limit', '5');
      url.searchParams.set('sortBy', 'name');
      url.searchParams.set('sortOrder', 'DESC');
      url.searchParams.set('filter_status', 'active');
      
      const request = new NextRequest(url.toString());
      const response = await GET(request, { params: testParams });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(mockedFetchTableData).toHaveBeenCalledWith(
        path.join(dbsDir, testParams.dbName),
        testParams.tableName,
        { page: 2, limit: 5, sortBy: 'name', sortOrder: 'DESC', filters: { status: 'active' } }
      );
      expect(body.data).toEqual(mockDataResult.data);
      expect(body.totalRows).toBe(10);
      expect(body.totalPages).toBe(2); // 10 rows / 5 limit
    });
    
    it('should return 404 if fetchTableData indicates table not found', async () => {
        mockedFetchTableData.mockImplementation(() => {
            const error = new Error("no such table: test_table") as any;
            throw error;
        });
        const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`);
        const response = await GET(request, { params: testParams });
        const body = await response.json();
        expect(response.status).toBe(404);
        expect(body.error).toBe(`Table '${testParams.tableName}' not found in database '${testParams.dbName}'.`);
    });


    it('should return 500 if fetchTableData throws an unexpected error', async () => {
      const errorMessage = 'Database query failed';
      mockedFetchTableData.mockImplementation(() => {
        throw new Error(errorMessage);
      });
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`);
      const response = await GET(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body.error).toBe(`Failed to fetch table data: ${errorMessage}`);
    });
  });

  describe('POST', () => {
    const rowData = { name: 'New Row', value: 123 };

    it('should return 404 if database file does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`, {
        method: 'POST',
        body: JSON.stringify(rowData),
      });
      const response = await POST(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body.error).toBe(`Database ${testParams.dbName} not found.`);
    });
    
    it('should return 400 if request body is empty', async () => {
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toBe('Request body cannot be empty.');
    });

    it('should return 400 if request body is not valid JSON', async () => {
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`, {
        method: 'POST',
        body: 'not json',
      });
      const response = await POST(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid JSON format in request body.');
    });

    it('should insert a row and return 201 on success', async () => {
      const mockInsertResult = { success: true, id: 1 };
      mockedInsertRow.mockReturnValue(mockInsertResult);
      // mockedGetTableSchema.mockReturnValue([{name: 'name', type: 'TEXT', pk:false, notnull: false}, {name: 'value', type: 'INTEGER', pk:false, notnull: false}]);


      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`, {
        method: 'POST',
        body: JSON.stringify(rowData),
      });
      const response = await POST(request, { params: testParams });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(mockedInsertRow).toHaveBeenCalledWith(
        path.join(dbsDir, testParams.dbName),
        testParams.tableName,
        rowData // The route sanitizes keys, but for this test, assume keys are fine
      );
      expect(body.message).toBe('Row inserted successfully.');
      expect(body.id).toBe(mockInsertResult.id);
    });

    it('should return 409 if insertRow fails due to UNIQUE constraint', async () => {
      const errorMessage = 'UNIQUE constraint failed: test_table.name';
      mockedInsertRow.mockReturnValue({ success: false, error: errorMessage });
      // mockedGetTableSchema.mockReturnValue([{name: 'name', type: 'TEXT', pk:false, notnull: false}]);


      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`, {
        method: 'POST',
        body: JSON.stringify(rowData),
      });
      const response = await POST(request, { params: testParams });
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe(`Failed to insert row: UNIQUE constraint failed. ${errorMessage}`);
    });
    
    it('should return 400 if insertRow fails due to NOT NULL constraint', async () => {
      const errorMessage = 'NOT NULL constraint failed: test_table.name';
      mockedInsertRow.mockReturnValue({ success: false, error: errorMessage });

      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`, {
        method: 'POST',
        body: JSON.stringify({ name: null }), // Example of data violating NOT NULL
      });
      const response = await POST(request, { params: testParams });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe(`Failed to insert row: NOT NULL constraint failed. ${errorMessage}`);
    });
    
    it('should return 404 if insertRow indicates table not found', async () => {
        mockedInsertRow.mockReturnValue({ success: false, error: "no such table: test_table" });
        const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`, {
            method: 'POST',
            body: JSON.stringify(rowData),
        });
        const response = await POST(request, { params: testParams });
        const body = await response.json();
        expect(response.status).toBe(404);
        expect(body.error).toBe(`Table '${testParams.tableName}' not found in database '${testParams.dbName}'.`);
    });


    it('should return 500 if insertRow fails for other reasons', async () => {
      const errorMessage = 'Database write error';
      mockedInsertRow.mockReturnValue({ success: false, error: errorMessage });
      // mockedGetTableSchema.mockReturnValue([{name: 'name', type: 'TEXT', pk:false, notnull: false}]);


      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data`, {
        method: 'POST',
        body: JSON.stringify(rowData),
      });
      const response = await POST(request, { params: testParams });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe(`Failed to insert row: ${errorMessage}`);
    });
  });
});
