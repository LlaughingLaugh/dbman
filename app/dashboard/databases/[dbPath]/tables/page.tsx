'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation'; // For accessing [dbPath] and navigation
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  listTablesAction,
  createTableAction,
  deleteTableAction,
  ColumnDefinition,
  ListTablesResult,
  CreateTableResult,
  DeleteTableResult
} from './actions';

const SQLITE_TYPES = ['TEXT', 'INTEGER', 'REAL', 'BLOB', 'NULL'];

interface TablePageState {
  tables: string[];
  isLoadingTables: boolean;
  isCreatingTable: boolean;
  isDeletingTable: string | null; // Store table name being deleted or null
  error: string | null;
  createTableDialogOpen: boolean;
  deleteAlertDialogOpen: boolean;
  tableToDelete: string | null;
}

interface NewColumn extends ColumnDefinition {
  id: string; // For unique key in React list
}

export default function TableManagementPage() {
  const router = useRouter();
  const params = useParams();
  const encodedDbPath = params.dbPath as string; // dbPath from URL

  const [pageState, setPageState] = useState<TablePageState>({
    tables: [],
    isLoadingTables: true,
    isCreatingTable: false,
    isDeletingTable: null,
    error: null,
    createTableDialogOpen: false,
    deleteAlertDialogOpen: false,
    tableToDelete: null,
  });

  const [newTableName, setNewTableName] = useState<string>('');
  const [columns, setColumns] = useState<NewColumn[]>([
    { id: crypto.randomUUID(), name: '', type: 'TEXT', primaryKey: false, notNull: false },
  ]);

  const fetchTables = async () => {
    if (!encodedDbPath) return;
    setPageState(prev => ({ ...prev, isLoadingTables: true, error: null }));
    const result: ListTablesResult = await listTablesAction(encodedDbPath);
    if (result.success) {
      setPageState(prev => ({ ...prev, tables: result.tables || [], isLoadingTables: false }));
    } else {
      setPageState(prev => ({ ...prev, error: result.error || 'Failed to load tables.', isLoadingTables: false }));
    }
  };

  useEffect(() => {
    fetchTables();
  }, [encodedDbPath]);

  // --- Create Table Handlers ---
  const handleAddColumn = () => {
    setColumns([
      ...columns,
      { id: crypto.randomUUID(), name: '', type: 'TEXT', primaryKey: false, notNull: false },
    ]);
  };

  const handleRemoveColumn = (id: string) => {
    if (columns.length > 1) { // Keep at least one column
      setColumns(columns.filter(col => col.id !== id));
    }
  };

  const handleColumnChange = (id: string, field: keyof ColumnDefinition, value: string | boolean) => {
    setColumns(
      columns.map(col =>
        col.id === id ? { ...col, [field]: value } : col
      )
    );
  };
  
  const handleColumnTypeChange = (id: string, value: string) => {
     setColumns(
      columns.map(col =>
        col.id === id ? { ...col, type: value } : col
      )
    );
  }


  const handleCreateTableSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!newTableName.trim()) {
      setPageState(prev => ({ ...prev, error: 'Table name cannot be empty.' }));
      return;
    }
    if (columns.some(col => !col.name.trim() || !col.type.trim())) {
       setPageState(prev => ({ ...prev, error: 'Column name and type cannot be empty.' }));
      return;
    }

    setPageState(prev => ({ ...prev, isCreatingTable: true, error: null }));
    const columnDefsToSubmit = columns.map(({ id, ...rest }) => rest); // Remove temporary id

    const result: CreateTableResult = await createTableAction(encodedDbPath, newTableName, columnDefsToSubmit);

    if (result.success) {
      setPageState(prev => ({ ...prev, createTableDialogOpen: false, isCreatingTable: false }));
      setNewTableName('');
      setColumns([{ id: crypto.randomUUID(), name: '', type: 'TEXT', primaryKey: false, notNull: false }]);
      fetchTables(); // Refresh table list
    } else {
      setPageState(prev => ({ ...prev, error: result.error || 'Failed to create table.', isCreatingTable: false }));
    }
  };


  // --- Delete Table Handlers ---
  const openDeleteConfirmation = (tableName: string) => {
    setPageState(prev => ({ ...prev, deleteAlertDialogOpen: true, tableToDelete: tableName }));
  };

  const handleDeleteTableConfirm = async () => {
    if (!pageState.tableToDelete) return;

    setPageState(prev => ({ ...prev, isDeletingTable: pageState.tableToDelete, error: null, deleteAlertDialogOpen: false }));
    const result: DeleteTableResult = await deleteTableAction(encodedDbPath, pageState.tableToDelete);

    if (result.success) {
      fetchTables(); // Refresh table list
    } else {
      setPageState(prev => ({ ...prev, error: result.error || `Failed to delete table ${pageState.tableToDelete}.` }));
    }
    setPageState(prev => ({ ...prev, isDeletingTable: null, tableToDelete: null }));
  };


  if (!encodedDbPath) {
    return <div className="container mx-auto p-4">Error: Database path not specified.</div>;
  }
  const dbName = decodeURIComponent(encodedDbPath);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <header className="space-y-2">
        <Link href="/dashboard/databases" className="text-blue-500 hover:underline text-sm">
          &larr; Back to Databases
        </Link>
        <h1 className="text-3xl font-bold">Table Management for <span className="font-mono bg-gray-100 px-2 py-1 rounded">{dbName}</span></h1>
      </header>

      {pageState.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{pageState.error}</span>
        </div>
      )}
      
      {/* Create Table Dialog Trigger */}
      <Dialog open={pageState.createTableDialogOpen} onOpenChange={(open) => setPageState(prev => ({...prev, createTableDialogOpen: open}))}>
        <DialogTrigger asChild>
          <Button>Create New Table</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create New Table</DialogTitle>
            <DialogDescription>Define the name and columns for your new table.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTableSubmit} className="space-y-4 overflow-y-auto flex-grow pr-2">
            <div>
              <label htmlFor="newTableName" className="block text-sm font-medium mb-1">Table Name</label>
              <Input
                id="newTableName"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="e.g., users"
                disabled={pageState.isCreatingTable}
              />
            </div>
            <h4 className="text-md font-semibold">Columns</h4>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 border rounded-md p-3">
              {columns.map((col, index) => (
                <div key={col.id} className="p-3 border rounded-md space-y-2 bg-slate-50">
                  <div className="flex justify-between items-center">
                     <span className="text-sm font-medium">Column {index + 1}</span>
                     {columns.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveColumn(col.id)} disabled={pageState.isCreatingTable}>
                          Remove
                        </Button>
                      )}
                  </div>
                  <Input
                    placeholder="Column Name (e.g., id, name)"
                    value={col.name}
                    onChange={(e) => handleColumnChange(col.id, 'name', e.target.value)}
                    disabled={pageState.isCreatingTable}
                  />
                  <Select
                    value={col.type}
                    onValueChange={(value) => handleColumnTypeChange(col.id, value)}
                    disabled={pageState.isCreatingTable}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                    <SelectContent>
                      {SQLITE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`pk-${col.id}`}
                        checked={col.primaryKey}
                        onCheckedChange={(checked) => handleColumnChange(col.id, 'primaryKey', !!checked)}
                        disabled={pageState.isCreatingTable}
                      />
                      <label htmlFor={`pk-${col.id}`} className="text-sm">Primary Key</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`nn-${col.id}`}
                        checked={col.notNull}
                        onCheckedChange={(checked) => handleColumnChange(col.id, 'notNull', !!checked)}
                        disabled={pageState.isCreatingTable}
                      />
                      <label htmlFor={`nn-${col.id}`} className="text-sm">Not Null</label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={handleAddColumn} disabled={pageState.isCreatingTable} className="w-full">
              Add Column
            </Button>
          </form>
          <DialogFooter className="mt-auto pt-4 border-t">
            <DialogClose asChild>
                <Button variant="outline" disabled={pageState.isCreatingTable}>Cancel</Button>
            </DialogClose>
            <Button type="submit" form="create-table-form" onClick={handleCreateTableSubmit} disabled={pageState.isCreatingTable}>
              {pageState.isCreatingTable ? 'Creating...' : 'Create Table'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Listing */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Existing Tables</h2>
        {pageState.isLoadingTables ? (
          <p>Loading tables...</p>
        ) : pageState.tables.length === 0 && !pageState.error ? (
          <p>No tables found in this database. Create one above!</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageState.tables.map((tableName) => (
                <TableRow key={tableName}>
                  <TableCell>
                    {/* Future link to table data view:
                    <Link href={`/dashboard/databases/${encodedDbPath}/tables/${tableName}`} className="text-blue-500 hover:underline">
                      {tableName}
                    </Link>
                    */}
                     {tableName} {/* Placeholder until data view exists */}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteConfirmation(tableName)}
                      disabled={!!pageState.isDeletingTable}
                    >
                      {pageState.isDeletingTable === tableName ? 'Deleting...' : 'Delete'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={pageState.deleteAlertDialogOpen} onOpenChange={(open) => setPageState(prev => ({...prev, deleteAlertDialogOpen: open}))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              <span className="font-bold"> {pageState.tableToDelete} </span>
              table and all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!pageState.isDeletingTable}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTableConfirm}
              disabled={!!pageState.isDeletingTable}
              className="bg-destructive hover:bg-destructive/90"
            >
              {pageState.isDeletingTable ? 'Deleting...' : 'Yes, delete table'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
