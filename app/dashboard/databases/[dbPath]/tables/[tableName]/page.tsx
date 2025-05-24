'use client';

import { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { TableColumn } from '@/lib/db'; // Assuming this is exported or define here
import {
  getTableInfoAndDataAction,
  updateRowAction,
  insertRowAction,
  deleteRowAction,
  GetTableInfoAndDataResult,
  UpdateRowResult,
  InsertRowResult,
  DeleteRowResult
} from './actions';
import { ArrowUpDown, Trash2, Edit3, Save, XCircle, PlusCircle } from 'lucide-react';


interface PageState {
  schema: TableColumn[];
  dataRows: any[];
  totalRows: number;
  primaryKeyColumns: string[];
  isLoading: boolean;
  error: string | null;
}

interface EditingState {
  rowIndex: number | null; // Index in the current dataRows array
  rowData: Record<string, any> | null; // Original data of the row being edited
  editValues: Record<string, any>; // Current values in input fields for the row
}

export default function TableDataPage() {
  const router = useRouter();
  const params = useParams();
  const encodedDbPath = params.dbPath as string;
  const encodedTableName = params.tableName as string;

  const [pageState, setPageState] = useState<PageState>({
    schema: [],
    dataRows: [],
    totalRows: 0,
    primaryKeyColumns: [],
    isLoading: true,
    error: null,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Or make it configurable
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');

  const [editingState, setEditingState] = useState<EditingState>({
    rowIndex: null,
    rowData: null,
    editValues: {},
  });

  const [showAddRowDialog, setShowAddRowDialog] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});

  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [rowToDeleteIdentifier, setRowToDeleteIdentifier] = useState<Record<string, any> | null>(null);


  const fetchData = useCallback(async () => {
    if (!encodedDbPath || !encodedTableName) return;
    setPageState(prev => ({ ...prev, isLoading: true, error: null }));

    const result: GetTableInfoAndDataResult = await getTableInfoAndDataAction(
      encodedDbPath,
      encodedTableName,
      currentPage,
      pageSize,
      sortBy,
      sortDirection
    );

    if (result.success && result.schema && result.data) {
      setPageState({
        schema: result.schema,
        dataRows: result.data,
        totalRows: result.totalRows || 0,
        primaryKeyColumns: result.primaryKeyColumns || [],
        isLoading: false,
        error: null,
      });
      // Initialize newRowData keys based on schema when schema is first fetched
      if (Object.keys(newRowData).length === 0 && result.schema.length > 0) {
        const initialNewRow: Record<string, any> = {};
        result.schema.forEach(col => {
          initialNewRow[col.name] = ''; // Default to empty string
        });
        setNewRowData(initialNewRow);
      }
    } else {
      setPageState(prev => ({
        ...prev,
        isLoading: false,
        error: result.error || 'Failed to load table data.',
        schema: [], // Clear schema on error
        dataRows: [], // Clear data on error
        totalRows: 0,
      }));
    }
  }, [encodedDbPath, encodedTableName, currentPage, pageSize, sortBy, sortDirection, newRowData]); // Added newRowData to deps for init

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (columnName: string) => {
    if (sortBy === columnName) {
      setSortDirection(prev => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(columnName);
      setSortDirection('ASC');
    }
    setCurrentPage(1); // Reset to first page on sort
    // fetchData will be called by useEffect due to sortBy/sortDirection change
  };

  // --- Inline Editing Handlers ---
  const handleEdit = (rowIndex: number, row: any) => {
    setEditingState({
      rowIndex,
      rowData: { ...row }, // Store original row data
      editValues: { ...row }, // Initialize editValues with current row data
    });
  };

  const handleCancelEdit = () => {
    setEditingState({ rowIndex: null, rowData: null, editValues: {} });
  };

  const handleEditChange = (columnName: string, value: any) => {
    setEditingState(prev => ({
      ...prev,
      editValues: { ...prev.editValues, [columnName]: value },
    }));
  };

  const handleSaveEdit = async () => {
    if (editingState.rowIndex === null || !editingState.rowData || pageState.primaryKeyColumns.length === 0) {
      setPageState(prev => ({ ...prev, error: "Cannot save: missing row data or primary key information."}));
      return;
    }

    const pkCriteria: Record<string, any> = {};
    pageState.primaryKeyColumns.forEach(pkColName => {
      pkCriteria[pkColName] = editingState.rowData![pkColName];
    });
    
    if (Object.values(pkCriteria).some(val => val === undefined || val === null)) {
        setPageState(prev => ({ ...prev, error: "Primary key value is missing. Cannot save."}));
        console.error("PK Criteria", pkCriteria);
        return;
    }

    // Only include changed values in the update
    const changedValues: Record<string, any> = {};
    for (const key in editingState.editValues) {
      if (editingState.editValues[key] !== editingState.rowData[key]) {
        changedValues[key] = editingState.editValues[key];
      }
    }

    if (Object.keys(changedValues).length === 0) {
      handleCancelEdit(); // No changes, just cancel
      return;
    }
    
    setPageState(prev => ({ ...prev, isLoading: true }));
    const result: UpdateRowResult = await updateRowAction(
      encodedDbPath,
      encodedTableName,
      pkCriteria,
      changedValues
    );
    setPageState(prev => ({ ...prev, isLoading: false }));

    if (result.success) {
      handleCancelEdit();
      fetchData(); // Refresh data
    } else {
      setPageState(prev => ({ ...prev, error: result.error || 'Failed to update row.' }));
    }
  };

  // --- Add Row Handlers ---
  const handleNewRowChange = (columnName: string, value: any) => {
    setNewRowData(prev => ({ ...prev, [columnName]: value }));
  };

  const handleAddRowSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPageState(prev => ({ ...prev, isLoading: true }));
    const result: InsertRowResult = await insertRowAction(encodedDbPath, encodedTableName, newRowData);
    setPageState(prev => ({ ...prev, isLoading: false }));

    if (result.success) {
      setShowAddRowDialog(false);
      const initialNewRow: Record<string, any> = {};
      pageState.schema.forEach(col => { initialNewRow[col.name] = ''; });
      setNewRowData(initialNewRow); // Reset form
      fetchData(); // Refresh data
    } else {
      setPageState(prev => ({ ...prev, error: result.error || 'Failed to add row.' }));
    }
  };

  // --- Delete Row Handlers ---
  const openDeleteConfirmation = (row: any) => {
     if (pageState.primaryKeyColumns.length === 0) {
      setPageState(prev => ({ ...prev, error: "Cannot delete: primary key information missing."}));
      return;
    }
    const pkCriteria: Record<string, any> = {};
    pageState.primaryKeyColumns.forEach(pkColName => {
      pkCriteria[pkColName] = row[pkColName];
    });
     if (Object.values(pkCriteria).some(val => val === undefined || val === null)) {
        setPageState(prev => ({ ...prev, error: "Primary key value is missing. Cannot delete."}));
        return;
    }
    setRowToDeleteIdentifier(pkCriteria);
    setShowDeleteConfirmDialog(true);
  };

  const handleDeleteRowConfirm = async () => {
    if (!rowToDeleteIdentifier) return;
    setPageState(prev => ({ ...prev, isLoading: true }));
    const result: DeleteRowResult = await deleteRowAction(encodedDbPath, encodedTableName, rowToDeleteIdentifier);
    setPageState(prev => ({ ...prev, isLoading: false }));

    if (result.success) {
      fetchData(); // Refresh data
    } else {
      setPageState(prev => ({ ...prev, error: result.error || 'Failed to delete row.' }));
    }
    setShowDeleteConfirmDialog(false);
    setRowToDeleteIdentifier(null);
  };
  
  // --- Pagination Handler ---
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= Math.ceil(pageState.totalRows / pageSize)) {
      setCurrentPage(newPage);
      // fetchData will be called by useEffect
    }
  };

  const totalPages = Math.ceil(pageState.totalRows / pageSize);
  const dbName = decodeURIComponent(encodedDbPath);
  const tableName = decodeURIComponent(encodedTableName);

  if (pageState.isLoading && pageState.schema.length === 0) { // Initial load
    return <div className="container mx-auto p-4">Loading table data...</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <header className="space-y-2">
        <div className="flex justify-between items-center">
          <Link href={`/dashboard/databases/${encodedDbPath}/tables`} className="text-blue-500 hover:underline text-sm">
            &larr; Back to Tables for {dbName}
          </Link>
          <Dialog open={showAddRowDialog} onOpenChange={setShowAddRowDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Row</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Row to {tableName}</DialogTitle>
                <DialogDescription>Enter data for each column.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddRowSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {pageState.schema.map(col => (
                  <div key={`new-${col.name}`}>
                    <label htmlFor={`new-col-${col.name}`} className="block text-sm font-medium mb-1">
                      {col.name} <span className="text-xs text-gray-500">({col.type})</span>
                    </label>
                    <Input
                      id={`new-col-${col.name}`}
                      value={newRowData[col.name] || ''}
                      onChange={(e) => handleNewRowChange(col.name, e.target.value)}
                      disabled={pageState.isLoading}
                      type={col.type.toLowerCase().includes('int') ? 'number' : 'text'} // Basic type handling
                    />
                  </div>
                ))}
                 <DialogFooter className="mt-auto pt-4 border-t">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={pageState.isLoading}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={pageState.isLoading}>
                      {pageState.isLoading ? 'Adding...' : 'Add Row'}
                    </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <h1 className="text-3xl font-bold">Table: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{tableName}</span></h1>
        <p className="text-sm text-muted-foreground">Database: {dbName}</p>
      </header>

      {pageState.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{pageState.error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableCaption>
            Displaying {pageState.dataRows.length} of {pageState.totalRows} rows.
            {pageState.isLoading && " (Loading...)"}
          </TableCaption>
          <TableHeader>
            <TableRow>
              {pageState.schema.map(col => (
                <TableHead key={col.name} onClick={() => handleSort(col.name)} className="cursor-pointer hover:bg-muted/50">
                  <div className="flex items-center gap-1">
                    {col.name}
                    {sortBy === col.name && (sortDirection === 'ASC' ? <ArrowUpDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 transform rotate-180" />)}
                    {pageState.primaryKeyColumns.includes(col.name) && <span title="Primary Key" className="text-yellow-500 font-bold text-xs">(PK)</span>}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-right w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageState.dataRows.map((row, rowIndex) => (
              <TableRow key={`row-${rowIndex}`}>
                {pageState.schema.map(col => (
                  <TableCell key={`${rowIndex}-${col.name}`}>
                    {editingState.rowIndex === rowIndex ? (
                      <Input
                        type={col.type.toLowerCase().includes('int') ? 'number' : 'text'} // Basic type handling
                        value={editingState.editValues[col.name] ?? ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => handleEditChange(col.name, e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      String(row[col.name] ?? '') // Handle null/undefined for display
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  {editingState.rowIndex === rowIndex ? (
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={handleSaveEdit} title="Save" disabled={pageState.isLoading}>
                        <Save className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={handleCancelEdit} title="Cancel" disabled={pageState.isLoading}>
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(rowIndex, row)} title="Edit" 
                        disabled={pageState.isLoading || pageState.primaryKeyColumns.length === 0}> {/* Disable edit if no PK */}
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteConfirmation(row)} title="Delete" 
                        disabled={pageState.isLoading || pageState.primaryKeyColumns.length === 0}> {/* Disable delete if no PK */}
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
             {pageState.dataRows.length === 0 && !pageState.isLoading && (
                <TableRow>
                    <TableCell colSpan={pageState.schema.length + 1} className="text-center">
                        No data found in this table.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} aria-disabled={currentPage === 1} className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined} />
            </PaginationItem>
            {/* Simple pagination display - can be enhanced */}
            {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                // Show first page, last page, and pages around current page
                if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1) ) {
                    return (
                        <PaginationItem key={i}>
                        <PaginationLink onClick={() => handlePageChange(pageNum)} isActive={currentPage === pageNum}>
                            {pageNum}
                        </PaginationLink>
                        </PaginationItem>
                    );
                } else if ( (pageNum === currentPage - 2 && currentPage > 3) || (pageNum === currentPage + 2 && currentPage < totalPages - 2) ) {
                    return <PaginationEllipsis key={`ellipsis-${pageNum}`} />;
                }
                return null;
            })}
            <PaginationItem>
              <PaginationNext onClick={() => handlePageChange(currentPage + 1)} aria-disabled={currentPage === totalPages} className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}


      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected row.
              Identifier: <span className="font-mono bg-gray-100 text-xs p-1 rounded">{JSON.stringify(rowToDeleteIdentifier)}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pageState.isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRowConfirm}
              disabled={pageState.isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {pageState.isLoading ? 'Deleting...' : 'Yes, delete row'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
