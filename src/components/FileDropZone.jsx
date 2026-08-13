import React, { useState, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FileDropZone({ onFileSelect, error, validationSuccess, requiredHeaders = ["BRANCH NAME", "BILL DATE", "NET SALE AMOUNT"] }) {
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
        className={`w-full border-2 border-dashed rounded-2xl cursor-pointer flex flex-col items-center justify-center p-12 text-center transition-all duration-300 backdrop-blur-[28px] backdrop-saturate-[120%] shadow-[0_8px_32px_rgba(0,0,0,0.04)]
          ${isDragging 
            ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30/50 scale-[1.02]" 
            : "border-white/80 hover:border-blue-400 bg-white/60 dark:bg-slate-800/60 hover:bg-white/70"
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <div className="mb-4 icon-upload cursor-pointer inline-block">
          <Upload size={48} className={isDragging ? "text-[#1a73e8]" : "text-[#5f6368] dark:text-gray-300"} strokeWidth={1.5} />
        </div>

        <h3 className="text-xl font-normal mb-2 text-[#202124] dark:text-white">
          Select a file from your device
        </h3>
        
        <p className="text-sm text-[#5f6368] dark:text-gray-300 mb-6">
          or drag and drop it here
        </p>
        
        <div className="flex items-center justify-center gap-4 mb-2">
          <span className="text-xs font-medium text-[#5f6368] dark:text-gray-300 bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] px-2 py-1 rounded">.XLSX</span>
          <span className="text-xs font-medium text-[#5f6368] dark:text-gray-300 bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] px-2 py-1 rounded">.XLS</span>
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
        {requiredHeaders.map((header, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs text-[#5f6368] dark:text-gray-300">
            <CheckCircle size={16} className="text-[#34a853]" />
            <span>"{header}"</span>
          </div>
        ))}
      </div>
    </div>
  );
}
