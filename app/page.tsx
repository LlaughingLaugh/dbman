"use client";

"use client"; // This should be at the very top

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion"; // Import motion

import { TableSchema } from "@/lib/db";
import { DbUploadForm } from "@/components/db-upload-form";
import { TableList } from "@/components/table-list";
import { DataTable } from "@/components/data-table";
import { EditRowForm } from "@/components/edit-row-form";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function Home() {
  // State Management
  const [currentDbName, setCurrentDbName] = useState<string | null>(null);
  const [currentDbPath, setCurrentDbPath] = useState<string | null>(null); // Not directly used in fetching, but good to have
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSchema, setTableSchema] = useState<TableSchema[]>([]);
  const [tableData, setTableData] = useState<Record<string, any>[]>([]);

  const [isLoadingDbUpload, setIsLoadingDbUpload] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRowData, setEditingRowData] = useState<Record<string, any> | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10); // Default limit
  const [totalRows, setTotalRows] = useState(0);

  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC" | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Data Fetching and Callbacks
  const fetchDataForTable = useCallback(async (
    dbName: string | null,
    tableName: string | null,
    page: number,
    currentLimit: number,
    currentSortBy: string | null,
    currentSortOrder: "ASC" | "DESC" | null,
    currentSearchTerm: string
  ) => {
    if (!dbName || !tableName) return;

    setIsLoadingData(true);
    let queryParams = `page=${page}&limit=${currentLimit}`;
    if (currentSortBy) queryParams += `&sortBy=${currentSortBy}`;
    if (currentSortOrder) queryParams += `&sortOrder=${currentSortOrder}`;
    
    // Basic search term handling: if it contains ':', assume column-specific search
    // e.g., "name:%John%" or "id:123"
    // Otherwise, treat as a general filter across all (or predefined) columns (API needs to support this)
    // For this implementation, we'll pass it as a single 'filter' param if it's not column-specific
    // Or multiple filter_column=value if it is.
    // The current API expects filter_columnName=value.
    // We will adapt the search term here or expect the user to format it correctly.
    // For simplicity, if searchTerm has ':', we parse it. Otherwise, it's not directly used unless API supports general search.
    // The DataTable component current search provides a single string.
    // We'll assume for now the API handles a single 'q' parameter for general search, or user types "column:value"
    
    if (currentSearchTerm) {
        // Example: if API expects q=searchTerm for general search
        // queryParams += `&q=${encodeURIComponent(currentSearchTerm)}`;
        // If API expects filter_col=val and search term is "col:val"
        const parts = currentSearchTerm.split(':');
        if (parts.length === 2 && parts[0] && parts[1]) {
            queryParams += `&filter_${encodeURIComponent(parts[0])}=${encodeURIComponent(parts[1])}`;
        } else if (parts.length === 1 && parts[0]) {
            // If API supports a general search query param 'q'
             queryParams += `&q=${encodeURIComponent(currentSearchTerm)}`;
             // Or, if no general search, this might do nothing or filter by a default field
             // For now, let's assume a single `filter_` param if not column specific (API needs to handle this)
             // toast.info("For column-specific search, use format: column_name:search_value");
        }
         // If the backend /lib/db.ts fetchTableData expects options.filters = { col: val }
         // We'd need to parse searchTerm more robustly here if not already "col:val"
         // For now, the data-table search just passes the raw string.
         // The API route for data fetching already tries to parse filter_
         // So, if searchTerm is "name:John", it should be passed as &filter_name=John
         // The current DataTable searchInput passes the whole string as `searchTerm`.
         // We need to adapt this in `handleSearchChange` or here.
         // Let's assume `handleSearchChange` sets a more structured search term or the API is flexible.
         // The current GET /data API expects filter_column=value.
         // The DataTable search passes the whole string. We'll use that for a generic filter if possible,
         // or instruct user. For now, let's assume the API's `filter_` params are what we need to construct.
         // If searchTerm is like "column:value", we use it.
         if (currentSearchTerm.includes(':')) {
            const [key, ...valParts] = currentSearchTerm.split(':');
            const value = valParts.join(':');
            if (key && value) {
                 queryParams += `&filter_${encodeURIComponent(key.trim())}=${encodeURIComponent(value.trim())}`;
            }
         } else if (currentSearchTerm) {
            // If no specific column, maybe a general search query `q`?
            // queryParams += `&q=${encodeURIComponent(currentSearchTerm)}`;
            // For now, we'll not add a general 'q' unless the API supports it explicitly.
            // The user would need to use column:value for effective filtering.
         }
    }


    try {
      const response = await fetch(`/api/db/${dbName}/tables/${tableName}/data?${queryParams}`);
      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || `Failed to fetch data for ${tableName}`);
      }
      const result = await response.json();
      setTableData(result.data || []);
      setTotalRows(result.totalRows || 0);
      setCurrentPage(result.currentPage || page); // Ensure currentPage from response is used
    } catch (error) {
      console.error("Error fetching table data:", error);
      toast.error(error instanceof Error ? error.message : String(error));
      setTableData([]); // Clear data on error
      setTotalRows(0);
    } finally {
      setIsLoadingData(false);
    }
  }, []); // No dependencies, as all params are passed in

  const handleUploadSuccess = async (uploadedFilePath: string, uploadedFileName: string) => {
    setCurrentDbPath(uploadedFilePath); // This is server path, mostly for reference
    setCurrentDbName(uploadedFileName);
    setSelectedTable(null);
    setTables([]);
    setTableSchema([]);
    setTableData([]);
    setCurrentPage(1);
    setTotalRows(0);
    setSortBy(null);
    setSortOrder(null);
    setSearchTerm("");

    setIsLoadingTables(true);
    try {
      const response = await fetch(`/api/db/${uploadedFileName}/tables`);
      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || "Failed to fetch tables");
      }
      const result = await response.json();
      setTables(result.tables || []);
      toast.success(`Database '${uploadedFileName}' loaded. Found ${result.tables?.length || 0} tables.`);
    } catch (error) {
      console.error("Error fetching tables:", error);
      toast.error(error instanceof Error ? error.message : String(error));
      setCurrentDbName(null); // Reset if tables can't be loaded
    } finally {
      setIsLoadingTables(false);
    }
  };

  const handleTableSelect = useCallback(async (tableName: string) => {
    setSelectedTable(tableName);
    setCurrentPage(1); // Reset to first page
    setSortBy(null);    // Reset sort
    setSortOrder(null);
    setSearchTerm("");  // Reset search
    setTableData([]);   // Clear previous data

    setIsLoadingSchema(true);
    setIsLoadingData(true); // For initial data load for the new table

    try {
      const schemaResponse = await fetch(`/api/db/${currentDbName}/tables/${tableName}/schema`);
      if (!schemaResponse.ok) {
        const errorResult = await schemaResponse.json();
        throw new Error(errorResult.error || `Failed to fetch schema for ${tableName}`);
      }
      const schemaResult = await schemaResponse.json();
      setTableSchema(schemaResult.schema || []);
      setIsLoadingSchema(false);
      
      // Initial data fetch for the selected table
      await fetchDataForTable(currentDbName, tableName, 1, limit, null, null, "");

    } catch (error) {
      console.error("Error selecting table:", error);
      toast.error(error instanceof Error ? error.message : String(error));
      setSelectedTable(null); // Reset on error
      setTableSchema([]);
      setIsLoadingSchema(false);
      setIsLoadingData(false);
    }
  }, [currentDbName, limit, fetchDataForTable]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleSortChange = (columnName: string) => {
    if (sortBy === columnName) {
      setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC");
    } else {
      setSortBy(columnName);
      setSortOrder("ASC");
    }
    setCurrentPage(1); // Reset to first page on sort change
  };
  
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    setCurrentPage(1); // Reset to first page on new search
  };

  const handleOpenModalForEdit = (rowData: Record<string, any>) => {
    setEditingRowData(rowData);
    setIsModalOpen(true);
  };

  const handleOpenModalForInsert = () => {
    setEditingRowData(null); // Null for new row
    setIsModalOpen(true);
  };

  const handleDeleteRow = async (rowData: Record<string, any>) => {
    if (!currentDbName || !selectedTable || !tableSchema) return;

    const pkColumn = tableSchema.find(col => col.pk);
    if (!pkColumn) {
      toast.error("Primary key not found for this table. Deletion failed.");
      return;
    }
    const rowId = rowData[pkColumn.name];
    if (typeof rowId === 'undefined' || rowId === null) {
        toast.error("Primary key value is missing. Deletion failed.");
        return;
    }

    if (confirm(`Are you sure you want to delete this row? (ID: ${rowId})`)) {
      try {
        const response = await fetch(`/api/db/${currentDbName}/tables/${selectedTable}/data/${encodeURIComponent(String(rowId))}`, {
          method: 'DELETE',
        });
        const result = await response.json();
        if (response.ok) {
          toast.success(result.message || "Row deleted successfully!");
          // Refetch data for the current table and page
          fetchDataForTable(currentDbName, selectedTable, currentPage, limit, sortBy, sortOrder, searchTerm);
        } else {
          throw new Error(result.error || "Failed to delete row.");
        }
      } catch (error) {
        console.error("Error deleting row:", error);
        toast.error(error instanceof Error ? error.message : String(error));
      }
    }
  };

  const handleModalSubmit = async (formData: Record<string, any>): Promise<{ success: boolean; error?: string }> => {
    if (!currentDbName || !selectedTable || !tableSchema) {
      return { success: false, error: "Database or table not selected." };
    }

    let response;
    let url;
    let method: 'POST' | 'PUT';

    if (editingRowData) { // Update
      const pkColumn = tableSchema.find(col => col.pk);
      if (!pkColumn) return { success: false, error: "Primary key not found for update." };
      const rowId = editingRowData[pkColumn.name];
      if (typeof rowId === 'undefined' || rowId === null) return { success: false, error: "Primary key value missing for update."};

      url = `/api/db/${currentDbName}/tables/${selectedTable}/data/${encodeURIComponent(String(rowId))}`;
      method = 'PUT';
    } else { // Insert
      url = `/api/db/${currentDbName}/tables/${selectedTable}/data`;
      method = 'POST';
    }

    try {
      response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (response.ok) {
        // Refetch data for the current table and page
        // If it's an insert, ideally go to the page where the new row is, but that's complex.
        // For now, just refetch current view or go to first page.
        fetchDataForTable(currentDbName, selectedTable, editingRowData ? currentPage : 1, limit, sortBy, sortOrder, searchTerm);
        return { success: true };
      } else {
        return { success: false, error: result.error || `Failed to ${editingRowData ? 'update' : 'insert'} row.` };
      }
    } catch (error) {
      console.error(`Error ${method === 'POST' ? 'inserting' : 'updating'} row:`, error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };

  // Effect for data fetching when relevant states change
  useEffect(() => {
    if (currentDbName && selectedTable) {
      fetchDataForTable(currentDbName, selectedTable, currentPage, limit, sortBy, sortOrder, searchTerm);
    }
  }, [currentDbName, selectedTable, currentPage, limit, sortBy, sortOrder, searchTerm, fetchDataForTable]);


  const mainVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: "easeIn" } }
  };

  return (
    <div className="flex flex-col sm:flex-row h-screen bg-background text-foreground antialiased">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: "-100%", opacity: 0 }}
        animate={{ x: "0%", opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="w-full sm:w-1/4 sm:min-w-[300px] sm:max-w-[380px] bg-card/60 dark:bg-card/30 p-4 border-r border-border/60 overflow-y-auto shadow-md sm:h-screen"
      >
        <div className="space-y-6 py-2">
          <DbUploadForm 
            onUploadSuccess={handleUploadSuccess} 
            setIsLoading={setIsLoadingDbUpload} 
          />
          <AnimatePresence>
            {currentDbName && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <TableList
                  dbName={currentDbName}
                  tables={tables}
                  selectedTable={selectedTable}
                  onTableSelect={handleTableSelect}
                  isLoadingTables={isLoadingTables || isLoadingDbUpload}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 p-3 sm:p-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {isLoadingDbUpload && (
              <motion.div key="db-loading" {...mainVariants} className="flex flex-col justify-center items-center h-full text-center">
                  <svg className="animate-spin h-10 w-10 text-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-xl text-muted-foreground">Processing database...</p>
              </motion.div>
          )}
          {!isLoadingDbUpload && !currentDbName && (
               <motion.div key="welcome" {...mainVariants} className="flex flex-col justify-center items-center h-full text-center p-4">
                  <Image src="/globe.svg" alt="Database Globe" width={100} height={100} className="mb-6 opacity-60 dark:invert filter dark:brightness-150"/>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-foreground/90 mb-3">Welcome to DB Explorer</h2>
                  <p className="text-base sm:text-lg text-muted-foreground max-w-md">
                    Upload an SQLite database file using the form on the left to explore its contents.
                  </p>
              </motion.div>
          )}
          {!isLoadingDbUpload && currentDbName && !selectedTable && (
            <motion.div key="db-loaded" {...mainVariants} className="flex flex-col justify-center items-center h-full text-center p-4">
              <Image src="/file.svg" alt="Table Icon" width={80} height={80} className="mb-6 opacity-60 dark:invert filter dark:brightness-150"/>
              <h2 className="text-xl sm:text-2xl font-medium text-foreground/80 mb-3">Database <span className="font-semibold text-primary">{currentDbName}</span> Loaded</h2>
              <p className="text-base text-muted-foreground">Select a table from the sidebar to view and manage its data.</p>
            </motion.div>
          )}
          
          {selectedTable && (
            <motion.div key={selectedTable} {...mainVariants} className="space-y-4"> {/* Key change for table transition */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-semibold text-foreground/90">
                  Table: <span className="text-primary">{selectedTable}</span>
                </h2>
                <Button onClick={handleOpenModalForInsert} variant="outline" className="w-full sm:w-auto transition-transform active:scale-95">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add New Row
                </Button>
              </div>
              <DataTable
                dbName={currentDbName!}
                tableName={selectedTable}
                schema={tableSchema}
                data={tableData}
                totalRows={totalRows}
                currentPage={currentPage}
                limit={limit}
                sortBy={sortBy}
                sortOrder={sortOrder}
                isLoading={isLoadingData || isLoadingSchema}
                onPageChange={handlePageChange}
                onSortChange={handleSortChange}
                onSearchChange={handleSearchChange}
                onEditRow={handleOpenModalForEdit}
                onDeleteRow={handleDeleteRow}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal for Insert/Edit - AnimatePresence can control modal open/close if Dialog itself doesn't use it */}
      <AnimatePresence>
        {isModalOpen && tableSchema.length > 0 && ( 
          <EditRowForm
            key="edit-row-form-modal" // Add key for AnimatePresence
            schema={tableSchema}
            initialData={editingRowData}
            tableName={selectedTable!}
            isOpen={isModalOpen}
            onOpenChange={setIsModalOpen}
            onSubmit={handleModalSubmit}
            dbName={currentDbName!}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
