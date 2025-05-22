"use client";

import { Button } from "@/components/ui/button";
import { motion } from 'framer-motion';

interface TableListProps {
  dbName: string | null;
  tables: string[];
  selectedTable: string | null;
  onTableSelect: (tableName: string) => void;
  isLoadingTables?: boolean; // Optional: to show a loading state for tables
}

export function TableList({ dbName, tables, selectedTable, onTableSelect, isLoadingTables }: TableListProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05, // Stagger effect for list items
        duration: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  };

  if (!dbName) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 text-sm text-muted-foreground"
      >
        Please upload a database to see its tables.
      </motion.div>
    );
  }

  if (isLoadingTables) {
    return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 space-y-2"
        >
            <p className="text-sm text-foreground/80">Loading tables for {dbName}...</p>
            {[...Array(3)].map((_, i) => (
                 <div key={i} className="h-9 bg-muted rounded animate-pulse"></div> // Adjusted height for better visual
            ))}
        </motion.div>
    );
  }

  if (tables.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4"
      >
        <p className="text-sm font-semibold text-foreground mb-2">Database: {dbName}</p>
        <p className="text-sm text-muted-foreground">No tables found in this database.</p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="p-4 space-y-3" // Increased spacing slightly
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.h3 variants={itemVariants} className="text-lg font-semibold tracking-tight text-foreground">
        Database: {dbName}
      </motion.h3>
      <motion.p variants={itemVariants} className="text-xs text-muted-foreground mb-2">Tables:</motion.p>
      <motion.nav variants={itemVariants} className="space-y-1.5"> {/* Increased spacing for nav items */}
        {tables.map((table) => (
          <motion.div key={table} variants={itemVariants}>
            <Button
              variant={table === selectedTable ? "secondary" : "ghost"}
              className="w-full justify-start text-left h-auto py-2.5 px-3.5 text-sm transition-colors duration-150 ease-in-out focus-visible:ring-1 focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground" // Enhanced styling
              onClick={() => onTableSelect(table)}
              // Framer motion button animations can be added directly to Button if it's a motion component
              // or wrapped like this. Since Button is likely not a motion component by default:
              // whileHover={{ scale: 1.02 }} // This needs the Button to be a motion component or this div to be clickable
              // whileTap={{ scale: 0.98 }}
            >
              {table}
            </Button>
          </motion.div>
        ))}
      </motion.nav>
    </motion.div>
  );
}
