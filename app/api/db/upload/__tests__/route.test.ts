import { POST } from '../route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { storeUploadedDbFile } from '@/lib/db';
import path from 'path';

// Mock @/lib/db
jest.mock('@/lib/db', () => ({
  storeUploadedDbFile: jest.fn(),
}));
const mockedStoreUploadedDbFile = storeUploadedDbFile as jest.MockedFunction<typeof storeUploadedDbFile>;

// Mock path (partially, only what's needed if any)
// jest.mock('path', () => ({
//   ...jest.requireActual('path'), // Import and retain default behavior
//   extname: jest.fn().mockImplementation((filename) => jest.requireActual('path').extname(filename)),
//   // Add other path functions if they need specific mocks for tests
// }));


describe('API Route: /api/db/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if no file is uploaded', async () => {
    const formData = new FormData(); // Empty form data
    const request = new NextRequest('http://localhost/api/db/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('No file uploaded.');
  });

  it('should return 400 for invalid file type (e.g., .txt)', async () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const formData = new FormData();
    formData.append('dbfile', file);

    const request = new NextRequest('http://localhost/api/db/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid file type. Please upload an SQLite database file.');
  });

  it('should call storeUploadedDbFile and return 200 on successful upload of .db file', async () => {
    const fileContent = 'sqlite content';
    const fileName = 'test.db';
    const mockFilePath = `/dbs/${fileName}`;
    
    const file = new File([fileContent], fileName, { type: 'application/octet-stream' }); // Use a generic type or specific for .db
    const formData = new FormData();
    formData.append('dbfile', file);

    mockedStoreUploadedDbFile.mockReturnValue(mockFilePath);

    const request = new NextRequest('http://localhost/api/db/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();
    
    expect(response.status).toBe(200);
    expect(mockedStoreUploadedDbFile).toHaveBeenCalledTimes(1);
    // Check buffer argument passed to storeUploadedDbFile
    const bufferArg = mockedStoreUploadedDbFile.mock.calls[0][0];
    expect(Buffer.isBuffer(bufferArg)).toBe(true);
    // const textContent = bufferArg.toString(); // This might not be reliable if file is binary
    // For a more robust check, compare ArrayBuffers or buffer lengths if content known
    const expectedArrayBuffer = await file.arrayBuffer();
    expect(bufferArg.buffer.byteLength).toEqual(expectedArrayBuffer.byteLength);


    expect(mockedStoreUploadedDbFile).toHaveBeenCalledWith(expect.any(Buffer), fileName);
    expect(body.message).toBe('File uploaded successfully.');
    expect(body.filePath).toBe(mockFilePath);
    expect(body.fileName).toBe(fileName);
  });
  
    it('should handle .sqlite file extension', async () => {
    const fileName = 'test.sqlite';
    const mockFilePath = `/dbs/${fileName}`;
    const file = new File(['content'], fileName, { type: 'application/x-sqlite3' });
    const formData = new FormData();
    formData.append('dbfile', file);
    mockedStoreUploadedDbFile.mockReturnValue(mockFilePath);

    const request = new NextRequest('http://localhost/api/db/upload', { method: 'POST', body: formData });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it('should handle .sqlite3 file extension', async () => {
    const fileName = 'test.sqlite3';
    const mockFilePath = `/dbs/${fileName}`;
    const file = new File(['content'], fileName, { type: 'application/x-sqlite3' });
    const formData = new FormData();
    formData.append('dbfile', file);
    mockedStoreUploadedDbFile.mockReturnValue(mockFilePath);

    const request = new NextRequest('http://localhost/api/db/upload', { method: 'POST', body: formData });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });


  it('should return 500 if storeUploadedDbFile throws an error', async () => {
    const file = new File(['sqlite content'], 'error.db', { type: 'application/octet-stream' });
    const formData = new FormData();
    formData.append('dbfile', file);

    const errorMessage = 'Disk full';
    mockedStoreUploadedDbFile.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    const request = new NextRequest('http://localhost/api/db/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe(`Upload failed: ${errorMessage}`);
  });

  // Test for when file.arrayBuffer() fails (though less common)
  it('should return 500 if reading file buffer fails', async () => {
    const file = new File(['sqlite content'], 'error.db', { type: 'application/octet-stream' });
    // Mock arrayBuffer to throw an error
    jest.spyOn(file, 'arrayBuffer').mockRejectedValueOnce(new Error('Failed to read file'));
    
    const formData = new FormData();
    formData.append('dbfile', file);

    const request = new NextRequest('http://localhost/api/db/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Upload failed: Failed to read file');
  });
});
