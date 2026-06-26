import React, { useState, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FileDropZone({ onFileSelect, error, validationSuccess }) {
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
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls"
        style={{ display: "none" }}
      />
      
      <div
        className={`w-full border-2 border-dashed rounded-lg cursor-pointer flex flex-col items-center justify-center p-12 text-center transition-colors bg-white
          ${isDragging 
            ? "border-[#1a73e8] bg-[#e8f0fe]" 
            : "border-[#dadce0] hover:border-[#1a73e8] hover:bg-[#f8f9fa]"
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <div className="mb-4">
          <Upload size={48} className={isDragging ? "text-[#1a73e8]" : "text-[#5f6368]"} strokeWidth={1.5} />
        </div>

        <h3 className="text-xl font-normal mb-2 text-[#202124]">
          Select a file from your device
        </h3>
        
        <p className="text-sm text-[#5f6368] mb-6">
          or drag and drop it here
        </p>
        
        <div className="flex items-center justify-center gap-4 mb-2">
          <span className="text-xs font-medium text-[#5f6368] bg-[#f1f3f4] px-2 py-1 rounded">.XLSX</span>
          <span className="text-xs font-medium text-[#5f6368] bg-[#f1f3f4] px-2 py-1 rounded">.XLS</span>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-md items-center mt-6">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 p-3 rounded bg-[#fce8e6] text-[#c5221f] text-left text-sm w-full"
              >
                <AlertCircle size={20} className="shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {validationSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 p-3 rounded bg-[#e6f4ea] text-[#137333] text-left text-sm w-full"
              >
                <CheckCircle size={20} className="shrink-0" />
                <span>Validation successful. Loading...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Requirement Badges */}
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-[#5f6368]">
          <CheckCircle size={16} className="text-[#34a853]" />
          <span>"BRANCH NAME"</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#5f6368]">
          <CheckCircle size={16} className="text-[#34a853]" />
          <span>"BILL DATE"</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#5f6368]">
          <CheckCircle size={16} className="text-[#34a853]" />
          <span>"NET SALE AMOUNT"</span>
        </div>
      </div>
    </div>
  );
}
