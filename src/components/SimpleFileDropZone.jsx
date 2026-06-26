import React, { useState, useRef } from "react";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SimpleFileDropZone({ onFileSelect, error, validationSuccess, title, description, file }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="w-full h-full flex">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls"
        style={{ display: "none" }}
      />
      
      <div
        className={`w-full flex-1 border-2 border-dashed rounded-lg cursor-pointer flex flex-col items-center justify-center p-8 text-center transition-colors bg-white
          ${isDragging 
            ? "border-[#1a73e8] bg-[#e8f0fe]" 
            : file 
              ? "border-[#34a853] bg-[#f8f9fa]"
              : "border-[#dadce0] hover:border-[#1a73e8] hover:bg-[#f8f9fa]"
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <div className="mb-4">
          <Upload size={36} className={isDragging ? "text-[#1a73e8]" : file ? "text-[#34a853]" : "text-[#5f6368]"} strokeWidth={1.5} />
        </div>

        <h3 className="text-lg font-medium mb-1 text-[#202124]">
          {file ? file.name : title}
        </h3>
        
        <p className="text-sm text-[#5f6368] mb-4">
          {file ? "Click or drag to replace" : (description || "Select a file from your device or drag and drop it here")}
        </p>

        {!file && (
          <div className="flex items-center justify-center gap-4">
            <span className="text-xs font-medium text-[#5f6368] bg-[#f1f3f4] px-2 py-1 rounded">.XLSX</span>
            <span className="text-xs font-medium text-[#5f6368] bg-[#f1f3f4] px-2 py-1 rounded">.XLS</span>
          </div>
        )}

        <div className="flex flex-col gap-2 w-full max-w-sm items-center mt-4">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 p-2 rounded bg-[#fce8e6] text-[#c5221f] text-left text-xs w-full"
              >
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {validationSuccess && !error && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 p-2 rounded bg-[#e6f4ea] text-[#137333] text-left text-xs w-full"
              >
                <CheckCircle size={16} className="shrink-0" />
                <span>File loaded successfully.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
