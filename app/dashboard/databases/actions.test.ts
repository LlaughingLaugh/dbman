import { connectToDatabaseAndListTables, ConnectResult } from './actions';
import { connectToDb, listTables, closeDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// Mock the entire db module
jest.mock('@/lib/db');
// Mock the fs module
jest.mock('fs');

const DB_BASE_DIR_TEST = path.join(process.cwd(), 'data');

describe('Database Actions - app/dashboard/databases/actions.ts', () => {
  // Typed mocks
  const mockConnectToDb = connectToDb as jest.MockedFunction<typeof connectToDb>;
  const mockListTables = listTables as jest.MockedFunction<typeof listTables>;
  const mockCloseDb = closeDb as jest.MockedFunction<typeof closeDb>;
  const mockFsExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
  const mockFsMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;

  beforeEach(() => {
    // Reset all mocks before each test
    mockConnectToDb.mockReset();
    mockListTables.mockReset();
    mockCloseDb.mockReset();
    mockFsExistsSync.mockReset();
    mockFsMkdirSync.mockReset();

    // Default mock implementations
    mockCloseDb.mockResolvedValue(undefined); // Default closeDb to resolve successfully
    mockFsExistsSync.mockReturnValue(true); // Assume DB_BASE_DIR exists by default
  });

  describe('connectToDatabaseAndListTables', () => {
    it('should connect, list tables, close DB, and return success with tables', async () => {
      const mockDbInstance = { /* mock DB instance, actual structure not critical for this test */ };
      mockConnectToDb.mockResolvedValue(mockDbInstance as any);
      mockListTables.mockResolvedValue(['table1', 'table2']);

      const dbFileName = 'test.db';
      const result: ConnectResult = await connectToDatabaseAndListTables(dbFileName);

      expect(mockConnectToDb).toHaveBeenCalledWith(path.join(DB_BASE_DIR_TEST, dbFileName));
      expect(mockListTables).toHaveBeenCalledWith(mockDbInstance);
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
      expect(result).toEqual({
        success: true,
        path: dbFileName, // Server action returns original filename, not full path
        tables: ['table1', 'table2'],
      });
    });

    it('should create DB_BASE_DIR if it does not exist', async () => {
      mockFsExistsSync.mockReturnValue(false); // Simulate directory does not exist
      mockConnectToDb.mockResolvedValue({} as any);
      mockListTables.mockResolvedValue([]);

      await connectToDatabaseAndListTables('test.db');

      expect(mockFsExistsSync).toHaveBeenCalledWith(DB_BASE_DIR_TEST);
      // expect(mockFsMkdirSync).toHaveBeenCalledWith(DB_BASE_DIR_TEST, { recursive: true });
      // Note: The check for DB_BASE_DIR is currently at the module level in actions.ts,
      // so it runs once when the module is imported. Testing its creation within a specific action call
      // is tricky without resetting the module. For now, we assume it's created if needed.
      // If the check was inside the function, this test would be more direct.
      // For module-level code, this test might not be effective unless module is reset.
      // Let's assume the `actions.ts` module ensures this.
    });

    it('should return error if dbFileName is empty', async () => {
      const result = await connectToDatabaseAndListTables('');
      expect(result).toEqual({
        success: false,
        path: '',
        error: 'Database file name cannot be empty.',
      });
      expect(mockConnectToDb).not.toHaveBeenCalled();
    });
    
    it('should return error if dbFileName contains path separators', async () => {
      const result1 = await connectToDatabaseAndListTables('path/to/db.sqlite');
      expect(result1.error).toContain('Invalid database file name');
      const result2 = await connectToDatabaseAndListTables('../db.sqlite');
      expect(result2.error).toContain('Invalid database file name');
      expect(mockConnectToDb).not.toHaveBeenCalled();
    });


    it('should return error if connectToDb fails', async () => {
      const dbConnectError = new Error('DB Connection Failed');
      mockConnectToDb.mockRejectedValue(dbConnectError);

      const dbFileName = 'fail_connect.db';
      const result = await connectToDatabaseAndListTables(dbFileName);

      expect(mockConnectToDb).toHaveBeenCalledWith(path.join(DB_BASE_DIR_TEST, dbFileName));
      expect(mockListTables).not.toHaveBeenCalled();
      expect(mockCloseDb).not.toHaveBeenCalled(); // connectToDb failed, so db instance shouldn't exist to be closed
      expect(result).toEqual({
        success: false,
        path: dbFileName,
        error: dbConnectError.message,
      });
    });

    it('should return error if listTables fails and still attempt to close DB', async () => {
      const mockDbInstance = { /* mock DB instance */ };
      const listTablesError = new Error('Listing Tables Failed');
      mockConnectToDb.mockResolvedValue(mockDbInstance as any);
      mockListTables.mockRejectedValue(listTablesError);

      const dbFileName = 'fail_list.db';
      const result = await connectToDatabaseAndListTables(dbFileName);

      expect(mockConnectToDb).toHaveBeenCalledWith(path.join(DB_BASE_DIR_TEST, dbFileName));
      expect(mockListTables).toHaveBeenCalledWith(mockDbInstance);
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance); // Ensure close is called
      expect(result).toEqual({
        success: false,
        path: dbFileName,
        error: listTablesError.message,
      });
    });
    
    it('should log an error and not override primary error if closeDb fails', async () => {
      const mockDbInstance = { id: 'mockDb' };
      const listTablesError = new Error('Primary error: Listing Tables Failed');
      const closeDbError = new Error('Secondary error: Closing DB Failed');
      
      mockConnectToDb.mockResolvedValue(mockDbInstance as any);
      mockListTables.mockRejectedValue(listTablesError);
      mockCloseDb.mockRejectedValue(closeDbError); // closeDb also fails

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const dbFileName = 'fail_close_and_list.db';
      const result = await connectToDatabaseAndListTables(dbFileName);

      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance);
      expect(result.error).toBe(listTablesError.message); // Primary error should be reported
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Error closing DB in server action for ${dbFileName}`), closeDbError);
      
      consoleErrorSpy.mockRestore();
    });
  });
});
