import { PUT, DELETE } from '../route'; // Adjust path
import { NextRequest } from 'next/server';
import { getPrimaryKeyColumn, updateRow, deleteRow } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// Mock @/lib/db
jest.mock('@/lib/db', () => ({
  ...jest.requireActual('@/lib/db'),
  getPrimaryKeyColumn: jest.fn(),
  updateRow: jest.fn(),
  deleteRow: jest.fn(),
}));
const mockedGetPrimaryKeyColumn = getPrimaryKeyColumn as jest.MockedFunction<typeof getPrimaryKeyColumn>;
const mockedUpdateRow = updateRow as jest.MockedFunction<typeof updateRow>;
const mockedDeleteRow = deleteRow as jest.MockedFunction<typeof deleteRow>;

// Mock fs
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

const dbsDir = path.join(process.cwd(), 'dbs');

describe('API Route: /api/db/[dbName]/[tableName]/data/[rowId]', () => {
  const testParams = { dbName: 'test.db', tableName: 'test_table', rowId: '1' };
  const pkColumnName = 'id';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(true); // Assume DB file exists
    mockedGetPrimaryKeyColumn.mockReturnValue(pkColumnName); // Assume PK column is 'id'
  });

  describe('PUT', () => {
    const updateData = { name: 'Updated Name' };

    it('should return 404 if database file does not exist', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const response = await PUT(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body.error).toBe(`Database ${testParams.dbName} not found.`);
    });

    it('should return 400 if primary key column is not found', async () => {
      mockedGetPrimaryKeyColumn.mockReturnValue(null);
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const response = await PUT(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toContain('Primary key not found or is composite');
    });
    
    it('should return 400 if request body is empty', async () => {
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'PUT',
        body: JSON.stringify({}),
      });
      const response = await PUT(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toBe('Request body cannot be empty for update.');
    });

    it('should return 400 if request body is not valid JSON', async () => {
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'PUT',
        body: 'not json',
      });
      const response = await PUT(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid JSON format in request body.');
    });
    
    it('should return 400 if sanitized body becomes empty (e.g. only PK was passed)', async () => {
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'PUT',
        body: JSON.stringify({ [pkColumnName]: 'new_id_value_ignored' }), // Only PK column
      });
      const response = await PUT(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toBe('No valid fields to update after sanitization or PK column removal.');
    });


    it('should update a row and return 200 on success', async () => {
      const mockUpdateResult = { success: true, changes: 1 };
      mockedUpdateRow.mockReturnValue(mockUpdateResult);

      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const response = await PUT(request, { params: testParams });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(mockedUpdateRow).toHaveBeenCalledWith(
        path.join(dbsDir, testParams.dbName),
        testParams.tableName,
        testParams.rowId,
        pkColumnName,
        updateData // Assuming keys in updateData are valid and don't get sanitized away
      );
      expect(body.message).toBe('Row updated successfully.');
      expect(body.changes).toBe(mockUpdateResult.changes);
    });
    
    it('should return 404 if updateRow reports 0 changes (row not found or data same)', async () => {
      mockedUpdateRow.mockReturnValue({ success: true, changes: 0 });
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const response = await PUT(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body.message).toContain('No row found');
    });


    it('should return 500 if updateRow fails', async () => {
      const errorMessage = 'Database update error';
      mockedUpdateRow.mockReturnValue({ success: false, error: errorMessage });

      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      const response = await PUT(request, { params: testParams });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe(`Failed to update row: ${errorMessage}`);
    });
  });

  describe('DELETE', () => {
    it('should return 404 if database file does not exist for delete', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body.error).toBe(`Database ${testParams.dbName} not found.`);
    });
    
    it('should return 400 if primary key column is not found for delete', async () => {
      mockedGetPrimaryKeyColumn.mockReturnValue(null);
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error).toContain('Primary key not found or is composite');
    });


    it('should delete a row and return 200 on success', async () => {
      const mockDeleteResult = { success: true, changes: 1 };
      mockedDeleteRow.mockReturnValue(mockDeleteResult);

      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: testParams });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(mockedDeleteRow).toHaveBeenCalledWith(
        path.join(dbsDir, testParams.dbName),
        testParams.tableName,
        testParams.rowId,
        pkColumnName
      );
      expect(body.message).toBe('Row deleted successfully.');
      expect(body.changes).toBe(mockDeleteResult.changes);
    });
    
    it('should return 404 if deleteRow reports 0 changes (row not found)', async () => {
      mockedDeleteRow.mockReturnValue({ success: true, changes: 0 });
      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: testParams });
      const body = await response.json();
      expect(response.status).toBe(404);
      expect(body.message).toContain('No row found');
    });

    it('should return 500 if deleteRow fails', async () => {
      const errorMessage = 'Database delete error';
      mockedDeleteRow.mockReturnValue({ success: false, error: errorMessage });

      const request = new NextRequest(`http://localhost/api/db/${testParams.dbName}/${testParams.tableName}/data/${testParams.rowId}`, {
        method: 'DELETE',
      });
      const response = await DELETE(request, { params: testParams });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe(`Failed to delete row: ${errorMessage}`);
    });
  });
});
