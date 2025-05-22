import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DbUploadForm } from '../db-upload-form'; // Adjust path as necessary
import { toast } from 'sonner'; // Mock sonner

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(), // Add other methods if used
  },
}));
const mockedToast = toast as jest.Mocked<typeof toast>;

// Mock global fetch
global.fetch = jest.fn();
const mockedFetch = global.fetch as jest.MockedFunction<typeof global.fetch>;


describe('DbUploadForm Component', () => {
  const mockOnUploadSuccess = jest.fn();
  const mockSetIsLoading = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form correctly', () => {
    render(<DbUploadForm onUploadSuccess={mockOnUploadSuccess} setIsLoading={mockSetIsLoading} />);
    expect(screen.getByLabelText(/upload sqlite database/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload database/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload database/i })).toBeDisabled(); // Initially disabled as no file
  });

  it('enables upload button when a valid file is selected', () => {
    render(<DbUploadForm onUploadSuccess={mockOnUploadSuccess} setIsLoading={mockSetIsLoading} />);
    const fileInput = screen.getByLabelText(/upload sqlite database/i);
    const file = new File(['dummy content'], 'test.db', { type: 'application/x-sqlite3' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByRole('button', { name: /upload database/i })).not.toBeDisabled();
  });

  it('shows error and resets if an invalid file type is selected', () => {
    render(<DbUploadForm onUploadSuccess={mockOnUploadSuccess} setIsLoading={mockSetIsLoading} />);
    const fileInput = screen.getByLabelText<HTMLInputElement>(/upload sqlite database/i);
    const invalidFile = new File(['dummy content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    
    expect(mockedToast.error).toHaveBeenCalledWith("Invalid file type. Please select an SQLite database file (.db, .sqlite, .sqlite3).");
    expect(fileInput.value).toBe(''); // File input should be reset
    expect(screen.getByRole('button', { name: /upload database/i })).toBeDisabled();
  });
  
  it('shows error toast if no file is selected on submit', async () => {
    render(<DbUploadForm onUploadSuccess={mockOnUploadSuccess} setIsLoading={mockSetIsLoading} />);
    const uploadButton = screen.getByRole('button', { name: /upload database/i });
    
    // Button is initially disabled, so need to select a file then remove it, or enable button some other way if possible.
    // For this test, we'll just directly fire submit on the form.
    const form = uploadButton.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(mockedToast.error).toHaveBeenCalledWith("Please select a file to upload.");
    expect(mockedFetch).not.toHaveBeenCalled();
  });


  it('handles successful file upload', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Upload successful!', filePath: '/dbs/test.db', fileName: 'test.db' }),
    } as Response);

    render(<DbUploadForm onUploadSuccess={mockOnUploadSuccess} setIsLoading={mockSetIsLoading} />);
    
    const fileInput = screen.getByLabelText<HTMLInputElement>(/upload sqlite database/i);
    const file = new File(['(⌐□_□)'], 'test.db', { type: 'application/x-sqlite3' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadButton = screen.getByRole('button', { name: /upload database/i });
    fireEvent.click(uploadButton);

    expect(uploadButton).toBeDisabled(); // Should be disabled during upload
    expect(screen.getByText(/uploading.../i)).toBeInTheDocument();
    expect(mockSetIsLoading).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledTimes(1);
      expect(mockedFetch.mock.calls[0][0]).toBe('/api/db/upload');
      const formData = mockedFetch.mock.calls[0][1]?.body as FormData;
      expect(formData.get('dbfile')).toEqual(file);
    });
    
    await waitFor(() => {
        expect(mockOnUploadSuccess).toHaveBeenCalledWith('/dbs/test.db', 'test.db');
    });
    expect(mockedToast.success).toHaveBeenCalledWith('Upload successful!');
    expect(fileInput.value).toBe(''); // File input should be reset
    expect(uploadButton).not.toBeDisabled(); // Re-enabled
    expect(mockSetIsLoading).toHaveBeenCalledWith(false);
  });

  it('handles failed file upload (API error)', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'API upload failed.' }),
    } as Response);

    render(<DbUploadForm onUploadSuccess={mockOnUploadSuccess} setIsLoading={mockSetIsLoading} />);
    const fileInput = screen.getByLabelText<HTMLInputElement>(/upload sqlite database/i);
    const file = new File(['(⌐□_□)'], 'test.db', { type: 'application/x-sqlite3' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    const uploadButton = screen.getByRole('button', { name: /upload database/i });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith('API upload failed.');
    });
    expect(uploadButton).not.toBeDisabled();
    expect(mockOnUploadSuccess).not.toHaveBeenCalled();
    expect(mockSetIsLoading).toHaveBeenCalledWith(false);
     // File input should NOT be reset on API error, allowing user to retry
    expect(fileInput.value).not.toBe(''); 
  });

  it('handles network error during upload', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<DbUploadForm onUploadSuccess={mockOnUploadSuccess} setIsLoading={mockSetIsLoading} />);
    const fileInput = screen.getByLabelText<HTMLInputElement>(/upload sqlite database/i);
    const file = new File(['(⌐□_□)'], 'test.db', { type: 'application/x-sqlite3' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadButton = screen.getByRole('button', { name: /upload database/i });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith('An unexpected error occurred during upload.');
    });
    expect(uploadButton).not.toBeDisabled();
    expect(mockOnUploadSuccess).not.toHaveBeenCalled();
    expect(mockSetIsLoading).toHaveBeenCalledWith(false);
  });
});
