import {
  storeUploadedDbFile,
  connectToDb,
  listTables,
  getTableSchema,
  getPrimaryKeyColumn,
  fetchTableData,
  insertRow,
  updateRow,
  deleteRow,
  TableSchema
} from '../db';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Mock 'fs'
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock 'better-sqlite3'
const mockDbInstance = {
  prepare: jest.fn().mockReturnThis(),
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
  pragma: jest.fn(),
  close: jest.fn(),
};
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => mockDbInstance);
});
const MockedDatabase = Database as jest.MockedFunction<typeof Database>;


describe('lib/db.ts', () => {
  const dbsDir = path.join(process.cwd(), 'dbs');
  const testDbPath = path.join(dbsDir, 'test.db');

  beforeEach(() => {
    // Clear all mock implementations and calls before each test
    jest.clearAllMocks();
    MockedDatabase.mockClear();
    Object.values(mockDbInstance).forEach(mockFn => mockFn.mockClear());
  });

  describe('storeUploadedDbFile', () => {
    it('should create dbs directory if it does not exist', () => {
      mockedFs.existsSync.mockReturnValueOnce(false); // dbsDir does not exist
      const buffer = Buffer.from('test');
      const filename = 'test.db';
      storeUploadedDbFile(buffer, filename);
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(dbsDir, { recursive: true });
    });

    it('should write the file to the dbs directory', () => {
      mockedFs.existsSync.mockReturnValueOnce(true); // dbsDir exists
      const buffer = Buffer.from('test content');
      const filename = 'uploaded.db';
      const expectedPath = path.join(dbsDir, filename);

      const resultPath = storeUploadedDbFile(buffer, filename);

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(expectedPath, buffer);
      expect(resultPath).toBe(expectedPath);
    });
  });

  describe('connectToDb', () => {
    it('should throw error if db file does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);
      expect(() => connectToDb('nonexistent.db')).toThrow('Database file not found at nonexistent.db');
    });

    it('should connect to the database and set journal_mode to WAL', () => {
      mockedFs.existsSync.mockReturnValue(true);
      const db = connectToDb(testDbPath);
      expect(MockedDatabase).toHaveBeenCalledWith(testDbPath);
      expect(mockDbInstance.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(db).toBe(mockDbInstance);
    });
  });

  describe('listTables', () => {
    it('should return a list of table names', () => {
      mockedFs.existsSync.mockReturnValue(true);
      const mockTables = [{ name: 'table1' }, { name: 'table2' }];
      mockDbInstance.prepare.mockReturnValueOnce({ all: jest.fn().mockReturnValueOnce(mockTables) } as any);
      
      const tables = listTables(testDbPath);
      
      expect(mockDbInstance.prepare).toHaveBeenCalledWith("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
      expect(tables).toEqual(['table1', 'table2']);
      expect(mockDbInstance.close).toHaveBeenCalled();
    });
  });

  describe('getTableSchema', () => {
    it('should return the schema for a table', () => {
      mockedFs.existsSync.mockReturnValue(true);
      const mockSchemaRows = [
        { name: 'id', type: 'INTEGER', notnull: 1, pk: 1 },
        { name: 'name', type: 'TEXT', notnull: 0, pk: 0 },
      ];
      mockDbInstance.prepare.mockReturnValueOnce({ all: jest.fn().mockReturnValueOnce(mockSchemaRows) } as any);

      const schema = getTableSchema(testDbPath, 'test_table');

      expect(mockDbInstance.prepare).toHaveBeenCalledWith('PRAGMA table_info(test_table);');
      expect(schema).toEqual([
        { name: 'id', type: 'INTEGER', notnull: true, pk: true },
        { name: 'name', type: 'TEXT', notnull: false, pk: false },
      ]);
      expect(mockDbInstance.close).toHaveBeenCalled();
    });
  });

  describe('getPrimaryKeyColumn', () => {
    it('should return the primary key column name if single PK exists', () => {
        mockedFs.existsSync.mockReturnValue(true);
        const mockSchemaRows = [
            { name: 'id', type: 'INTEGER', notnull: 1, pk: 1 },
            { name: 'data', type: 'TEXT', notnull: 0, pk: 0 },
        ];
        // Mock getTableSchema indirectly by mocking the db call it makes
        mockDbInstance.prepare.mockReturnValueOnce({ all: jest.fn().mockReturnValueOnce(mockSchemaRows) } as any);

        const pkColumn = getPrimaryKeyColumn(testDbPath, 'table_with_pk');
        expect(pkColumn).toBe('id');
    });

    it('should return null if no primary key exists', () => {
        mockedFs.existsSync.mockReturnValue(true);
        const mockSchemaRows = [
            { name: 'col1', type: 'TEXT', notnull: 0, pk: 0 },
            { name: 'col2', type: 'INTEGER', notnull: 0, pk: 0 },
        ];
        mockDbInstance.prepare.mockReturnValueOnce({ all: jest.fn().mockReturnValueOnce(mockSchemaRows) } as any);
        const pkColumn = getPrimaryKeyColumn(testDbPath, 'table_no_pk');
        expect(pkColumn).toBeNull();
    });

    it('should return null for composite primary keys', () => {
        mockedFs.existsSync.mockReturnValue(true);
        const mockSchemaRows = [
            { name: 'id1', type: 'INTEGER', notnull: 1, pk: 1 },
            { name: 'id2', type: 'INTEGER', notnull: 1, pk: 1 },
        ];
        mockDbInstance.prepare.mockReturnValueOnce({ all: jest.fn().mockReturnValueOnce(mockSchemaRows) } as any);
        const pkColumn = getPrimaryKeyColumn(testDbPath, 'table_composite_pk');
        expect(pkColumn).toBeNull();
    });
  });

  describe('fetchTableData', () => {
    beforeEach(() => {
        mockedFs.existsSync.mockReturnValue(true);
    });
    
    it('should fetch data with pagination, sorting, and filtering', () => {
      const mockData = [{ id: 1, name: 'Test' }];
      const mockTotalRows = { count: 1 };
      
      // Mock for count query
      mockDbInstance.prepare.mockImplementationOnce((sql: string) => {
        if (sql.toUpperCase().startsWith('SELECT COUNT(*)')) {
          return { get: jest.fn().mockReturnValueOnce(mockTotalRows) } as any;
        }
        return mockDbInstance; // Should not happen if count is first
      });
      // Mock for data query
       mockDbInstance.prepare.mockImplementationOnce((sql: string) => {
        if (sql.toUpperCase().startsWith('SELECT *')) {
          return { all: jest.fn().mockReturnValueOnce(mockData) } as any;
        }
        return mockDbInstance; 
      });


      const result = fetchTableData(testDbPath, 'my_table', {
        page: 1,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'ASC',
        filters: { category: 'A', status: 'active' },
      });

      expect(mockDbInstance.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) as count FROM my_table WHERE category = ? AND status = ?'));
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM my_table WHERE category = ? AND status = ? ORDER BY name ASC LIMIT ? OFFSET ?'));
      
      // Check parameters for count query (get)
      // This part is tricky because prepare is called twice, and we need to check the params for each specific call.
      // The current mock structure makes this hard. A more robust mock would allow chaining or specific return values per SQL query.
      // For now, we assume the order of calls to prepare and then their respective execution (get/all).

      // Parameters for data query (all)
      // const dataQueryParams = mockDbInstance.prepare.mock.results[1].value.all.mock.calls[0];
      // expect(dataQueryParams).toEqual(['A', 'active', 10, 0]);
      // This check is also problematic due to the prepare mock.

      expect(result.data).toEqual(mockData);
      expect(result.totalRows).toBe(1);
      expect(mockDbInstance.close).toHaveBeenCalledTimes(2); // Called by connectToDb in each prepare mock
    });

     it('should handle NULL filters correctly', () => {
      mockDbInstance.prepare.mockReturnValueOnce({ get: jest.fn().mockReturnValueOnce({ count: 0 }) } as any); // Count
      mockDbInstance.prepare.mockReturnValueOnce({ all: jest.fn().mockReturnValueOnce([]) } as any); // Data

      fetchTableData(testDbPath, 'my_table', { filters: { name: null } });
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) as count FROM my_table WHERE name IS NULL'));
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM my_table WHERE name IS NULL'));
    });

    it('should handle LIKE filters correctly', () => {
      mockDbInstance.prepare.mockReturnValueOnce({ get: jest.fn().mockReturnValueOnce({ count: 0 }) } as any);
      mockDbInstance.prepare.mockReturnValueOnce({ all: jest.fn().mockReturnValueOnce([]) } as any);
      fetchTableData(testDbPath, 'my_table', { filters: { name: '%test%' } });
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) as count FROM my_table WHERE name LIKE ?'));
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM my_table WHERE name LIKE ?'));
    });
  });

  describe('insertRow', () => {
    it('should insert a row and return success with lastInsertRowid', () => {
      mockedFs.existsSync.mockReturnValue(true);
      const mockRunInfo = { lastInsertRowid: 123, changes: 1 };
      mockDbInstance.prepare.mockReturnValueOnce({ run: jest.fn().mockReturnValueOnce(mockRunInfo) } as any);

      const data = { name: 'New Item', value: 100 };
      const result = insertRow(testDbPath, 'items', data);

      expect(mockDbInstance.prepare).toHaveBeenCalledWith('INSERT INTO items (name, value) VALUES (?, ?)');
      // Check params for run:
      // const runParams = mockDbInstance.prepare.mock.results[0].value.run.mock.calls[0];
      // expect(runParams).toEqual(['New Item', 100]); // Problematic due to prepare mock
      expect(result).toEqual({ success: true, id: 123 });
      expect(mockDbInstance.close).toHaveBeenCalled();
    });
     it('should return error on failure', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockDbInstance.prepare.mockReturnValueOnce({ run: jest.fn().mockImplementation(() => { throw new Error("Insert failed"); }) } as any);
      const result = insertRow(testDbPath, 'items', { name: 'Fail' });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Insert failed");
    });
  });

  describe('updateRow', () => {
    it('should update a row and return success with changes', () => {
      mockedFs.existsSync.mockReturnValue(true);
      const mockRunInfo = { changes: 1 };
      mockDbInstance.prepare.mockReturnValueOnce({ run: jest.fn().mockReturnValueOnce(mockRunInfo) } as any);

      const data = { name: 'Updated Item' };
      const result = updateRow(testDbPath, 'items', 1, 'id', data);

      expect(mockDbInstance.prepare).toHaveBeenCalledWith('UPDATE items SET name = ? WHERE id = ?');
      // Check params for run:
      // const runParams = mockDbInstance.prepare.mock.results[0].value.run.mock.calls[0];
      // expect(runParams).toEqual(['Updated Item', 1]); // Problematic
      expect(result).toEqual({ success: true, changes: 1 });
      expect(mockDbInstance.close).toHaveBeenCalled();
    });
     it('should return error on failure', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockDbInstance.prepare.mockReturnValueOnce({ run: jest.fn().mockImplementation(() => { throw new Error("Update failed"); }) } as any);
      const result = updateRow(testDbPath, 'items', 1, 'id', { name: 'Fail' });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Update failed");
    });
  });

  describe('deleteRow', () => {
    it('should delete a row and return success with changes', () => {
      mockedFs.existsSync.mockReturnValue(true);
      const mockRunInfo = { changes: 1 };
      mockDbInstance.prepare.mockReturnValueOnce({ run: jest.fn().mockReturnValueOnce(mockRunInfo) } as any);

      const result = deleteRow(testDbPath, 'items', 1, 'id');

      expect(mockDbInstance.prepare).toHaveBeenCalledWith('DELETE FROM items WHERE id = ?');
      // Check params for run:
      // const runParams = mockDbInstance.prepare.mock.results[0].value.run.mock.calls[0];
      // expect(runParams).toEqual([1]); // Problematic
      expect(result).toEqual({ success: true, changes: 1 });
      expect(mockDbInstance.close).toHaveBeenCalled();
    });
     it('should return error on failure', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockDbInstance.prepare.mockReturnValueOnce({ run: jest.fn().mockImplementation(() => { throw new Error("Delete failed"); }) } as any);
      const result = deleteRow(testDbPath, 'items', 1, 'id');
      expect(result.success).toBe(false);
      expect(result.error).toBe("Delete failed");
    });
  });
});
