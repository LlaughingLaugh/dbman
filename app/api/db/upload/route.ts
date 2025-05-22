import { NextRequest, NextResponse } from 'next/server';
import { storeUploadedDbFile } from '@/lib/db'; // Assuming @ refers to the root
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('dbfile') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    // Check if the file is an SQLite database file (optional but good practice)
    // For example, check by extension or magic numbers
    const allowedExtensions = ['.db', '.sqlite', '.sqlite3'];
    const fileExtension = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
        return NextResponse.json({ error: 'Invalid file type. Please upload an SQLite database file.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalFilename = file.name;

    const savedFilePath = storeUploadedDbFile(buffer, originalFilename);

    return NextResponse.json({
      message: 'File uploaded successfully.',
      filePath: savedFilePath, // This will be the absolute path on the server
      fileName: originalFilename, // Send back the original filename for client use
    }, { status: 200 });

  } catch (error) {
    console.error('Upload failed:', error);
    // Check if error is an instance of Error to safely access message property
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: `Upload failed: ${errorMessage}` }, { status: 500 });
  }
}
