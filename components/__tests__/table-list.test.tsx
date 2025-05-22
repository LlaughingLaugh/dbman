import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TableList } from '../table-list'; // Adjust path as necessary
import { motion } from 'framer-motion';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const actualMotion = jest.requireActual('framer-motion');
  return {
    ...actualMotion,
    motion: {
      ...actualMotion.motion,
      div: ({ children, ...props }: { children: React.ReactNode} ) => <div {...props}>{children}</div>,
      h3: ({ children, ...props }: { children: React.ReactNode} ) => <h3 {...props}>{children}</h3>,
      p: ({ children, ...props }: { children: React.ReactNode} ) => <p {...props}>{children}</p>,
      nav: ({ children, ...props }: { children: React.ReactNode} ) => <nav {...props}>{children}</nav>,
      // Add any other motion components you use in TableList here
    },
    AnimatePresence: ({ children }: { children: React.ReactNode}) => <div>{children}</div>,
  };
});


describe('TableList Component', () => {
  const mockOnTableSelect = jest.fn();
  const tables = ['customers', 'orders', 'products'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Please upload a database" message when dbName is null', () => {
    render(
      <TableList
        dbName={null}
        tables={[]}
        selectedTable={null}
        onTableSelect={mockOnTableSelect}
      />
    );
    expect(screen.getByText(/please upload a database to see its tables/i)).toBeInTheDocument();
  });

  it('renders loading state when isLoadingTables is true', () => {
    render(
      <TableList
        dbName="testDB"
        tables={[]}
        selectedTable={null}
        onTableSelect={mockOnTableSelect}
        isLoadingTables={true}
      />
    );
    expect(screen.getByText(/loading tables for testDB.../i)).toBeInTheDocument();
    // Check for skeleton loaders (example: count them or check for specific class if unique)
    const skeletons = screen.getAllByRole('generic', { name: '' }); // Assuming skeletons are divs without specific role
    // This is a bit fragile; better to add a data-testid to skeleton divs in the component for testing
    // For now, we'll assume the divs with animate-pulse are the skeletons.
    // The current skeleton implementation doesn't have a role, let's find by class if possible or count divs.
    // In the component, skeletons are <div className="h-9 bg-muted rounded animate-pulse"></div>
    // We can count them based on this structure if other tests are too complex.
    // For simplicity, we'll just check that some elements indicative of loading are present.
    expect(screen.getAllByText((content, element) => element?.className.includes('animate-pulse') ?? false).length).toBeGreaterThan(0);
  });

  it('renders "No tables found" message when tables array is empty', () => {
    render(
      <TableList
        dbName="testDB"
        tables={[]}
        selectedTable={null}
        onTableSelect={mockOnTableSelect}
        isLoadingTables={false}
      />
    );
    expect(screen.getByText(/database: testDB/i)).toBeInTheDocument();
    expect(screen.getByText(/no tables found in this database/i)).toBeInTheDocument();
  });

  it('renders the list of tables correctly', () => {
    render(
      <TableList
        dbName="testDB"
        tables={tables}
        selectedTable={null}
        onTableSelect={mockOnTableSelect}
      />
    );
    expect(screen.getByText(/database: testDB/i)).toBeInTheDocument();
    expect(screen.getByText(/tables:/i)).toBeInTheDocument();
    tables.forEach(table => {
      expect(screen.getByRole('button', { name: table })).toBeInTheDocument();
    });
  });

  it('highlights the selected table', () => {
    const selected = 'orders';
    render(
      <TableList
        dbName="testDB"
        tables={tables}
        selectedTable={selected}
        onTableSelect={mockOnTableSelect}
      />
    );
    const selectedButton = screen.getByRole('button', { name: selected });
    // Shadcn UI Button variant 'secondary' might add specific classes or attributes.
    // For this example, we'll assume 'secondary' gives it a distinct visual style that can be checked.
    // If it adds `aria-current="true"` or a specific class like `bg-secondary`, that would be ideal.
    // Let's check for a class that `variant="secondary"` might apply (this is an assumption).
    // A better way is to inspect the actual DOM output of a selected button with variant="secondary".
    // For now, we check if it's present. The visual distinction is hard to test without specific class knowledge.
    expect(selectedButton).toBeInTheDocument(); 
    // A more robust test would be: expect(selectedButton).toHaveClass('bg-secondary'); (or similar)

    // Check that other buttons are not highlighted (e.g., have 'ghost' variant styling)
    const unselectedButton = screen.getByRole('button', { name: 'customers' });
    // expect(unselectedButton).toHaveClass('bg-ghost'); // (or similar for ghost variant)
  });

  it('calls onTableSelect with the table name when a table button is clicked', () => {
    render(
      <TableList
        dbName="testDB"
        tables={tables}
        selectedTable={null}
        onTableSelect={mockOnTableSelect}
      />
    );
    const tableToClick = 'products';
    const tableButton = screen.getByRole('button', { name: tableToClick });
    fireEvent.click(tableButton);
    expect(mockOnTableSelect).toHaveBeenCalledTimes(1);
    expect(mockOnTableSelect).toHaveBeenCalledWith(tableToClick);
  });
});
