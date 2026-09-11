import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { appendHistoricalData, loadHistoricalData, clearHistoricalData, parseBillDate, findHeaderRowIndex, normalizeStoreName } from "../helpers";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Upload, Database, FileSpreadsheet, Search, Trash2, Calendar, Store, X, TrendingUp, DollarSign, Package, Receipt } from "lucide-react";
import toast from "react-hot-toast";

export default function HistoricalSales() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  
  const [dbData, setDbData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Query state
  const [stores, setStores] = useState([]);
  const [selectedStores, setSelectedStores] = useState([]);
  const formatMonth = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setFullYear(defaultStart.getFullYear() - 1);

  const [startMonth, setStartMonth] = useState(formatMonth(defaultStart));
  const [endMonth, setEndMonth] = useState(formatMonth(defaultEnd));

  // Check if data exists on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await loadHistoricalData();
      if (data) {
        setDbData(data);
        extractStores(data);
      } else {
        setDbData(null);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load data from database.");
    }
    setIsLoading(false);
  };

  // Helper for flexible case-insensitive, whitespace and punctuation-tolerant key matching
  const getRowVal = (row, candidateKeys) => {
    if (!row || typeof row !== "object") return "";
    // 1. Exact candidate check
    for (const k of candidateKeys) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
    }
    const rowKeys = Object.keys(row);
    // 2. Case-insensitive & trimmed candidate check
    for (const k of candidateKeys) {
      const target = k.trim().toUpperCase();
      const foundKey = rowKeys.find(rk => rk.trim().toUpperCase() === target);
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== "") {
        return row[foundKey];
      }
    }
    // 3. Clean string candidate check (stripping spaces, dots, underscores, dashes)
    const cleanTargets = candidateKeys.map(k => k.replace(/[\s._\-]+/g, "").toUpperCase());
    for (const rk of rowKeys) {
      const cleanRk = rk.replace(/[\s._\-]+/g, "").toUpperCase();
      if (cleanTargets.includes(cleanRk)) {
        if (row[rk] !== undefined && row[rk] !== null && row[rk] !== "") {
          return row[rk];
        }
      }
    }
    return "";
  };

  const STORE_KEYS = ["STORE NAME", "BRANCH NAME", "FROM BRANCH NAME", "TO STORE", "BRANCH", "STORE"];
  const QTY_KEYS = ["SOLD QTY", "QTY", "QUANTITY", "NET QTY", "TOTAL QTY", "SOLD QUANTITY"];
  const AMOUNT_KEYS = ["NET AMOUNT", "SALES AMOUNT", "AMOUNT", "TOTAL", "NET SALE AMOUNT", "GROSS AMOUNT", "TOTAL AMOUNT", "NET SALES"];
  const BILL_KEYS = [
    "NEW VOUCHER NO.", "NEW VOUCHER NO", "NEW VOUCHER_NO", "NEW VOUCHERNO",
    "NEW BILL NO.", "NEW BILL NO", "NEW INVOICE NO.", "NEW INVOICE NO",
    "VOUCHER NO.", "VOUCHER NO", "VOUCHER_NO", "VOUCHERNO", "VOUCHER",
    "BILL NO.", "BILL NO", "BILL_NO", "BILLNO", "BILL",
    "INVOICE NO.", "INVOICE NO", "INVOICE_NO", "INVOICE NUMBER", "BILL NUMBER", "VOUCHER NUMBER",
    "DOC NO.", "DOC NO", "DOC_NO", "DOCUMENT NO", "DOCUMENT NO.", 
    "TRANS NO", "TRANSACTION NO", "SL NO", "SL. NO."
  ];
  const DATE_KEYS = ["BILL DATE", "DATE", "VOUCHER DATE", "INVOICE DATE", "DOC DATE", "TRANSACTION DATE"];

  const getBillNoVal = (row, idx) => {
    if (!row || typeof row !== "object") return `__row_${idx}`;

    // 1. Check explicit candidate list (including NEW VOUCHER NO.)
    const explicit = getRowVal(row, BILL_KEYS);
    if (explicit !== undefined && explicit !== null && String(explicit).trim() !== "") {
      return String(explicit).trim();
    }

    // 2. Search row keys for any key containing VOUCHER, BILL, INVOICE, DOC, MEMO, REF, TXN
    const keys = Object.keys(row);
    for (const key of keys) {
      const clean = key.replace(/[\s._\-]+/g, "").toUpperCase();
      if (clean.includes("VOUCHER") || clean.includes("BILL") || clean.includes("INVOICE") || clean.includes("MEMO") || clean.includes("DOC") || clean.includes("RECEIPT") || clean.includes("CHALLAN") || clean.includes("REF")) {
        if (!/(STORE|BRANCH|DATE|QTY|QUANTITY|AMOUNT|PRICE|TOTAL|NET|GROSS|ITEM|CODE|NAME|BRAND|CATEGORY|GST|TAX|RATE|DISC|COST)/i.test(clean)) {
          const val = row[key];
          if (val !== undefined && val !== null && String(val).trim() !== "") {
            return String(val).trim();
          }
        }
      }
    }

    // 3. Fallback check if values in any row look like bill/voucher numbers (e.g. 'RI - 1 WMP001', 'V-1001')
    for (const key of keys) {
      const cleanKey = key.toUpperCase();
      if (cleanKey.includes("STORE") || cleanKey.includes("BRANCH") || cleanKey.includes("DATE") || cleanKey.includes("QTY") || cleanKey.includes("AMOUNT") || cleanKey.includes("TOTAL") || cleanKey.includes("ITEM") || cleanKey.includes("CODE")) continue;
      const val = String(row[key] || "").trim();
      if (/^(RI\s*-\s*\d+|V|BILL|INV|VCH|REF|CM|DOC)[-/\s]?/i.test(val)) {
        return val;
      }
    }

    // 4. Fallback if the sheet has no bill number column: each row is 1 transaction/bill
    return `__row_${idx}`;
  };

  const getStoreNameVal = (row) => {
    const raw = getRowVal(row, STORE_KEYS);
    if (!raw) return "";
    const norm = normalizeStoreName(String(raw));
    return (norm || String(raw)).trim().toUpperCase();
  };

  const extractStores = (data) => {
    const storeSet = new Set();
    data.forEach(row => {
      const sName = getStoreNameVal(row);
      if (sName) {
        storeSet.add(sName);
      }
    });
    setStores(Array.from(storeSet).sort());
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === "shyam") {
      setIsAuthenticated(true);
      toast.success("Access Granted");
    } else {
      toast.error("Incorrect Password");
    }
  };

  const handleUploadHistoricalFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const toastId = toast.loading("Saving data to local database...");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const headerRowIndex = findHeaderRowIndex(worksheet);
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "", range: headerRowIndex });
        
        if (jsonData.length === 0) {
          toast.error("File is empty.", { id: toastId });
          return;
        }

        await appendHistoricalData(jsonData);
        
        // Refresh local state with merged data
        const freshData = await loadHistoricalData();
        setDbData(freshData);
        extractStores(freshData);
        setIsUploadModalOpen(false);
        
        toast.success("Successfully saved locally!", { id: toastId });
      } catch (err) {
        console.error(err);
        toast.error(`Upload Failed: ${err.message}`, { id: toastId });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null; // reset input
  };

  const handleClearDB = async () => {
    if (window.confirm("Are you sure you want to clear the historical database? This cannot be undone.")) {
      try {
        await clearHistoricalData();
        setDbData(null);
        setStores([]);
        setSelectedStores([]);
        toast.success("Database cleared.");
      } catch (err) {
        console.error(err);
        toast.error("Failed to clear database.");
      }
    }
  };

  // Data processing hook
  const { aggregatedData, insights } = useMemo(() => {
    if (!dbData || dbData.length === 0) return { aggregatedData: [], insights: null };

    // 1. First calculate overall insights across all data for the top cards
    const storeTotals = {};
    let grandTotalRev = 0;
    let grandTotalQty = 0;
    const globalBillsSet = new Set();

    dbData.forEach((row, idx) => {
      const sName = getStoreNameVal(row);
      if (sName) {
        const qty = parseFloat(getRowVal(row, QTY_KEYS)) || 0;
        const amount = parseFloat(getRowVal(row, AMOUNT_KEYS)) || 0;
        const billNo = getBillNoVal(row, idx);
        
        if (!storeTotals[sName]) storeTotals[sName] = { rev: 0, qty: 0 };
        storeTotals[sName].rev += amount;
        storeTotals[sName].qty += qty;
        
        grandTotalRev += amount;
        grandTotalQty += qty;
        if (billNo) globalBillsSet.add(`${sName}::${billNo}`);
      }
    });

    let bestStore = { name: "-", rev: 0 };
    for (const [s, data] of Object.entries(storeTotals)) {
      if (data.rev > bestStore.rev) bestStore = { name: s, rev: data.rev };
    }

    const calculatedInsights = {
      bestStore: bestStore.name,
      bestStoreRev: bestStore.rev,
      totalRev: grandTotalRev,
      totalQty: grandTotalQty,
      totalBills: globalBillsSet.size
    };

    // 2. Now calculate the specific Monthly Aggregated Data for the Preview Table and Export
    // Filter by selected stores
    if (selectedStores.length === 0) return { aggregatedData: [], insights: calculatedInsights };

    const storeData = dbData.filter(row => {
      const sName = getStoreNameVal(row);
      return sName && selectedStores.includes(sName);
    });

    // Add parsed dates
    const parsedData = storeData.map((row, idx) => {
      const rawDate = getRowVal(row, DATE_KEYS);
      let parsedDate = parseBillDate(rawDate);
      if (!parsedDate && rawDate) parsedDate = new Date(rawDate);
      return { ...row, _parsedDate: parsedDate, _originalIdx: idx };
    }).filter(row => row._parsedDate && !isNaN(row._parsedDate));

    // Parse start and end months
    const [startYear, startM] = startMonth.split("-").map(Number);
    const [endYear, endM] = endMonth.split("-").map(Number);
    
    // Create Date objects
    const startDateObj = new Date(startYear, startM - 1, 1);
    const endDateObj = new Date(endYear, endM, 0, 23, 59, 59);

    const filteredData = parsedData.filter(row => row._parsedDate >= startDateObj && row._parsedDate <= endDateObj);

    // Aggregate by month (MMM-YYYY)
    const monthMap = {}; // { 'Aug-2025': { _dateObj, store1: { rev, qty, billsSet }, store2: ... } }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    filteredData.forEach(row => {
      const storeName = getStoreNameVal(row);
      const d = row._parsedDate;
      const monthKey = `${monthNames[d.getMonth()]}-${d.getFullYear()}`;
      
      const qty = parseFloat(getRowVal(row, QTY_KEYS)) || 0;
      const amount = parseFloat(getRowVal(row, AMOUNT_KEYS)) || 0;
      const billNo = getBillNoVal(row, row._originalIdx || 0);

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = { _dateObj: new Date(d.getFullYear(), d.getMonth(), 1) };
        selectedStores.forEach(s => {
          monthMap[monthKey][s] = { rev: 0, qty: 0, billsSet: new Set() };
        });
      }
      
      if (monthMap[monthKey][storeName]) {
        monthMap[monthKey][storeName].rev += amount;
        monthMap[monthKey][storeName].qty += qty;
        if (billNo) {
          monthMap[monthKey][storeName].billsSet.add(billNo);
        }
      }
    });

    // Convert to sorted array
    const sortedMonths = Object.keys(monthMap).sort((a, b) => monthMap[a]._dateObj - monthMap[b]._dateObj);
    
    const finalAggregated = sortedMonths.map(m => {
      const res = { Month: m };
      selectedStores.forEach(s => {
        res[`${s} Sales`] = monthMap[m][s].rev;
        res[`${s} Qty`] = monthMap[m][s].qty;
        res[`${s} Bills`] = monthMap[m][s].billsSet.size;
      });
      return res;
    });

    return { aggregatedData: finalAggregated, insights: calculatedInsights };

  }, [dbData, selectedStores, startMonth, endMonth]);


  const handleGenerateReport = async () => {
    if (aggregatedData.length === 0) {
      toast.error("No data available to export.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Monthly Sales");

    const title = `Monthly Sales Report: ${selectedStores.join(" vs ")} (${startMonth} to ${endMonth})`;
    
    // Title Row
    const endColIndex = 1 + (selectedStores.length * 3);
    const endColLetter = String.fromCharCode(64 + endColIndex);
    sheet.mergeCells(`A1:${endColLetter}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    // Blank row
    sheet.addRow([]);

    // Headers
    const headers = ["Month"];
    selectedStores.forEach(s => {
      headers.push(`${s} Sales (₹)`);
      headers.push(`${s} Qty`);
      headers.push(`${s} Bills Made`);
    });
    
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    // Data and Totals
    const totals = {};
    selectedStores.forEach(s => totals[s] = { rev: 0, qty: 0, bills: 0 });

    aggregatedData.forEach(row => {
      const dataRow = [row.Month];
      selectedStores.forEach(s => {
        const rev = row[`${s} Sales`] || 0;
        const qty = row[`${s} Qty`] || 0;
        const bills = row[`${s} Bills`] || 0;
        
        totals[s].rev += rev;
        totals[s].qty += qty;
        totals[s].bills += bills;
        
        dataRow.push(rev);
        dataRow.push(qty);
        dataRow.push(bills);
      });
      const sheetRow = sheet.addRow(dataRow);
      
      sheetRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, 
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, 
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        };
        
        if (colNumber === 1) {
          cell.font = { bold: true };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if ((colNumber - 2) % 3 === 0) { // Sales
          cell.numFmt = '₹#,##0.00';
        } else if ((colNumber - 2) % 3 === 1) { // Qty
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else { // Bills Made
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      });
    });

    // Add Grand Total Row
    const totalDataRow = ["Grand Total"];
    selectedStores.forEach(s => {
      totalDataRow.push(totals[s].rev);
      totalDataRow.push(totals[s].qty);
      totalDataRow.push(totals[s].bills);
    });
    
    const totalRow = sheet.addRow(totalDataRow);
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    
    totalRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF9CA3AF' } }, 
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'medium', color: { argb: 'FF9CA3AF' } }, 
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
      
      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if ((colNumber - 2) % 3 === 0) { // Sales
        cell.numFmt = '₹#,##0.00';
      } else if ((colNumber - 2) % 3 === 1) { // Qty
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else { // Bills Made
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });

    // Auto-size columns
    sheet.columns.forEach((column, i) => {
      column.width = i === 0 ? 15 : 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const storePrefix = selectedStores.length === 1 ? selectedStores[0].replace(/ /g, "_") : selectedStores.length > 1 ? "Multiple_Stores" : "All_Stores";
    saveAs(blob, `${storePrefix}_Monthly_Sales_${startMonth}_to_${endMonth}.xlsx`);
    
    toast.success("Stylish Report Generated!");
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-8 rounded-3xl border border-white/80 dark:border-white/10 shadow-2xl max-w-md w-full"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">Restricted Access</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-8">Please enter the master password to access the historical database.</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  const val = e.target.value;
                  setPassword(val);
                  if (val === "shyam") {
                    setIsAuthenticated(true);
                    toast.success("Access Granted");
                  }
                }}
                placeholder="Enter password..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Unlock Dashboard
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Historical Sales Dashboard</h2>
          <p className="text-gray-500 dark:text-gray-400">Analyze long-term trends and compare stores.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
          <div className="flex items-center bg-white/50 dark:bg-slate-800/50 p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <Database className={`w-5 h-5 ${dbData ? 'text-green-500' : 'text-gray-400'}`} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-2">
              {isLoading ? "Loading..." : (dbData ? `${dbData.length} records` : "No Database")}
            </span>
            {dbData && (
              <button 
                onClick={handleClearDB}
                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500 transition-colors ml-2"
                title="Clear Database"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center px-4 py-2.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-xl font-medium transition-colors border border-emerald-200 dark:border-emerald-800"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Data
          </button>
        </div>
      </div>

      {/* Top Insights */}
      {insights && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        >
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100 font-medium">Top Performing Store</span>
              <TrendingUp className="w-5 h-5 text-blue-200" />
            </div>
            <div className="text-2xl font-bold truncate">{insights.bestStore}</div>
            <div className="text-sm text-blue-200 mt-1">{formatCurrency(insights.bestStoreRev)} All Time</div>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/80 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Total Database Revenue</span>
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(insights.totalRev)}</div>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/80 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Total Database Qty</span>
              <Package className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{insights.totalQty.toLocaleString()} items</div>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/80 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Total Bills Made</span>
              <Receipt className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{insights.totalBills.toLocaleString()} bills</div>
          </div>
        </motion.div>
      )}

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Sidebar: Filters */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:w-1/3 space-y-6"
        >
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-white/80 dark:border-white/10 shadow-xl">
            <div className="flex items-center mb-6 space-x-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Filters</h3>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <Store className="w-4 h-4 mr-2" /> Compare Stores
                </label>
                <div className="w-full h-48 overflow-y-auto px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-slate-800/50 flex flex-col gap-2">
                  {stores.length === 0 && <p className="text-gray-500 text-sm">No stores available in database.</p>}
                  {stores.map(store => (
                    <label key={store} className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedStores.includes(store)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStores(prev => [...prev, store]);
                          } else {
                            setSelectedStores(prev => prev.filter(s => s !== store));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">{store}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" /> Date Range
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Start Month</span>
                    <input 
                      type="month" 
                      value={startMonth}
                      onChange={(e) => setStartMonth(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-slate-800/50 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">End Month</span>
                    <input 
                      type="month" 
                      value={endMonth}
                      onChange={(e) => setEndMonth(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-slate-800/50 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleGenerateReport}
                disabled={aggregatedData.length === 0}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
              >
                <FileSpreadsheet className="w-5 h-5 mr-2" />
                Download Excel Report
              </button>
            </div>
          </div>
        </motion.div>

        {/* Right Area: Preview Table */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:w-2/3"
        >
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-white/80 dark:border-white/10 shadow-xl h-full min-h-[400px]">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Report Preview</h3>
            
            {aggregatedData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                <FileSpreadsheet className="w-12 h-12 mb-3 opacity-50" />
                <p>Select at least one store to view the preview.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                  <thead className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold rounded-tl-lg">Month</th>
                      {selectedStores.map(store => (
                        <React.Fragment key={store}>
                          <th className="px-4 py-3 font-semibold border-l border-gray-200 dark:border-gray-700">{store} Sales</th>
                          <th className="px-4 py-3 font-semibold bg-gray-50 dark:bg-slate-800/80">{store} Qty</th>
                          <th className="px-4 py-3 font-semibold bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{store} Bills Made</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedData.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{row.Month}</td>
                        {selectedStores.map(store => (
                          <React.Fragment key={store}>
                            <td className="px-4 py-3 border-l border-gray-100 dark:border-gray-800">{formatCurrency(row[`${store} Sales`] || 0)}</td>
                            <td className="px-4 py-3 bg-gray-50/50 dark:bg-slate-800/30">{(row[`${store} Qty`] || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 bg-blue-50/30 dark:bg-blue-900/10 font-semibold text-blue-600 dark:text-blue-400">{(row[`${store} Bills`] || 0).toLocaleString()}</td>
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-800 relative"
            >
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Upload Data</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Upload historical spreadsheet to append to the database.</p>
              
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-emerald-200 dark:border-emerald-800 border-dashed rounded-2xl cursor-pointer bg-emerald-50/50 dark:bg-emerald-900/10 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileSpreadsheet className="w-10 h-10 text-emerald-500 mb-3" />
                  <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">XLSX, XLS files only</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx, .xls"
                  onChange={handleUploadHistoricalFile}
                />
              </label>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
