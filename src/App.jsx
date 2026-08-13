import React, { useState, useEffect, useRef } from "react";
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
import MacDock from "./components/MacDock";
import { motion, AnimatePresence } from "framer-motion";
import SpaceBackground from "./components/SpaceBackground";
import { Sun, Moon, Settings } from "lucide-react";
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

const ToolCard = ({ tool, onClick }) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
      }}
      whileHover={{ 
        y: -8, 
        scale: 1.02,
        transition: { type: "spring", stiffness: 300, damping: 20 }
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`glass-card bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/80 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-300 cursor-pointer group relative overflow-hidden flex flex-col h-full`}
    >
      {/* Spotlight Effect (Windows 11 Fluent) */}
      <div 
        className="pointer-events-none absolute -inset-px rounded-2xl z-10 transition-opacity duration-300"
        style={{
          background: `radial-gradient(800px circle at var(--mouse-x, -1000px) var(--mouse-y, -1000px), rgba(255,255,255,0.7), transparent 40%)`
        }}
      />
      
      {/* Background color blob for the card */}
      <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full ${tool.color} opacity-40 blur-2xl transition-transform duration-700 group-hover:scale-150 group-hover:opacity-60 z-0`} />
      
      <div className={`w-14 h-14 rounded-2xl ${tool.color} flex items-center justify-center mb-6 relative z-10 shadow-sm border border-white/50 transition-transform duration-500 group-hover:rotate-[5deg] group-hover:scale-110`}>
        {tool.icon}
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 relative z-10 group-hover:text-black dark:group-hover:text-white transition-colors">{tool.title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed relative z-10 flex-grow">{tool.description}</p>
      
      <div className="mt-6 flex items-center text-sm font-semibold text-gray-400 dark:text-gray-400 group-hover:text-blue-600 transition-colors relative z-10">
        Launch Tool <span className="ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const [showSplash, setShowSplash] = useState(true);

  // Ensure we always start on the home dashboard on fresh load or reload
  useEffect(() => {
    setActiveTab("home");
  }, []);

  const handleGridMouseMove = (e) => {
    const cards = document.getElementsByClassName("glass-card");
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    }
  };

  const handleGridMouseLeave = () => {
    const cards = document.getElementsByClassName("glass-card");
    for (const card of cards) {
      card.style.setProperty("--mouse-x", `-1000px`);
      card.style.setProperty("--mouse-y", `-1000px`);
    }
  };

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

  // Reset validator state when tab changes to open afresh
  useEffect(() => {
    if (activeTab !== "validator") {
      setReportData(null);
      setError("");
      setValidationSuccess(false);
    }
  }, [activeTab]);

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
            exit={{ opacity: 0, scale: 2.5, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: "easeIn" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#f8f9fa] dark:bg-transparent"
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
              
              {/* Restored Pigeon Logo */}
              <img src="/pigeon.png" alt="Pigeon Logo" className="h-28 object-contain mb-8 drop-shadow-xl" />
              
              <h1 className="text-4xl md:text-5xl font-light text-[#202124] dark:text-white tracking-tight mb-3">
                Welcome <span className="font-semibold text-[#1a73e8]">Shyam</span>
              </h1>
              
              <div className="flex items-center gap-3">
                <div className="h-[1px] w-8 bg-[#dadce0]"></div>
                <p className="text-[#5f6368] dark:text-gray-300 text-sm font-medium tracking-[0.2em] uppercase">
                  by Stovekraft
                </p>
                <div className="h-[1px] w-8 bg-[#dadce0]"></div>
              </div>
              
              {/* Loading Progress Bar */}
              <div className="mt-10 w-64 h-1 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.3, ease: "easeInOut" }}
                  className="h-full bg-blue-600 rounded-full"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`min-h-screen ${!isDarkMode ? "abstract-gradient-bg" : ""} text-[#202124] dark:text-white flex flex-col font-sans overflow-x-hidden relative`}>
      <Toaster position="bottom-center" />
      {/* Dark Mode Toggle Drawer */}
      <div 
        className="fixed bottom-20 sm:bottom-6 right-0 z-50 flex items-center bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-lg border border-r-0 border-gray-200 dark:border-slate-700 rounded-l-full cursor-pointer transition-transform duration-300 ease-in-out translate-x-[calc(100%-48px)] hover:translate-x-0 group"
        onClick={() => setIsDarkMode(!isDarkMode)}
      >
        <div className="w-12 h-12 flex items-center justify-center shrink-0">
          <Settings size={20} className="text-gray-500 dark:text-gray-400 group-hover:rotate-90 transition-transform duration-500" />
        </div>
        <div className="flex items-center gap-3 pr-5 py-2">
          <Sun size={16} className={`${!isDarkMode ? 'text-amber-500' : 'text-slate-400'}`} />
          <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-indigo-500' : 'bg-slate-300'} flex items-center`}>
            <motion.div 
              className="w-4 h-4 bg-white rounded-full shadow-sm"
              animate={{ x: isDarkMode ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </div>
          <Moon size={16} className={`${isDarkMode ? 'text-indigo-300' : 'text-slate-400'}`} />
        </div>
      </div>

      {/* Conditionally render space background */}
      {isDarkMode && <SpaceBackground />}

      
      {/* Background Decor */}
      <div className="fixed bottom-0 left-0 w-full h-32 pointer-events-none z-0 opacity-40">
      </div>
    
      {/* macOS Tahoe Top Nav Bar */}
      <header className="w-full macos-glass px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setActiveTab("home")}
            >
              <img src="/pigeon.png" alt="Pigeon Logo" className="h-8 sm:h-10 object-contain rounded-md transition-transform group-hover:scale-105" />
              <span className="text-xl font-normal text-[#5f6368] dark:text-gray-300 tracking-tight hidden sm:block">
                Stovekraft <span className="text-[#202124] dark:text-white font-medium">Shyam</span>
              </span>
            </div>
            
            {activeTab !== "home" && (
              <div className="flex items-center border-l border-[#dadce0] dark:border-slate-600 pl-3 sm:pl-6">
                <button
                  onClick={() => setActiveTab("home")}
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium text-[#5f6368] dark:text-gray-300 hover:text-[#1a73e8] hover:bg-blue-50 dark:hover:bg-slate-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <ArrowLeft size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">Back to Dashboard</span>
                  <span className="xs:hidden">Back</span>
                </button>
              </div>
            )}
          </div>
        
          {activeTab === "validator" && !reportData && (
            <div className="hidden md:flex items-center gap-6">
              <div className="flex flex-col">
                <label className="text-[11px] font-medium text-[#5f6368] dark:text-gray-300 uppercase tracking-wider mb-0.5">Target</label>
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
                <label className="text-[11px] font-medium text-[#5f6368] dark:text-gray-300 uppercase tracking-wider mb-0.5">Commitment</label>
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


        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-8 relative z-10">
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
                    <div className="relative w-full">
                      <div className="text-center mb-12 relative z-10">
                        <motion.h1 
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-4xl font-medium text-[#202124] dark:text-white tracking-tight mb-3"
                        >
                          Welcome to your Workspace
                        </motion.h1>
                        <motion.p 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="text-lg text-[#5f6368] dark:text-gray-300"
                        >
                          Select a tool below to begin your work today.
                        </motion.p>
                      </div>
                      
                      <motion.div 
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative z-10"
                        onMouseMove={handleGridMouseMove}
                        onMouseLeave={handleGridMouseLeave}
                        initial="hidden"
                        animate="show"
                        variants={{
                          hidden: { opacity: 0 },
                          show: {
                            opacity: 1,
                            transition: {
                              staggerChildren: 0.1
                            }
                          }
                        }}
                      >
                        {TOOLS.map((tool) => (
                          <ToolCard 
                            key={tool.id} 
                            tool={tool} 
                            onClick={() => setActiveTab(tool.id)} 
                          />
                        ))}
                      </motion.div>
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
                        <h1 className="text-3xl font-normal text-[#202124] dark:text-white mb-2 text-center">
                          Upload a spreadsheet to begin
                        </h1>
                        <p className="text-[#5f6368] dark:text-gray-300 mb-10 text-center max-w-lg">
                          Drag and drop your daily sales Excel report to instantly calculate DRR, view store metrics, and generate text reports.
                        </p>

                        <div className="md:hidden w-full max-w-md bg-white dark:bg-slate-800/60 border border-[#dadce0] dark:border-slate-700 rounded-lg p-4 mb-6 shadow-sm flex flex-col gap-4">
                          <div>
                            <label className="block text-xs font-medium text-[#5f6368] dark:text-gray-300 mb-1">Monthly Target (₹)</label>
                            <input
                              type="number"
                              value={monthlyTarget}
                              onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                              className="google-input w-full p-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[#5f6368] dark:text-gray-300 mb-1">Monthly Commitment (₹)</label>
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
                          <p className="text-center text-sm text-[#5f6368] dark:text-gray-300 mt-4">
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

        {/* macOS Dock */}
        {activeTab !== "home" && (
          <MacDock activeTab={activeTab} setActiveTab={setActiveTab} />
        )}
        
        {/* Spacing for Dock */}
        <div className="h-20 sm:h-24"></div>
      </div>
    </>
  );
}
