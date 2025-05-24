import {
  getTableInfoAndDataAction,
  updateRowAction,
  insertRowAction,
  deleteRowAction,
  GetTableInfoAndDataResult,
  UpdateRowResult,
  InsertRowResult,
  DeleteRowResult
} from './actions';
import { connectToDb, getTableSchema, getAllRows, getOneRow, runQuery, closeDb, TableColumn } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// Mock the db module and fs module
jest.mock('@/lib/db');
jest.mock('fs');

const DB_BASE_DIR_TEST = path.join(process.cwd(), 'data');

describe('Table Data Actions - app/dashboard/databases/[dbPath]/tables/[tableName]/actions.ts', () => {
  // Typed mocks
  const mockConnectToDb = connectToDb as jest.MockedFunction<typeof connectToDb>;
  const mockGetTableSchema = getTableSchema as jest.MockedFunction<typeof getTableSchema>;
  const mockGetAllRows = getAllRows as jest.MockedFunction<typeof getAllRows>;
  const mockGetOneRow = getOneRow as jest.MockedFunction<typeof getOneRow>;
  const mockRunQuery = runQuery as jest.MockedFunction<typeof runQuery>;
  const mockCloseDb = closeDb as jest.MockedFunction<typeof closeDb>;
  const mockFsExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

  const mockDbInstance = { /* Mock DB instance */ };
  const encodedDbPath = encodeURIComponent('test.db');
  const encodedTableName = encodeURIComponent('test_table');
  const fullTestDbPath = path.join(DB_BASE_DIR_TEST, 'test.db');
  const tableName = 'test_table';

  const sampleSchema: TableColumn[] = [
    { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
    { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDb.mockResolvedValue(mockDbInstance as any);
    mockCloseDb.mockResolvedValue(undefined);
    mockFsExistsSync.mockReturnValue(true);
  });

  // --- getTableInfoAndDataAction ---
  describe('getTableInfoAndDataAction', () => {
    it('should fetch table schema, data, count, and PKs successfully', async () => {
      mockGetTableSchema.mockResolvedValue(sampleSchema);
      mockGetAllRows.mockResolvedValue([{ id: 1, name: 'Alice' }]);
      mockGetOneRow.mockResolvedValue({ count: 1 }); // For total row count

      const result: GetTableInfoAndDataResult = await getTableInfoAndDataAction(encodedDbPath, encodedTableName, 1, 10);
      
      expect(mockConnectToDb).toHaveBeenCalledWith(fullTestDbPath);
      expect(mockGetTableSchema).toHaveBeenCalledWith(mockDbInstance, tableName);
      expect(mockGetAllRows).toHaveBeenCalledWith(mockDbInstance, expect.stringContaining(`SELECT * FROM "${tableName}"`), [10, 0]);
      expect(mockGetOneRow).toHaveBeenCalledWith(mockDbInstance, expect.stringContaining(`SELECT COUNT(*) as count FROM "${tableName}"`));
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
      expect(result).toEqual({
        success: true,
        schema: sampleSchema,
        data: [{ id: 1, name: 'Alice' }],
        totalRows: 1,
        primaryKeyColumns: ['id'],
      });
    });

    it('should handle sorting correctly', async () => {
        mockGetTableSchema.mockResolvedValue(sampleSchema);
        mockGetAllRows.mockResolvedValue([]);
        mockGetOneRow.mockResolvedValue({ count: 0 });
        await getTableInfoAndDataAction(encodedDbPath, encodedTableName, 1, 10, 'name', 'DESC');
        expect(mockGetAllRows).toHaveBeenCalledWith(mockDbInstance, expect.stringContaining(`ORDER BY "name" DESC`), [10, 0]);
    });
    
    it('should return error if sortBy column does not exist in schema', async () => {
        mockGetTableSchema.mockResolvedValue(sampleSchema); // 'id', 'name'
        const result = await getTableInfoAndDataAction(encodedDbPath, encodedTableName, 1, 10, 'invalid_column', 'ASC');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid sort column: invalid_column');
        expect(mockGetAllRows).not.toHaveBeenCalled(); // Should not attempt to query data
    });


    it('should return error if schema is empty or not found', async () => {
      mockGetTableSchema.mockResolvedValue([]); // Empty schema
      const result = await getTableInfoAndDataAction(encodedDbPath, encodedTableName);
      expect(result.success).toBe(false);
      expect(result.error).toContain(`Table "${tableName}" not found or has no columns.`);
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
    });
    
    it('should return error if getTableSchema fails', async () => {
      const schemaError = new Error('Schema fetch failed');
      mockGetTableSchema.mockRejectedValue(schemaError);
      const result = await getTableInfoAndDataAction(encodedDbPath, encodedTableName);
      expect(result.success).toBe(false);
      expect(result.error).toBe(schemaError.message);
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
    });
  });

  // --- updateRowAction ---
  describe('updateRowAction', () => {
    const pkCriteria = { id: 1 };
    const updatedValues = { name: 'Bob' };

    it('should update a row successfully', async () => {
      mockRunQuery.mockResolvedValue({ changes: 1, lastID: 0 });
      const result: UpdateRowResult = await updateRowAction(encodedDbPath, encodedTableName, pkCriteria, updatedValues);
      expect(mockRunQuery).toHaveBeenCalledWith(
        mockDbInstance,
        expect.stringContaining(`UPDATE "${tableName}" SET "name" = ? WHERE "id" = ?`),
        ['Bob', 1]
      );
      expect(result).toEqual({ success: true });
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
    });

    it('should return error if no updatedValues provided', async () => {
      const result = await updateRowAction(encodedDbPath, encodedTableName, pkCriteria, {});
      expect(result).toEqual({ success: false, error: 'No values provided for update.' });
    });
    
    it('should return error if no primaryKeyCriteria provided', async () => {
      const result = await updateRowAction(encodedDbPath, encodedTableName, {}, updatedValues);
      expect(result).toEqual({ success: false, error: 'Primary key criteria missing for update.' });
    });

    it('should return error if runQuery fails', async () => {
      const queryError = new Error('Update failed');
      mockRunQuery.mockRejectedValue(queryError);
      const result = await updateRowAction(encodedDbPath, encodedTableName, pkCriteria, updatedValues);
      expect(result).toEqual({ success: false, error: queryError.message });
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
    });
    
    it('should warn if no rows were changed by update', async () => {
      mockRunQuery.mockResolvedValue({ changes: 0, lastID: 0 }); // 0 changes
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = await updateRowAction(encodedDbPath, encodedTableName, pkCriteria, updatedValues);
      
      expect(result.success).toBe(true); // Still success if query ran
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('resulted in 0 changes'));
      consoleWarnSpy.mockRestore();
    });
  });

  // --- insertRowAction ---
  describe('insertRowAction', () => {
    const newRowData = { name: 'Charlie' }; // Assuming 'id' is autoincrement

    it('should insert a row successfully', async () => {
      mockRunQuery.mockResolvedValue({ changes: 1, lastID: 2 });
      const result: InsertRowResult = await insertRowAction(encodedDbPath, encodedTableName, newRowData);
      expect(mockRunQuery).toHaveBeenCalledWith(
        mockDbInstance,
        expect.stringContaining(`INSERT INTO "${tableName}" ("name") VALUES (?)`),
        ['Charlie']
      );
      expect(result).toEqual({ success: true, lastID: 2 });
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
    });
    
    it('should return error if newRowData is empty', async () => {
      const result = await insertRowAction(encodedDbPath, encodedTableName, {});
      expect(result).toEqual({ success: false, error: 'No data provided for new row.' });
    });

    it('should return error if runQuery fails during insert', async () => {
      const insertError = new Error('Insert failed');
      mockRunQuery.mockRejectedValue(insertError);
      const result = await insertRowAction(encodedDbPath, encodedTableName, newRowData);
      expect(result).toEqual({ success: false, error: insertError.message });
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
    });
  });

  // --- deleteRowAction ---
  describe('deleteRowAction', () => {
    const pkCriteria = { id: 1 };

    it('should delete a row successfully', async () => {
      mockRunQuery.mockResolvedValue({ changes: 1, lastID: 0 });
      const result: DeleteRowResult = await deleteRowAction(encodedDbPath, encodedTableName, pkCriteria);
      expect(mockRunQuery).toHaveBeenCalledWith(
        mockDbInstance,
        expect.stringContaining(`DELETE FROM "${tableName}" WHERE "id" = ?`),
        [1]
      );
      expect(result).toEqual({ success: true });
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
    });
    
    it('should return error if pkCriteria is empty', async () => {
      const result = await deleteRowAction(encodedDbPath, encodedTableName, {});
      expect(result).toEqual({ success: false, error: 'Primary key criteria missing for deletion.' });
    });

    it('should return error if runQuery fails during delete', async () => {
      const deleteError = new Error('Delete failed');
      mockRunQuery.mockRejectedValue(deleteError);
      const result = await deleteRowAction(encodedDbPath, encodedTableName, pkCriteria);
      expect(result).toEqual({ success: false, error: deleteError.message });
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
    });
    
    it('should warn if no rows were changed by delete', async () => {
      mockRunQuery.mockResolvedValue({ changes: 0, lastID: 0 }); // 0 changes
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = await deleteRowAction(encodedDbPath, encodedTableName, pkCriteria);
      
      expect(result.success).toBe(true); // Still success if query ran
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('resulted in 0 changes'));
      consoleWarnSpy.mockRestore();
    });
  });
});
