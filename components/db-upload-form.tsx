"use client";

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DbUploadFormProps {
  onUploadSuccess: (filePath: string, fileName: string) => void;
  setIsLoading?: (isLoading: boolean) => void; // Optional: to control a global loading state
}

export function DbUploadForm({ onUploadSuccess, setIsLoading }: DbUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref to reset file input

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFile = event.target.files[0];
      // Basic file type check (client-side)
      if (!selectedFile.name.endsWith('.db') && !selectedFile.name.endsWith('.sqlite') && !selectedFile.name.endsWith('.sqlite3')) {
        toast.error("Invalid file type. Please select an SQLite database file (.db, .sqlite, .sqlite3).");
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Reset the file input
        }
        setFile(null);
        return;
      }
      setFile(selectedFile);
    } else {
      setFile(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      toast.error("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    if (setIsLoading) setIsLoading(true);
    const formData = new FormData();
    formData.append('dbfile', file);

    try {
      const response = await fetch('/api/db/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || "File uploaded successfully!");
        onUploadSuccess(result.filePath, result.fileName);
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; // Reset the file input
        }
        setFile(null);
      } else {
        toast.error(result.error || "File upload failed.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("An unexpected error occurred during upload.");
    } finally {
      setIsUploading(false);
      if (setIsLoading) setIsLoading(false);
    }
  };

  return (
    <motion.form 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onSubmit={handleSubmit} 
      className="space-y-4 p-1" // Added small padding for visual separation if needed
    >
      <div>
        <label htmlFor="dbfile-input" className="block text-sm font-medium text-foreground/80 mb-1">
          Upload SQLite Database
        </label>
        <Input
          id="dbfile-input"
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isUploading}
          className="w-full file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          accept=".db,.sqlite,.sqlite3"
        />
        {file && <p className="mt-2 text-xs text-muted-foreground">Selected: {file.name}</p>}
      </div>
      <motion.div // Added motion.div for button tap animation
          whileTap={{ scale: 0.97 }}
          className="w-full sm:w-auto"
      >
        <Button 
          type="submit" 
          disabled={isUploading || !file} 
          className="w-full transition-all duration-150 ease-in-out" // Ensure button itself is full width if container is w-auto
        >
          {isUploading ? 'Uploading...' : 'Upload Database'}
        </Button>
      </motion.div>
    </motion.form>
  );
}
