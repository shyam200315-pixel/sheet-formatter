import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { appendHistoricalData, loadHistoricalData, saveHistoricalData, clearHistoricalData, parseBillDate, findHeaderRowIndex, normalizeStoreName } from "../helpers";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Upload, Database, FileSpreadsheet, Search, Trash2, Calendar, Store, X, TrendingUp, DollarSign, Package, Receipt, FileText, Clock, Cloud, RefreshCw, UploadCloud, Settings } from "lucide-react";
import toast from "react-hot-toast";

export default function HistoricalSales() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  
  const [dbData, setDbData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isManageFilesModalOpen, setIsManageFilesModalOpen] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [showAllFiles, setShowAllFiles] = useState(false);

  // Query state
  const [stores, setStores] = useState([]);
  const [selectedStores, setSelectedStores] = useState([]);
  const [storeMaxDates, setStoreMaxDates] = useState({});
  const [storeDateRanges, setStoreDateRanges] = useState({});
  const [dbLatestDate, setDbLatestDate] = useState(null);
  const [indexedData, setIndexedData] = useState(null);
  const [globalInsights, setGlobalInsights] = useState(null);
  const [fileGroups, setFileGroups] = useState([]);
  const colKeysRef = useRef({ store: null, qty: null, amount: null, date: null, bill: null });
  const insights = globalInsights;

  const formatMonth = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setFullYear(defaultStart.getFullYear() - 1);

  const [startMonth, setStartMonth] = useState(formatMonth(defaultStart));
  const [endMonth, setEndMonth] = useState(formatMonth(defaultEnd));

  const formatDateShort = (d) => {
    if (!d || isNaN(d.getTime())) return "";
    const day = d.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day} ${monthNames[d.getMonth()]}`;
  };

  const formatDateFull = (d) => {
    if (!d || isNaN(d.getTime())) return "";
    const day = d.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Check if data exists on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Auto-adjust Date Range instantly in O(1) using pre-calculated storeDateRanges (NO 50,000-row lag!)
  useEffect(() => {
    const targetStores = selectedStores.length > 0 ? selectedStores : stores;
    if (targetStores.length === 0) return;

    let minDate = null;
    let maxDate = null;

    targetStores.forEach(s => {
      const r = storeDateRanges[s];
      if (r) {
        if (!minDate || r.min < minDate) minDate = r.min;
        if (!maxDate || r.max > maxDate) maxDate = r.max;
      }
    });

    if (minDate && maxDate) {
      setStartMonth(formatMonth(minDate));
      setEndMonth(formatMonth(maxDate));
    }
  }, [selectedStores, storeDateRanges, stores]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await loadHistoricalData();
      if (data && data.length > 0) {
        processAndIndexData(data);
      } else {
        processAndIndexData(null);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load data from database.");
    }
    setIsLoading(false);
  };

  // Fast column key resolution helper (runs once, then O(1) direct property access)
  const findColumnKey = (sampleRow, candidateKeys) => {
    if (!sampleRow || typeof sampleRow !== "object") return null;
    for (const cand of candidateKeys) {
      if (sampleRow[cand] !== undefined && sampleRow[cand] !== null && sampleRow[cand] !== "") return cand;
    }
    const rKeys = Object.keys(sampleRow);
    for (const cand of candidateKeys) {
      const target = cand.trim().toUpperCase();
      const found = rKeys.find(rk => rk.trim().toUpperCase() === target);
      if (found && sampleRow[found] !== undefined) return found;
    }
    const cleanTargets = candidateKeys.map(c => c.replace(/[\s._\-]+/g, "").toUpperCase());
    for (const rk of rKeys) {
      const cleanRk = rk.replace(/[\s._\-]+/g, "").toUpperCase();
      if (cleanTargets.includes(cleanRk) && sampleRow[rk] !== undefined) return rk;
    }
    return null;
  };

  const getRowVal = (row, candidateKeys, type = null) => {
    if (!row || typeof row !== "object") return "";
    if (type && colKeysRef.current[type]) {
      const val = row[colKeysRef.current[type]];
      if (val !== undefined && val !== null) return val;
    }
    const k = findColumnKey(row, candidateKeys);
    if (k) {
      if (type) colKeysRef.current[type] = k;
      return row[k] || "";
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
    const explicit = getRowVal(row, BILL_KEYS, "bill");
    if (explicit !== undefined && explicit !== null && String(explicit).trim() !== "") {
      return String(explicit).trim();
    }
    return `__row_${idx}`;
  };

  const getStoreNameVal = (row) => {
    const raw = getRowVal(row, STORE_KEYS, "store");
    if (!raw) return "";
    const norm = normalizeStoreName(String(raw));
    return (norm || String(raw)).trim().toUpperCase();
  };

  const getRowFileId = (row) => {
    if (row && row._fileId) return row._fileId;
    if (row && row._fileName) return `file_name_${row._fileName}`;
    return "legacy_default";
  };

  const getRowFileName = (row) => {
    if (row && row._fileName) return row._fileName;
    return "Legacy / Direct DB Records";
  };

  // Month names for indexing
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Ultra-fast single-pass processor and indexer (<20ms for 50,000+ rows)
  const processAndIndexData = (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      setDbData(null);
      setIndexedData(null);
      setStores([]);
      setSelectedStores([]);
      setStoreMaxDates({});
      setStoreDateRanges({});
      setDbLatestDate(null);
      setGlobalInsights(null);
      setFileGroups([]);
      return;
    }

    setDbData(data);

    // 1. Pre-warm column keys on first row
    const sample = data[0];
    colKeysRef.current.store = findColumnKey(sample, STORE_KEYS);
    colKeysRef.current.qty = findColumnKey(sample, QTY_KEYS);
    colKeysRef.current.amount = findColumnKey(sample, AMOUNT_KEYS);
    colKeysRef.current.date = findColumnKey(sample, DATE_KEYS);
    colKeysRef.current.bill = findColumnKey(sample, BILL_KEYS);

    const storeKey = colKeysRef.current.store;
    const qtyKey = colKeysRef.current.qty;
    const amtKey = colKeysRef.current.amount;
    const dateKey = colKeysRef.current.date;
    const billKey = colKeysRef.current.bill;

    const storeSet = new Set();
    const datesMap = {};
    const rangesMap = {};
    let overallMax = null;

    // For Insights
    const storeTotals = {};
    let grandTotalRev = 0;
    let grandTotalQty = 0;
    const globalBillsSet = new Set();

    // For File Groups
    const groupsMap = {};

    // Compact indexed records array for instant filtering & aggregation
    const indexedRows = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || typeof row !== "object") continue;

      const rawStore = storeKey ? row[storeKey] : getRowVal(row, STORE_KEYS, "store");
      if (!rawStore) continue;
      const sName = normalizeStoreName(String(rawStore)).trim().toUpperCase();
      if (!sName) continue;

      storeSet.add(sName);

      const rawDate = dateKey ? row[dateKey] : getRowVal(row, DATE_KEYS, "date");
      let parsedDate = parseBillDate(rawDate);
      if (!parsedDate && rawDate) parsedDate = new Date(rawDate);

      const validDate = parsedDate && !isNaN(parsedDate.getTime());
      const timeMs = validDate ? parsedDate.getTime() : 0;

      if (validDate) {
        if (!rangesMap[sName]) {
          rangesMap[sName] = { min: parsedDate, max: parsedDate };
        } else {
          if (parsedDate < rangesMap[sName].min) rangesMap[sName].min = parsedDate;
          if (parsedDate > rangesMap[sName].max) rangesMap[sName].max = parsedDate;
        }

        if (!datesMap[sName] || parsedDate > datesMap[sName]) {
          datesMap[sName] = parsedDate;
        }
        if (!overallMax || parsedDate > overallMax) {
          overallMax = parsedDate;
        }
      }

      const q = qtyKey && row[qtyKey] !== undefined ? (+row[qtyKey] || 0) : (parseFloat(getRowVal(row, QTY_KEYS, "qty")) || 0);
      const a = amtKey && row[amtKey] !== undefined ? (+row[amtKey] || 0) : (parseFloat(getRowVal(row, AMOUNT_KEYS, "amount")) || 0);
      const b = (billKey && row[billKey] !== undefined && row[billKey] !== null && String(row[billKey]).trim() !== "")
        ? String(row[billKey]).trim()
        : getBillNoVal(row, i);

      // Insights accumulation
      if (!storeTotals[sName]) storeTotals[sName] = { rev: 0, qty: 0 };
      storeTotals[sName].rev += a;
      storeTotals[sName].qty += q;
      grandTotalRev += a;
      grandTotalQty += q;
      if (b) globalBillsSet.add(`${sName}::${b}`);

      // File groups accumulation
      const fId = getRowFileId(row);
      const fName = getRowFileName(row);
      const uploadedAt = row._uploadedAt || null;

      let g = groupsMap[fId];
      if (!g) {
        g = groupsMap[fId] = {
          fileId: fId,
          fileName: fName,
          uploadedAt: uploadedAt,
          rowCount: 0,
          minDate: null,
          maxDate: null,
          stores: new Set()
        };
      }
      g.rowCount += 1;
      if (uploadedAt && (!g.uploadedAt || new Date(uploadedAt) > new Date(g.uploadedAt))) {
        g.uploadedAt = uploadedAt;
      }
      g.stores.add(sName);
      if (validDate) {
        if (!g.minDate || parsedDate < g.minDate) g.minDate = parsedDate;
        if (!g.maxDate || parsedDate > g.maxDate) g.maxDate = parsedDate;
      }

      // Compact record
      if (validDate) {
        const mKey = `${MONTH_NAMES[parsedDate.getMonth()]}-${parsedDate.getFullYear()}`;
        const mTime = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1).getTime();
        indexedRows.push({
          s: sName,
          d: parsedDate,
          t: timeMs,
          m: mKey,
          mTime,
          q,
          a,
          b
        });
      }
    }

    let bestStore = { name: "-", rev: 0 };
    for (const [s, sData] of Object.entries(storeTotals)) {
      if (sData.rev > bestStore.rev) bestStore = { name: s, rev: sData.rev };
    }

    const calculatedInsights = {
      bestStore: bestStore.name,
      bestStoreRev: bestStore.rev,
      totalRev: grandTotalRev,
      totalQty: grandTotalQty,
      totalBills: globalBillsSet.size
    };

    const sortedFileGroups = Object.values(groupsMap).map(g => ({
      ...g,
      storesList: Array.from(g.stores).sort()
    })).sort((ga, gb) => {
      const timeA = ga.uploadedAt ? new Date(ga.uploadedAt).getTime() : 0;
      const timeB = gb.uploadedAt ? new Date(gb.uploadedAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      const dateA = ga.maxDate ? ga.maxDate.getTime() : 0;
      const dateB = gb.maxDate ? gb.maxDate.getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return gb.fileName.localeCompare(ga.fileName);
    });

    setStores(Array.from(storeSet).sort());
    setStoreMaxDates(datesMap);
    setStoreDateRanges(rangesMap);
    setDbLatestDate(overallMax);
    setGlobalInsights(calculatedInsights);
    setFileGroups(sortedFileGroups);
    setIndexedData(indexedRows);
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

        await appendHistoricalData(jsonData, file.name);
        
        // Refresh local state with merged data
        const freshData = await loadHistoricalData();
        processAndIndexData(freshData);
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
        processAndIndexData(null);
        toast.success("Database cleared.");
      } catch (err) {
        console.error(err);
        toast.error("Failed to clear database.");
      }
    }
  };

  const filteredFileGroups = useMemo(() => {
    if (!fileSearchQuery.trim()) return fileGroups;
    const query = fileSearchQuery.toLowerCase();
    return fileGroups.filter(g => 
      g.fileName.toLowerCase().includes(query) ||
      g.storesList.some(s => s.toLowerCase().includes(query))
    );
  }, [fileGroups, fileSearchQuery]);

  const displayedFileGroups = useMemo(() => {
    if (fileSearchQuery.trim()) return filteredFileGroups;
    if (showAllFiles) return filteredFileGroups;
    return filteredFileGroups.slice(0, 50);
  }, [filteredFileGroups, fileSearchQuery, showAllFiles]);

  const handleDeleteFileGroup = async (group) => {
    if (!window.confirm(`Are you sure you want to delete file "${group.fileName}" (${group.rowCount.toLocaleString()} records)? This cannot be undone.`)) {
      return;
    }

    setDeletingFileId(group.fileId);
    const toastId = toast.loading(`Deleting ${group.fileName}...`);

    try {
      const updatedDb = dbData ? dbData.filter(row => getRowFileId(row) !== group.fileId) : [];
      await saveHistoricalData(updatedDb.length > 0 ? updatedDb : null);

      const freshData = await loadHistoricalData();
      processAndIndexData(freshData);

      toast.success(`Successfully deleted "${group.fileName}" (${group.rowCount.toLocaleString()} records).`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error(`Failed to delete file: ${err.message}`, { id: toastId });
    } finally {
      setDeletingFileId(null);
    }
  };

  // Ultra-fast Aggregation Hook (<2ms execution, no object clones or string parsing on filter changes)
  const aggregatedData = useMemo(() => {
    if (!indexedData || indexedData.length === 0 || selectedStores.length === 0) {
      return [];
    }

    const selStoreSet = new Set(selectedStores);

    // Parse start and end months
    const [startYear, startM] = startMonth.split("-").map(Number);
    const [endYear, endM] = endMonth.split("-").map(Number);
    const startMs = new Date(startYear, startM - 1, 1).getTime();
    const endMs = new Date(endYear, endM, 0, 23, 59, 59, 999).getTime();

    const monthMap = {};

    for (let i = 0; i < indexedData.length; i++) {
      const rec = indexedData[i];
      if (rec.t < startMs || rec.t > endMs) continue;
      if (!selStoreSet.has(rec.s)) continue;

      let mEntry = monthMap[rec.m];
      if (!mEntry) {
        mEntry = monthMap[rec.m] = {
          Month: rec.m,
          _mTime: rec.mTime,
          _maxDate: null,
          storeData: {}
        };
        for (let sIdx = 0; sIdx < selectedStores.length; sIdx++) {
          mEntry.storeData[selectedStores[sIdx]] = { rev: 0, qty: 0, bills: new Set(), maxDate: null };
        }
      }

      if (!mEntry._maxDate || rec.d > mEntry._maxDate) {
        mEntry._maxDate = rec.d;
      }

      const sData = mEntry.storeData[rec.s];
      if (sData) {
        sData.rev += rec.a;
        sData.qty += rec.q;
        if (rec.b) sData.bills.add(rec.b);
        if (!sData.maxDate || rec.d > sData.maxDate) {
          sData.maxDate = rec.d;
        }
      }
    }

    const sortedMonths = Object.values(monthMap).sort((a, b) => a._mTime - b._mTime);

    return sortedMonths.map(m => {
      const rowMaxDate = m._maxDate;
      const mtdLabel = rowMaxDate ? `Till ${formatDateShort(rowMaxDate)}` : "";
      const res = {
        Month: m.Month,
        _maxDate: rowMaxDate,
        mtdLabel: mtdLabel
      };

      for (let sIdx = 0; sIdx < selectedStores.length; sIdx++) {
        const s = selectedStores[sIdx];
        const sData = m.storeData[s] || { rev: 0, qty: 0, bills: new Set(), maxDate: null };
        const rev = sData.rev;
        const qty = sData.qty;
        const bills = sData.bills.size;
        const abv = bills > 0 ? rev / bills : 0;
        const upt = bills > 0 ? qty / bills : 0;
        const sMaxDate = sData.maxDate;

        res[`${s} Sales`] = rev;
        res[`${s} Qty`] = qty;
        res[`${s} Bills`] = bills;
        res[`${s} ABV`] = abv;
        res[`${s} UPT`] = upt;
        res[`${s} MaxDate`] = sMaxDate;
        res[`${s} MtdLabel`] = sMaxDate ? `Till ${formatDateShort(sMaxDate)}` : "";
      }
      return res;
    });
  }, [indexedData, selectedStores, startMonth, endMonth]);


  const handleGenerateReport = async () => {
    if (aggregatedData.length === 0) {
      toast.error("No data available to export.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Monthly Sales");

    const title = `Monthly Sales Report: ${selectedStores.join(" vs ")} (${startMonth} to ${endMonth})`;
    
    // Title Row
    const endColIndex = 1 + (selectedStores.length * 5);
    const endColLetter = String.fromCharCode(64 + Math.min(endColIndex, 26)); // ExcelJS handle or col letter
    sheet.mergeCells(1, 1, 1, endColIndex);
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
      headers.push(`${s} ABV (₹)`);
      headers.push(`${s} UPT`);
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

    aggregatedData.forEach((row, idx) => {
      const isLastRow = idx === aggregatedData.length - 1;
      const monthDisplay = (isLastRow && row.mtdLabel) ? `${row.Month} (${row.mtdLabel})` : row.Month;
      const dataRow = [monthDisplay];
      selectedStores.forEach(s => {
        const rev = row[`${s} Sales`] || 0;
        const qty = row[`${s} Qty`] || 0;
        const bills = row[`${s} Bills`] || 0;
        const abv = row[`${s} ABV`] || 0;
        const upt = row[`${s} UPT`] || 0;
        
        totals[s].rev += rev;
        totals[s].qty += qty;
        totals[s].bills += bills;
        
        dataRow.push(rev);
        dataRow.push(qty);
        dataRow.push(bills);
        dataRow.push(abv);
        dataRow.push(upt);
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
        } else {
          const mod = (colNumber - 2) % 5;
          if (mod === 0) { // Sales
            cell.numFmt = '₹#,##0.00';
          } else if (mod === 1) { // Qty
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (mod === 2) { // Bills Made
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (mod === 3) { // ABV
            cell.numFmt = '₹#,##0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (mod === 4) { // UPT
            cell.numFmt = '0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
        }
      });
    });

    // Add Grand Total Row
    const totalDataRow = ["Grand Total"];
    selectedStores.forEach(s => {
      const gRev = totals[s].rev;
      const gQty = totals[s].qty;
      const gBills = totals[s].bills;
      const gAbv = gBills > 0 ? gRev / gBills : 0;
      const gUpt = gBills > 0 ? gQty / gBills : 0;

      totalDataRow.push(gRev);
      totalDataRow.push(gQty);
      totalDataRow.push(gBills);
      totalDataRow.push(gAbv);
      totalDataRow.push(gUpt);
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
      } else {
        const mod = (colNumber - 2) % 5;
        if (mod === 0) { // Sales
          cell.numFmt = '₹#,##0.00';
        } else if (mod === 1) { // Qty
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (mod === 2) { // Bills Made
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (mod === 3) { // ABV
          cell.numFmt = '₹#,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (mod === 4) { // UPT
          cell.numFmt = '0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
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

  const formatCurrency = (amount, maxDecimals = 0) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: maxDecimals }).format(amount);
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

  if (isLoading) {
    return <HistoricalSalesSkeleton />;
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
              {isLoading ? "Loading..." : (dbData ? `${dbData.length.toLocaleString()} records (${fileGroups.length} ${fileGroups.length === 1 ? 'file' : 'files'})` : "No Database")}
            </span>
            {dbData && (
              <button 
                onClick={handleClearDB}
                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500 transition-colors ml-2"
                title="Clear All Historical Database"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>


          
          {dbData && dbData.length > 0 && (
            <button
              onClick={() => {
                setShowAllFiles(false);
                setIsManageFilesModalOpen(true);
              }}
              className="flex items-center px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 rounded-xl font-medium transition-colors border border-indigo-200 dark:border-indigo-800 shadow-sm"
              title="View and delete specific uploaded files"
            >
              <FileText className="w-4 h-4 mr-2" />
              Manage / Delete Files
            </button>
          )}

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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6"
        >
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100 font-medium text-sm">Top Store</span>
              <TrendingUp className="w-5 h-5 text-blue-200" />
            </div>
            <div className="text-xl font-bold truncate">{insights.bestStore}</div>
            <div className="text-xs text-blue-200 mt-1">{formatCurrency(insights.bestStoreRev)} All Time</div>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/80 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium text-xs">Total Revenue</span>
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(insights.totalRev)}</div>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/80 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium text-xs">Total Quantity</span>
              <Package className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{insights.totalQty.toLocaleString()} items</div>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/80 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium text-xs">Total Bills</span>
              <Receipt className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{insights.totalBills.toLocaleString()} bills</div>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/80 dark:border-white/10 shadow-lg border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium text-xs">Data Available Till</span>
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{dbLatestDate ? formatDateFull(dbLatestDate) : "N/A"}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Latest MTD Date</div>
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
                          <th className="px-4 py-3 font-semibold bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">{store} ABV</th>
                          <th className="px-4 py-3 font-semibold bg-purple-50/50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">{store} UPT</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedData.map((row, i) => {
                      const isLastRow = i === aggregatedData.length - 1;
                      return (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                            <div className="flex flex-col items-start">
                              <span className="font-semibold text-gray-900 dark:text-white">{row.Month}</span>
                              {isLastRow && row.mtdLabel && (
                                <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                                  <Calendar className="w-3 h-3 mr-1 text-blue-600 dark:text-blue-400" />
                                  {row.mtdLabel}
                                </span>
                              )}
                            </div>
                          </td>
                          {selectedStores.map(store => (
                            <React.Fragment key={store}>
                              <td className="px-4 py-3 border-l border-gray-100 dark:border-gray-800">{formatCurrency(row[`${store} Sales`] || 0, 0)}</td>
                              <td className="px-4 py-3 bg-gray-50/50 dark:bg-slate-800/30">{(row[`${store} Qty`] || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 bg-blue-50/30 dark:bg-blue-900/10 font-semibold text-blue-600 dark:text-blue-400">{(row[`${store} Bills`] || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 bg-amber-50/30 dark:bg-amber-900/10 font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(row[`${store} ABV`] || 0, 2)}</td>
                              <td className="px-4 py-3 bg-purple-50/30 dark:bg-purple-900/10 font-semibold text-purple-600 dark:text-purple-400">{(row[`${store} UPT`] || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                            </React.Fragment>
                          ))}
                        </tr>
                      );
                    })}
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

      {/* Manage / Delete Files Modal */}
      <AnimatePresence>
        {isManageFilesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-800 relative"
            >
              <button 
                onClick={() => {
                  setShowAllFiles(false);
                  setIsManageFilesModalOpen(false);
                }}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Uploaded Files Manager</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Select any uploaded file to delete it from the historical sales database.</p>
                </div>
              </div>

              {/* Search Bar & Summary */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 my-4">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search file name or store..."
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium self-end sm:self-center">
                  {fileSearchQuery.trim() ? (
                    <span>Matches: <span className="font-semibold text-gray-700 dark:text-gray-200">{filteredFileGroups.length}</span> files</span>
                  ) : (
                    <span>
                      {fileGroups.length > 50 && !showAllFiles ? (
                        <>Showing Recent: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{displayedFileGroups.length}</span> of </>
                      ) : (
                        <>Total: </>
                      )}
                      <span className="font-semibold text-gray-700 dark:text-gray-200">{fileGroups.length}</span> files
                    </span>
                  )} | Total Records: <span className="font-semibold text-gray-700 dark:text-gray-200">{dbData ? dbData.length.toLocaleString() : 0}</span>
                </div>
              </div>

              {/* Limit 50 notice banner */}
              {fileGroups.length > 50 && !fileSearchQuery.trim() && (
                <div className="flex items-center justify-between px-4 py-2.5 mb-3 bg-indigo-50/80 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl text-xs text-indigo-700 dark:text-indigo-300">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span>
                      {showAllFiles
                        ? `Showing all ${fileGroups.length} files.`
                        : `Showing recent 50 files. Older data is securely saved in the database.`}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAllFiles(!showAllFiles)}
                    className="underline hover:text-indigo-900 dark:hover:text-white font-semibold ml-2 cursor-pointer transition-colors"
                  >
                    {showAllFiles ? "Show Recent 50 Only" : `Show All ${fileGroups.length} Files`}
                  </button>
                </div>
              )}

              {/* Files List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-[250px]">
                {displayedFileGroups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                    <FileText className="w-10 h-10 text-gray-400 mb-2 opacity-60" />
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No files found</p>
                    <p className="text-xs text-gray-400 mt-1">Try searching with a different keyword or upload a file.</p>
                  </div>
                ) : (
                  <>
                    {displayedFileGroups.map((group) => (
                      <div 
                        key={group.fileId} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 transition-all gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span className="font-semibold text-gray-900 dark:text-white text-sm truncate" title={group.fileName}>
                              {group.fileName}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                              {group.rowCount.toLocaleString()} records
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-500 dark:text-gray-400">
                            {group.minDate && group.maxDate && (
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                <span>{formatDateShort(group.minDate)} - {formatDateFull(group.maxDate)}</span>
                              </div>
                            )}
                            {group.uploadedAt && (
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                <span>Uploaded: {new Date(group.uploadedAt).toLocaleDateString()} {new Date(group.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            )}
                            {group.storesList.length > 0 && (
                              <div className="flex items-center space-x-1 truncate max-w-xs">
                                <Store className="w-3.5 h-3.5 text-amber-500" />
                                <span className="truncate">{group.storesList.join(", ")}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteFileGroup(group)}
                          disabled={deletingFileId === group.fileId}
                          className="flex items-center justify-center px-3.5 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold transition-colors border border-red-200 dark:border-red-800 shrink-0 self-end sm:self-center"
                          title={`Delete ${group.fileName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          {deletingFileId === group.fileId ? "Deleting..." : "Delete File"}
                        </button>
                      </div>
                    ))}

                    {!showAllFiles && !fileSearchQuery.trim() && filteredFileGroups.length > 50 && (
                      <div className="p-3.5 text-center bg-gray-50/80 dark:bg-slate-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 mt-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          +{filteredFileGroups.length - 50} older files are securely saved in the database.
                        </p>
                        <button
                          onClick={() => setShowAllFiles(true)}
                          className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 text-xs font-semibold rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
                        >
                          Show All {filteredFileGroups.length} Files
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                <button
                  onClick={() => {
                    setShowAllFiles(false);
                    setIsManageFilesModalOpen(false);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}


      </AnimatePresence>
    </div>
  );
}

function HistoricalSalesSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
        <div className="space-y-2.5">
          <div className="h-8 w-72 bg-gray-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-4 w-96 bg-gray-100 dark:bg-slate-800/60 rounded-xl max-w-full" />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-10 w-48 bg-gray-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-10 w-36 bg-gray-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* Top 5 Metrics Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i} 
            className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-5 border border-white/80 dark:border-white/10 shadow-lg space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-gray-200 dark:bg-slate-800 rounded" />
              <div className="w-5 h-5 bg-gray-200 dark:bg-slate-800 rounded-full" />
            </div>
            <div className="h-7 w-28 bg-gray-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-3 w-16 bg-gray-100 dark:bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* Main Layout Skeleton */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar Filters Skeleton */}
        <div className="lg:w-1/3 space-y-6">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-white/80 dark:border-white/10 shadow-xl space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gray-200 dark:bg-slate-800 rounded-xl" />
              <div className="h-6 w-24 bg-gray-200 dark:bg-slate-800 rounded-lg" />
            </div>

            <div className="space-y-3">
              <div className="h-4 w-32 bg-gray-200 dark:bg-slate-800 rounded" />
              <div className="w-full h-48 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/40 dark:bg-slate-800/30 p-3 space-y-2.5">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-gray-200 dark:bg-slate-700 rounded" />
                    <div className={`h-3.5 bg-gray-200 dark:bg-slate-700 rounded ${j % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-800 rounded" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-11 bg-gray-100 dark:bg-slate-800 rounded-xl" />
                <div className="h-11 bg-gray-100 dark:bg-slate-800 rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-3.5 w-24 bg-gray-200 dark:bg-slate-800 rounded" />
              <div className="flex gap-2">
                <div className="h-8 w-16 bg-gray-200 dark:bg-slate-800 rounded-lg" />
                <div className="h-8 w-16 bg-gray-200 dark:bg-slate-800 rounded-lg" />
                <div className="h-8 w-16 bg-gray-200 dark:bg-slate-800 rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Content Area Skeleton */}
        <div className="lg:w-2/3">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl border border-white/80 dark:border-white/10 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="space-y-2">
                <div className="h-6 w-48 bg-gray-200 dark:bg-slate-800 rounded-xl" />
                <div className="h-3.5 w-64 bg-gray-100 dark:bg-slate-800/60 rounded" />
              </div>
              <div className="h-10 w-36 bg-gray-200 dark:bg-slate-800 rounded-xl" />
            </div>

            {/* Table Mock Rows */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 pb-3">
                    <th className="py-3 px-4"><div className="h-4 w-28 bg-gray-200 dark:bg-slate-800 rounded" /></th>
                    <th className="py-3 px-4"><div className="h-4 w-24 bg-gray-200 dark:bg-slate-800 rounded" /></th>
                    <th className="py-3 px-4"><div className="h-4 w-16 bg-gray-200 dark:bg-slate-800 rounded" /></th>
                    <th className="py-3 px-4"><div className="h-4 w-16 bg-gray-200 dark:bg-slate-800 rounded" /></th>
                    <th className="py-3 px-4"><div className="h-4 w-16 bg-gray-200 dark:bg-slate-800 rounded" /></th>
                    <th className="py-3 px-4"><div className="h-4 w-16 bg-gray-200 dark:bg-slate-800 rounded" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {[...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td className="py-4 px-4"><div className={`h-4 bg-gray-200 dark:bg-slate-800 rounded ${i % 2 === 0 ? 'w-40' : 'w-32'}`} /></td>
                      <td className="py-4 px-4"><div className="h-4 w-24 bg-gray-100 dark:bg-slate-800/80 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-16 bg-gray-100 dark:bg-slate-800/80 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-16 bg-gray-100 dark:bg-slate-800/80 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-16 bg-gray-100 dark:bg-slate-800/80 rounded" /></td>
                      <td className="py-4 px-4"><div className="h-4 w-14 bg-gray-100 dark:bg-slate-800/80 rounded" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
