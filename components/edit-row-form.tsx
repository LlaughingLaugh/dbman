"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { TableSchema } from "@/lib/db";
import { toast } from "sonner";

interface EditRowFormProps {
  schema: TableSchema[];
  initialData?: Record<string, any> | null; // null for insert, object for edit
  tableName: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (formData: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
  dbName: string; // For context in UI, if needed
}

export function EditRowForm({
  schema,
  initialData,
  tableName,
  isOpen,
  onOpenChange,
  onSubmit,
  dbName,
}: EditRowFormProps) {
  const [formData, setFormData] = React.useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (initialData) {
      // For TEXT, REAL, INTEGER types, convert nulls from DB to empty strings for input fields
      // For BOOLEAN (INTEGER 0/1), convert to boolean
      const processedData: Record<string, any> = {};
      schema.forEach(col => {
        const value = initialData[col.name];
        if (value === null && (col.type.toUpperCase().includes('TEXT') || col.type.toUpperCase().includes('VARCHAR') || col.type.toUpperCase().includes('CHAR'))) {
          processedData[col.name] = '';
        } else if (col.type.toUpperCase() === 'BOOLEAN' || (col.type.toUpperCase() === 'INTEGER' && (value === 0 || value === 1))) {
          processedData[col.name] = Boolean(value);
        } else if (value === null && col.type.toUpperCase().includes('INT')) { // For INTEGER/NUMERIC types that are not boolean
            processedData[col.name] = ''; // Or handle as needed, e.g. allow them to submit null if field is nullable
        }
        else {
          processedData[col.name] = value;
        }
      });
      setFormData(processedData);
    } else {
      // For insert, initialize with empty strings or default values based on schema
      const defaultData: Record<string, any> = {};
      schema.forEach(col => {
        if (col.type.toUpperCase() === 'BOOLEAN' || (col.type.toUpperCase() === 'INTEGER' && !col.pk)) { // Default booleans to false
          defaultData[col.name] = false;
        } else {
          defaultData[col.name] = ''; // Default other types to empty string
        }
      });
      setFormData(defaultData);
    }
  }, [initialData, schema, isOpen]); // Re-initialize form when initialData or isOpen changes

  const handleChange = (name: string, value: any, type: string) => {
    if (type.toUpperCase() === 'BOOLEAN' || (type.toUpperCase() === 'INTEGER' && (value === true || value === false))) {
        setFormData((prev) => ({ ...prev, [name]: value }));
    } else if (type.toUpperCase().includes('INT')) { // For actual integer types
        // Allow empty string for optional integers, otherwise parse
        if (value === '' || value === null) {
            setFormData((prev) => ({ ...prev, [name]: null })); // Send null if empty and nullable
        } else {
            const intVal = parseInt(value, 10);
            setFormData((prev) => ({ ...prev, [name]: isNaN(intVal) ? null : intVal }));
        }
    } else if (type.toUpperCase() === 'REAL' || type.toUpperCase() === 'FLOAT' || type.toUpperCase() === 'DOUBLE') {
        if (value === '' || value === null) {
            setFormData((prev) => ({ ...prev, [name]: null }));
        } else {
            const floatVal = parseFloat(value);
            setFormData((prev) => ({ ...prev, [name]: isNaN(floatVal) ? null : floatVal }));
        }
    }
    else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const getColumnInputType = (columnType: string): string => {
    const upperType = columnType.toUpperCase();
    if (upperType.includes("INT")) return "number";
    if (upperType.includes("REAL") || upperType.includes("FLOAT") || upperType.includes("DOUBLE")) return "number";
    if (upperType.includes("DATE") && !upperType.includes("DATETIME")) return "date";
    if (upperType.includes("DATETIME") || upperType.includes("TIMESTAMP")) return "datetime-local";
    // Consider 'TEXT', 'VARCHAR', 'CHAR' etc. as 'text'
    // BLOB could be 'textarea' or a special file input in future
    return "text";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    // Prepare data for submission: convert boolean back to 0/1 if schema is INTEGER for booleans
    const dataToSubmit = { ...formData };
    schema.forEach(col => {
        if (col.type.toUpperCase() === 'INTEGER' && typeof formData[col.name] === 'boolean') {
            dataToSubmit[col.name] = formData[col.name] ? 1 : 0;
        }
        // Ensure empty strings for nullable non-boolean fields are sent as null
        if (formData[col.name] === '' && !col.notnull && col.type.toUpperCase() !== 'BOOLEAN' && !col.pk) {
             if (col.type.toUpperCase().includes('TEXT') || col.type.toUpperCase().includes('VARCHAR') || col.type.toUpperCase().includes('CHAR') || col.type.toUpperCase().includes('BLOB')) {
                // For text based types, empty string might be valid. Or send NULL based on preference.
                // For now, let's assume empty string is fine for text types if not explicitly NULL.
                // If strict NULL is required for empty strings: dataToSubmit[col.name] = null;
             } else {
                 dataToSubmit[col.name] = null; // For numbers, dates etc.
             }
        }
    });


    const result = await onSubmit(dataToSubmit);
    setIsSubmitting(false);

    if (result.success) {
      toast.success(initialData ? "Row updated successfully!" : "Row inserted successfully!");
      onOpenChange(false); // Close dialog on success
    } else {
      toast.error(result.error || "An unknown error occurred.");
    }
  };

  const pkColumn = schema.find(col => col.pk);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] md:max-w-[600px] lg:max-w-[800px] max-h-[90vh] flex flex-col bg-background border shadow-xl rounded-lg">
        <DialogHeader className="px-6 py-4 border-b rounded-t-lg">
          <DialogTitle className="text-xl font-semibold">
            {initialData ? `Edit Row in ${tableName}` : `Insert New Row into ${tableName}`}
          </DialogTitle>
          {dbName && <DialogDescription className="text-sm text-muted-foreground">Database: {dbName}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto px-6 py-4 space-y-5"> {/* Increased gap with space-y-5 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4"> {/* Consistent gap */}
            {schema.map((col) => (
              <div key={col.name} className="space-y-1.5">
                <Label htmlFor={col.name} className="flex items-center text-sm font-medium text-foreground/90">
                  {col.name}
                  <span className="text-xs text-muted-foreground ml-2">({col.type.toLowerCase()})</span>
                  {col.pk && <span className="text-xs text-sky-600 dark:text-sky-400 ml-1.5 font-semibold">[PK]</span>}
                  {col.notnull && !col.pk && <span className="text-xs text-destructive ml-1.5 font-semibold">*</span>}
                </Label>
                {col.type.toUpperCase() === "BOOLEAN" || (col.type.toUpperCase() === 'INTEGER' && (typeof formData[col.name] === 'boolean' || (initialData && (initialData[col.name] === 0 || initialData[col.name] === 1)))) ? (
                  <div className={`flex items-center space-x-2.5 h-10 border rounded-md px-3 ${ (col.pk && !!initialData) || isSubmitting ? 'bg-muted/50 opacity-70 cursor-not-allowed' : 'bg-input/40 hover:bg-input/60'}`}>
                    <Checkbox
                      id={col.name}
                      checked={Boolean(formData[col.name])}
                      onCheckedChange={(checked) => handleChange(col.name, checked, col.type)}
                      disabled={(col.pk && !!initialData) || isSubmitting}
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:ring-1 focus-visible:ring-ring"
                    />
                     <Label htmlFor={col.name} className="text-sm font-normal text-muted-foreground">
                        {Boolean(formData[col.name]) ? "True" : "False"}
                    </Label>
                  </div>
                ) : col.type.toUpperCase().includes("TEXT") || col.type.toUpperCase().includes("BLOB") ? (
                  <Textarea
                    id={col.name}
                    value={formData[col.name] === null || typeof formData[col.name] === 'undefined' ? "" : formData[col.name]}
                    onChange={(e) => handleChange(col.name, e.target.value, col.type)}
                    placeholder={`${col.name} (${col.type.toLowerCase()})${col.notnull && !col.pk ? ' (required)' : ''}`}
                    disabled={(col.pk && !!initialData) || isSubmitting}
                    rows={col.type.toUpperCase().includes("BLOB") ? 5 : 3} // Consistent rows
                    className="focus-visible:ring-1 focus-visible:ring-ring data-[disabled]:opacity-70 data-[disabled]:cursor-not-allowed resize-y min-h-[60px]" // Allow vertical resize
                  />
                ) : (
                  <Input
                    id={col.name}
                    type={getColumnInputType(col.type)}
                    value={formData[col.name] === null || typeof formData[col.name] === 'undefined' ? "" : formData[col.name]}
                    onChange={(e) => handleChange(col.name, e.target.value, col.type)}
                    placeholder={`${col.name} (${col.type.toLowerCase()})${col.notnull && !col.pk ? ' (required)' : ''}`}
                    disabled={(col.pk && !!initialData) || isSubmitting}
                    step={getColumnInputType(col.type) === "number" && (col.type.toUpperCase().includes("REAL") || col.type.toUpperCase().includes("FLOAT") || col.type.toUpperCase().includes("DOUBLE")) ? "any" : undefined}
                    className="h-10 focus-visible:ring-1 focus-visible:ring-ring data-[disabled]:opacity-70 data-[disabled]:cursor-not-allowed" // Consistent height
                  />
                )}
                 {col.name === pkColumn?.name && initialData && (
                     <p className="text-xs text-muted-foreground italic">Primary key cannot be edited.</p>
                 )}
              </div>
            ))}
          </div>
          <DialogFooter className="px-6 py-3 border-t mt-auto bg-muted/30 dark:bg-muted/20 rounded-b-lg"> {/* Subtle background for footer */}
            <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="transition-colors duration-150">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px] transition-all duration-150 ease-in-out active:scale-95">
              {isSubmitting ? (initialData ? 'Saving...' : 'Inserting...') : (initialData ? 'Save Changes' : 'Insert Row')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
