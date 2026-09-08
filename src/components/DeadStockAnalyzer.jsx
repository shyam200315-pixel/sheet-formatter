import React, { useState, useMemo, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { 
  Package, 
  Search, 
  ArrowLeft, 
  UploadCloud, 
  Download, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRightLeft, 
  ShoppingCart, 
  CheckCircle2, 
  XCircle, 
  Sliders, 
  Sparkles, 
  Calendar, 
  MapPin,
  CheckCircle,
  RefreshCw,
  FileSpreadsheet,
  Database,
  Save,
  PlusCircle,
  DatabaseZap,
  Check,
  Trash2
} from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { 
  loadHistoricalData, 
  appendHistoricalData, 
  saveHistoricalData, 
  clearHistoricalData,
  processSalesRowsToMap, 
  findHeaderRowIndex,
  extractStoreCode as extractStoreCodeHelper,
  getStateFromStore as getStateFromStoreHelper
} from "../helpers";

// Store Code extraction (e.g. 'WMH001 - NED - VAZIRABAD' -> 'WMH001')
const extractStoreCode = (branchStr) => {
  return extractStoreCodeHelper(branchStr);
};

// State extraction (MH vs MP)
const getStateFromStore = (storeStr) => {
  return getStateFromStoreHelper(storeStr);
};

// Date parser
const parseAnyDate = (dateVal) => {
  if (!dateVal) return null;
  if (typeof dateVal === "number") {
    return new Date(Math.round((dateVal - (25567 + 2)) * 86400 * 1000));
  }
  const str = String(dateVal).trim();
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export default function DeadStockAnalyzer({ onBack }) {
  // Raw Data
  const [salesDataRaw, setSalesDataRaw] = useState(null);
  const [stockDataRaw, setStockDataRaw] = useState(null);
  const [orderDataRaw, setOrderDataRaw] = useState(null);

  // File Names
  const [salesFileName, setSalesFileName] = useState("");
  const [stockFileName, setStockFileName] = useState("");
  const [orderFileName, setOrderFileName] = useState("");

  // Saved Database state
  const [useSavedSalesDB, setUseSavedSalesDB] = useState(false);
  const [savedDbCount, setSavedDbCount] = useState(null);
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  // Loading flags
  const [isParsingSales, setIsParsingSales] = useState(false);
  const [isParsingStock, setIsParsingStock] = useState(false);
  const [isParsingOrder, setIsParsingOrder] = useState(false);

  // Sales Period Metadata
  const [salesPeriodInfo, setSalesPeriodInfo] = useState({
    periodDays: 90,
    periodMonths: 3.0,
    labelText: "Sales Period"
  });

  // Settings
  const [strictSameState, setStrictSameState] = useState(true);
  const [retentionQty, setRetentionQty] = useState(2); // Units to keep at store

  // Filters
  const [selectedStore, setSelectedStore] = useState("All Stores");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("DEAD"); // 'DEAD' | 'ACTIVE' | 'ALL'
  const [searchTerm, setSearchTerm] = useState("");
  const [auditFilter, setAuditFilter] = useState("ALL"); // 'ALL' | 'DENE_CHAHIYE' | 'NAHI_DENE_CHAHIYE'

  // Active Tab: 'dead-stock' | 'order-audit'
  const [activeTab, setActiveTab] = useState("dead-stock");

  const salesInputRef = useRef(null);
  const stockInputRef = useRef(null);
  const orderInputRef = useRef(null);
  const appendSalesInputRef = useRef(null);

  // Check and auto-load saved sales DB on mount
  useEffect(() => {
    const initDb = async () => {
      try {
        let dbRows = await loadHistoricalData();

        // Auto-seed from public/seed_sales.json if DB is empty
        if (!dbRows || dbRows.length === 0) {
          try {
            const res = await fetch("/seed_sales.json");
            if (res.ok) {
              const seedRows = await res.json();
              if (seedRows && seedRows.length > 0) {
                await saveHistoricalData(seedRows);
                dbRows = seedRows;
              }
            }
          } catch (e) {
            // Ignore seed fetch error silently on mount
          }
        }

        if (dbRows && dbRows.length > 0) {
          const { salesMap, periodInfo, totalRows } = processSalesRowsToMap(dbRows);
          setSalesDataRaw(salesMap);
          setSalesPeriodInfo(periodInfo);
          setSalesFileName(`Saved DB (${totalRows.toLocaleString()} lines - ${periodInfo.labelText})`);
          setUseSavedSalesDB(true);
          setSavedDbCount(totalRows);
        } else {
          setSavedDbCount(0);
        }
      } catch (e) {
        console.error(e);
      }
    };
    initDb();
  }, []);

  // Load Saved Sales DB
  const handleLoadSavedSalesDB = async () => {
    setIsLoadingDb(true);
    try {
      let dbRows = await loadHistoricalData();

      // Auto-seed from public/seed_sales.json if DB is empty
      if (!dbRows || dbRows.length === 0) {
        const toastSeedId = toast.loading("Loading default April-August Sales History file...");
        try {
          const res = await fetch("/seed_sales.json");
          if (res.ok) {
            const seedRows = await res.json();
            if (seedRows && seedRows.length > 0) {
              await saveHistoricalData(seedRows);
              dbRows = seedRows;
              toast.success(`Initialized Database with April-August Sales (${seedRows.length.toLocaleString()} rows)!`, { id: toastSeedId });
            }
          }
        } catch (err) {
          toast.error("Failed to seed default sales data.", { id: toastSeedId });
        }
      }

      if (!dbRows || dbRows.length === 0) {
        toast.error("No historical sales data found. Please upload a sales file first.");
        setIsLoadingDb(false);
        return;
      }

      const { salesMap, periodInfo, totalRows } = processSalesRowsToMap(dbRows);
      setSalesDataRaw(salesMap);
      setSalesPeriodInfo(periodInfo);
      setSalesFileName(`Saved DB (${totalRows.toLocaleString()} lines - ${periodInfo.labelText})`);
      setUseSavedSalesDB(true);
      setSavedDbCount(totalRows);
      toast.success(`⚡ Loaded ${totalRows.toLocaleString()} sales records from Saved Database!`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to load saved sales DB: ${err.message}`);
    } finally {
      setIsLoadingDb(false);
    }
  };

  // Append new month sales data to DB
  const handleAppendSalesToDB = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const toastId = toast.loading("Appending new month sales file to local database...");
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const headerIdx = findHeaderRowIndex(worksheet);
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "", range: headerIdx });

          if (jsonData.length === 0) {
            toast.error("File is empty", { id: toastId });
            return;
          }

          await appendHistoricalData(jsonData);
          const freshData = await loadHistoricalData();
          const { salesMap, periodInfo, totalRows } = processSalesRowsToMap(freshData);
          setSalesDataRaw(salesMap);
          setSalesPeriodInfo(periodInfo);
          setSalesFileName(`Saved DB (${totalRows.toLocaleString()} lines - ${periodInfo.labelText})`);
          setSavedDbCount(totalRows);
          setUseSavedSalesDB(true);
          toast.success(`Successfully added new month sales! Total in DB: ${totalRows.toLocaleString()} lines`, { id: toastId });
        } catch (err) {
          toast.error(`Append failed: ${err.message}`, { id: toastId });
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      toast.error(`Failed to read file: ${err.message}`, { id: toastId });
    }
    e.target.value = null;
  };

  // Clear Saved Sales DB from IndexedDB and state
  const handleClearSalesDB = async () => {
    if (window.confirm("Are you sure you want to clear all saved sales data from the database?")) {
      try {
        await clearHistoricalData();
        setSalesDataRaw(null);
        setSalesFileName("");
        setUseSavedSalesDB(false);
        setSavedDbCount(0);
        setSalesPeriodInfo({
          periodDays: 90,
          periodMonths: 3.0,
          labelText: "No Sales Data"
        });
        toast.success("Saved Sales Database cleared successfully! Upload a fresh sales file.");
      } catch (err) {
        toast.error(`Clear failed: ${err.message}`);
      }
    }
  };

  // Reset files
  const handleResetFiles = () => {
    setSalesDataRaw(null);
    setStockDataRaw(null);
    setOrderDataRaw(null);
    setSalesFileName("");
    setStockFileName("");
    setOrderFileName("");
    setUseSavedSalesDB(false);
  };

  // Parse Sales File
  const handleSalesUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setSalesFileName(file.name);
    setIsParsingSales(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        let headerIdx = -1;
        for (let i = 0; i < Math.min(30, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row) continue;
          const uppercaseCells = row.map(c => String(c).trim().toUpperCase());
          if (uppercaseCells.includes("BRANCH NAME") && (uppercaseCells.includes("BILL DATE") || uppercaseCells.includes("ITEM CODE"))) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          for (let i = 0; i < Math.min(30, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && row.some(cell => String(cell).toUpperCase() === "BRANCH NAME")) {
              headerIdx = i;
              break;
            }
          }
        }

        if (headerIdx === -1) {
          throw new Error("Sales file must contain a header row with 'BRANCH NAME'.");
        }

        const headers = jsonData[headerIdx].map(h => String(h).trim().toUpperCase());
        const branchCol = headers.indexOf("BRANCH NAME") !== -1 ? headers.indexOf("BRANCH NAME") : headers.findIndex(h => h.includes("BRANCH"));
        const itemCol = headers.indexOf("ITEM CODE") !== -1 ? headers.indexOf("ITEM CODE") : headers.findIndex(h => h.includes("ITEM CODE"));
        const addlItemCol = headers.findIndex(h => h.includes("ADDL ITEM") || h.includes("BARCODE"));
        const descCol = headers.findIndex(h => h.includes("DESCRIPTION") || h.includes("MODEL"));
        const brandCol = headers.findIndex(h => h.includes("BRAND"));
        const catCol = headers.findIndex(h => h.includes("CATEGORY"));
        const qtyCol = headers.indexOf("NET QTY") !== -1 ? headers.indexOf("NET QTY") : headers.findIndex(h => h === "TOTAL QTY" || h.includes("QTY"));
        const amountCol = headers.findIndex(h => h.includes("NET SALE AMOUNT") || h.includes("GROSS SALE"));
        const dateCol = headers.findIndex(h => h.includes("BILL DATE"));

        const salesMap = {};
        let minDate = null;
        let maxDate = null;

        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[branchCol]) continue;

          const rawBranch = String(row[branchCol]).trim();
          const storeCode = extractStoreCode(rawBranch);
          const rawItemCode = itemCol !== -1 && row[itemCol] ? String(row[itemCol]).trim() : "";
          const rawAddlCode = addlItemCol !== -1 && row[addlItemCol] ? String(row[addlItemCol]).trim() : "";
          const itemCode = rawItemCode || rawAddlCode;

          if (!itemCode) continue;

          const desc = descCol !== -1 && row[descCol] ? String(row[descCol]).trim() : "";
          const brand = brandCol !== -1 && row[brandCol] ? String(row[brandCol]).trim() : "";
          const category = catCol !== -1 && row[catCol] ? String(row[catCol]).trim() : "";
          const qty = qtyCol !== -1 ? parseFloat(row[qtyCol]) || 0 : 0;
          const amount = amountCol !== -1 ? parseFloat(row[amountCol]) || 0 : 0;
          const billDateStr = dateCol !== -1 && row[dateCol] ? String(row[dateCol]).trim() : "";

          if (billDateStr) {
            const dObj = parseAnyDate(billDateStr);
            if (dObj) {
              if (!minDate || dObj < minDate) minDate = dObj;
              if (!maxDate || dObj > maxDate) maxDate = dObj;
            }
          }

          const key = `${storeCode}::${itemCode}`;
          if (!salesMap[key]) {
            salesMap[key] = {
              storeCode,
              storeState: getStateFromStore(storeCode),
              branchName: rawBranch,
              itemCode,
              description: desc,
              brand,
              category,
              l3mQty: 0,
              l3mAmount: 0
            };
          }

          salesMap[key].l3mQty += qty;
          salesMap[key].l3mAmount += amount;
        }

        let periodDays = 90;
        if (minDate && maxDate) {
          periodDays = Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        }
        const periodMonths = Math.max(0.5, periodDays / 30);

        let dateLabel = `${periodDays} Days (~${periodMonths.toFixed(1)} Months)`;
        if (minDate && maxDate) {
          dateLabel += ` (${minDate.toLocaleDateString('en-IN')} to ${maxDate.toLocaleDateString('en-IN')})`;
        }

        setSalesPeriodInfo({ periodDays, periodMonths, labelText: dateLabel });
        setSalesDataRaw(salesMap);
        toast.success(`Sales File Loaded (${Object.keys(salesMap).length} items)`);
      } catch (err) {
        console.error(err);
        toast.error(`Error parsing Sales File: ${err.message}`);
      } finally {
        setIsParsingSales(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Parse Stock File
  const handleStockUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setStockFileName(file.name);
    setIsParsingStock(true);

    if (!salesDataRaw) {
      handleLoadSavedSalesDB();
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        let headerIdx = -1;
        for (let i = 0; i < Math.min(30, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row) continue;
          const uppercaseCells = row.map(c => String(c).trim().toUpperCase());
          if (uppercaseCells.includes("BRANCH NAME") && uppercaseCells.includes("CLOSING STOCK")) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          throw new Error("Stock file header not found! Sheet must contain 'BRANCH NAME' and 'CLOSING STOCK' columns.");
        }

        const headers = jsonData[headerIdx].map(h => String(h).trim().toUpperCase());
        const branchCol = headers.indexOf("BRANCH NAME");
        const barcodeCol = headers.indexOf("BARCODE");
        const itemNameCol = headers.indexOf("ITEM NAME");
        const descCol = headers.indexOf("ITEM DESCRIPTION");
        const godownCol = headers.indexOf("GODOWN NAME");
        const brandCol = headers.indexOf("BRAND NAME");
        const mainProdCol = headers.indexOf("MAIN PRODUCT");
        const stockCol = headers.indexOf("CLOSING STOCK");
        const valueCol = headers.indexOf("CLOSING VALUE(LANDED COST)");
        const mrpCol = headers.indexOf("ITEM M.R.P");

        const stockItems = [];

        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[branchCol]) continue;

          const rawBranch = String(row[branchCol]).trim();
          const storeCode = extractStoreCode(rawBranch);
          const storeState = getStateFromStore(storeCode);
          const rawBarcode = barcodeCol !== -1 && row[barcodeCol] ? String(row[barcodeCol]).trim() : "";
          const rawItemName = itemNameCol !== -1 && row[itemNameCol] ? String(row[itemNameCol]).trim() : "";
          
          let itemCode = rawBarcode;
          if (!itemCode && rawItemName) {
            itemCode = rawItemName.split(" ")[0];
          }

          if (!itemCode) continue;

          const desc = descCol !== -1 && row[descCol] ? String(row[descCol]).trim() : rawItemName;
          const brand = brandCol !== -1 && row[brandCol] ? String(row[brandCol]).trim() : "";
          const category = mainProdCol !== -1 && row[mainProdCol] ? String(row[mainProdCol]).trim() : "";
          const closingStock = stockCol !== -1 ? parseFloat(row[stockCol]) || 0 : 0;
          const closingValue = valueCol !== -1 ? parseFloat(row[valueCol]) || 0 : 0;
          const mrp = mrpCol !== -1 ? parseFloat(row[mrpCol]) || 0 : 0;

          if (closingStock <= 0) continue;

          let unitCost = closingValue > 0 && closingStock > 0 ? (closingValue / closingStock) : (mrp || 0);

          stockItems.push({
            id: `stk_${storeCode}_${itemCode}_${i}`,
            storeCode,
            storeState,
            branchName: rawBranch,
            itemCode,
            description: desc,
            brand: brand || "General",
            category: category || "General",
            closingStock,
            closingValue: closingValue || (closingStock * mrp),
            unitCost
          });
        }

        setStockDataRaw(stockItems);
        toast.success(`Current Stock Loaded (${stockItems.length} active stock lines)`);
      } catch (err) {
        console.error(err);
        toast.error(`Error parsing Stock File: ${err.message}`);
      } finally {
        setIsParsingStock(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Parse Order Requirement File
  const handleOrderUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setOrderFileName(file.name);
    setIsParsingOrder(true);

    if (!salesDataRaw) {
      handleLoadSavedSalesDB();
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        let headerIdx = -1;
        for (let i = 0; i < Math.min(15, jsonData.length); i++) {
          const row = jsonData[i];
          if (row && row.some(cell => String(cell).toUpperCase().includes("STORE CODE") || String(cell).toUpperCase().includes("REQ QTY"))) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          throw new Error("Order Requirement header not found! Must contain 'STORE CODE' and 'Req Qty'.");
        }

        const headers = jsonData[headerIdx].map(h => String(h).trim().toUpperCase());
        const dateCol = headers.findIndex(h => h === "DATE" || h.includes("BILL DATE") || h.includes("ORDER DATE"));
        const stateCol = headers.findIndex(h => h === "STATE");
        const storeCodeCol = headers.findIndex(h => h.includes("STORE CODE"));
        const storeNameCol = headers.findIndex(h => h.includes("STORE NAME"));
        const itemCodeCol = headers.findIndex(h => h.includes("ITEM CODE"));
        const descCol = headers.findIndex(h => h.includes("DESCRIPTION"));
        const catCol = headers.findIndex(h => h.includes("CATEGORY"));
        const reqQtyCol = headers.findIndex(h => h.includes("REQ QTY") || h.includes("ORDER QTY") || h.includes("REQUIRED"));
        const availStockCol = headers.findIndex(h => 
          (h.includes("AVAIL") || h.includes("STORE STOCK") || h.includes("STOCK AT STORE") || h.includes("CLOSING STOCK") || h.includes("ON HAND") || (h.includes("STOCK") && !h.includes("REQ"))) && !h.includes("REQ QTY")
        );

        const orderLines = [];
        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[storeCodeCol]) continue;

          const rawStoreCode = String(row[storeCodeCol]).trim();
          const storeCode = extractStoreCode(rawStoreCode);
          const storeState = stateCol !== -1 && row[stateCol] ? String(row[stateCol]).trim() : getStateFromStore(storeCode);
          const storeName = storeNameCol !== -1 && row[storeNameCol] ? String(row[storeNameCol]).trim() : storeCode;
          const dateVal = dateCol !== -1 && row[dateCol] ? String(row[dateCol]).trim() : "";
          const itemCode = itemCodeCol !== -1 && row[itemCodeCol] ? String(row[itemCodeCol]).trim() : "";
          const desc = descCol !== -1 && row[descCol] ? String(row[descCol]).trim() : "";
          const category = catCol !== -1 && row[catCol] ? String(row[catCol]).trim() : "";
          const reqQty = reqQtyCol !== -1 ? parseFloat(row[reqQtyCol]) || 0 : 0;
          const availStock = availStockCol !== -1 && row[availStockCol] !== undefined ? parseFloat(row[availStockCol]) || 0 : 0;

          if (!itemCode || reqQty <= 0) continue;

          orderLines.push({
            id: `ord_${i}`,
            dateVal,
            storeCode,
            storeState,
            storeName,
            itemCode,
            description: desc,
            category,
            reqQty,
            availStock
          });
        }

        setOrderDataRaw(orderLines);
        setActiveTab("order-audit");
        toast.success(`Order File Loaded (${orderLines.length} order items)`);
      } catch (err) {
        console.error(err);
        toast.error(`Error parsing Order File: ${err.message}`);
      } finally {
        setIsParsingOrder(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Merged Analysis Engine
  const mergedAnalysis = useMemo(() => {
    const salesMap = salesDataRaw || {};
    const itemSurplusStoreMap = {};
    const itemSalesStoreMap = {};

    const stockItems = stockDataRaw || [];

    const items = stockItems.map(stock => {
      const key = `${stock.storeCode}::${stock.itemCode}`;
      const sales = salesMap[key] || { l3mQty: 0 };
      const periodSales = sales.l3mQty;

      // Status
      const isDead = periodSales === 0;
      const status = isDead ? "DEAD" : "ACTIVE";

      // Retention & Surplus
      const retainedQty = isDead ? Math.min(stock.closingStock, retentionQty) : stock.closingStock;
      const surplusQty = isDead ? Math.max(0, stock.closingStock - retainedQty) : 0;
      const surplusValue = surplusQty * stock.unitCost;

      if (surplusQty > 0) {
        if (!itemSurplusStoreMap[stock.itemCode]) itemSurplusStoreMap[stock.itemCode] = [];
        itemSurplusStoreMap[stock.itemCode].push({
          storeCode: stock.storeCode,
          storeState: stock.storeState,
          branchName: stock.branchName,
          surplusQty,
          unitCost: stock.unitCost
        });
      }

      if (periodSales > 0) {
        if (!itemSalesStoreMap[stock.itemCode]) itemSalesStoreMap[stock.itemCode] = [];
        itemSalesStoreMap[stock.itemCode].push({
          storeCode: stock.storeCode,
          storeState: stock.storeState,
          periodSales
        });
      }

      return {
        ...stock,
        periodSales,
        status,
        retainedQty,
        surplusQty,
        surplusValue
      };
    });

    // Destination Store Matching (MH -> MH, MP -> MP)
    const finalItems = items.map(item => {
      if (item.surplusQty > 0) {
        const sellingStores = itemSalesStoreMap[item.itemCode] || [];
        let candidates = sellingStores.filter(s => s.storeCode !== item.storeCode);

        if (strictSameState) {
          candidates = candidates.filter(s => s.storeState === item.storeState);
        }

        let recDest = strictSameState ? `Central ${item.storeState} Warehouse` : "Central Warehouse";
        if (candidates.length > 0) {
          candidates.sort((a, b) => b.periodSales - a.periodSales);
          recDest = `${candidates[0].storeCode} (${candidates[0].storeState} - Sold ${candidates[0].periodSales} units)`;
        }

        return { ...item, recommendedDestination: recDest };
      }
      return item;
    });

    const storeList = Array.from(new Set([
      ...finalItems.map(i => i.storeCode),
      ...(orderDataRaw ? orderDataRaw.map(o => o.storeCode) : [])
    ])).sort();

    return {
      items: finalItems,
      storeList,
      itemSurplusStoreMap
    };
  }, [stockDataRaw, salesDataRaw, orderDataRaw, retentionQty, strictSameState]);

  // Overall Unfiltered Stock Metrics (Independent of status filter!)
  const metrics = useMemo(() => {
    if (!mergedAnalysis) return { totalVal: 0, deadVal: 0, activeVal: 0, surplusVal: 0, totalUnits: 0, deadUnits: 0, activeUnits: 0, surplusUnits: 0, deadSkus: 0, activeSkus: 0 };
    
    const baseItems = mergedAnalysis.items.filter(item => {
      if (selectedStore !== "All Stores" && item.storeCode !== selectedStore) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return item.itemCode.toLowerCase().includes(term) || item.description.toLowerCase().includes(term) || item.storeCode.toLowerCase().includes(term);
      }
      return true;
    });

    let totalVal = 0, deadVal = 0, activeVal = 0, surplusVal = 0;
    let totalUnits = 0, deadUnits = 0, activeUnits = 0, surplusUnits = 0;
    let deadSkus = 0, activeSkus = 0;

    baseItems.forEach(i => {
      totalVal += i.closingValue;
      totalUnits += i.closingStock;

      if (i.status === "DEAD") {
        deadVal += i.closingValue;
        deadUnits += i.closingStock;
        surplusVal += i.surplusValue;
        surplusUnits += i.surplusQty;
        deadSkus++;
      } else {
        activeVal += i.closingValue;
        activeUnits += i.closingStock;
        activeSkus++;
      }
    });

    return { totalVal, deadVal, activeVal, surplusVal, totalUnits, deadUnits, activeUnits, surplusUnits, deadSkus, activeSkus };
  }, [mergedAnalysis, selectedStore, searchTerm]);

  // Filtered Items for Display Table
  const filteredItems = useMemo(() => {
    if (!mergedAnalysis) return [];
    return mergedAnalysis.items.filter(item => {
      if (selectedStore !== "All Stores" && item.storeCode !== selectedStore) return false;
      if (selectedStatusFilter !== "ALL" && item.status !== selectedStatusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return item.itemCode.toLowerCase().includes(term) || item.description.toLowerCase().includes(term) || item.storeCode.toLowerCase().includes(term);
      }
      return true;
    });
  }, [mergedAnalysis, selectedStore, selectedStatusFilter, searchTerm]);

  // Order Audit / Processing List (Evaluates Order Req or Stock against Sales DB)
  const auditedOrders = useMemo(() => {
    if (!mergedAnalysis) return [];
    const salesMap = salesDataRaw || {};
    const { itemSurplusStoreMap } = mergedAnalysis;

    // Use orderDataRaw if available, else derive from stockDataRaw
    const baseSource = orderDataRaw || (stockDataRaw ? stockDataRaw.map(s => ({
      id: s.id,
      dateVal: "",
      storeCode: s.storeCode,
      storeState: s.storeState,
      storeName: s.branchName,
      itemCode: s.itemCode,
      description: s.description,
      category: s.category || "",
      reqQty: s.closingStock,
      availStock: s.closingStock
    })) : []);

    return baseSource.map(ord => {
      const key = `${ord.storeCode}::${ord.itemCode}`;
      const sales = salesMap[key] || { l3mQty: 0 };
      const periodSales = sales.l3mQty;
      const stockAtStore = ord.availStock !== undefined ? parseFloat(ord.availStock) || 0 : 0;

      const surplusList = itemSurplusStoreMap[ord.itemCode] || [];
      let sources = surplusList.filter(s => s.storeCode !== ord.storeCode);
      if (strictSameState) {
        sources = sources.filter(s => s.storeState === ord.storeState);
      }

      // REJECT ONLY IF: store already has stock in hand (stockAtStore > 0) AND 0 sales in reference period.
      // IF stockAtStore === 0, APPROVE IT because store needs display/minimum stock!
      const isHighRisk = stockAtStore > 0 && periodSales === 0;
      const statusTag = isHighRisk ? "REJECTED" : "APPROVED";
      const statusLabel = isHighRisk ? "REJECTED" : "APPROVED";

      let reason = "";
      if (isHighRisk) {
        reason = `Rejected: Store already has ${stockAtStore} unit(s) in hand but 0 sales in reference period.`;
      } else if (periodSales > 0) {
        reason = `Approved: Active seller at ${ord.storeCode} (${periodSales} units sold in reference period).`;
      } else {
        reason = `Approved: Zero stock in hand at ${ord.storeCode} (restocking approved for minimum store stock).`;
      }

      let transferMatch = null;
      if (sources.length > 0) {
        sources.sort((a, b) => b.surplusQty - a.surplusQty);
        transferMatch = {
          fromStore: sources[0].storeCode,
          fromState: sources[0].storeState,
          availableSurplus: sources[0].surplusQty,
          suggestedQty: Math.min(ord.reqQty, sources[0].surplusQty)
        };
      }

      return {
        ...ord,
        dateVal: ord.dateVal || "",
        category: ord.category || "",
        availStock: stockAtStore,
        periodSales,
        isHighRisk,
        statusTag,
        statusLabel,
        reason,
        transferMatch
      };
    }).filter(ord => {
      if (selectedStore !== "All Stores" && ord.storeCode !== selectedStore) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesCode = ord.itemCode.toLowerCase().includes(term);
        const matchesDesc = ord.description.toLowerCase().includes(term);
        const matchesStore = ord.storeCode.toLowerCase().includes(term);
        if (!matchesCode && !matchesDesc && !matchesStore) return false;
      }
      if (auditFilter === "APPROVED") return ord.statusTag === "APPROVED";
      if (auditFilter === "REJECTED") return ord.statusTag === "REJECTED";
      return true;
    });
  }, [orderDataRaw, stockDataRaw, mergedAnalysis, salesDataRaw, strictSameState, auditFilter, selectedStore, searchTerm]);

  // Summary Metrics for Order Requirement Audit Dashboard
  const orderMetrics = useMemo(() => {
    const salesMap = salesDataRaw || {};
    const baseSource = orderDataRaw || (stockDataRaw ? stockDataRaw.map(s => ({
      storeCode: s.storeCode,
      storeState: s.storeState,
      itemCode: s.itemCode,
      reqQty: s.closingStock,
      availStock: s.closingStock
    })) : []);

    let totalLines = baseSource.length;
    let approvedCount = 0;
    let rejectedCount = 0;
    let totalReqQty = 0;
    const storeSet = new Set();

    baseSource.forEach(ord => {
      if (ord.storeCode) storeSet.add(ord.storeCode);
      totalReqQty += (ord.reqQty || 0);
      const key = `${ord.storeCode}::${ord.itemCode}`;
      const periodSales = (salesMap[key] || {}).l3mQty || 0;
      const stockAtStore = ord.availStock !== undefined ? parseFloat(ord.availStock) || 0 : 0;

      const isRejected = stockAtStore > 0 && periodSales === 0;
      if (!isRejected) {
        approvedCount++;
      } else {
        rejectedCount++;
      }
    });

    return {
      totalLines,
      approvedCount,
      rejectedCount,
      storesCount: storeSet.size,
      totalReqQty
    };
  }, [orderDataRaw, stockDataRaw, salesDataRaw]);

  // CHECK IF INITIAL UPLOAD STAGE IS NEEDED
  const isInitialState = !salesDataRaw || (!stockDataRaw && !orderDataRaw);

  // Active Dashboard Mode
  const isOrderDashboard = activeTab === "order-audit" || (!stockDataRaw && !!orderDataRaw);

  // Fixed Master Store Color Map (WMP001 -> Light Blue, WMP002 -> Light Green, etc.)
  const FIXED_STORE_COLORS = {
    "WMP001": "BFDBFE",
    "WMP002": "DCFCE7",
    "WMP003": "FEF08A",
    "WMP004": "FFEDD5",
    "WMP005": "E9D5FF",
    "WMP006": "FECDD3",
    "WMP007": "CFFAFE",
    "WMP008": "FCE7F3",
    "WMH001": "BFDBFE",
    "WMH002": "DCFCE7",
    "WMH003": "FEF08A",
    "WMH004": "FFEDD5",
    "WMH005": "E9D5FF",
    "WMH006": "FECDD3",
    "WMH007": "CFFAFE",
    "WMH008": "FCE7F3",
    "WMH009": "CCFBF1",
    "WMH011": "D1EDBF"
  };

  // Export Surplus Excel
  const exportSurplusExcel = () => {
    if (!filteredItems) return;
    const deadItems = filteredItems.filter(i => i.status === "DEAD" && i.surplusQty > 0);
    if (deadItems.length === 0) {
      toast.error("No surplus items to export!");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Surplus Transfer Advice");

    sheet.columns = [
      { header: "STORE", key: "storeCode", width: 16 },
      { header: "STATE", key: "storeState", width: 10 },
      { header: "ITEM CODE", key: "itemCode", width: 18 },
      { header: "PRODUCT DESCRIPTION", key: "description", width: 45 },
      { header: "TOTAL STOCK", key: "closingStock", width: 14 },
      { header: "RETAINED (DISPLAY)", key: "retainedQty", width: 18 },
      { header: "SURPLUS TO MOVE", key: "surplusQty", width: 18 },
      { header: "WHERE TO SEND (RECOMMENDED)", key: "recommendedDestination", width: 45 }
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E293B" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 28;

    deadItems.forEach(i => {
      const dest = i.recommendedDestination || "";
      const targetStoreMatch = dest.match(/WM[HM]\d{3}/i);
      let destFillColor = null;

      if (targetStoreMatch) {
        const targetStoreCode = targetStoreMatch[0].toUpperCase();
        destFillColor = FIXED_STORE_COLORS[targetStoreCode] || "E2E8F0";
      }

      const row = sheet.addRow({
        storeCode: i.storeCode,
        storeState: i.storeState,
        itemCode: i.itemCode,
        description: i.description,
        closingStock: i.closingStock,
        retainedQty: i.retainedQty,
        surplusQty: i.surplusQty,
        recommendedDestination: i.recommendedDestination
      });

      row.height = 22;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "CBD5E1" } },
          bottom: { style: "thin", color: { argb: "CBD5E1" } },
          left: { style: "thin", color: { argb: "CBD5E1" } },
          right: { style: "thin", color: { argb: "CBD5E1" } }
        };

        if (colNumber === 8 && destFillColor) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: destFillColor }
          };
          cell.font = { bold: true };
        }
      });
    });

    workbook.xlsx.writeBuffer().then(b => {
      saveAs(new Blob([b]), `Dead_Stock_Transfer_Advice_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel Exported with Store Color Coding!");
    });
  };

  // Export Order Audit Excel
  const exportOrderAuditExcel = () => {
    if (!auditedOrders || auditedOrders.length === 0) {
      toast.error("No audited order lines to export!");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Order Requirement Audit");

    sheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "State", key: "state", width: 10 },
      { header: "STORE CODE", key: "storeCode", width: 16 },
      { header: "Store Name", key: "storeName", width: 22 },
      { header: "ITEM CODE", key: "itemCode", width: 16 },
      { header: "ITEM DESCRIPTION", key: "description", width: 45 },
      { header: "Category", key: "category", width: 18 },
      { header: "Req Qty", key: "reqQty", width: 12 },
      { header: "Available Stock", key: "availStock", width: 16 },
      { header: "L3M Sale", key: "periodSales", width: 14 },
      { header: "Recommendation", key: "recommendation", width: 20 }
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1976D2" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 28;

    const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

    auditedOrders.forEach(ord => {
      const row = sheet.addRow({
        date: ord.dateVal || todayStr,
        state: ord.storeState || "",
        storeCode: ord.storeCode || "",
        storeName: ord.storeName || ord.storeCode || "",
        itemCode: ord.itemCode || "",
        description: ord.description || "",
        category: ord.category || "",
        reqQty: ord.reqQty || 0,
        availStock: ord.availStock || 0,
        periodSales: ord.periodSales || 0,
        recommendation: ord.statusLabel || ""
      });

      row.height = 22;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "CBD5E1" } },
          bottom: { style: "thin", color: { argb: "CBD5E1" } },
          left: { style: "thin", color: { argb: "CBD5E1" } },
          right: { style: "thin", color: { argb: "CBD5E1" } }
        };

        if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 4 || colNumber === 8 || colNumber === 9) {
          cell.font = { bold: true };
        } else if (colNumber === 5) {
          cell.font = { bold: true, color: { argb: "0284C7" } };
        } else if (colNumber === 10) {
          if (ord.periodSales === 0) {
            cell.font = { bold: true, color: { argb: "DC2626" } };
          } else {
            cell.font = { bold: true, color: { argb: "16A34A" } };
          }
        } else if (colNumber === 11) {
          if (ord.isHighRisk) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FEE2E2" }
            };
            cell.font = { bold: true, color: { argb: "991B1B" } };
          } else {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "DCFCE7" }
            };
            cell.font = { bold: true, color: { argb: "166534" } };
          }
        }
      });
    });

    sheet.columns.forEach(column => {
      let maxLen = column.header ? column.header.length : 10;
      column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber > 1 && cell.value) {
          const str = String(cell.value);
          if (str.length > maxLen) maxLen = str.length;
        }
      });
      column.width = Math.min(Math.max(maxLen + 4, 12), 60);
    });

    workbook.xlsx.writeBuffer().then(b => {
      saveAs(new Blob([b]), `Order_Requirement_Audit_Results_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Order Audit Excel Exported!");
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 md:p-6 space-y-6">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              {isOrderDashboard ? (
                <>
                  <ShoppingCart className="w-6 h-6 text-cyan-500" />
                  Sales-Based Order Processing & Audit Dashboard
                </>
              ) : (
                <>
                  <AlertTriangle className="w-6 h-6 text-rose-500" />
                  Dead Stock & Smart Transfer Manager
                </>
              )}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isOrderDashboard ? (
                "Audit store requirement sheets against historical sales database to auto-approve active items & reject non-sellers."
              ) : (
                "Find non-moving stock, keep 2 display units per store, and transfer surplus stock within MH & MP."
              )}
            </p>
          </div>
        </div>

        {!isInitialState && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleLoadSavedSalesDB}
              disabled={isLoadingDb}
              className={`px-3 py-2 font-extrabold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 ${
                useSavedSalesDB
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              <DatabaseZap className="w-3.5 h-3.5" />
              {isLoadingDb ? "Loading DB..." : useSavedSalesDB ? "✓ Sales DB Active" : "⚡ Use Saved Sales DB"}
            </button>

            <button
              onClick={() => appendSalesInputRef.current?.click()}
              title="Append new month sales file into DB"
              className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <input ref={appendSalesInputRef} type="file" accept=".xlsx,.xls" onChange={handleAppendSalesToDB} className="hidden" />
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Add Month Sales</span>
            </button>

            <button
              onClick={handleResetFiles}
              className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Change Files
            </button>

            {isOrderDashboard ? (
              <button
                onClick={exportOrderAuditExcel}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                Download Audit Report (Excel)
              </button>
            ) : (
              <button
                onClick={exportSurplusExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                Download Transfer Sheet (Excel)
              </button>
            )}
          </div>
        )}
      </div>

      {/* INITIAL LANDING UPLOAD SCREEN (Split into 2 Parts: Top = Dead Stock Analyzer, Bottom = Stock Processor) */}
      {isInitialState ? (
        <div className="max-w-4xl mx-auto space-y-7 my-6">

          {/* ========================================================================= */}
          {/* TOP PART: DEAD STOCK ANALYZER */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 md:p-7 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden space-y-5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-rose-400 pointer-events-none" />
            
            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                      Dead Stock Analyzer
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-full border border-rose-100 dark:border-rose-900/40">
                      1-Step Dashboard
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                    Sales History (6-8 months) is saved permanently. Upload your Closing Stock file to open the dashboard.
                  </p>
                </div>
              </div>

              {/* Sales DB Status & Add Month Button */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Saved Sales DB Status Badge */}
                {salesDataRaw && useSavedSalesDB ? (
                  <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-xl flex items-center gap-1.5">
                    <DatabaseZap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>✓ Sales History Saved ({savedDbCount ? savedDbCount.toLocaleString() : 'Active'} Rows)</span>
                  </div>
                ) : (
                  <button
                    onClick={handleLoadSavedSalesDB}
                    disabled={isLoadingDb}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <DatabaseZap className="w-3.5 h-3.5" />
                    {isLoadingDb ? "Loading DB..." : "⚡ Load Saved Sales DB"}
                  </button>
                )}

                {/* Append New Month Sales Data Button */}
                <button
                  onClick={() => appendSalesInputRef.current?.click()}
                  title="Upload new month sales Excel to add into saved sales DB"
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/50 text-xs font-medium rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <input ref={appendSalesInputRef} type="file" accept=".xlsx,.xls" onChange={handleAppendSalesToDB} className="hidden" />
                  <PlusCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Add New Month Sales</span>
                </button>

                {/* Clear Saved DB Button */}
                <button
                  onClick={handleClearSalesDB}
                  title="Clear all saved sales history data from local database"
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs font-medium rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Clear Saved DB</span>
                </button>
              </div>
            </div>

            {/* Top Upload Box - Closing Stock In-Hand Upload */}
            <div 
              onClick={() => stockInputRef.current?.click()}
              className={`p-7 rounded-2xl border border-dashed cursor-pointer transition-all duration-200 text-center flex flex-col items-center justify-center space-y-2.5 group ${
                stockDataRaw 
                  ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20" 
                  : "border-rose-200/90 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 hover:border-rose-400 dark:hover:border-rose-700 hover:bg-rose-50/40 shadow-sm"
              }`}
            >
              <input ref={stockInputRef} type="file" accept=".xlsx,.xls" onChange={handleStockUpload} className="hidden" />
              <div className={`p-3.5 rounded-xl transition-transform duration-200 group-hover:scale-105 ${stockDataRaw ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-rose-100/70 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"}`}>
                <Package className="w-8 h-8" />
              </div>
              <div>
                <div className="text-xs font-semibold text-rose-500 dark:text-rose-400 tracking-wide uppercase">Closing Stock File</div>
                <div className="text-base font-semibold text-slate-800 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors mt-0.5">
                  {stockFileName ? stockFileName : "Upload Closing Stock In Hand File"}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-normal">
                  {isParsingStock ? "Processing Stock File..." : stockDataRaw ? `✓ ${stockDataRaw.length.toLocaleString()} Stock Lines Loaded` : "Select Closing Stock On-Hand Excel (.xlsx / .xls)"}
                </div>
              </div>
            </div>
          </div>


          {/* ========================================================================= */}
          {/* BOTTOM PART: STOCK PROCESSOR */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 md:p-7 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden space-y-5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-cyan-500 pointer-events-none" />

            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                      Stock Processor
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-900/40">
                      1-Step Order Auditor
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                    Sales History (6-8 months) is saved permanently. Upload your Processing Requirement file to open the Order Audit Dashboard.
                  </p>
                </div>
              </div>

              {/* Saved Sales DB Status Badge & Clear Option */}
              <div className="flex items-center gap-2 flex-wrap">
                {salesDataRaw && useSavedSalesDB ? (
                  <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-xl flex items-center gap-1.5">
                    <DatabaseZap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>✓ Sales History Saved ({savedDbCount ? savedDbCount.toLocaleString() : 'Active'} Rows)</span>
                  </div>
                ) : (
                  <button
                    onClick={handleLoadSavedSalesDB}
                    disabled={isLoadingDb}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <DatabaseZap className="w-3.5 h-3.5" />
                    {isLoadingDb ? "Loading DB..." : "⚡ Load Saved Sales DB"}
                  </button>
                )}

                <button
                  onClick={handleClearSalesDB}
                  title="Clear all saved sales history data from local database"
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs font-medium rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Clear Saved DB</span>
                </button>
              </div>
            </div>

            {/* Bottom Upload Box - Processing File (Processed_Order_Requirement.xlsx) */}
            <div 
              onClick={() => orderInputRef.current?.click()}
              className={`p-7 rounded-2xl border border-dashed cursor-pointer transition-all duration-200 text-center flex flex-col items-center justify-center space-y-2.5 group ${
                orderDataRaw 
                  ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20" 
                  : "border-indigo-200/90 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10 hover:border-indigo-400 dark:hover:border-indigo-700 hover:bg-indigo-50/40 shadow-sm"
              }`}
            >
              <input ref={orderInputRef} type="file" accept=".xlsx,.xls" onChange={handleOrderUpload} className="hidden" />
              <div className={`p-3.5 rounded-xl transition-transform duration-200 group-hover:scale-105 ${orderDataRaw ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-indigo-100/70 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"}`}>
                <ShoppingCart className="w-8 h-8" />
              </div>
              <div>
                <div className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 tracking-wide uppercase">Processing File</div>
                <div className="text-base font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mt-0.5">
                  {orderFileName ? orderFileName : "Upload Processing File (Processed_Order_Requirement.xlsx)"}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-normal">
                  {isParsingOrder ? "Processing Order File..." : orderDataRaw ? `✓ ${orderDataRaw.length.toLocaleString()} Order Lines Loaded` : "Select Processed_Order_Requirement Excel (.xlsx / .xls)"}
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* FULL DASHBOARD VIEW (Unlocked after files are uploaded) */
        <>
          {/* Dashboard Mode Selector Tabs (Shown if both stock & order files exist) */}
          {stockDataRaw && orderDataRaw && (
            <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2 pb-1">
              <button
                onClick={() => setActiveTab("dead-stock")}
                className={`px-4 py-2 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === "dead-stock"
                    ? "border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-t-xl"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Dead Stock Manager ({filteredItems.length} Stock Items)
              </button>

              <button
                onClick={() => setActiveTab("order-audit")}
                className={`px-4 py-2 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === "order-audit"
                    ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 rounded-t-xl"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <ShoppingCart className="w-4 h-4 text-cyan-500" />
                Order Processing Auditor ({auditedOrders.length} Order Lines)
              </button>
            </div>
          )}

          {isOrderDashboard ? (
            /* ==================== 1. DEDICATED ORDER PROCESSING DASHBOARD ==================== */
            <div className="space-y-6">
              {/* 4 Focused Order Processing KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Card 1: Total Requested Items */}
                <div 
                  onClick={() => setAuditFilter("ALL")}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02] ${
                    auditFilter === "ALL" ? "border-cyan-500 ring-2 ring-cyan-500/50" : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 text-cyan-500" /> Total Requested Items
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {orderMetrics.totalLines.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">
                    {orderMetrics.totalReqQty.toLocaleString()} units ({orderMetrics.storesCount} stores)
                  </div>
                </div>

                {/* Card 2: Approved Items */}
                <div 
                  onClick={() => setAuditFilter("APPROVED")}
                  className={`bg-emerald-50 dark:bg-emerald-950/20 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02] ${
                    auditFilter === "APPROVED" ? "border-emerald-500 ring-2 ring-emerald-500/50" : "border-emerald-200 dark:border-emerald-500/40"
                  }`}
                >
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approved Items (Sales &gt; 0 or Stock = 0)
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {orderMetrics.approvedCount.toLocaleString()}
                  </div>
                  <div className="text-xs text-emerald-800 dark:text-emerald-300/80 mt-1 font-bold">
                    {((orderMetrics.approvedCount / (orderMetrics.totalLines || 1)) * 100).toFixed(1)}% approved (Active or 0 Stock)
                  </div>
                </div>

                {/* Card 3: Rejected Items */}
                <div 
                  onClick={() => setAuditFilter("REJECTED")}
                  className={`bg-rose-50 dark:bg-rose-950/20 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02] ${
                    auditFilter === "REJECTED" ? "border-rose-500 ring-2 ring-rose-500/50" : "border-rose-200 dark:border-rose-500/40"
                  }`}
                >
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> Rejected Items (Unsold Stock In Hand)
                  </div>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                    {orderMetrics.rejectedCount.toLocaleString()}
                  </div>
                  <div className="text-xs text-rose-800 dark:text-rose-300/80 mt-1 font-bold">
                    {((orderMetrics.rejectedCount / (orderMetrics.totalLines || 1)) * 100).toFixed(1)}% blocked (Stock &gt; 0 & 0 sales)
                  </div>
                </div>

                {/* Card 4: Ordering Stores */}
                <div className="bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-500/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div className="text-xs font-bold text-cyan-700 dark:text-cyan-300 uppercase flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-cyan-600" /> Ordering Stores
                  </div>
                  <div className="text-2xl font-black text-cyan-900 dark:text-cyan-100 my-1">
                    {orderMetrics.storesCount} Stores
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Unique retail stores evaluated in this requirement file.
                  </div>
                </div>
              </div>

              {/* Order Processing Controls Bar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search Item Code, Description, or Store..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  {/* Store Selector */}
                  <select 
                    value={selectedStore} 
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="All Stores">All Stores ({mergedAnalysis.storeList.length})</option>
                    {mergedAnalysis.storeList.map(st => (
                      <option key={st} value={st}>{st} ({getStateFromStore(st)})</option>
                    ))}
                  </select>

                  {/* Filter Pills: All | Approved | Rejected */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                      onClick={() => setAuditFilter("ALL")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        auditFilter === "ALL"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      All Items ({orderMetrics.totalLines})
                    </button>

                    <button
                      onClick={() => setAuditFilter("APPROVED")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                        auditFilter === "APPROVED"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved ({orderMetrics.approvedCount})
                    </button>

                    <button
                      onClick={() => setAuditFilter("REJECTED")}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                        auditFilter === "REJECTED"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40"
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Rejected ({orderMetrics.rejectedCount})
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => orderInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
                  >
                    <input ref={orderInputRef} type="file" accept=".xlsx,.xls" onChange={handleOrderUpload} className="hidden" />
                    <RefreshCw className="w-3.5 h-3.5" /> {orderDataRaw ? "Change Order File" : "Upload Order Req File"}
                  </button>
                </div>
              </div>

              {/* Order Processing Audit Results Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-cyan-500" />
                      Sales-Based Order Processing & Audit Results ({auditedOrders.length} lines)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {orderFileName ? `File: ${orderFileName}` : `Auditing store stock lines against Sales History DB (${salesPeriodInfo.labelText})`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportOrderAuditExcel}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Export Audit Sheet (Excel)
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-center text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 font-extrabold uppercase border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3 text-center">Store</th>
                        <th className="p-3 text-center">Item Code</th>
                        <th className="p-3 text-center">Description</th>
                        <th className="p-3 text-center">Category</th>
                        <th className="p-3 text-center">Req Qty</th>
                        <th className="p-3 text-center">Stock at Store</th>
                        <th className="p-3 text-center">Store Sales L3M</th>
                        <th className="p-3 text-center">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                      {auditedOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                            No audited order lines matching current filter.
                          </td>
                        </tr>
                      ) : (
                        auditedOrders.map(ord => (
                          <tr key={ord.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="p-3 text-center font-bold text-slate-900 dark:text-white">
                              {ord.storeCode} ({ord.storeState})
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-cyan-600 dark:text-cyan-300">
                              {ord.itemCode}
                            </td>
                            <td className="p-3 text-center max-w-xs font-medium text-slate-900 dark:text-white truncate mx-auto" title={ord.description}>
                              {ord.description}
                            </td>
                            <td className="p-3 text-center font-semibold text-slate-600 dark:text-slate-400">
                              {ord.category || "-"}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-900 dark:text-white">
                              {ord.reqQty}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-extrabold">{ord.availStock ?? 0}</span>
                            </td>
                            <td className="p-3 text-center font-bold">
                              {ord.periodSales === 0 ? (
                                <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 rounded font-black">0</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded font-black">{ord.periodSales}</span>
                              )}
                            </td>
                            <td className="p-3 text-center flex justify-center">
                              {ord.isHighRisk ? (
                                <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 rounded-lg font-black text-[11px] flex items-center gap-1.5 w-fit">
                                  <XCircle className="w-3.5 h-3.5 shrink-0" /> REJECTED
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 rounded-lg font-black text-[11px] flex items-center gap-1.5 w-fit">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> APPROVED
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* ==================== 2. DEDICATED DEAD STOCK DASHBOARD ==================== */
            <div className="space-y-6">
              {/* Summary KPI Filter Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Card 1: Total Stock On-Hand */}
                <div 
                  onClick={() => setSelectedStatusFilter("ALL")}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02] ${
                    selectedStatusFilter === "ALL" ? "border-slate-900 dark:border-white ring-2 ring-slate-400/50" : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="text-xs font-bold text-slate-400 uppercase">Total Stock On-Hand</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    ₹{Math.round(metrics.totalVal).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">
                    {metrics.totalUnits.toLocaleString()} total units (Click to view all)
                  </div>
                </div>

                {/* Card 2: Total Dead Stock */}
                <div 
                  onClick={() => setSelectedStatusFilter("DEAD")}
                  className={`bg-rose-50 dark:bg-rose-950/20 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02] ${
                    selectedStatusFilter === "DEAD" ? "border-rose-500 ring-2 ring-rose-500/50" : "border-rose-200 dark:border-rose-500/40"
                  }`}
                >
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Total Dead Stock (0 Sales)
                  </div>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                    ₹{Math.round(metrics.deadVal).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-rose-800 dark:text-rose-300/80 mt-1 font-bold">
                    {metrics.deadUnits.toLocaleString()} units ({metrics.deadSkus} SKUs)
                  </div>
                </div>

                {/* Card 3: Active / Running Items */}
                <div 
                  onClick={() => setSelectedStatusFilter("ACTIVE")}
                  className={`bg-emerald-50 dark:bg-emerald-950/20 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02] ${
                    selectedStatusFilter === "ACTIVE" ? "border-emerald-500 ring-2 ring-emerald-500/50" : "border-emerald-200 dark:border-emerald-500/40"
                  }`}
                >
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Active / Running Stock
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    ₹{Math.round(metrics.activeVal).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-emerald-800 dark:text-emerald-300/80 mt-1 font-bold">
                    {metrics.activeUnits.toLocaleString()} units ({metrics.activeSkus} SKUs) (Click to view)
                  </div>
                </div>

                {/* Card 4: Retention Rule Control */}
                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <div className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase flex items-center justify-between">
                    <span>Surplus to Move</span>
                    <span className="text-[11px] font-black text-cyan-600 dark:text-cyan-400">₹{Math.round(metrics.surplusVal).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center gap-2 my-1">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Keep at store:</span>
                    <input 
                      type="number" 
                      min="0" 
                      max="20" 
                      value={retentionQty} 
                      onChange={(e) => setRetentionQty(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-14 px-2 py-1 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-500/50 rounded text-center text-slate-900 dark:text-white font-extrabold text-sm focus:outline-none"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">units</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {metrics.surplusUnits.toLocaleString()} surplus dead units to transfer.
                  </div>
                </div>
              </div>

              {/* Controls & Search */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search Item Code or Product Name..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  {/* Store Selector */}
                  <select 
                    value={selectedStore} 
                    onChange={(e) => setSelectedStore(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="All Stores">All Stores ({mergedAnalysis.storeList.length})</option>
                    {mergedAnalysis.storeList.map(st => (
                      <option key={st} value={st}>{st} ({getStateFromStore(st)})</option>
                    ))}
                  </select>

                  {/* Status Filter */}
                  <select 
                    value={selectedStatusFilter} 
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="DEAD">🔴 Dead Stock Only (0 Sales)</option>
                    <option value="ACTIVE">🟢 Active / Running Items Only (Sales &gt; 0)</option>
                    <option value="ALL">📋 Show All Stock Items (Dead + Active)</option>
                  </select>

                  {/* Same State Rule Toggle */}
                  <button
                    onClick={() => setStrictSameState(!strictSameState)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      strictSameState 
                        ? "bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/50 text-amber-800 dark:text-amber-300" 
                        : "bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    {strictSameState ? "Intra-State Only (MH↔MH, MP↔MP)" : "Cross State Allowed"}
                  </button>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                  Showing <span className="text-slate-900 dark:text-white font-extrabold">{filteredItems.length}</span> items
                </div>
              </div>

              {/* Dead Stock Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 font-extrabold uppercase border-b border-slate-200 dark:border-slate-800">
                        <th className="p-3">Store</th>
                        <th className="p-3">State</th>
                        <th className="p-3">Item Code</th>
                        <th className="p-3">Product Name & Description</th>
                        <th className="p-3 text-center">Total Sales (Qty Sold)</th>
                        <th className="p-3 text-center">On-Hand Stock</th>
                        <th className="p-3 text-center">Keep</th>
                        <th className="p-3 text-center bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300">Surplus to Move</th>
                        <th className="p-3">Where to Send? (Same State)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="p-8 text-center text-slate-400 text-sm">
                            No matching stock items found for selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => (
                          <tr 
                            key={item.id} 
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                              item.status === "DEAD" ? "bg-rose-50/50 dark:bg-rose-950/10" : "bg-emerald-50/30 dark:bg-emerald-950/10"
                            }`}
                          >
                            <td className="p-3 font-bold text-slate-900 dark:text-white">
                              {item.storeCode}
                            </td>
                            <td className="p-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                item.storeState === 'MH' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                              }`}>
                                {item.storeState}
                              </span>
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {item.itemCode}
                            </td>
                            <td className="p-3 max-w-sm">
                              <div className="font-bold text-slate-900 dark:text-white truncate" title={item.description}>
                                {item.description}
                              </div>
                              <div className="text-[10px] text-slate-400">Brand: {item.brand}</div>
                            </td>
                            <td className="p-3 text-center font-extrabold">
                              {item.periodSales === 0 ? (
                                <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 rounded">0</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded font-black">{item.periodSales}</span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-900 dark:text-white">
                              {item.closingStock}
                            </td>
                            <td className="p-3 text-center font-bold text-purple-700 dark:text-purple-300">
                              {item.retainedQty}
                            </td>
                            <td className="p-3 text-center font-black bg-cyan-50/70 dark:bg-cyan-950/30 text-cyan-800 dark:text-cyan-300">
                              {item.surplusQty > 0 ? (
                                <span className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-500/20 border border-cyan-300 dark:border-cyan-500/40 rounded text-cyan-800 dark:text-cyan-300">
                                  {item.surplusQty} units
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="p-3 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                              {item.surplusQty > 0 ? (
                                <div className="flex items-center gap-1">
                                  <ArrowRightLeft className="w-3.5 h-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                                  <span>{item.recommendedDestination}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
