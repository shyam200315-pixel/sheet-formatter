import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { findHeaderRowIndex, getTargetDate, parseBillDate } from "./helpers";
import FileDropZone from "./components/FileDropZone";
import DashboardView from "./components/DashboardView";
import OrderProcessing from "./components/OrderProcessing";
import RequirementGenerator from "./components/RequirementGenerator";
import MRPChecker from "./components/MRPChecker";
import QuotationGenerator from "./components/QuotationGenerator";
import StockAnalyzer from "./components/StockAnalyzer";
import InwardTracker from "./components/InwardTracker";
import BestSellers from "./components/BestSellers";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from 'react-hot-toast';
import { 
  Calculator, 
  ShoppingCart, 
  ListChecks, 
  Tags, 
  FileText, 
  BarChart2, 
  PackageCheck, 
  TrendingUp,
  ArrowLeft 
} from 'lucide-react';

const TOOLS = [
  {
    id: "validator",
    title: "Daily Sales Validator",
    description: "Calculate DRR, view store metrics, and generate text reports.",
    icon: <Calculator className="w-8 h-8 text-blue-600" />,
    color: "bg-blue-100",
    borderColor: "border-blue-200",
    hoverBorder: "hover:border-blue-400"
  },
  {
    id: "best-sellers",
    title: "Best Sellers",
    description: "Item-wise store collection and product analytics.",
    icon: <TrendingUp className="w-8 h-8 text-fuchsia-600" />,
    color: "bg-fuchsia-100",
    borderColor: "border-fuchsia-200",
    hoverBorder: "hover:border-fuchsia-400"
  },
  {
    id: "orders",
    title: "Order Processing",
    description: "Process purchase orders and streamline dispatch operations.",
    icon: <ShoppingCart className="w-8 h-8 text-indigo-600" />,
    color: "bg-indigo-100",
    borderColor: "border-indigo-200",
    hoverBorder: "hover:border-indigo-400"
  },
  {
    id: "generator",
    title: "Requirement Generator",
    description: "Generate branch requirements dynamically based on sales.",
    icon: <ListChecks className="w-8 h-8 text-emerald-600" />,
    color: "bg-emerald-100",
    borderColor: "border-emerald-200",
    hoverBorder: "hover:border-emerald-400"
  },
  {
    id: "stock",
    title: "Stock Analyzer",
    description: "Analyze stock levels, closing stock and inventory health.",
    icon: <BarChart2 className="w-8 h-8 text-violet-600" />,
    color: "bg-violet-100",
    borderColor: "border-violet-200",
    hoverBorder: "hover:border-violet-400"
  },
  {
    id: "inward-tracker",
    title: "Inward Tracker",
    description: "Track inward shipments and pending deliveries efficiently.",
    icon: <PackageCheck className="w-8 h-8 text-cyan-600" />,
    color: "bg-cyan-100",
    borderColor: "border-cyan-200",
    hoverBorder: "hover:border-cyan-400"
  },
  {
    id: "mrp",
    title: "MRP Checker",
    description: "Validate product pricing against official master records.",
    icon: <Tags className="w-8 h-8 text-amber-600" />,
    color: "bg-amber-100",
    borderColor: "border-amber-200",
    hoverBorder: "hover:border-amber-400"
  },
  {
    id: "quotation",
    title: "Quotation Generator",
    description: "Quickly generate professional PDF quotations for customers.",
    icon: <FileText className="w-8 h-8 text-rose-600" />,
    color: "bg-rose-100",
    borderColor: "border-rose-200",
    hoverBorder: "hover:border-rose-400"
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("sheetFormatterActiveTab") || "home";
  });

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    localStorage.setItem("sheetFormatterActiveTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500); // 2.5 seconds splash
    return () => clearTimeout(timer);
  }, []);

  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState("");
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [monthlyTarget, setMonthlyTarget] = useState(8675000);
  const [monthlyCommitment, setMonthlyCommitment] = useState(8675000);

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

        const sheetName = workbook.SheetNames.includes("Report") 
          ? "Report" 
          : workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const headerRowIndex = findHeaderRowIndex(worksheet);

        let jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          range: headerRowIndex,
        });

        if (jsonData.length === 0) {
          throw new Error(`The sheet "${sheetName}" does not contain any rows after headers.`);
        }

        jsonData = jsonData.map(row => {
          const newRow = { ...row };
          if (newRow[" FROM BRANCH NAME "]) {
            newRow["BRANCH NAME"] = newRow[" FROM BRANCH NAME "];
          } else if (newRow["FROM BRANCH NAME"]) {
            newRow["BRANCH NAME"] = newRow["FROM BRANCH NAME"];
          }
          if (newRow["NET AMOUNT"]) {
            newRow["NET SALE AMOUNT"] = newRow["NET AMOUNT"];
          }
          return newRow;
        });

        const sampleRow = jsonData[0];
        const requiredHeaders = ["BRANCH NAME", "BILL DATE", "NET SALE AMOUNT"];
        const missingHeaders = requiredHeaders.filter(h => !(h in sampleRow));

        if (missingHeaders.length > 0) {
          throw new Error(
            `Unable to locate required columns: ${missingHeaders.join(", ")}. ` +
            `Please ensure the sheet contains these column headers exactly (case-sensitive).`
          );
        }

        const { today, todayStr } = getTargetDate(worksheet, jsonData);

        if (!today || isNaN(today.getTime())) {
          throw new Error("Could not parse or establish report date from the sheet.");
        }

        const allStores = new Set();
        for (const row of jsonData) {
          if (row["BRANCH NAME"]) {
            allStores.add(row["BRANCH NAME"]);
          }
        }

        if (allStores.size === 0) {
          throw new Error("No branches found in the spreadsheet branch list.");
        }

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
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(5px)" }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#f8f9fa]"
            style={{
              backgroundImage: `
                radial-gradient(at 0% 0%, hsla(217,100%,94%,1) 0px, transparent 50%),
                radial-gradient(at 100% 0%, hsla(209,100%,95%,1) 0px, transparent 50%),
                radial-gradient(at 100% 100%, hsla(217,100%,95%,1) 0px, transparent 50%),
                radial-gradient(at 0% 100%, hsla(208,100%,96%,1) 0px, transparent 50%),
                radial-gradient(#dadce0 1px, transparent 1px)
              `,
              backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%, 32px 32px',
              backgroundPosition: 'center, center, center, center, 0 0',
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="flex flex-col items-center relative"
            >
              {/* Premium Glow Effect */}
              <div className="absolute inset-0 bg-blue-100 blur-[80px] rounded-full opacity-50 -z-10" />
              <img src="/pigeon.png" alt="Pigeon Logo" className="h-28 object-contain mb-8 drop-shadow-xl" />
              <h1 className="text-4xl md:text-5xl font-light text-[#202124] tracking-tight mb-3">
                Welcome <span className="font-semibold text-[#1a73e8]">Shyam</span>
              </h1>
              <div className="flex items-center gap-3">
                <div className="h-[1px] w-8 bg-[#dadce0]"></div>
                <p className="text-[#5f6368] text-sm font-medium tracking-[0.2em] uppercase">
                  by Stovekraft
                </p>
                <div className="h-[1px] w-8 bg-[#dadce0]"></div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-transparent text-[var(--text-primary)] flex flex-col font-sans">
        <Toaster position="bottom-center" />
      
        {/* Google-style Top App Bar */}
        <header className="w-full bg-[var(--surface-color)] border-b border-[var(--border-color)] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setActiveTab("home")}
            >
              <img src="/pigeon.png" alt="Pigeon Logo" className="h-10 object-contain rounded-md transition-transform group-hover:scale-105" />
              <span className="text-xl font-normal text-[#5f6368] tracking-tight hidden sm:block">
                Stovekraft <span className="text-[#202124] font-medium">Shyam</span>
              </span>
            </div>

            {activeTab !== "home" && (
              <div className="flex items-center border-l border-[#dadce0] pl-6">
                <button
                  onClick={() => setActiveTab("home")}
                  className="flex items-center gap-2 text-sm font-medium text-[#5f6368] hover:text-[#1a73e8] hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back to Dashboard
                </button>
              </div>
            )}
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

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            {activeTab === "home" ? (
              <motion.div
                key="home-dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <div className="text-center mb-12">
                  <h1 className="text-4xl font-medium text-[#202124] tracking-tight mb-3">Welcome to your Workspace</h1>
                  <p className="text-lg text-[#5f6368]">Select a tool below to begin your work today.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {TOOLS.map((tool) => (
                    <div
                      key={tool.id}
                      onClick={() => setActiveTab(tool.id)}
                      className={`bg-white rounded-2xl p-6 border ${tool.borderColor} ${tool.hoverBorder} shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col h-full`}
                    >
                      <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full ${tool.color} opacity-30 transition-transform duration-500 group-hover:scale-110`} />
                      
                      <div className={`w-14 h-14 rounded-2xl ${tool.color} flex items-center justify-center mb-6 relative z-10 transition-transform duration-300 group-hover:-translate-y-1`}>
                        {tool.icon}
                      </div>
                      
                      <h3 className="text-xl font-semibold text-gray-900 mb-3 relative z-10">{tool.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed relative z-10 flex-grow">{tool.description}</p>
                      
                      <div className="mt-6 flex items-center text-sm font-medium text-gray-400 group-hover:text-blue-600 transition-colors">
                        Launch Tool &rarr;
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : activeTab === "validator" ? (
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
                      <p className="text-center text-sm text-[#5f6368] mt-4">
                        <em>Note: The option to upload your Closing Stock file (for Scrap calculations) will appear on the dashboard after you upload this sales report.</em>
                      </p>
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
            ) : activeTab === "mrp" ? (
              <motion.div
                key="mrp-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <MRPChecker />
              </motion.div>
            ) : activeTab === "quotation" ? (
              <motion.div
                key="quotation-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <QuotationGenerator />
              </motion.div>
            ) : activeTab === "stock" ? (
              <motion.div
                key="stock-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <StockAnalyzer />
              </motion.div>
            ) : activeTab === "inward-tracker" ? (
              <motion.div
                key="inward-tracker-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <InwardTracker />
              </motion.div>
            ) : (
              <motion.div
                key="best-sellers-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <BestSellers />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="w-full text-center py-6 text-sm text-[#5f6368] bg-[#f8f9fa] border-t border-[#dadce0] mt-auto">
          <p>Processed locally in your browser. No files are uploaded to any server.</p>
        </footer>
      </div>
    </>
  );
}
