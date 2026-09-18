import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { 
  Wallet, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  SlidersHorizontal, 
  Search, 
  Copy, 
  Check, 
  Download, 
  ArrowLeft,
  Building2,
  TrendingUp,
  Layers,
  Sparkles,
  Info,
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { MASTER_STORES, normalizeStoreName } from "../helpers";

export default function StoreCashAnalyzer({ onBack }) {
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Toggle State: true = Only Blue Line (Main Ledger), false = Both Blue + Black Lines (Combined)
  const [blueLineOnly, setBlueLineOnly] = useState(true);
  
  // State Filter: "ALL", "MP", "MH"
  const [stateFilter, setStateFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);

  // Parse Uploaded Excel File
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processExcelFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processExcelFile(file);
  };

  const processExcelFile = (file) => {
    setIsProcessing(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Raw array of arrays
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        // Extract report title date if present (e.g. "STORE CASH BALANCE REPORT - 3 From 18/09/2026 to 18/09/2026")
        let extractedDate = "";
        for (let r = 0; r < Math.min(5, rows.length); r++) {
          const rowStr = rows[r].join(" ");
          const match = rowStr.match(/From\s+(\d{2}[/\-]\d{2}[/\-]\d{4})/i);
          if (match) {
            extractedDate = match[1];
            break;
          }
        }
        setReportDate(extractedDate || new Date().toLocaleDateString('en-GB'));

        // Process rows starting after header (finding row with BRANCH NAME or SNO.)
        let startIdx = 0;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const rowText = rows[i].join(" ").toUpperCase();
          if (rowText.includes("BRANCH") || rowText.includes("ACCOUNT") || rowText.includes("CREDIT")) {
            startIdx = i + 1;
            break;
          }
        }

        const parsedEntries = [];
        for (let i = startIdx; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r.length < 3) continue;

          const sno = r[0] ? String(r[0]).trim() : "";
          const branchRaw = r[1] ? String(r[1]).trim() : "";
          const accountRaw = r[2] ? String(r[2]).trim() : "";
          const debit = parseFloat(r[3]) || 0;
          const credit = parseFloat(r[4]) || 0;

          if (!branchRaw && !accountRaw) continue;

          // Determine if this row is SNO empty (Blue Main Line) or SNO = '1' (Secondary Black Line)
          const isMainLine = !sno || sno === "";

          parsedEntries.push({
            id: `row-${i}`,
            sno,
            branchRaw,
            branchNorm: normalizeStoreName(branchRaw),
            accountRaw,
            debit,
            credit,
            net: debit - credit,
            isMainLine,
            isCashAccount: accountRaw.toUpperCase().includes("CASH")
          });
        }

        setFileData(parsedEntries);
        toast.success(`Loaded ${parsedEntries.length} entries successfully!`);
      } catch (err) {
        console.error("Error parsing file:", err);
        toast.error("Failed to parse Excel file. Please check file format.");
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Group Parsed Data By Store (Restricted to MP & MH Stores Only)
  const storeGroupedData = useMemo(() => {
    if (!fileData) return [];

    const storeMap = {};

    fileData.forEach((entry) => {
      const canonical = entry.branchNorm || entry.branchRaw;
      if (!canonical) return;

      // Extract State - Strict check for MP & MH
      const upper = canonical.toUpperCase();
      let state = "OTHER";
      if (upper.startsWith("WMP") || upper.includes("WMP")) state = "MP";
      else if (upper.startsWith("WMH") || upper.includes("WMH")) state = "MH";

      // User requested: ONLY MP and MH stores should be included, ignore all other regions
      if (state !== "MP" && state !== "MH") return;

      if (!storeMap[canonical]) {
        storeMap[canonical] = {
          storeName: canonical,
          state,
          mainLineEntries: [],
          secondaryLineEntries: [],
          mainLineCashTotal: 0,
          secondaryLineCashTotal: 0,
          allEntries: []
        };
      }

      const store = storeMap[canonical];
      store.allEntries.push(entry);

      if (entry.isCashAccount) {
        if (entry.isMainLine) {
          store.mainLineEntries.push(entry);
          store.mainLineCashTotal += entry.net;
        } else {
          store.secondaryLineEntries.push(entry);
          store.secondaryLineCashTotal += entry.net;
        }
      }
    });

    return Object.values(storeMap);
  }, [fileData]);

  // Filtered Stores Based on User Selection (State & Search)
  const filteredStores = useMemo(() => {
    return storeGroupedData.filter((store) => {
      if (stateFilter === "MP" && store.state !== "MP") return false;
      if (stateFilter === "MH" && store.state !== "MH") return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = store.storeName.toLowerCase().includes(term);
        const matchesAccount = store.allEntries.some(e => e.accountRaw.toLowerCase().includes(term));
        if (!matchesName && !matchesAccount) return false;
      }

      return true;
    });
  }, [storeGroupedData, stateFilter, searchTerm]);

  // Overall Statistics calculated dynamically based on blueLineOnly toggle
  const stats = useMemo(() => {
    let mpTotal = 0;
    let mhTotal = 0;

    let mpBlueTotal = 0, mpCombinedTotal = 0;
    let mhBlueTotal = 0, mhCombinedTotal = 0;

    storeGroupedData.forEach((store) => {
      const mainCash = store.mainLineCashTotal;
      const combinedCash = store.mainLineCashTotal + store.secondaryLineCashTotal;
      const activeCash = blueLineOnly ? mainCash : combinedCash;

      if (store.state === "MP") {
        mpTotal += activeCash;
        mpBlueTotal += mainCash;
        mpCombinedTotal += combinedCash;
      } else if (store.state === "MH") {
        mhTotal += activeCash;
        mhBlueTotal += mainCash;
        mhCombinedTotal += combinedCash;
      }
    });

    const grandTotal = mpTotal + mhTotal;

    return {
      grandTotal,
      mpTotal,
      mhTotal,
      mpBlueTotal,
      mpCombinedTotal,
      mhBlueTotal,
      mhCombinedTotal
    };
  }, [storeGroupedData, blueLineOnly]);

  // Copy Summary to Clipboard
  const handleCopySummary = (type) => {
    let text = `📊 *STORE CASH BALANCE SUMMARY (${reportDate})*\n`;
    text += `Mode: *${blueLineOnly ? "BLUE LINE ONLY (Main Ledger)" : "COMBINED (Blue + Black Lines)"}*\n\n`;

    if (type === "MP" || type === "ALL") {
      text += `🟢 *MADHYA PRADESH (MP) STORES:* Total ₹${stats.mpTotal.toLocaleString("en-IN")}\n`;
      storeGroupedData.filter(s => s.state === "MP").forEach(s => {
        const val = blueLineOnly ? s.mainLineCashTotal : (s.mainLineCashTotal + s.secondaryLineCashTotal);
        text += `• ${s.storeName}: ₹${val.toLocaleString("en-IN")}\n`;
      });
      text += `\n`;
    }

    if (type === "MH" || type === "ALL") {
      text += `🔵 *MAHARASHTRA (MH) STORES:* Total ₹${stats.mhTotal.toLocaleString("en-IN")}\n`;
      storeGroupedData.filter(s => s.state === "MH").forEach(s => {
        const val = blueLineOnly ? s.mainLineCashTotal : (s.mainLineCashTotal + s.secondaryLineCashTotal);
        text += `• ${s.storeName}: ₹${val.toLocaleString("en-IN")}\n`;
      });
      text += `\n`;
    }

    text += `🏆 *GRAND TOTAL:* ₹${stats.grandTotal.toLocaleString("en-IN")}`;

    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    toast.success(`Copied ${type} Cash Summary to Clipboard!`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                <Wallet className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Store Cash Balance & Ledger Analyzer
                  <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-700">
                    MP & MH Stores
                  </span>
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Analyze Cash In Hand, Main vs Secondary Ledgers, and filter MP/MH stores effortlessly.
                </p>
              </div>
            </div>
          </div>
        </div>

        {fileData && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setFileData(null); setFileName(""); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition"
            >
              <RefreshCw className="w-4 h-4" />
              Upload New Sheet
            </button>
          </div>
        )}
      </div>

      {/* Main File Drop Zone if no file uploaded */}
      {!fileData && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-emerald-300 dark:border-emerald-700/60 hover:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer relative overflow-hidden group"
        >
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
          />
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-2xl shadow-emerald-500/30 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-10 h-10 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Drop your Store Cash Balance Excel file here
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Supports <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-emerald-600 font-mono">STORE CASH BALANCE REPORT</code> sheets (.xlsx, .xls)
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-medium shadow-lg shadow-emerald-600/30">
              <FileSpreadsheet className="w-5 h-5" />
              Browse Excel File
            </div>
          </div>
        </div>
      )}

      {/* File Data View */}
      {fileData && (
        <div className="space-y-6">

          {/* DUAL MODE TOGGLE BUTTON BAR */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
              <div className="space-y-1 text-center lg:text-left">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold tracking-wider uppercase">
                  <Sparkles className="w-4 h-4" /> Mode Switcher
                </div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Dual Ledger Calculation Mode
                </h2>
                <p className="text-xs text-slate-400 max-w-xl">
                  {blueLineOnly 
                    ? "Currently showing ONLY Blue Main Line entries (Primary Ledger)." 
                    : "Currently showing COMBINED entries (Blue Main Line + Black Secondary Counter 2)."}
                </p>
              </div>

              {/* Interactive Toggle Switch */}
              <div className="flex items-center gap-3 bg-slate-950/80 p-2 rounded-2xl border border-slate-700">
                <button
                  onClick={() => setBlueLineOnly(true)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                    blueLineOnly
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/40 scale-105"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${blueLineOnly ? "bg-cyan-300 animate-pulse" : "bg-blue-500"}`} />
                  Blue Line Only
                  <span className="text-[10px] bg-blue-900/60 text-blue-200 px-2 py-0.5 rounded-full border border-blue-400/30">
                    Main Ledger
                  </span>
                </button>

                <button
                  onClick={() => setBlueLineOnly(false)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                    !blueLineOnly
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/40 scale-105"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${!blueLineOnly ? "bg-emerald-300 animate-pulse" : "bg-emerald-500"}`} />
                  Add Both (Combined)
                  <span className="text-[10px] bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30">
                    Blue + Black Line
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* DYNAMIC METRIC CARDS (MP & MH ONLY) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* COMBINED MP + MH GRAND TOTAL */}
            <motion.div 
              layout
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
                <span>MP + MH TOTAL CASH IN HAND</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  {blueLineOnly ? "Blue Line Only" : "Combined Mode"}
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                ₹{stats.grandTotal.toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Combined 18 MP & MH Stores Total Cash
              </p>
            </motion.div>

            {/* MP STORES TOTAL */}
            <motion.div 
              layout
              className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent bg-white dark:bg-slate-900 p-6 rounded-3xl border border-emerald-200 dark:border-emerald-800/60 shadow-xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-2">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> MP STORES (8 Stores)
                </span>
                <button
                  onClick={() => handleCopySummary("MP")}
                  className="p-1 rounded hover:bg-emerald-200/50 dark:hover:bg-emerald-800/50 transition"
                  title="Copy MP Summary"
                >
                  {copiedKey === "MP" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                ₹{stats.mpTotal.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 space-y-0.5">
                <div>Blue Main Line: ₹{stats.mpBlueTotal.toLocaleString("en-IN")}</div>
                <div>Combined Both: ₹{stats.mpCombinedTotal.toLocaleString("en-IN")}</div>
              </div>
            </motion.div>

            {/* MH STORES TOTAL */}
            <motion.div 
              layout
              className="bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent bg-white dark:bg-slate-900 p-6 rounded-3xl border border-blue-200 dark:border-blue-800/60 shadow-xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 text-xs font-bold mb-2">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> MH STORES (10 Stores)
                </span>
                <button
                  onClick={() => handleCopySummary("MH")}
                  className="p-1 rounded hover:bg-blue-200/50 dark:hover:bg-blue-800/50 transition"
                  title="Copy MH Summary"
                >
                  {copiedKey === "MH" ? <Check className="w-4 h-4 text-blue-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                </button>
              </div>
              <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                ₹{stats.mhTotal.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 space-y-0.5">
                <div>Blue Main Line: ₹{stats.mhBlueTotal.toLocaleString("en-IN")}</div>
                <div>Combined Both: ₹{stats.mhCombinedTotal.toLocaleString("en-IN")}</div>
              </div>
            </motion.div>

          </div>

          {/* FILTERS & SEARCH BAR */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg">

            {/* State Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full md:w-auto">
              <button
                onClick={() => setStateFilter("ALL")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  stateFilter === "ALL"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All MP & MH Stores ({storeGroupedData.length})
              </button>
              <button
                onClick={() => setStateFilter("MP")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  stateFilter === "MP"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Madhya Pradesh (MP) ({storeGroupedData.filter(s => s.state === "MP").length})
              </button>
              <button
                onClick={() => setStateFilter("MH")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  stateFilter === "MH"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Maharashtra (MH) ({storeGroupedData.filter(s => s.state === "MH").length})
              </button>
            </div>

            {/* Search Input & Copy WhatsApp */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search store name or city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                onClick={() => handleCopySummary(stateFilter)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition shadow-md"
              >
                {copiedKey === stateFilter ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                Copy Report
              </button>
            </div>

          </div>

          {/* STORE WISE BREAKDOWN TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                Store-Wise Cash Balance Ledger
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {filteredStores.length} Stores Shown
                </span>
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Blue Line (Main Ledger)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Black Line (Counter 2)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-6">Store Name & Region</th>
                    <th className="py-3.5 px-4 text-right">Blue Main Line (₹)</th>
                    <th className="py-3.5 px-4 text-right">Black Line SNO 1 (₹)</th>
                    <th className="py-3.5 px-6 text-right">Net Cash In Hand (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredStores.map((store) => {
                    const mainVal = store.mainLineCashTotal;
                    const secVal = store.secondaryLineCashTotal;
                    const combinedVal = mainVal + secVal;
                    const displayVal = blueLineOnly ? mainVal : combinedVal;

                    return (
                      <tr 
                        key={store.storeName}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                              store.state === "MP" 
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                : store.state === "MH"
                                ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                            }`}>
                              {store.state}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {store.storeName}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {store.allEntries.length} ledger rows in sheet
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Blue Main Line Column */}
                        <td className="py-4 px-4 text-right">
                          <div className="font-bold text-blue-600 dark:text-blue-400">
                            ₹{mainVal.toLocaleString("en-IN")}
                          </div>
                          <span className="text-[10px] text-blue-500/80 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                            Primary
                          </span>
                        </td>

                        {/* Black Secondary Line Column */}
                        <td className="py-4 px-4 text-right">
                          <div className={`font-semibold ${blueLineOnly ? "text-slate-400 line-through opacity-50" : "text-slate-700 dark:text-slate-300"}`}>
                            ₹{secVal.toLocaleString("en-IN")}
                          </div>
                          <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {secVal > 0 ? "Counter 2" : "None"}
                          </span>
                        </td>

                        {/* Net Cash Calculated Column */}
                        <td className="py-4 px-6 text-right">
                          <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                            ₹{displayVal.toLocaleString("en-IN")}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {blueLineOnly ? "Blue Only Mode" : "Combined Mode"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredStores.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                        No stores matched your current search/filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
