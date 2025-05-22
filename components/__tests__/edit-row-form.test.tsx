import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EditRowForm } from '../edit-row-form'; // Adjust path
import { TableSchema } from '@/lib/db'; // Adjust path
import { toast } from 'sonner';

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));
const mockedToast = toast as jest.Mocked<typeof toast>;

const mockSchema: TableSchema[] = [
  { name: 'id', type: 'INTEGER', pk: true, notnull: true },
  { name: 'name', type: 'TEXT', pk: false, notnull: false },
  { name: 'age', type: 'INTEGER', pk: false, notnull: false },
  { name: 'is_active', type: 'BOOLEAN', pk: false, notnull: false }, // Typically INTEGER 0/1 in SQLite
  { name: 'bio', type: 'TEXT', pk: false, notnull: true }, // Required textarea
  { name: 'created_at', type: 'DATETIME', pk: false, notnull: false },
];

describe('EditRowForm Component', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSubmit = jest.fn();
  const defaultProps = {
    schema: mockSchema,
    tableName: 'testTable',
    isOpen: true,
    onOpenChange: mockOnOpenChange,
    onSubmit: mockOnSubmit,
    dbName: 'testDB',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Insert Mode (no initialData)', () => {
    it('renders form fields correctly based on schema for insert', () => {
      render(<EditRowForm {...defaultProps} initialData={null} />);
      expect(screen.getByText(/insert new row into testTable/i)).toBeInTheDocument();
      mockSchema.forEach(col => {
        expect(screen.getByLabelText(new RegExp(col.name, 'i'))).toBeInTheDocument();
        if (col.pk) { // PK field should be enabled for insert
          expect(screen.getByLabelText(new RegExp(col.name, 'i'))).not.toBeDisabled();
        }
      });
      expect(screen.getByRole('button', { name: /insert row/i })).toBeInTheDocument();
    });

    it('initializes form with default values for insert', () => {
      render(<EditRowForm {...defaultProps} initialData={null} />);
      // Text/number fields should be empty, booleans false
      expect(screen.getByLabelText<HTMLInputElement>(/name/i).value).toBe('');
      expect(screen.getByLabelText<HTMLInputElement>(/age/i).value).toBe('');
      // Checkbox for is_active (assuming it's rendered as a checkbox)
      const isActiveCheckbox = screen.getByLabelText(/is_active/i) as HTMLInputElement;
      // For our component, boolean is rendered as a checkbox with a text label "True"/"False" next to it
      // The actual checkbox input might not have the direct name label, but its associated label will.
      // We find the checkbox by its role and check its 'checked' state.
      const checkbox = screen.getByRole('checkbox', { name: /is_active/i });
      expect(checkbox).not.toBeChecked();
    });
    
    it('submits correct data for insert', async () => {
      mockOnSubmit.mockResolvedValueOnce({ success: true });
      render(<EditRowForm {...defaultProps} initialData={null} />);

      fireEvent.change(screen.getByLabelText(/id/i), { target: { value: '100' } });
      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New User' } });
      fireEvent.change(screen.getByLabelText(/age/i), { target: { value: '30' } });
      // Click the checkbox associated with is_active
      fireEvent.click(screen.getByRole('checkbox', { name: /is_active/i })); 
      fireEvent.change(screen.getByLabelText(/bio/i), { target: { value: 'Test bio' } });
      fireEvent.change(screen.getByLabelText(/created_at/i), { target: { value: '2024-01-01T10:00' } });


      fireEvent.click(screen.getByRole('button', { name: /insert row/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          id: 100, // Assuming number conversion
          name: 'New User',
          age: 30,  // Assuming number conversion
          is_active: true, // Boolean from checkbox
          bio: 'Test bio',
          created_at: '2024-01-01T10:00'
        });
      });
      expect(mockedToast.success).toHaveBeenCalledWith('Row inserted successfully!');
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Edit Mode (with initialData)', () => {
    const initialData = {
      id: 1,
      name: 'Existing User',
      age: 25,
      is_active: 1, // SQLite boolean true
      bio: 'Existing bio',
      created_at: '2023-01-01T00:00:00Z'
    };

    it('renders form fields with initial data and disables PK', () => {
      render(<EditRowForm {...defaultProps} initialData={initialData} />);
      expect(screen.getByText(/edit row in testTable/i)).toBeInTheDocument();
      
      expect(screen.getByLabelText<HTMLInputElement>(/id/i).value).toBe(initialData.id.toString());
      expect(screen.getByLabelText<HTMLInputElement>(/id/i)).toBeDisabled(); // PK disabled
      expect(screen.getByText(/primary key cannot be edited/i)).toBeInTheDocument();


      expect(screen.getByLabelText<HTMLInputElement>(/name/i).value).toBe(initialData.name);
      expect(screen.getByLabelText<HTMLInputElement>(/age/i).value).toBe(initialData.age.toString());
      
      const isActiveCheckbox = screen.getByRole('checkbox', { name: /is_active/i });
      expect(isActiveCheckbox).toBeChecked(); // is_active is 1 (true)

      expect(screen.getByLabelText<HTMLTextAreaElement>(/bio/i).value).toBe(initialData.bio);
      // DATETIME fields might need specific handling for value attribute if not text
      // For input type="datetime-local", value should be in 'yyyy-MM-ddTHH:mm'
      // Assuming initialData.created_at is a full ISO string, it might need formatting for the input value.
      // The current component logic passes it as is; browser might handle it.
      // For test simplicity, we'll check if the input field has a value.
      expect(screen.getByLabelText<HTMLInputElement>(/created_at/i).value).toBeTruthy();


      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('submits updated data correctly', async () => {
      mockOnSubmit.mockResolvedValueOnce({ success: true });
      render(<EditRowForm {...defaultProps} initialData={initialData} />);

      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Updated User' } });
      fireEvent.change(screen.getByLabelText(/age/i), { target: { value: '26' } });

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          ...initialData, // PK (id) should remain the same
          name: 'Updated User',
          age: 26, // Assuming number conversion
          is_active: true, // from initialData, converted to boolean
          // bio and created_at remain from initialData as they weren't changed
        });
      });
      expect(mockedToast.success).toHaveBeenCalledWith('Row updated successfully!');
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('handles submission failure and shows error toast', async () => {
    mockOnSubmit.mockResolvedValueOnce({ success: false, error: 'Database error' });
    render(<EditRowForm {...defaultProps} initialData={null} />);
    
    fireEvent.change(screen.getByLabelText(/id/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/bio/i), { target: { value: 'Required bio' } });
    fireEvent.click(screen.getByRole('button', { name: /insert row/i }));

    await waitFor(() => {
      expect(mockedToast.error).toHaveBeenCalledWith('Database error');
    });
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false); // Dialog should remain open
  });

  it('calls onOpenChange with false when cancel button is clicked', () => {
    render(<EditRowForm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
