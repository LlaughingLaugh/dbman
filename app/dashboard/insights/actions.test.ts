import {
  getOverallStatsAction,
  GetOverallStatsResult,
  InsightStats
} from './actions';
import { connectToDb, listTables, getOneRow, closeDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// Mock the db module and fs module
jest.mock('@/lib/db');
jest.mock('fs');

const DB_BASE_DIR_TEST = path.join(process.cwd(), 'data');

describe('Insights Actions - app/dashboard/insights/actions.ts', () => {
  // Typed mocks
  const mockConnectToDb = connectToDb as jest.MockedFunction<typeof connectToDb>;
  const mockListTables = listTables as jest.MockedFunction<typeof listTables>;
  const mockGetOneRow = getOneRow as jest.MockedFunction<typeof getOneRow>; // For COUNT(*)
  const mockCloseDb = closeDb as jest.MockedFunction<typeof closeDb>;
  const mockFsExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
  const mockFsMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;


  const mockDbInstance1 = { id: 'db1_mock_instance' };
  const mockDbInstance2 = { id: 'db2_mock_instance' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCloseDb.mockResolvedValue(undefined);
    // By default, assume DB_BASE_DIR exists. Specific tests can override this.
    mockFsExistsSync.mockImplementation((p) => {
        if (p === DB_BASE_DIR_TEST) return true;
        // For db files, let tests control this.
        return false; 
    });
    // mockFsMkdirSync is for the module level check, assume it works or test separately if needed.
  });

  describe('getOverallStatsAction', () => {
    it('should return error if no database file names provided', async () => {
      const result: GetOverallStatsResult = await getOverallStatsAction([]);
      expect(result).toEqual({
        success: false,
        error: 'No database file names provided.',
      });
    });

    it('should process multiple databases successfully', async () => {
      // DB1 setup
      mockFsExistsSync.mockImplementation(p => p === DB_BASE_DIR_TEST || p === path.join(DB_BASE_DIR_TEST, 'db1.sqlite'));
      mockConnectToDb.mockResolvedValueOnce(mockDbInstance1 as any);
      mockListTables.mockImplementationOnce(async (db) => {
        if (db === mockDbInstance1) return ['table1', 'table2'];
        return [];
      });
      mockGetOneRow.mockImplementation(async (db, query) => {
        if (db === mockDbInstance1) {
          if (query.includes('"table1"')) return { count: 100 };
          if (query.includes('"table2"')) return { count: 50 };
        }
        return { count: 0 };
      });
      
      // DB2 setup (will be next calls)
      mockFsExistsSync.mockImplementationOnce(p => p === DB_BASE_DIR_TEST || p === path.join(DB_BASE_DIR_TEST, 'db2.sqlite'));
      mockConnectToDb.mockResolvedValueOnce(mockDbInstance2 as any);
      mockListTables.mockImplementationOnce(async (db) => {
        if (db === mockDbInstance2) return ['tableA'];
        return [];
      });
       // Extend GetOneRow for DB2
      mockGetOneRow.mockImplementation(async (db, query) => {
        if (db === mockDbInstance1) {
          if (query.includes('"table1"')) return { count: 100 };
          if (query.includes('"table2"')) return { count: 50 };
        } else if (db === mockDbInstance2) {
          if (query.includes('"tableA"')) return { count: 200 };
        }
        return { count: 0 };
      });


      const result: GetOverallStatsResult = await getOverallStatsAction(['db1.sqlite', 'db2.sqlite']);

      expect(result.success).toBe(true);
      const stats = result.stats as InsightStats;
      expect(stats.totalDatabasesProcessed).toBe(2);
      expect(stats.totalDatabasesSuccessfullyProcessed).toBe(2);
      expect(stats.totalTables).toBe(3); // 2 from db1, 1 from db2
      expect(stats.grandTotalRows).toBe(350); // 100 + 50 + 200
      expect(stats.databases).toHaveLength(2);
      
      expect(stats.databases[0].fileName).toBe('db1.sqlite');
      expect(stats.databases[0].tableCount).toBe(2);
      expect(stats.databases[0].totalRows).toBe(150);
      expect(stats.databases[0].tables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'table1', rowCount: 100 }),
          expect.objectContaining({ name: 'table2', rowCount: 50 }),
        ])
      );
      
      expect(stats.databases[1].fileName).toBe('db2.sqlite');
      expect(stats.databases[1].tableCount).toBe(1);
      expect(stats.databases[1].totalRows).toBe(200);
      expect(stats.databases[1].tables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'tableA', rowCount: 200 }),
        ])
      );
      expect(mockCloseDb).toHaveBeenCalledTimes(2); // For db1 and db2
    });

    it('should handle a mix of successful and failed database processing', async () => {
      // DB1 (success)
      mockFsExistsSync.mockImplementationOnce(p => p === DB_BASE_DIR_TEST || p === path.join(DB_BASE_DIR_TEST, 'db1.sqlite'));
      mockConnectToDb.mockResolvedValueOnce(mockDbInstance1 as any);
      mockListTables.mockResolvedValueOnce(['table1']);
      mockGetOneRow.mockResolvedValueOnce({ count: 10 }); // Row count for table1

      // DB2 (file not found)
      mockFsExistsSync.mockImplementationOnce(p => p === DB_BASE_DIR_TEST); // db2.sqlite does not exist


      // DB3 (connect fails)
      mockFsExistsSync.mockImplementationOnce(p => p === DB_BASE_DIR_TEST || p === path.join(DB_BASE_DIR_TEST, 'db3.sqlite'));
      const connectError = new Error('Connection failed for db3');
      mockConnectToDb.mockRejectedValueOnce(connectError);

      const result = await getOverallStatsAction(['db1.sqlite', 'db2_notfound.sqlite', 'db3.sqlite']);

      expect(result.success).toBe(true); // Action itself succeeds
      const stats = result.stats as InsightStats;
      expect(stats.totalDatabasesProcessed).toBe(3);
      expect(stats.totalDatabasesSuccessfullyProcessed).toBe(1); // Only db1
      expect(stats.totalTables).toBe(1); // From db1
      expect(stats.grandTotalRows).toBe(10); // From db1

      expect(stats.databases).toHaveLength(3);
      expect(stats.databases[0].fileName).toBe('db1.sqlite');
      expect(stats.databases[0].error).toBeUndefined();
      expect(stats.databases[0].totalRows).toBe(10);

      expect(stats.databases[1].fileName).toBe('db2_notfound.sqlite');
      expect(stats.databases[1].error).toContain('Database file not found');
      
      expect(stats.databases[2].fileName).toBe('db3.sqlite');
      expect(stats.databases[2].error).toBe(connectError.message);
      
      expect(mockCloseDb).toHaveBeenCalledTimes(1); // Only for db1 as others failed before or during connect
    });
    
    it('should handle empty or invalid file names in the input array', async () => {
        mockFsExistsSync.mockReturnValue(true); // Assume base dir exists
        // For a valid DB to ensure some processing happens
        mockConnectToDb.mockResolvedValueOnce(mockDbInstance1 as any);
        mockListTables.mockResolvedValueOnce(['t1']);
        mockGetOneRow.mockResolvedValueOnce({ count: 5 });


        const result = await getOverallStatsAction(['', 'valid.db', 'path/invalid.db', ' ']);
        expect(result.success).toBe(true);
        const stats = result.stats as InsightStats;
        expect(stats.totalDatabasesProcessed).toBe(4);
        expect(stats.totalDatabasesSuccessfullyProcessed).toBe(1); // Only valid.db

        expect(stats.databases[0].error).toBe('File name is empty.');
        expect(stats.databases[1].fileName).toBe('valid.db');
        expect(stats.databases[1].error).toBeUndefined();
        expect(stats.databases[2].error).toContain('Invalid database file name.');
        expect(stats.databases[3].error).toBe('File name is empty.');
    });
    
     it('should handle error during listTables and still close DB', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockConnectToDb.mockResolvedValue(mockDbInstance1 as any);
      const listError = new Error('Failed to list tables');
      mockListTables.mockRejectedValue(listError);

      const result = await getOverallStatsAction(['test.db']);
      const stats = result.stats!;
      
      expect(stats.databases[0].error).toBe(listError.message);
      expect(stats.totalDatabasesSuccessfullyProcessed).toBe(0);
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance1);
    });

    it('should handle error during getTableRowCount and still close DB', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockConnectToDb.mockResolvedValue(mockDbInstance1 as any);
      mockListTables.mockResolvedValue(['table1']);
      const countError = new Error('Failed to count rows');
      mockGetOneRow.mockRejectedValue(countError); // Fails for table1 count

      const result = await getOverallStatsAction(['test.db']);
      const stats = result.stats!;

      // The error in getTableRowCount is caught per table, so the db processing might still be "successful"
      // but the table itself would have 0 rows or an error marker if we added that.
      // The current implementation of getOverallStatsAction catches this at the db processing level.
      expect(stats.databases[0].error).toBe(countError.message);
      expect(stats.totalDatabasesSuccessfullyProcessed).toBe(0);
      expect(mockCloseDb).toHaveBeenCalledWith(mockDbInstance1);
    });
    
    it('should handle error during closeDb and log it', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockConnectToDb.mockResolvedValue(mockDbInstance1 as any);
      mockListTables.mockResolvedValue(['table1']);
      mockGetOneRow.mockResolvedValue({ count: 1 });
      const closeDbError = new Error('Failed to close DB');
      mockCloseDb.mockRejectedValue(closeDbError);
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getOverallStatsAction(['test.db']);
      const stats = result.stats!;

      // The primary operation (getting stats) succeeded
      expect(stats.totalDatabasesSuccessfullyProcessed).toBe(1);
      expect(stats.databases[0].error).toBeUndefined(); // No error during stats gathering
      
      // Error during closeDb should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error closing DB for test.db'), closeDbError);
      // The dbInsight.error might get updated if close fails and no prior error, based on action logic
      // Current logic: if (!dbInsight.error) { dbInsight.error = `Failed to close ...`; }
      // This means the returned dbInsight might show an error if closing fails.
      // Let's test the case where it's the *only* error.
      // If the action updates dbInsight.error on closeDb failure, then:
      // expect(stats.databases[0].error).toContain('Failed to close database connection');
      
      consoleErrorSpy.mockRestore();
    });
  });
});
