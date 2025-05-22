"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSchema } from "@/lib/db"; // Assuming TableSchema is exported from lib/db
import { ArrowUpDown, MoreHorizontal, Trash2, Edit } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableProps {
  dbName: string;
  tableName: string;
  schema: TableSchema[];
  data: Record<string, any>[];
  totalRows: number;
  currentPage: number;
  limit: number;
  sortBy: string | null;
  sortOrder: "ASC" | "DESC" | null;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onSortChange: (columnName: string) => void;
  onSearchChange: (searchTerm: string) => void;
  onEditRow: (rowData: Record<string, any>) => void;
  onDeleteRow: (rowData: Record<string, any>) => void;
}

export function DataTable({
  dbName,
  tableName,
  schema,
  data,
  totalRows,
  currentPage,
  limit,
  sortBy,
  sortOrder,
  isLoading,
  onPageChange,
  onSortChange,
  onSearchChange,
  onEditRow,
  onDeleteRow,
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const totalPages = Math.ceil(totalRows / limit);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchChange(searchTerm);
  };
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  const renderPaginationItems = () => {
    const items = [];
    const maxPagesToShow = 5; // Show 2 pages before and after current, plus current, prev, next, first, last
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (currentPage - 1 <= 2) { // if current page is 1, 2, or 3
        endPage = Math.min(totalPages, maxPagesToShow -1); // show up to 4 pages (1,2,3,4) if totalPages allows
    }
    if (totalPages - currentPage <= 2) { // if current page is totalPages, totalPages-1, or totalPages-2
        startPage = Math.max(1, totalPages - maxPagesToShow + 2); // show last up to 4 pages if totalPages allows
    }


    // Always add first page if it's not in the main range
    if (startPage > 1) {
        items.push(
            <PaginationItem key="first">
                <PaginationLink onClick={() => handlePageChange(1)} isActive={currentPage === 1}>1</PaginationLink>
            </PaginationItem>
        );
        if (startPage > 2) {
            items.push(<PaginationEllipsis key="ellipsis-start" />);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink onClick={() => handlePageChange(i)} isActive={i === currentPage}>
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    // Always add last page if it's not in the main range
    if (endPage < totalPages) {
        if (endPage < totalPages -1 ){
            items.push(<PaginationEllipsis key="ellipsis-end" />);
        }
        items.push(
            <PaginationItem key="last">
                <PaginationLink onClick={() => handlePageChange(totalPages)} isActive={currentPage === totalPages}>{totalPages}</PaginationLink>
            </PaginationItem>
        );
    }


    return items;
  };


  const getDisplayValue = (value: any): string => {
    if (value === null || typeof value === 'undefined') return 'NULL';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (value instanceof Buffer) return '[BLOB]'; // Or a more sophisticated representation
    if (typeof value === 'object') return JSON.stringify(value); // For JSON or other objects
    return String(value);
  };

  const tableContainerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } } // Faster fade-in for container
  };

  const rowVariants = {
    hidden: { opacity: 0, y: 5 }, // Smaller y offset for subtlety
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.02, // Faster stagger
        duration: 0.2,
        ease: "easeOut"
      }
    }),
    exit: { opacity: 0, y: -5, transition: { duration: 0.2, ease: "easeIn" } }
  };


  return (
    <motion.div 
      variants={tableContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4 p-1 md:p-4 border rounded-lg shadow-sm bg-background" // Use background, responsive padding
    >
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pb-2">
        <Input
          ref={searchInputRef}
          placeholder="Search (e.g., id:1 or name:%pattern%)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow sm:max-w-xs md:max-w-sm lg:max-w-md h-10 focus-visible:ring-1 focus-visible:ring-ring" // Consistent height
        />
        <div className="flex gap-2">
          <Button type="submit" className="w-full sm:w-auto h-10"> {/* Consistent height */}
            Search
          </Button>
          {searchTerm && (
            <Button variant="outline" onClick={() => { setSearchTerm(""); onSearchChange(""); }} className="w-full sm:w-auto h-10"> {/* Consistent height */}
              Clear
            </Button>
          )}
        </div>
      </form>

      <div className="rounded-md border overflow-x-auto"> 
        <Table className="min-w-full"> {/* Ensure table takes at least full width for overflow */}
          <TableHeader className="bg-muted/40 dark:bg-muted/20">
            <TableRow>
              {schema.map((col) => (
                <TableHead key={col.name} className="px-3 py-2.5 group"> {/* Group for hover effect on icon */}
                  <Button
                    variant="ghost"
                    onClick={() => onSortChange(col.name)}
                    className="px-2 py-1 h-auto hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring transition-colors duration-150 text-xs sm:text-sm"
                  >
                    {col.name}
                    {sortBy === col.name ? (
                      <ArrowUpDown className={`ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-150 ${sortOrder === 'DESC' ? 'rotate-180' : ''}`} />
                    ) : (
                      <ArrowUpDown className="ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-30 group-hover:opacity-100 transition-opacity duration-150" />
                    )}
                  </Button>
                </TableHead>
              ))}
              <TableHead className="px-3 py-2.5 text-center text-xs sm:text-sm">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence initial={false}> {/* For row exit animations if needed */}
              {isLoading ? (
                [...Array(limit)].map((_, i) => (
                  <TableRow key={`skeleton-${i}`} className="hover:bg-muted/20 dark:hover:bg-muted/10 transition-colors duration-100">
                    {schema.map((col) => (
                      <TableCell key={`${col.name}-skeleton-${i}`} className="px-3 py-2">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                    <TableCell key={`actions-skeleton-${i}`} className="px-3 py-2 text-center">
                      <Skeleton className="h-8 w-16 mx-auto" /> {/* Adjusted width */}
                    </TableCell>
                  </TableRow>
                ))
              ) : data.length > 0 ? (
                data.map((row, rowIndex) => (
                  <motion.tr 
                    key={`row-${rowIndex}-${JSON.stringify(row)}`} // More unique key for animations if row data can change
                    custom={rowIndex}
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout // Animate layout changes
                    className="hover:bg-muted/20 dark:hover:bg-muted/10 transition-colors duration-100 text-xs sm:text-sm"
                  >
                    {schema.map((col) => (
                      <TableCell key={`${col.name}-${rowIndex}`} className="px-3 py-2 max-w-[150px] sm:max-w-xs truncate" title={getDisplayValue(row[col.name])}>
                        {getDisplayValue(row[col.name])}
                      </TableCell>
                    ))}
                    <TableCell className="px-3 py-2 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 p-0 focus-visible:ring-1 focus-visible:ring-ring">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background border shadow-lg rounded-md">
                          <DropdownMenuLabel className="text-xs px-2 py-1.5">Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onEditRow(row)} className="hover:bg-muted focus:bg-muted cursor-pointer text-xs sm:text-sm px-2 py-1.5">
                            <Edit className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onDeleteRow(row)} className="text-destructive hover:!text-destructive focus:!text-destructive hover:!bg-destructive/10 focus:!bg-destructive/10 cursor-pointer text-xs sm:text-sm px-2 py-1.5">
                            <Trash2 className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={schema.length + 1} className="h-24 text-center text-muted-foreground text-sm">
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
         <Pagination className="pt-3">
            <PaginationContent className="flex flex-wrap justify-center gap-1 sm:gap-2">
                <PaginationItem>
                    <PaginationPrevious
                      onClick={() => handlePageChange(currentPage - 1)}
                      // @ts-ignore 
                      disabled={currentPage === 1}
                      className={`h-9 w-9 sm:h-10 sm:w-10 ${currentPage === 1 ? "cursor-not-allowed opacity-60" : "hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring"}`}
                    />
                </PaginationItem>
                {renderPaginationItems()}
                <PaginationItem>
                    <PaginationNext
                      onClick={() => handlePageChange(currentPage + 1)}
                      // @ts-ignore 
                      disabled={currentPage === totalPages}
                      className={`h-9 w-9 sm:h-10 sm:w-10 ${currentPage === totalPages ? "cursor-not-allowed opacity-60" : "hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring"}`}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
      )}
      <div className="text-xs text-muted-foreground pt-2 text-center sm:text-right">
        Showing {isLoading || data.length === 0 ? 0 : ((currentPage - 1) * limit + 1).toLocaleString()}-
        {Math.min(currentPage * limit, totalRows).toLocaleString()} of {totalRows.toLocaleString()} rows.
      </div>
    </motion.div>
  );
}
