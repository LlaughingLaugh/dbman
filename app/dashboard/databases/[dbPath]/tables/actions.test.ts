import {
  listTablesAction,
  createTableAction,
  deleteTableAction,
  ListTablesResult,
  CreateTableResult,
  DeleteTableResult,
  ColumnDefinition
} from './actions';
import { connectToDb, listTables, runQuery, closeDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// Mock the db module and fs module
jest.mock('@/lib/db');
jest.mock('fs');

const DB_BASE_DIR_TEST = path.join(process.cwd(), 'data');

describe('Table Actions - app/dashboard/databases/[dbPath]/tables/actions.ts', () => {
  // Typed mocks
  const mockConnectToDb = connectToDb as jest.MockedFunction<typeof connectToDb>;
  const mockListTables = listTables as jest.MockedFunction<typeof listTables>;
  const mockRunQuery = runQuery as jest.MockedFunction<typeof runQuery>;
  const mockCloseDb = closeDb as jest.MockedFunction<typeof closeDb>;
  const mockFsExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

  const mockDbInstance = { /* Mock DB instance */ };
  const encodedDbPath = encodeURIComponent('test.db');
  const fullTestDbPath = path.join(DB_BASE_DIR_TEST, 'test.db');

  beforeEach(() => {
    jest.clearAllMocks(); // Clears mock usage data and resets implementations if they were jest.fn() or jest.spyOn()
    
    // Default successful mock implementations
    mockConnectToDb.mockResolvedValue(mockDbInstance as any);
    mockCloseDb.mockResolvedValue(undefined);
    mockFsExistsSync.mockReturnValue(true); // Assume DB_BASE_DIR and DB file exist by default
  });

  // --- listTablesAction ---
  describe('listTablesAction', () => {
    it('should list tables successfully', async () => {
      mockListTables.mockResolvedValue(['tableA', 'tableB']);
      const result: ListTablesResult = await listTablesAction(encodedDbPath);
      expect(mockConnectToDb).toHaveBeenCalledWith(fullTestDbPath);
      expect(mockListTables).toHaveBeenCalledWith(mockDbInstance);
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
      expect(result).toEqual({ success: true, tables: ['tableA', 'tableB'] });
    });

    it('should return error if listTables fails', async () => {
      const error = new Error('Failed to list');
      mockListTables.mockRejectedValue(error);
      const result: ListTablesResult = await listTablesAction(encodedDbPath);
      expect(result).toEqual({ success: false, error: error.message });
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance); // Ensure close is still called
    });
    
    it('should return error for invalid dbPath', async () => {
      const invalidEncodedPath = encodeURIComponent('../../../etc/passwd');
      const result = await listTablesAction(invalidEncodedPath);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid database file name');
      expect(mockConnectToDb).not.toHaveBeenCalled();
    });
  });

  // --- createTableAction ---
  describe('createTableAction', () => {
    const tableName = 'new_table';
    const columns: ColumnDefinition[] = [{ name: 'id', type: 'INTEGER', primaryKey: true, notNull: true }];

    it('should create a table successfully', async () => {
      mockRunQuery.mockResolvedValue({ lastID: 0, changes: 1 }); // Simulate successful DDL
      const result: CreateTableResult = await createTableAction(encodedDbPath, tableName, columns);
      expect(mockConnectToDb).toHaveBeenCalledWith(fullTestDbPath);
      // Check if the query string is correctly formatted. Example:
      expect(mockRunQuery).toHaveBeenCalledWith(mockDbInstance, expect.stringContaining(`CREATE TABLE "${tableName}"`));
      expect(mockRunQuery).toHaveBeenCalledWith(mockDbInstance, expect.stringContaining(`"id" INTEGER PRIMARY KEY NOT NULL`));
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
      expect(result).toEqual({ success: true });
    });
    
    it('should create a table with composite primary key successfully', async () => {
      const compositePkColumns: ColumnDefinition[] = [
        { name: 'id1', type: 'INTEGER', primaryKey: true, notNull: true },
        { name: 'id2', type: 'TEXT', primaryKey: true, notNull: false } // notNull should be handled by PK
      ];
      mockRunQuery.mockResolvedValue({ lastID: 0, changes: 1 });
      const result = await createTableAction(encodedDbPath, 'composite_pk_table', compositePkColumns);
      expect(mockRunQuery).toHaveBeenCalledWith(mockDbInstance, expect.stringContaining('PRIMARY KEY ("id1", "id2")'));
      expect(result).toEqual({ success: true });
    });


    it('should return error if table name is empty', async () => {
      const result = await createTableAction(encodedDbPath, '', columns);
      expect(result).toEqual({ success: false, error: 'Table name cannot be empty.' });
    });
    
    it('should return error if table name is invalid', async () => {
      const result = await createTableAction(encodedDbPath, '123invalid', columns);
      expect(result.error).toContain('Invalid table name.');
    });

    it('should return error if columns array is empty', async () => {
      const result = await createTableAction(encodedDbPath, tableName, []);
      expect(result).toEqual({ success: false, error: 'Table must have at least one column.' });
    });
    
    it('should return error if column name is invalid', async () => {
      const invalidCols: ColumnDefinition[] = [{ name: '1col', type: 'TEXT', primaryKey: false, notNull: false }];
      const result = await createTableAction(encodedDbPath, tableName, invalidCols);
      expect(result.error).toContain('Invalid column name: 1col');
    });

    it('should return error if runQuery fails', async () => {
      const error = new Error('SQL error');
      mockRunQuery.mockRejectedValue(error);
      const result: CreateTableResult = await createTableAction(encodedDbPath, tableName, columns);
      expect(result).toEqual({ success: false, error: error.message });
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
    });
  });

  // --- deleteTableAction ---
  describe('deleteTableAction', () => {
    const tableName = 'table_to_delete';

    it('should delete a table successfully', async () => {
      mockRunQuery.mockResolvedValue({ lastID: 0, changes: 1 }); // Simulate successful DDL
      const result: DeleteTableResult = await deleteTableAction(encodedDbPath, tableName);
      expect(mockConnectToDb).toHaveBeenCalledWith(fullTestDbPath);
      expect(mockRunQuery).toHaveBeenCalledWith(mockDbInstance, `DROP TABLE IF EXISTS "${tableName}"`);
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
      expect(result).toEqual({ success: true });
    });

    it('should return error if table name is empty for deletion', async () => {
      const result = await deleteTableAction(encodedDbPath, '');
      expect(result).toEqual({ success: false, error: 'Table name cannot be empty for deletion.' });
    });
    
    it('should return error if table name is invalid for deletion', async () => {
      const result = await deleteTableAction(encodedDbPath, '123invalid');
      expect(result.error).toContain('Invalid table name for deletion.');
    });

    it('should return error if runQuery fails during deletion', async () => {
      const error = new Error('SQL drop error');
      mockRunQuery.mockRejectedValue(error);
      const result: DeleteTableResult = await deleteTableAction(encodedDbPath, tableName);
      expect(result).toEqual({ success: false, error: error.message });
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
    });
  });
});
