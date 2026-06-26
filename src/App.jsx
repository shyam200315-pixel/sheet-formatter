import React, { useState } from "react";
import * as XLSX from "xlsx";
import { findHeaderRowIndex, getTargetDate, parseBillDate } from "./helpers";
import FileDropZone from "./components/FileDropZone";
import DashboardView from "./components/DashboardView";
import OrderProcessing from "./components/OrderProcessing";
import RequirementGenerator from "./components/RequirementGenerator";
import MRPChecker from "./components/MRPChecker";
import { motion, AnimatePresence } from "framer-motion";
import { FileSpreadsheet } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("validator"); // 'validator' or 'orders'

  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState("");
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [monthlyTarget, setMonthlyTarget] = useState(6300000);
  const [monthlyCommitment, setMonthlyCommitment] = useState(6300000);

  const handleFileSelect = (file) => {
    setError("");
    setValidationSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error("The Excel file doesn't contain any sheets.");
        }

        // Get the target sheet (Report or the first sheet)
        const sheetName = workbook.SheetNames.includes("Report") 
          ? "Report" 
          : workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // 1. Dynamically find the header row index
        const headerRowIndex = findHeaderRowIndex(worksheet);

        // 2. Parse the sheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          range: headerRowIndex,
        });

        if (jsonData.length === 0) {
          throw new Error(`The sheet "${sheetName}" does not contain any rows after headers.`);
        }

        // Validate that critical headers are present in the parsed rows
        const sampleRow = jsonData[0];
        const requiredHeaders = ["BRANCH NAME", "BILL DATE", "NET SALE AMOUNT"];
        const missingHeaders = requiredHeaders.filter(h => !(h in sampleRow));

        if (missingHeaders.length > 0) {
          throw new Error(
            `Unable to locate required columns: ${missingHeaders.join(", ")}. ` +
            `Please ensure the sheet contains these column headers exactly (case-sensitive).`
          );
        }

        // 3. Resolve the target report date
        const { today, todayStr } = getTargetDate(worksheet, jsonData);

        // Validate that we got a valid today date
        if (!today || isNaN(today.getTime())) {
          throw new Error("Could not parse or establish report date from the sheet.");
        }

        // 4. Group all unique store names
        const allStores = new Set();
        for (const row of jsonData) {
          if (row["BRANCH NAME"]) {
            allStores.add(row["BRANCH NAME"]);
          }
        }

        if (allStores.size === 0) {
          throw new Error("No branches found in the spreadsheet branch list.");
        }

        // Set success state, trigger a minor timeout, then load Dashboard
        setValidationSuccess(true);
        setTimeout(() => {
          setReportData({
            todayStr,
            today,
            totalDays: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(),
            allStores,
            jsonData,
            parseBillDate,
          });
        }, 1500);

      } catch (err) {
        setError(err.message || "Failed to process the spreadsheet.");
      }
    };

    reader.onerror = () => {
      setError("Error reading the Excel file.");
    };

    reader.readAsArrayBuffer(file);
  };

  const handleTargetChange = (target, commitment) => {
    setMonthlyTarget(target);
    setMonthlyCommitment(commitment);
  };

  const handleReset = () => {
    setReportData(null);
    setValidationSuccess(false);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-primary)] flex flex-col font-sans">
      
      {/* Google-style Top App Bar */}
      <header className="w-full bg-[var(--surface-color)] border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
              <FileSpreadsheet size={24} />
            </div>
            <span className="text-xl font-normal text-[#5f6368] tracking-tight">
              Sheet <span className="text-[#202124] font-medium">Formatter</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 border-l border-[#dadce0] pl-6">
            <button
              onClick={() => setActiveTab("validator")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "validator" 
                  ? "bg-[#e8f0fe] text-[#1a73e8]" 
                  : "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
              }`}
            >
              Daily Sales Validator
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "orders" 
                  ? "bg-[#e8f0fe] text-[#1a73e8]" 
                  : "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
              }`}
            >
              Order Processing
            </button>
            <button
              onClick={() => setActiveTab("generator")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "generator" 
                  ? "bg-[#e8f0fe] text-[#1a73e8]" 
                  : "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
              }`}
            >
              Requirement Generator
            </button>
            <button
              onClick={() => setActiveTab("mrp")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "mrp" 
                  ? "bg-[#e8f0fe] text-[#1a73e8]" 
                  : "text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
              }`}
            >
              MRP Checker
            </button>
          </div>
        </div>
        
        {activeTab === "validator" && !reportData && (
          <div className="hidden md:flex items-center gap-6">
            <div className="flex flex-col">
              <label className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-0.5">Target</label>
              <div className="flex items-center gap-1 text-[#1a73e8] font-medium text-sm">
                <span>₹</span>
                <input
                  type="number"
                  value={monthlyTarget}
                  onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                  className="bg-transparent w-24 focus:outline-none focus:border-b focus:border-[#1a73e8]"
                />
              </div>
            </div>
            <div className="w-px h-8 bg-[#dadce0]"></div>
            <div className="flex flex-col">
              <label className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider mb-0.5">Commitment</label>
              <div className="flex items-center gap-1 text-[#1a73e8] font-medium text-sm">
                <span>₹</span>
                <input
                  type="number"
                  value={monthlyCommitment}
                  onChange={(e) => setMonthlyCommitment(Number(e.target.value))}
                  className="bg-transparent w-24 focus:outline-none focus:border-b focus:border-[#1a73e8]"
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Tabs */}
      <div className="sm:hidden flex border-b border-[#dadce0] bg-white">
        <button
          onClick={() => setActiveTab("validator")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "validator"
              ? "border-[#1a73e8] text-[#1a73e8]"
              : "border-transparent text-[#5f6368]"
          }`}
        >
          Daily Sales
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "orders"
              ? "border-[#1a73e8] text-[#1a73e8]"
              : "border-transparent text-[#5f6368]"
          }`}
        >
          Orders
        </button>
        <button
          onClick={() => setActiveTab("generator")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "generator"
              ? "border-[#1a73e8] text-[#1a73e8]"
              : "border-transparent text-[#5f6368]"
          }`}
        >
          Generator
        </button>
        <button
          onClick={() => setActiveTab("mrp")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "mrp"
              ? "border-[#1a73e8] text-[#1a73e8]"
              : "border-transparent text-[#5f6368]"
          }`}
        >
          MRP Check
        </button>
      </div>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === "validator" ? (
            <motion.div
              key="validator-tab"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {!reportData ? (
                <div className="flex flex-col items-center mt-6">
                  <h1 className="text-3xl font-normal text-[#202124] mb-2 text-center">
                    Upload a spreadsheet to begin
                  </h1>
                  <p className="text-[#5f6368] mb-10 text-center max-w-lg">
                    Drag and drop your daily sales Excel report to instantly calculate DRR, view store metrics, and generate text reports.
                  </p>

                  <div className="md:hidden w-full max-w-md bg-white border border-[#dadce0] rounded-lg p-4 mb-6 shadow-sm flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#5f6368] mb-1">Monthly Target (₹)</label>
                      <input
                        type="number"
                        value={monthlyTarget}
                        onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                        className="google-input w-full p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#5f6368] mb-1">Monthly Commitment (₹)</label>
                      <input
                        type="number"
                        value={monthlyCommitment}
                        onChange={(e) => setMonthlyCommitment(Number(e.target.value))}
                        className="google-input w-full p-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="w-full max-w-2xl">
                    <FileDropZone 
                      onFileSelect={handleFileSelect} 
                      error={error} 
                      validationSuccess={validationSuccess} 
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <DashboardView 
                    reportData={reportData} 
                    monthlyTarget={monthlyTarget}
                    monthlyCommitment={monthlyCommitment}
                    onTargetChange={handleTargetChange}
                    onReset={handleReset} 
                  />
                </div>
              )}
            </motion.div>
          ) : activeTab === "orders" ? (
            <motion.div
              key="orders-tab"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <OrderProcessing />
            </motion.div>
          ) : activeTab === "generator" ? (
            <motion.div
              key="generator-tab"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <RequirementGenerator />
            </motion.div>
          ) : (
            <motion.div
              key="mrp-tab"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <MRPChecker />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="w-full text-center py-6 text-sm text-[#5f6368] bg-[#f8f9fa] border-t border-[#dadce0]">
        <p>Processed locally in your browser. No files are uploaded to any server.</p>
      </footer>
    </div>
  );
}
