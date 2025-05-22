import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../page'; // Adjust path to your Home component
import { toast } from 'sonner';
import { TableSchema } from '@/lib/db'; // Assuming TableSchema is exported from lib/db

// Mock sonner
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock framer-motion
jest.mock('framer-motion', () => {
  const actualMotion = jest.requireActual('framer-motion');
  return {
    ...actualMotion,
    motion: {
      ...actualMotion.motion,
      div: jest.fn(({ children, ...props }) => <div {...props}>{children}</div>),
      aside: jest.fn(({ children, ...props }) => <aside {...props}>{children}</aside>),
      // Add other motion components used in Home page if necessary
    },
    AnimatePresence: jest.fn(({ children }) => <div>{children}</div>),
  };
});


// Mock global fetch
global.fetch = jest.fn();
const mockedFetch = global.fetch as jest.MockedFunction<typeof global.fetch>;

// Mock window.confirm for delete operations
global.confirm = jest.fn(() => true); // Always confirm 'yes'

const mockDbSchema: Record<string, TableSchema[]> = {
  users: [
    { name: 'id', type: 'INTEGER', pk: true, notnull: true },
    { name: 'name', type: 'TEXT', pk: false, notnull: false },
    { name: 'email', type: 'TEXT', pk: false, notnull: true },
  ],
  products: [
    { name: 'product_id', type: 'INTEGER', pk: true, notnull: true },
    { name: 'product_name', type: 'TEXT', pk: false, notnull: true },
    { name: 'price', type: 'REAL', pk: false, notnull: false },
  ],
};

const mockDbData: Record<string, any[]> = {
  users: [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ],
  products: [
    { product_id: 101, product_name: 'Laptop', price: 1200.50 },
    { product_id: 102, product_name: 'Mouse', price: 25.00 },
  ],
};


describe('Home Page Integration Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset motion component mocks if they have specific states/calls to check
    (motion.div as jest.Mock).mockImplementation(({ children, ...props }) => <div {...props}>{children}</div>);
    (motion.aside as jest.Mock).mockImplementation(({ children, ...props }) => <aside {...props}>{children}</aside>);
    (AnimatePresence as jest.Mock).mockImplementation(({ children }) => <div>{children}</div>);

  });

  const renderHomePage = () => render(<Home />);

  test('full workflow: upload DB, view tables, select table, view data, add, edit, delete row', async () => {
    renderHomePage();

    // 1. Initial state: Welcome message
    expect(screen.getByText(/welcome to db explorer/i)).toBeInTheDocument();

    // 2. Upload a DB
    mockedFetch.mockImplementationOnce(async (url) => { // For /api/db/upload
      if (url === '/api/db/upload') {
        return {
          ok: true,
          json: async () => ({ message: 'DB Uploaded!', filePath: '/dbs/test.db', fileName: 'test.db' }),
        } as Response;
      }
      return { ok: false, json: async () => ({ error: 'Unknown fetch' }) } as Response;
    });
    mockedFetch.mockImplementationOnce(async (url) => { // For /api/db/test.db/tables
      if (url === '/api/db/test.db/tables') {
        return {
          ok: true,
          json: async () => ({ tables: ['users', 'products'] }),
        } as Response;
      }
      return { ok: false, json: async () => ({ error: 'Unknown fetch' }) } as Response;
    });

    const fileInput = screen.getByLabelText(/upload sqlite database/i);
    const dbFile = new File(['dummy sqlite content'], 'test.db', { type: 'application/x-sqlite3' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [dbFile] } });
    });
    
    const uploadButton = screen.getByRole('button', { name: /upload database/i });
    await act(async () => {
      fireEvent.click(uploadButton);
    });
    
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Database 'test.db' loaded. Found 2 tables."));
    expect(screen.getByText(/database: test.db/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'users' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'products' })).toBeInTheDocument();

    // 3. Select 'users' table
    mockedFetch.mockImplementationOnce(async (url) => { // For /api/db/test.db/tables/users/schema
        expect(url).toBe('/api/db/test.db/tables/users/schema');
        return { ok: true, json: async () => ({ schema: mockDbSchema.users }) } as Response;
    });
    mockedFetch.mockImplementationOnce(async (url) => { // For /api/db/test.db/tables/users/data (initial load)
        expect(url.toString()).toContain('/api/db/test.db/tables/users/data?page=1&limit=10');
        return { ok: true, json: async () => ({ data: mockDbData.users, totalRows: mockDbData.users.length, currentPage: 1 }) } as Response;
    });
    
    const usersTableButton = screen.getByRole('button', { name: 'users' });
    await act(async () => {
        fireEvent.click(usersTableButton);
    });

    await waitFor(() => expect(screen.getByText('Table: users')).toBeInTheDocument());
    // Check data from 'users' table is rendered
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();

    // 4. Add New Row to 'users'
    const addNewRowButton = screen.getByRole('button', { name: /add new row/i });
    await act(async () => {
        fireEvent.click(addNewRowButton);
    });
    
    await waitFor(() => expect(screen.getByText(/insert new row into users/i)).toBeInTheDocument());

    // Mock fetch for POST new user
    mockedFetch.mockImplementationOnce(async (url, options) => {
        expect(url).toBe('/api/db/test.db/tables/users/data');
        expect(options?.method).toBe('POST');
        const body = JSON.parse(options?.body as string);
        expect(body.name).toBe('Charlie');
        return { ok: true, json: async () => ({ message: 'Row inserted!', id: 3 }) } as Response;
    });
    // Mock fetch for data refresh after insert
    mockedFetch.mockImplementationOnce(async (url) => {
        const updatedUsers = [...mockDbData.users, { id: 3, name: 'Charlie', email: 'charlie@example.com' }];
        return { ok: true, json: async () => ({ data: updatedUsers, totalRows: updatedUsers.length, currentPage: 1 }) } as Response;
    });

    await act(async () => {
        fireEvent.change(screen.getByLabelText(/id/i), { target: { value: '3' } });
        fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Charlie' } });
        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'charlie@example.com' } });
    });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /insert row/i }));
    });

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Row inserted successfully!'));
    await waitFor(() => expect(screen.getByText('Charlie')).toBeInTheDocument()); // New row visible

    // 5. Edit 'Charlie's row (assuming it's now the last one, or find it more robustly)
    const actionButtons = await screen.findAllByRole('button', { name: /open menu/i });
    // Assuming Charlie is the last row, so actionButtons[2]
    // This is fragile; a better way would be to find the row containing "Charlie" then its menu.
    // For now, using index based on current data.
    await act(async () => {
      fireEvent.click(actionButtons[2]); 
    });
    await waitFor(() => { fireEvent.click(screen.getByText('Edit')); }); // Edit dropdown item
    
    await waitFor(() => expect(screen.getByText(/edit row in users/i)).toBeInTheDocument());
    expect(screen.getByLabelText<HTMLInputElement>(/name/i).value).toBe('Charlie');

    // Mock fetch for PUT update user
    mockedFetch.mockImplementationOnce(async (url, options) => {
        expect(url).toBe('/api/db/test.db/tables/users/data/3'); // Assuming ID 3
        expect(options?.method).toBe('PUT');
        const body = JSON.parse(options?.body as string);
        expect(body.email).toBe('charlie.updated@example.com');
        return { ok: true, json: async () => ({ message: 'Row updated!', changes: 1 }) } as Response;
    });
    // Mock fetch for data refresh after update
    mockedFetch.mockImplementationOnce(async (url) => {
        const updatedUsers = mockDbData.users.map(u => u.id === 3 ? {...u, email: 'charlie.updated@example.com'} : u);
        // If Charlie wasn't in mockDbData initially, adjust this logic
        const charlieRow = { id: 3, name: 'Charlie', email: 'charlie.updated@example.com' };
        const finalUsers = [mockDbData.users[0], mockDbData.users[1], charlieRow];

        return { ok: true, json: async () => ({ data: finalUsers, totalRows: finalUsers.length, currentPage: 1 }) } as Response;
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'charlie.updated@example.com' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Row updated successfully!'));
    await waitFor(() => expect(screen.getByText('charlie.updated@example.com')).toBeInTheDocument());

    // 6. Delete 'Bob' (ID 2)
    // Find Bob's row more robustly
    const rows = screen.getAllByRole('row');
    const bobRow = Array.from(rows).find(row => row.textContent?.includes('Bob'));
    expect(bobRow).toBeInTheDocument();
    
    const bobMenuButton = Array.from(bobRow!.querySelectorAll('button[aria-label="Open menu"], button[aria-haspopup="menu"]')).find(b => b) as HTMLElement; // More specific selector needed
    // If the above doesn't work, use a more direct approach if structure is known:
    // const bobMenuButton = within(bobRow!).getByRole('button', { name: /open menu/i });
    // For now, we stick to index-based finding for menu buttons if the above is too complex.
    // Let's assume Bob is the second row, so actionButtons[1]
     await act(async () => {
      fireEvent.click(actionButtons[1]); // Bob's menu
    });
    await waitFor(() => { fireEvent.click(screen.getByText('Delete')); });

    expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this row? (ID: 2)');

    // Mock fetch for DELETE user
    mockedFetch.mockImplementationOnce(async (url, options) => {
        expect(url).toBe('/api/db/test.db/tables/users/data/2');
        expect(options?.method).toBe('DELETE');
        return { ok: true, json: async () => ({ message: 'Row deleted!', changes: 1 }) } as Response;
    });
    // Mock fetch for data refresh after delete
    mockedFetch.mockImplementationOnce(async (url) => {
        // Original Alice + updated Charlie
        const remainingUsers = [
            mockDbData.users[0], 
            { id: 3, name: 'Charlie', email: 'charlie.updated@example.com' }
        ];
        return { ok: true, json: async () => ({ data: remainingUsers, totalRows: remainingUsers.length, currentPage: 1 }) } as Response;
    });
    
    // The delete action is confirmed by global.confirm mock.
    // No button click needed for confirmation itself.
    
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Row deleted successfully!'));
    await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument());
    expect(screen.getByText('Alice')).toBeInTheDocument(); // Alice should still be there
    expect(screen.getByText('Charlie')).toBeInTheDocument(); // Charlie should still be there

  });
});
