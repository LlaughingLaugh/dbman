import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DataTable } from '../data-table'; // Adjust path
import { TableSchema } from '@/lib/db'; // Adjust path
import { motion, AnimatePresence } from 'framer-motion';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const actualMotion = jest.requireActual('framer-motion');
  return {
    ...actualMotion,
    motion: {
      ...actualMotion.motion,
      div: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
      tr: ({ children, ...props }: { children: React.ReactNode }) => <tr {...props}>{children}</tr>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});


const mockSchema: TableSchema[] = [
  { name: 'id', type: 'INTEGER', pk: true, notnull: true },
  { name: 'name', type: 'TEXT', pk: false, notnull: false },
  { name: 'value', type: 'REAL', pk: false, notnull: false },
];

const mockData = [
  { id: 1, name: 'Alice', value: 10.5 },
  { id: 2, name: 'Bob', value: 20.0 },
  { id: 3, name: 'Charlie', value: null }, // Test null display
];

describe('DataTable Component', () => {
  const mockOnPageChange = jest.fn();
  const mockOnSortChange = jest.fn();
  const mockOnSearchChange = jest.fn();
  const mockOnEditRow = jest.fn();
  const mockOnDeleteRow = jest.fn();

  const defaultProps = {
    dbName: 'testDB',
    tableName: 'testTable',
    schema: mockSchema,
    data: mockData,
    totalRows: mockData.length,
    currentPage: 1,
    limit: 10,
    sortBy: null,
    sortOrder: null,
    isLoading: false,
    onPageChange: mockOnPageChange,
    onSortChange: mockOnSortChange,
    onSearchChange: mockOnSearchChange,
    onEditRow: mockOnEditRow,
    onDeleteRow: mockOnDeleteRow,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders schema as table headers and data rows correctly', () => {
    render(<DataTable {...defaultProps} />);
    // Check headers
    mockSchema.forEach(col => {
      expect(screen.getByRole('button', { name: new RegExp(col.name, 'i') })).toBeInTheDocument();
    });
    expect(screen.getByText('Actions')).toBeInTheDocument(); // Actions header

    // Check data rows
    mockData.forEach(row => {
      expect(screen.getByText(row.id.toString())).toBeInTheDocument();
      expect(screen.getByText(row.name)).toBeInTheDocument();
      if (row.value === null) {
        expect(screen.getByText('NULL')).toBeInTheDocument();
      } else {
        expect(screen.getByText(row.value.toString())).toBeInTheDocument();
      }
    });
  });

  it('displays skeleton loaders when isLoading is true', () => {
    render(<DataTable {...defaultProps} isLoading={true} data={[]} totalRows={0} />); // Empty data for loading state
    // Assuming limit is 10, there should be 10 skeleton rows
    // Each row has schema.length + 1 (for actions) cells
    const skeletonCells = screen.getAllByRole('cell').filter(cell => 
        cell.querySelector('.h-5.w-full') || cell.querySelector('.h-8.w-16.mx-auto') // Check for skeleton class
    );
    // Number of skeleton rows * number of columns (schema.length + 1 for actions)
    expect(skeletonCells.length).toBe(defaultProps.limit * (mockSchema.length + 1));
  });

  it('displays "No results found." when data is empty and not loading', () => {
    render(<DataTable {...defaultProps} data={[]} totalRows={0} />);
    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  it('calls onSortChange when a column header is clicked', () => {
    render(<DataTable {...defaultProps} />);
    const nameHeaderButton = screen.getByRole('button', { name: /name/i });
    fireEvent.click(nameHeaderButton);
    expect(mockOnSortChange).toHaveBeenCalledWith('name');
  });

  it('calls onSearchChange when search form is submitted or cleared', () => {
    render(<DataTable {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/search/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    fireEvent.change(searchInput, { target: { value: 'Alice' } });
    fireEvent.click(searchButton); // Or fireEvent.submit(formElement)
    expect(mockOnSearchChange).toHaveBeenCalledWith('Alice');
    
    // Test clear button
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);
    expect(mockOnSearchChange).toHaveBeenCalledWith('');
  });

  it('calls onEditRow and onDeleteRow when action buttons are clicked', async () => {
    render(<DataTable {...defaultProps} />);
    // Get all "Open menu" buttons (MoreHorizontal icon triggers)
    const menuButtons = screen.getAllByRole('button', { name: /open menu/i });
    
    // Test with the first row's actions
    fireEvent.click(menuButtons[0]); 

    // Wait for dropdown items to be available
    await waitFor(() => {
      expect(screen.getByText(/edit/i)).toBeInTheDocument(); // Dropdown item for Edit
    });
    
    const editButton = screen.getByText(/edit/i);
    fireEvent.click(editButton);
    expect(mockOnEditRow).toHaveBeenCalledWith(mockData[0]);

    // Re-open menu for delete
    fireEvent.click(menuButtons[0]);
     await waitFor(() => {
      expect(screen.getByText(/delete/i)).toBeInTheDocument(); // Dropdown item for Delete
    });
    const deleteButton = screen.getByText(/delete/i);
    fireEvent.click(deleteButton);
    expect(mockOnDeleteRow).toHaveBeenCalledWith(mockData[0]);
  });

  describe('Pagination', () => {
    const paginatedProps = {
      ...defaultProps,
      totalRows: 25, // e.g., 3 pages if limit is 10
      limit: 10,
    };

    it('renders pagination controls when totalPages > 1', () => {
      render(<DataTable {...paginatedProps} />);
      expect(screen.getByRole('button', { name: /go to previous page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to next page/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /page 1/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /page 2/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /page 3/i })).toBeInTheDocument();
    });

    it('calls onPageChange with the correct page number', () => {
      render(<DataTable {...paginatedProps} currentPage={1} />);
      
      const nextPageButton = screen.getByRole('button', { name: /go to next page/i });
      fireEvent.click(nextPageButton);
      expect(mockOnPageChange).toHaveBeenCalledWith(2);

      // Test specific page link
      const page2Link = screen.getByRole('link', { name: /page 2/i });
      fireEvent.click(page2Link);
      expect(mockOnPageChange).toHaveBeenCalledWith(2);
      
      // Go to page 2, then test previous
      render(<DataTable {...paginatedProps} currentPage={2} />);
      const prevPageButton = screen.getByRole('button', { name: /go to previous page/i });
      fireEvent.click(prevPageButton);
      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });

    it('disables previous/next buttons appropriately', () => {
      // On first page
      render(<DataTable {...paginatedProps} currentPage={1} />);
      expect(screen.getByRole('button', { name: /go to previous page/i })).toHaveClass('cursor-not-allowed'); // Based on current styling
      expect(screen.getByRole('button', { name: /go to next page/i })).not.toHaveClass('cursor-not-allowed');

      // On last page
      render(<DataTable {...paginatedProps} currentPage={3} />); // 25 rows, limit 10 -> 3 pages
      expect(screen.getByRole('button', { name: /go to previous page/i })).not.toHaveClass('cursor-not-allowed');
      expect(screen.getByRole('button', { name: /go to next page/i })).toHaveClass('cursor-not-allowed');
    });
    
    it('renders ellipsis correctly', () => {
      const manyPagesProps = { ...defaultProps, totalRows: 100, limit: 5, currentPage: 10 }; // 20 pages
      render(<DataTable {...manyPagesProps} />);
      expect(screen.getByText('...')).toBeInTheDocument(); // Should be at least one ellipsis
    });
  });
   it('displays correct row count information', () => {
    render(<DataTable {...defaultProps} limit={5} totalRows={12} currentPage={2} />);
    expect(screen.getByText(/showing 6-10 of 12 rows/i)).toBeInTheDocument();
  });

  it('displays "Showing 0-0 of 0 rows." when data is empty', () => {
    render(<DataTable {...defaultProps} data={[]} totalRows={0} />);
    expect(screen.getByText(/showing 0-0 of 0 rows/i)).toBeInTheDocument();
  });
});
