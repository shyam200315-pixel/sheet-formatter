import React, { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { 
  TrendingUp, 
  Calendar, 
  Store, 
  DollarSign, 
  AlertTriangle, 
  Clipboard, 
  Download, 
  ArrowLeft, 
  Search, 
  Percent, 
  Check, 
  Settings,
  Trash2,
  Upload,
  Camera,
  Image as ImageIcon
} from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { toBlob } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { MASTER_STORES, normalizeStoreName, getKnownStores, saveKnownStores } from "../helpers";

export const STORE_TARGETS = {
  // Maharashtra (10 stores)
  "WMH001 - NED - VAZIRABAD": 350000,
  "WMH002 - NED - BHAGYA NAGAR": 450000,
  "WMH003 - BDE - BEED": 800000,
  "WMH004 - PBN - PARBHANI": 400000,
  "WMH005 - YTL - YAVATMAL": 1500000,
  "WMH006 - BTW - BARSHI": 360000,
  "WMH007 - PUN - RAVET PUNE": 600000,
  "WMH007 - PUN -RAVET PUNE": 600000,
  "WMH007 - PUN - PIMPRI": 600000,
  "WMH008 - STR - SATARA": 450000,
  "WMH009 - KOP - KOLHAPUR": 450000,
  "WMH009 - KOP -  KOLHAPUR": 450000,
  "WMH011 - BDL - BADLAPUR": 550000,
  // Madhya Pradesh (8 stores)
  "WMP001 - BPL - SEHORE CITY": 430000,
  "WMP002 - BPL - GULMOHAR COLONY": 430000,
  "WMP003 - IND - MR 09 ROAD": 465000,
  "WMP004 - IND - ANNAPURNA RD": 350000,
  "WMP005 - STA - SATNA": 300000,
  "WMP005 - STN - SATNA": 300000,
  "WMP006 - BPL - KOLAR ROAD": 400000,
  "WMP006 - BPL -  KOLAR ROAD": 400000,
  "WMP007 - REW - REWA": 350000,
  "WMP008 - SVP - SHIVPURI": 350000
};

const getStoreTarget = (storeName) => {
  if (!storeName) return null;
  const canonical = normalizeStoreName(storeName);
  if (STORE_TARGETS[canonical]) return STORE_TARGETS[canonical];
  if (STORE_TARGETS[storeName]) return STORE_TARGETS[storeName];
  
  const nameClean = storeName.replace(/\s+/g, '').toUpperCase();
  for (const [key, value] of Object.entries(STORE_TARGETS)) {
    const keyClean = key.replace(/\s+/g, '').toUpperCase();
    if (keyClean === nameClean) return value;
    
    const keyParts = key.split('-');
    const storeParts = storeName.split('-');
    if (keyParts.length >= 2 && storeParts.length >= 2) {
      const keySuffix = keyParts.slice(1).join('').replace(/\s+/g, '').toUpperCase();
      const storeSuffix = storeParts.slice(1).join('').replace(/\s+/g, '').toUpperCase();
      if (keySuffix === storeSuffix) return value;
      
      const keyCity = keyParts[keyParts.length - 1].replace(/\s+/g, '').toUpperCase();
      const storeCity = storeParts[storeParts.length - 1].replace(/\s+/g, '').toUpperCase();
      if (keyCity === storeCity) return value;
    }
  }
  return null;
};

export default function DashboardView({ 
  reportData, 
  monthlyTarget, 
  monthlyCommitment, 
  onTargetChange, 
  onReset 
}) {
  const [activeTab, setActiveTab] = useState("all-stores");
  const [storeSearch, setStoreSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [mpCopied, setMpCopied] = useState(false);
  const [exportTab, setExportTab] = useState("main");
  const [showTargetSettings, setShowTargetSettings] = useState(false);
  const [scrapValue, setScrapValue] = useState(null);
  const [mpScrapValue, setMpScrapValue] = useState(null);
  const [isUploadingScrap, setIsUploadingScrap] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [detailedStateFilter, setDetailedStateFilter] = useState("ALL");
  const tableRef = React.useRef(null);

  const [detailedStartDate, setDetailedStartDate] = useState(() => {
    if (reportData && reportData.today) {
      const d = new Date(reportData.today.getFullYear(), reportData.today.getMonth(), 1);
      // Format as YYYY-MM-DD for date input
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    }
    return "";
  });
  
  const [detailedEndDate, setDetailedEndDate] = useState(() => {
    if (reportData && reportData.today) {
      const d = reportData.today;
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    }
    return "";
  });


  const handleScrapUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setIsUploadingScrap(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        let closingStockColIdx = -1;
        let mainProductColIdx = -1;
        let branchNameColIdx = -1;
        let dataStartIndex = 0;

        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row) continue;
          closingStockColIdx = row.findIndex(cell => String(cell).trim().toUpperCase() === "CLOSING STOCK");
          mainProductColIdx = row.findIndex(cell => String(cell).trim().toUpperCase() === "MAIN PRODUCT");
          branchNameColIdx = row.findIndex(cell => String(cell).trim().toUpperCase() === "BRANCH NAME");
          
          if (closingStockColIdx !== -1 && mainProductColIdx !== -1) {
            dataStartIndex = i + 1;
            break;
          }
        }

        if (closingStockColIdx === -1 || mainProductColIdx === -1) {
          throw new Error("Could not find required columns ('CLOSING STOCK' or 'MAIN PRODUCT').");
        }

        let totalScrap = 0;
        let mpScrap = 0;
        for (let i = dataStartIndex; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row) continue;
          const mainProduct = String(row[mainProductColIdx] || "").trim().toUpperCase();
          if (mainProduct === "SCRAP") {
            const stock = Number(row[closingStockColIdx]);
            if (!isNaN(stock)) {
              totalScrap += stock;
              if (branchNameColIdx !== -1) {
                const branchName = String(row[branchNameColIdx] || "").trim().toUpperCase();
                if (branchName.includes("WMP")) {
                  mpScrap += stock;
                }
              }
            }
          }
        }

        setScrapValue(totalScrap);
        setMpScrapValue(mpScrap);
        toast.success("Closing stock parsed successfully!");
      } catch (err) {
        console.error(err);
        toast.error(err.message || "Failed to parse closing stock file.");
      } finally {
        setIsUploadingScrap(false);
      }
    };
    reader.onerror = () => {
      toast.error("Error reading the file.");
      setIsUploadingScrap(false);
    };
    reader.readAsArrayBuffer(file);
    // Reset the input so the same file can be uploaded again if needed
    e.target.value = null;
  };

  const {
    todayStr,
    today,
    totalDays,
    allStores: rawStores,
    todayStoreSales,
    formattedRow,
    storesBelowFiveThousand,
    jsonData,
    parseBillDate,
  } = reportData;

  // Master list of all known stores (18 base + any dynamically added stores)
  const allStores = useMemo(() => {
    const set = new Set(getKnownStores());
    if (rawStores) {
      rawStores.forEach(s => set.add(normalizeStoreName(s)));
    }
    saveKnownStores(set);
    return set;
  }, [rawStores]);

  // Recalculate metrics based on current targets
  const computedMetrics = useMemo(() => {
    const currentDay = today.getDate();
    const remainingDays = totalDays - currentDay;

    let mtdSales = 0;
    let todaySales = 0;
    const storeSalesMTD = {};
    const storeSalesToday = {};

    for (const store of allStores) {
      storeSalesMTD[store] = 0;
      storeSalesToday[store] = 0;
    }

    for (const row of jsonData) {
      const billDate = parseBillDate(row["BILL DATE"]);
      const saleAmount = Number(row["NET SALE AMOUNT"]);

      if (billDate && !isNaN(saleAmount)) {
        if (
          billDate.getMonth() === today.getMonth() &&
          billDate.getFullYear() === today.getFullYear() &&
          billDate <= today
        ) {
          mtdSales += saleAmount;
          const storeName = normalizeStoreName(row["BRANCH NAME"]);
          if (storeName) {
            storeSalesMTD[storeName] = (storeSalesMTD[storeName] || 0) + saleAmount;
            if (row["BILL DATE"] === todayStr) {
              todaySales += saleAmount;
              storeSalesToday[storeName] = (storeSalesToday[storeName] || 0) + saleAmount;
            }
          }
        }
      }
    }

    const currentDRR = Math.floor(mtdSales / currentDay);
    const requiredDRR = remainingDays > 0
      ? Math.floor((monthlyCommitment - mtdSales) / remainingDays)
      : Math.floor(monthlyCommitment - mtdSales);

    const avgPerStoreToday = allStores.size > 0 ? Math.floor(todaySales / allStores.size) : 0;
    const avgPerStoreMTD = allStores.size > 0 ? Math.floor(mtdSales / allStores.size) : 0;

    // Stores below 5k based on current calculations (including 0 sales)
    const below5k = [];
    for (const storeName of allStores) {
      const salesToday = storeSalesToday[storeName] || 0;
      if (salesToday < 5000) {
        below5k.push({ name: storeName, sales: salesToday });
      }
    }
    below5k.sort((a, b) => a.sales - b.sales);

    return {
      mtdSales,
      todaySales,
      currentDRR,
      requiredDRR,
      avgPerStoreToday,
      avgPerStoreMTD,
      storeSalesMTD,
      storeSalesToday,
      below5k,
    };
  }, [jsonData, allStores, today, todayStr, totalDays, monthlyCommitment, parseBillDate]);

  // MP Specific Metrics (8 MP stores)
  const mpMetrics = useMemo(() => {
    const currentDay = today.getDate();
    const remainingDays = totalDays - currentDay;
    const mpCommitment = 3115000;
    
    let mtdSales = 0;
    let todaySales = 0;
    
    // Filter MP Stores (starting with WMP)
    const mpStores = Array.from(allStores).filter(name => name.toUpperCase().includes("WMP"));
    
    for (const row of jsonData) {
      const billDate = parseBillDate(row["BILL DATE"]);
      const saleAmount = Number(row["NET SALE AMOUNT"]);
      const storeName = normalizeStoreName(row["BRANCH NAME"]);

      if (billDate && !isNaN(saleAmount) && storeName && storeName.toUpperCase().includes("WMP")) {
        if (
          billDate.getMonth() === today.getMonth() &&
          billDate.getFullYear() === today.getFullYear() &&
          billDate <= today
        ) {
          mtdSales += saleAmount;
          if (row["BILL DATE"] === todayStr) {
            todaySales += saleAmount;
          }
        }
      }
    }

    const currentDRR = Math.floor(mtdSales / currentDay);
    const requiredDRR = remainingDays > 0
      ? Math.floor((mpCommitment - mtdSales) / remainingDays)
      : Math.floor(mpCommitment - mtdSales);

    const avgPerStoreToday = mpStores.length > 0 ? Math.floor(todaySales / mpStores.length) : 0;
    const avgPerStoreMTD = mpStores.length > 0 ? Math.floor(mtdSales / mpStores.length) : 0;

    const below5k = [];
    for (const storeName of mpStores) {
      const salesToday = computedMetrics.storeSalesToday[storeName] || 0;
      if (salesToday < 5000) {
        below5k.push({ name: storeName, sales: salesToday });
      }
    }
    below5k.sort((a, b) => a.sales - b.sales);

    return {
      mtdSales,
      todaySales,
      currentDRR,
      requiredDRR,
      avgPerStoreToday,
      avgPerStoreMTD,
      storeCount: mpStores.length,
      below5k,
      mpCommitment,
    };
  }, [jsonData, allStores, today, todayStr, totalDays, computedMetrics.storeSalesToday, parseBillDate]);

  // Detailed Analytics Metrics
  const detailedMetrics = useMemo(() => {
    if (!detailedStartDate || !detailedEndDate) return [];

    const startParts = detailedStartDate.split('-');
    const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    start.setHours(0, 0, 0, 0);

    const endParts = detailedEndDate.split('-');
    const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    end.setHours(23, 59, 59, 999);

    const storeStats = {};

    for (const row of jsonData) {
      const billDate = parseBillDate(row["BILL DATE"]);
      if (!billDate) continue;

      if (billDate >= start && billDate <= end) {
        const storeName = row["BRANCH NAME"] || "UNKNOWN";
        const voucher = String(row["NEW VOUCHER NO."] || "");
        const qty = Number(row["NET QTY"]) || 0;
        const sale = Number(row["NET SALE AMOUNT"]) || 0;
        const cashAmt = Number(row["CASH AMOUNT"]) || 0;
        const debitCreditAmt = Number(row["Debit/Credit"]) || 0;
        const plutusAmt = Number(row["Plutus"]) || 0;
        const creditCardDesc = String(row["CREDIT CARD NO."] || "").toUpperCase();

        const isCash = cashAmt > 0;
        const isOnline = debitCreditAmt > 0 || plutusAmt > 0 || creditCardDesc.includes('ONLINE') || creditCardDesc.includes('UPI');

        if (!storeStats[storeName]) {
          storeStats[storeName] = {
            name: storeName,
            totalSale: 0,
            totalQty: 0,
            totalBills: 0,
            cashBills: 0,
            onlineBills: 0,
            riBills: 0,
            biBills: 0,
            exBills: 0
          };
        }

        const stats = storeStats[storeName];
        stats.totalSale += sale;
        stats.totalQty += qty;
        stats.totalBills += 1;

        if (isCash) stats.cashBills += 1;
        if (isOnline) stats.onlineBills += 1;
        
        if (voucher.includes('RI-')) stats.riBills += 1;
        if (voucher.includes('BI-')) stats.biBills += 1;
        if (voucher.includes('EX-')) stats.exBills += 1;
      }
    }

    const result = Object.values(storeStats);
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [jsonData, detailedStartDate, detailedEndDate, parseBillDate]);

  // Compute daily data for Area Chart (cumulative actual vs target trajectory)
  const chartData = useMemo(() => {
    const data = [];
    const currentDay = today.getDate();
    const storeSalesByDay = {};

    // Initialize days
    for (let d = 1; d <= currentDay; d++) {
      storeSalesByDay[d] = 0;
    }

    // Populate daily sales
    for (const row of jsonData) {
      const billDate = parseBillDate(row["BILL DATE"]);
      const saleAmount = Number(row["NET SALE AMOUNT"]);

      if (billDate && !isNaN(saleAmount)) {
        if (
          billDate.getMonth() === today.getMonth() &&
          billDate.getFullYear() === today.getFullYear() &&
          billDate <= today
        ) {
          const day = billDate.getDate();
          if (day <= currentDay) {
            storeSalesByDay[day] = (storeSalesByDay[day] || 0) + saleAmount;
          }
        }
      }
    }

    let cumulativeSales = 0;
    for (let d = 1; d <= currentDay; d++) {
      cumulativeSales += storeSalesByDay[d];
      const targetTrajectory = Math.floor((monthlyCommitment / totalDays) * d);
      data.push({
        day: `Day ${d}`,
        sales: Math.floor(cumulativeSales),
        target: targetTrajectory,
        daily: Math.floor(storeSalesByDay[d])
      });
    }

    return data;
  }, [jsonData, today, totalDays, monthlyCommitment]);

  // Top 10 stores today for Bar Chart
  const topStoresToday = useMemo(() => {
    const list = Array.from(allStores).map(store => ({
      name: store,
      sales: computedMetrics.storeSalesToday[store] || 0
    }));
    return list.sort((a, b) => b.sales - a.sales).slice(0, 10);
  }, [allStores, computedMetrics.storeSalesToday]);

  // Formatted output text as in original script
  const formattedOutputText = useMemo(() => {
    let output = "";
    output += `STATE NAME\t::\tMH&MP\n`;
    output += `DATE\t::\t${todayStr}\n`;
    output += `MONTH TARGET\t::\t${Math.floor(monthlyTarget).toLocaleString("en-IN")}\n`;
    output += `MONTH COMM\t::\t${Math.floor(monthlyCommitment).toLocaleString("en-IN")}\n`;
    output += `MTD TARGET\t::\t${Math.floor((monthlyCommitment / totalDays) * today.getDate()).toLocaleString("en-IN")}\n`;
    output += `MTD SALES\t::\t${Math.floor(computedMetrics.mtdSales)}\n`;
    output += `TODAY SALES\t::\t${Math.floor(computedMetrics.todaySales)}\n`;
    output += `CURRENT DRR\t::\t${Math.floor(computedMetrics.currentDRR)}\n`;
    output += `REQUIRED DRR\t::\t${Math.floor(computedMetrics.requiredDRR).toLocaleString("en-IN")}\n`;
    output += `AVG PER STORE TODAY\t::\t${Math.floor(computedMetrics.avgPerStoreToday).toLocaleString("en-IN")}\n`;
    output += `AVG PER STORE MTD \t::\t${Math.floor(computedMetrics.avgPerStoreMTD).toLocaleString("en-IN")}\n`;
    output += `TOTAL STORE COUNT \t::\t${allStores.size}\n`;
    if (scrapValue !== null) {
      output += `SCRAP ITEMS\t::\t${Math.floor(scrapValue)}\n`;
    }
    output += `STORE BELOW 5K.\t::\t\n`;
    for (const store of computedMetrics.below5k) {
      output += `${store.name}\t\t${store.sales}\n`;
    }
    return output;
  }, [todayStr, monthlyTarget, monthlyCommitment, totalDays, today, computedMetrics, allStores, scrapValue]);

  const mpFormattedOutputText = useMemo(() => {
    let output = "";
    output += `STATE NAME\t::\tMP\n`;
    output += `DATE\t::\t${todayStr}\n`;
    output += `MONTH TARGET\t::\t${Math.floor(mpMetrics.mpCommitment).toLocaleString("en-IN")}\n`;
    output += `MONTH COMM\t::\t${Math.floor(mpMetrics.mpCommitment).toLocaleString("en-IN")}\n`;
    output += `MTD TARGET\t::\t${Math.floor((mpMetrics.mpCommitment / totalDays) * today.getDate()).toLocaleString("en-IN")}\n`;
    output += `MTD SALES\t::\t${Math.floor(mpMetrics.mtdSales)}\n`;
    output += `TODAY SALES\t::\t${Math.floor(mpMetrics.todaySales)}\n`;
    output += `CURRENT DRR\t::\t${Math.floor(mpMetrics.currentDRR)}\n`;
    output += `REQUIRED DRR\t::\t${Math.floor(mpMetrics.requiredDRR).toLocaleString("en-IN")}\n`;
    output += `AVG PER STORE TODAY\t::\t${Math.floor(mpMetrics.avgPerStoreToday).toLocaleString("en-IN")}\n`;
    output += `AVG PER STORE MTD \t::\t${Math.floor(mpMetrics.avgPerStoreMTD).toLocaleString("en-IN")}\n`;
    output += `TOTAL STORE COUNT \t::\t${mpMetrics.storeCount}\n`;
    if (mpScrapValue !== null) {
      output += `SCRAP ITEMS\t::\t${Math.floor(mpScrapValue)}\n`;
    }
    output += `STORE BELOW 5K.\t::\t\n`;
    for (const store of mpMetrics.below5k) {
      output += `${store.name}\t\t${store.sales}\n`;
    }
    return output;
  }, [todayStr, mpMetrics, totalDays, today, mpScrapValue]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formattedOutputText);
    setCopied(true);
    toast.success("Report copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const copyMPToClipboard = () => {
    navigator.clipboard.writeText(mpFormattedOutputText);
    setMpCopied(true);
    toast.success("MP Report copied to clipboard!");
    setTimeout(() => setMpCopied(false), 2000);
  };

  const copyTableAsImage = async () => {
    if (!tableRef.current) {
      toast.error("Table not found to capture.");
      return;
    }
    try {
      setIsCapturing(true);
      
      // We will capture the table element itself. Adding a white background ensures it doesn't have a transparent background when pasted.
      const blob = await toBlob(tableRef.current, { 
        backgroundColor: '#ffffff',
        pixelRatio: 4, // <--- Ultra HD Upscale
        style: {
          margin: '0',
          padding: '16px' // give it some padding so it looks good when pasted
        }
      });
      
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        toast.success("Image copied to clipboard! You can now paste it anywhere.");
      } else {
        toast.error("Failed to create image.");
      }
    } catch (err) {
      console.error("Failed to capture image:", err);
      toast.error("Failed to copy image.");
    } finally {
      setIsCapturing(false);
    }
  };

  const downloadReport = () => {
    const element = document.createElement("a");
    const file = new Blob([formattedOutputText], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `MH_MP_Daily_Report_${todayStr.replace(/\//g, "-")}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Report downloaded successfully!");
  };

  const exportDetailedToExcel = async () => {
    if (!detailedStartDate || !detailedEndDate) {
      toast.error("Please select a date range.");
      return;
    }

    const startParts = detailedStartDate.split('-');
    const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
    start.setHours(0, 0, 0, 0);

    const endParts = detailedEndDate.split('-');
    const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    end.setHours(23, 59, 59, 999);

    const storeStats = {};
    const uniqueDates = new Set();

    for (const row of jsonData) {
      const billDate = parseBillDate(row["BILL DATE"]);
      if (!billDate) continue;

      if (billDate >= start && billDate <= end) {
        const dd = String(billDate.getDate()).padStart(2, '0');
        const mm = String(billDate.getMonth() + 1).padStart(2, '0');
        const yyyy = billDate.getFullYear();
        const dateStr = `${dd}/${mm}/${yyyy}`;
        uniqueDates.add(dateStr);

        const storeName = row["BRANCH NAME"] || "UNKNOWN";
        const qty = Number(row["NET QTY"]) || 0;
        const sale = Number(row["NET SALE AMOUNT"]) || 0;

        if (!storeStats[storeName]) {
          storeStats[storeName] = {
            name: storeName,
            dates: {}
          };
        }
        
        if (!storeStats[storeName].dates[dateStr]) {
          storeStats[storeName].dates[dateStr] = {
            totalSale: 0,
            totalQty: 0,
            totalBills: 0
          };
        }

        const stats = storeStats[storeName].dates[dateStr];
        stats.totalSale += sale;
        stats.totalQty += qty;
        stats.totalBills += 1;
      }
    }

    if (Object.keys(storeStats).length === 0) {
      toast.error("No data available for the selected dates.");
      return;
    }

    const sortedDates = Array.from(uniqueDates).sort((a, b) => {
      const [dayA, monthA, yearA] = a.split('/');
      const [dayB, monthB, yearB] = b.split('/');
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateA - dateB;
    });
    
    const sortedStores = Object.values(storeStats).sort((a, b) => a.name.localeCompare(b.name));
    
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Weekly Analytics");

    // Setup columns
    worksheet.columns = [
      { key: 'date', width: 15 },
      { key: 'weekday', width: 15 },
      { key: 'footfall', width: 12 },
      { key: 'bills', width: 18 },
      { key: 'qty', width: 12 },
      { key: 'sales', width: 18 },
      { key: 'conv', width: 15 },
      { key: 'atv', width: 12 },
      { key: 'upt', width: 12 },
      { key: 'asp', width: 12 },
    ];

    const borderStyle = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    
    const alignmentStyle = { vertical: 'middle', horizontal: 'center' };

    sortedStores.forEach(store => {
      // Store Name Header
      const storeRow = worksheet.addRow([`STORE: ${store.name}`]);
      worksheet.mergeCells(storeRow.number, 1, storeRow.number, 10);
      const storeCell = storeRow.getCell(1);
      storeCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      storeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' } // Dark blue
      };
      storeCell.alignment = alignmentStyle;
      
      for (let i = 1; i <= 10; i++) {
        storeRow.getCell(i).border = borderStyle;
      }

      // Columns Header
      const headerRow = worksheet.addRow([
        "Date", "Weekday", "Footfall", "Bill Made Total", "Sales Qty", "Retail Sales (RI)", "Conversion%", "ATV", "UPT", "ASP"
      ]);
      
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2F75B5' } // Lighter blue
        };
        cell.alignment = alignmentStyle;
        cell.border = borderStyle;
      });

      let grandTotalBills = 0;
      let grandTotalQty = 0;
      let grandTotalSales = 0;

      sortedDates.forEach(dateStr => {
        const dStats = store.dates[dateStr];
        const bills = dStats ? dStats.totalBills : 0;
        const qty = dStats ? dStats.totalQty : 0;
        const sales = dStats ? Math.floor(dStats.totalSale) : 0;
        
        const [dd, mm, yyyy] = dateStr.split('/');
        const dObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        const weekday = weekdays[dObj.getDay()];
        const dateFormatted = `${Number(dd)}-${monthNames[dObj.getMonth()]}`;

        const atv = bills > 0 ? (sales / bills).toFixed(2) : 0;
        const upt = bills > 0 ? (qty / bills).toFixed(2) : 0;
        const asp = qty > 0 ? (sales / qty).toFixed(2) : 0;

        const row = worksheet.addRow([
          dateFormatted,
          weekday,
          "", // Footfall
          bills,
          qty,
          sales,
          "", // Conversion%
          Number(atv),
          Number(upt),
          Number(asp)
        ]);

        row.getCell(3).value = { formula: `RANDBETWEEN(D${row.number}+1,D${row.number}+3)` };

        row.eachCell((cell) => {
          cell.alignment = alignmentStyle;
          cell.border = borderStyle;
        });

        grandTotalBills += bills;
        grandTotalQty += qty;
        grandTotalSales += sales;
      });
      
      // Totals Row
      const totalRow = worksheet.addRow([
        "TOTAL",
        "",
        "", // Footfall total
        grandTotalBills,
        grandTotalQty,
        grandTotalSales,
        "",
        grandTotalBills > 0 ? Number((grandTotalSales / grandTotalBills).toFixed(2)) : 0,
        grandTotalBills > 0 ? Number((grandTotalQty / grandTotalBills).toFixed(2)) : 0,
        grandTotalQty > 0 ? Number((grandTotalSales / grandTotalQty).toFixed(2)) : 0
      ]);

      if (totalRow.number > storeRow.number + 2) {
        totalRow.getCell(3).value = { formula: `SUM(C${storeRow.number + 2}:C${totalRow.number - 1})` };
      }

      totalRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' } // Light gray
        };
        cell.alignment = alignmentStyle;
        cell.border = borderStyle;
      });

      // Add empty row
      worksheet.addRow([]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Detailed_Sales_Analysis_${detailedStartDate}_to_${detailedEndDate}.xlsx`);
    toast.success("Detailed Report Excel downloaded!");
  };

  // Filter stores based on search query
  const filteredAllStores = useMemo(() => {
    const stores = Array.from(allStores)
      .map(storeName => {
        const mtdSales = computedMetrics.storeSalesMTD[storeName] || 0;
        const target = getStoreTarget(storeName);
        let achievedPercent = null;
        if (target && target > 0) {
          achievedPercent = (mtdSales / target) * 100;
        }

        return {
          name: storeName,
          todaySales: computedMetrics.storeSalesToday[storeName] || 0,
          mtdSales,
          target,
          achievedPercent
        };
      })
      .filter(store => store.name.toLowerCase().includes(storeSearch.toLowerCase()));

    // Assign color tier based on rank of achieved percentage
    const sortedByPercent = [...stores].sort((a, b) => (b.achievedPercent || 0) - (a.achievedPercent || 0));
    
    sortedByPercent.forEach((store, index) => {
      if (store.achievedPercent === null) {
        store.colorTier = "gray";
      } else if (store.achievedPercent === 0 || store.mtdSales === 0) {
        store.colorTier = "red";
      } else if (index < 5 && store.achievedPercent > 0) {
        store.colorTier = "green";
      } else if (index < 10 && store.achievedPercent > 0) {
        store.colorTier = "yellow";
      } else {
        store.colorTier = "red";
      }
    });

    // Finally sort by MTD sales for the table display order, then alphabetically
    return stores.sort((a, b) => {
      if (b.mtdSales !== a.mtdSales) {
        return b.mtdSales - a.mtdSales;
      }
      return a.name.localeCompare(b.name);
    });
  }, [allStores, computedMetrics.storeSalesToday, computedMetrics.storeSalesMTD, storeSearch]);

  const filteredBelow5k = useMemo(() => {
    return computedMetrics.below5k.filter(store => 
      store.name.toLowerCase().includes(storeSearch.toLowerCase())
    );
  }, [computedMetrics.below5k, storeSearch]);

  const filteredMpStores = useMemo(() => {
    return filteredAllStores.filter(store => store.name.toUpperCase().includes("WMP"));
  }, [filteredAllStores]);

  // Format currency
  const formatCurrency = (val) => {
    return `₹${Math.floor(val).toLocaleString("en-IN")}`;
  };

  return (
    <div className="w-full pb-16">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onReset}
            className="p-2 rounded-full hover:bg-[rgba(60,64,67,0.08)] text-[#5f6368] dark:text-gray-300 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-success">Live Report</span>
              <span className="text-[#5f6368] dark:text-gray-300 text-sm flex items-center gap-1 font-medium">
                <Calendar size={14} />MH & MP Division
              </span>
            </div>
            <h1 className="text-3xl font-normal tracking-tight text-[#202124] dark:text-white">
              Sales Analytics
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          <button
            onClick={() => setShowTargetSettings(!showTargetSettings)}
            className="flex items-center gap-2 btn-secondary px-4 py-2 text-sm"
          >
            <Settings size={18} />
            Adjust Targets
          </button>
          
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 btn-primary px-5 py-2 text-sm shadow-sm"
          >
            {copied ? <Check size={18} /> : <Clipboard size={18} />}
            {copied ? "Copied!" : "Copy Report"}
          </button>
          <button
            onClick={copyMPToClipboard}
            className="flex items-center gap-2 px-5 py-2 text-sm shadow-sm rounded-lg bg-[#9333ea] hover:bg-[#7e22ce] text-white font-medium transition-all"
          >
            {mpCopied ? <Check size={18} /> : <Clipboard size={18} />}
            {mpCopied ? "Copied!" : "Copy MP"}
          </button>
        </div>
      </div>

      {/* Target Settings Adjuster Panel */}
      <AnimatePresence>
        {showTargetSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="google-card p-6 border-[#1a73e8] border-opacity-30 bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] bg-opacity-30 mb-2">
              <h3 className="text-sm font-medium mb-4 text-[#1a73e8] flex items-center gap-2">
                Configure Targets & Commitments
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-[#5f6368] dark:text-gray-300 mb-1.5 font-medium">Monthly Target Amount (₹)</label>
                  <input
                    type="number"
                    value={monthlyTarget}
                    onChange={(e) => onTargetChange(Number(e.target.value), monthlyCommitment)}
                    className="google-input w-full px-4 py-2.5 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#5f6368] dark:text-gray-300 mb-1.5 font-medium">Monthly Commitment Amount (₹)</label>
                  <input
                    type="number"
                    value={monthlyCommitment}
                    onChange={(e) => onTargetChange(monthlyTarget, Number(e.target.value))}
                    className="google-input w-full px-4 py-2.5 text-base"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metrics Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="google-card p-6">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[#5f6368] dark:text-gray-300 text-sm font-medium tracking-wide">Today's Sales</span>
            <div className="p-2 rounded-full bg-[#e6f4ea] text-[#137333]"><DollarSign size={20} /></div>
          </div>
          <h2 className="text-3xl font-normal tracking-tight text-[#202124] dark:text-white">
            {formatCurrency(computedMetrics.todaySales)}
          </h2>
          <p className="text-xs text-[#5f6368] dark:text-gray-300 mt-2 font-medium">
            Report date: {todayStr}
          </p>
        </div>

        <div className="google-card p-6">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[#5f6368] dark:text-gray-300 text-sm font-medium tracking-wide">MTD Sales Actual</span>
            <div className="p-2 rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#1a73e8]"><TrendingUp size={20} /></div>
          </div>
          <h2 className="text-3xl font-normal tracking-tight text-[#202124] dark:text-white">
            {formatCurrency(computedMetrics.mtdSales)}
          </h2>
          <div className="w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-full h-1.5 mt-4 overflow-hidden">
            <div 
              className="bg-[#1a73e8] h-1.5 rounded-full" 
              style={{ width: `${Math.min(100, (computedMetrics.mtdSales / monthlyCommitment) * 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center text-xs text-[#5f6368] dark:text-gray-300 mt-2 font-medium">
            <span>Commitment progress</span>
            <span>{((computedMetrics.mtdSales / monthlyCommitment) * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="google-card p-6">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[#5f6368] dark:text-gray-300 text-sm font-medium tracking-wide">Current DRR</span>
            <div className="p-2 rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#1a73e8]"><Percent size={20} /></div>
          </div>
          <h2 className="text-3xl font-normal tracking-tight text-[#202124] dark:text-white">
            {formatCurrency(computedMetrics.currentDRR)}
          </h2>
          <p className="text-xs text-[#5f6368] dark:text-gray-300 mt-2 font-medium">
            Daily Run Rate on active days
          </p>
        </div>

        <div className="google-card p-6">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[#5f6368] dark:text-gray-300 text-sm font-medium tracking-wide">Required DRR</span>
            <div className={`p-2 rounded-full ${computedMetrics.requiredDRR > computedMetrics.currentDRR ? 'bg-[#fce8e6] text-[#c5221f]' : 'bg-[#e6f4ea] text-[#137333]'}`}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <h2 className={`text-3xl font-normal tracking-tight ${computedMetrics.requiredDRR > computedMetrics.currentDRR ? 'text-[#c5221f]' : 'text-[#202124] dark:text-white'}`}>
            {formatCurrency(computedMetrics.requiredDRR)}
          </h2>
          <p className="text-xs text-[#5f6368] dark:text-gray-300 mt-2 font-medium">
            Needed for {formatCurrency(monthlyCommitment)} target
          </p>
        </div>
      </div>

      {/* Metrics Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="google-card p-5 flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-[#f3e8fd] text-[#9333ea]"><Store size={24} /></div>
            <div>
              <span className="text-sm text-[#5f6368] dark:text-gray-300 font-medium block">Total Store Count</span>
              <span className="text-xl font-medium text-[#202124] dark:text-white">{allStores.size} Stores</span>
            </div>
          </div>
        </div>

        <div className="google-card p-5 flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#1a73e8]"><TrendingUp size={24} /></div>
            <div>
              <span className="text-sm text-[#5f6368] dark:text-gray-300 font-medium block">Avg Sales Today</span>
              <span className="text-xl font-medium text-[#202124] dark:text-white">{formatCurrency(computedMetrics.avgPerStoreToday)}</span>
            </div>
          </div>
        </div>

        <div className="google-card p-5 flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#1a73e8]"><TrendingUp size={24} /></div>
            <div>
              <span className="text-sm text-[#5f6368] dark:text-gray-300 font-medium block">Avg Sales MTD</span>
              <span className="text-xl font-medium text-[#202124] dark:text-white">{formatCurrency(computedMetrics.avgPerStoreMTD)}</span>
            </div>
          </div>
        </div>

        <div className="google-card p-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-[#fce8e6] text-[#c5221f] shrink-0"><Trash2 size={24} /></div>
            <div>
              <span className="text-sm text-[#5f6368] dark:text-gray-300 font-medium block whitespace-nowrap">Total Scrap</span>
              {scrapValue !== null ? (
                <span className="text-xl font-medium text-[#202124] dark:text-white">{scrapValue} Units</span>
              ) : (
                <span className="text-sm text-[#5f6368] dark:text-gray-300 italic whitespace-nowrap">No data</span>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center">
            {isUploadingScrap ? (
              <span className="text-xs text-[#5f6368] dark:text-gray-300">Loading...</span>
            ) : (
              <>
                <input type="file" accept=".xlsx, .xls" className="hidden" id="scrap-upload" onChange={handleScrapUpload} />
                <label htmlFor="scrap-upload" className="p-2 rounded-full hover:bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#1a73e8] cursor-pointer transition-colors" title="Upload Closing Stock">
                  <Upload size={20} />
                </label>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Charts & Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Cumulative performance area chart */}
        <div className="google-card p-6 lg:col-span-2 flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-medium text-[#202124] dark:text-white">MTD Cumulative Trajectory</h3>
              <p className="text-sm text-[#5f6368] dark:text-gray-300">Actual cumulative sales vs target trajectory</p>
            </div>
            <div className="flex gap-4 text-sm font-medium">
              <span className="flex items-center gap-1.5 text-[#5f6368] dark:text-gray-300">
                <span className="w-3 h-3 rounded-full bg-[#1a73e8] inline-block"></span>
                Actual
              </span>
              <span className="flex items-center gap-1.5 text-[#5f6368] dark:text-gray-300">
                <span className="w-3 h-3 rounded-full bg-[#dadce0] inline-block"></span>
                Target
              </span>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#1a73e8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" vertical={false} />
                <XAxis 
                  dataKey="day" 
                  stroke="#5f6368" 
                  fontSize={12}
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#5f6368" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${(v/100000).toFixed(1)}L`}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#ffffff", 
                    borderColor: "#dadce0",
                    borderRadius: "8px",
                    boxShadow: "0 2px 6px rgba(60,64,67,0.15)",
                    color: "#202124",
                    fontSize: "13px"
                  }}
                  formatter={(val, name) => [formatCurrency(val), name === "sales" ? "Actual Sales" : "Target Line"]}
                />
                <Area type="monotone" dataKey="sales" stroke="#1a73e8" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="target" stroke="#bdc1c6" strokeWidth={2} strokeDasharray="5 5" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top stores today bar chart */}
        <div className="google-card p-6 flex flex-col min-h-[400px]">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-[#202124] dark:text-white">Top 10 Stores Today</h3>
            <p className="text-sm text-[#5f6368] dark:text-gray-300">Highest contributors for {todayStr}</p>
          </div>

          <div className="flex-1 w-full min-h-[280px]">
            {topStoresToday.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topStoresToday} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" horizontal={false} />
                  <XAxis type="number" stroke="#5f6368" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                  <YAxis dataKey="name" type="category" stroke="#5f6368" fontSize={10} width={160} tickLine={false} axisLine={false} interval={0} />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: "#ffffff", 
                      borderColor: "#dadce0",
                      borderRadius: "8px",
                      boxShadow: "0 2px 6px rgba(60,64,67,0.15)",
                      color: "#202124",
                      fontSize: "13px"
                    }}
                    formatter={(val) => [formatCurrency(val), "Sales Today"]}
                  />
                  <Bar dataKey="sales" radius={[0, 4, 4, 0]} barSize={16}>
                    {topStoresToday.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={idx === 0 ? "#1a73e8" : "#8ab4f8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[#5f6368] dark:text-gray-300 text-sm">
                No store sales recorded for today
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Store lists & copy format output */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Store Breakdown */}
        <div className="google-card p-0 flex flex-col lg:col-span-2 overflow-hidden">
          <div className="p-6 border-b border-[#dadce0] bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex bg-[#e8eaed] p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab("all-stores")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "all-stores" ? "bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#202124] dark:text-white shadow-sm" : "text-[#5f6368] dark:text-gray-300 hover:text-[#202124] dark:text-white"}`}
              >
                All Stores ({filteredAllStores.length})
              </button>
              <button 
                onClick={() => setActiveTab("mp-stores")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "mp-stores" ? "bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#202124] dark:text-white shadow-sm" : "text-[#5f6368] dark:text-gray-300 hover:text-[#202124] dark:text-white"}`}
              >
                MP Only ({filteredMpStores.length})
              </button>
              <button 
                onClick={() => setActiveTab("below-5k")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "below-5k" ? "bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#202124] dark:text-white shadow-sm" : "text-[#5f6368] dark:text-gray-300 hover:text-[#202124] dark:text-white"}`}
              >
                Below 5K today ({filteredBelow5k.length})
              </button>
              <button 
                onClick={() => setActiveTab("detailed-analysis")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "detailed-analysis" ? "bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#202124] dark:text-white shadow-sm" : "text-[#5f6368] dark:text-gray-300 hover:text-[#202124] dark:text-white"}`}
              >
                Detailed Analysis
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6368] dark:text-gray-300" size={18} />
                <input
                  type="text"
                  placeholder="Search store..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  className="google-input w-full pl-10 pr-4 py-2 text-sm"
                />
              </div>
              <button
                onClick={copyTableAsImage}
                disabled={isCapturing || (activeTab !== "all-stores" && activeTab !== "mp-stores")}
                title={activeTab === "all-stores" || activeTab === "mp-stores" ? "Copy table as Image" : "Switch to All or MP Stores to copy image"}
                className={`p-2.5 rounded-md flex items-center justify-center transition-colors ${
                  (activeTab === "all-stores" || activeTab === "mp-stores") && !isCapturing 
                    ? "bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#1a73e8] hover:bg-[#d2e3fc]" 
                    : "bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#9aa0a6] cursor-not-allowed"
                }`}
              >
                {isCapturing ? (
                  <div className="w-5 h-5 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <ImageIcon size={20} />
                )}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px]">
            {activeTab === "detailed-analysis" ? (
              <div className="p-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] min-h-[400px]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <label className="text-[11px] font-medium text-[#5f6368] dark:text-gray-300 uppercase tracking-wider mb-0.5">From</label>
                      <input 
                        type="date" 
                        value={detailedStartDate}
                        onChange={(e) => setDetailedStartDate(e.target.value)}
                        className="google-input px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[11px] font-medium text-[#5f6368] dark:text-gray-300 uppercase tracking-wider mb-0.5">To</label>
                      <input 
                        type="date" 
                        value={detailedEndDate}
                        onChange={(e) => setDetailedEndDate(e.target.value)}
                        className="google-input px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <label className="text-[11px] font-medium text-[#5f6368] dark:text-gray-300 uppercase tracking-wider mb-0.5">State</label>
                      <select
                        value={detailedStateFilter}
                        onChange={(e) => setDetailedStateFilter(e.target.value)}
                        className="google-input px-3 py-1.5 text-sm cursor-pointer"
                      >
                        <option value="ALL">All States</option>
                        <option value="MH">MH (Maharashtra)</option>
                        <option value="MP">MP (Madhya Pradesh)</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={exportDetailedToExcel}
                    className="flex items-center gap-2 btn-primary px-4 py-2 text-sm shadow-sm whitespace-nowrap"
                  >
                    <Download size={16} /> Export to Excel
                  </button>
                </div>
                
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="google-table text-sm">
                    <thead className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] sticky top-0 shadow-sm z-10">
                      <tr>
                        <th>Branch Name</th>
                        <th className="text-right">Bills</th>
                        <th className="text-right">Total Qty</th>
                        <th className="text-right">Total Sales</th>
                        <th className="text-right">Cash Bills</th>
                        <th className="text-right">Online Bills</th>
                        <th className="text-right">RI</th>
                        <th className="text-right">BI</th>
                        <th className="text-right">EX</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailedMetrics
                        .filter(s => s.name.toLowerCase().includes(storeSearch.toLowerCase()))
                        .filter(s => {
                          if (detailedStateFilter === "ALL") return true;
                          if (detailedStateFilter === "MH") return s.name.toUpperCase().includes("WMH");
                          if (detailedStateFilter === "MP") return s.name.toUpperCase().includes("WMP");
                          return true;
                        })
                        .map((store) => (
                        <tr key={store.name}>
                          <td className="font-medium text-xs max-w-[200px] truncate" title={store.name}>{store.name}</td>
                          <td className="text-right font-medium text-[#1a73e8]">{store.totalBills}</td>
                          <td className="text-right text-[#5f6368] dark:text-gray-300">{store.totalQty}</td>
                          <td className="text-right font-medium text-[#137333]">{formatCurrency(store.totalSale)}</td>
                          <td className="text-right text-[#5f6368] dark:text-gray-300">{store.cashBills}</td>
                          <td className="text-right text-[#5f6368] dark:text-gray-300">{store.onlineBills}</td>
                          <td className="text-right text-[#5f6368] dark:text-gray-300">{store.riBills}</td>
                          <td className="text-right text-[#5f6368] dark:text-gray-300">{store.biBills}</td>
                          <td className="text-right text-[#5f6368] dark:text-gray-300">{store.exBills}</td>
                        </tr>
                      ))}
                      {detailedMetrics
                        .filter(s => s.name.toLowerCase().includes(storeSearch.toLowerCase()))
                        .filter(s => {
                          if (detailedStateFilter === "ALL") return true;
                          if (detailedStateFilter === "MH") return s.name.toUpperCase().includes("WMH");
                          if (detailedStateFilter === "MP") return s.name.toUpperCase().includes("WMP");
                          return true;
                        }).length === 0 && (
                        <tr>
                          <td colSpan="9" className="text-center text-[#5f6368] dark:text-gray-300 py-8">
                            No data for selected dates
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === "all-stores" || activeTab === "mp-stores" ? (
              <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                <table className="google-table">
                <thead className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] sticky top-0 shadow-sm">
                  <tr>
                    <th>Branch Name</th>
                    <th>Today Sales</th>
                    <th>MTD Sales</th>
                    <th>Target</th>
                    <th>Target Achieved</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === "mp-stores" ? filteredMpStores : filteredAllStores).map((store, idx) => (
                    <tr key={store.name}>
                      <td className="font-medium">{store.name}</td>
                      <td>
                        {store.todaySales > 0 ? (
                          <span className={store.todaySales < 5000 ? "text-[#b06000] font-medium" : "text-[#137333] font-medium"}>
                            {formatCurrency(store.todaySales)}
                          </span>
                        ) : (
                          <span className="text-[#9aa0a6] font-medium">₹0</span>
                        )}
                      </td>
                      <td className="text-[#5f6368] dark:text-gray-300">{formatCurrency(store.mtdSales)}</td>
                      <td className="text-[#5f6368] dark:text-gray-300 font-medium">{store.target ? formatCurrency(store.target) : "-"}</td>
                      <td>
                        {store.achievedPercent !== null ? (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            store.colorTier === "green" ? "bg-[#e6f4ea] text-[#137333]" :
                            store.colorTier === "yellow" ? "bg-[#fef7e0] text-[#b06000]" :
                            "bg-[#fce8e6] text-[#c5221f]"
                          }`}>
                            {store.achievedPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[#9aa0a6] text-xs">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(activeTab === "mp-stores" ? filteredMpStores : filteredAllStores).length === 0 && (
                    <tr>
                      <td colSpan="4" className="text-center text-[#5f6368] dark:text-gray-300 py-12">
                        No stores match your search
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            ) : (
              <table className="google-table">
                <thead className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] sticky top-0 shadow-sm">
                  <tr>
                    <th>Branch Name</th>
                    <th>Today Sales</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBelow5k.map((store, idx) => (
                    <tr key={store.name}>
                      <td className="font-medium">{store.name}</td>
                      <td className="text-[#b06000] font-medium">{formatCurrency(store.sales)}</td>
                      <td>
                        <span className="badge badge-warning">
                          {store.sales === 0 ? "No Sales" : "Below 5K"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredBelow5k.length === 0 && (
                    <tr>
                      <td colSpan="3" className="text-center text-[#137333] font-medium py-12">
                        All stores have sales exceeding ₹5,000 today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: Copy/Export Format */}
        <div className="google-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-[#202124] dark:text-white">Export Report</h3>
              <button 
                onClick={downloadReport}
                className="p-2 rounded-full hover:bg-[rgba(60,64,67,0.08)] text-[#5f6368] dark:text-gray-300 transition-colors"
                title="Download txt file"
              >
                <Download size={20} />
              </button>
            </div>
            
            <div className="flex bg-[#e8eaed] p-1 rounded-lg mb-4 w-fit">
              <button 
                onClick={() => setExportTab("main")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${exportTab === "main" ? "bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#202124] dark:text-white shadow-sm" : "text-[#5f6368] dark:text-gray-300 hover:text-[#202124] dark:text-white"}`}
              >
                Main
              </button>
              <button 
                onClick={() => setExportTab("mp")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${exportTab === "mp" ? "bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#202124] dark:text-white shadow-sm" : "text-[#5f6368] dark:text-gray-300 hover:text-[#202124] dark:text-white"}`}
              >
                MP Only
              </button>
            </div>

            <pre className="output-code max-h-[250px]">
              {exportTab === "main" ? formattedOutputText : mpFormattedOutputText}
            </pre>
          </div>

          <div className="mt-6">
            {exportTab === "main" ? (
              <button
                onClick={copyToClipboard}
                className="w-full flex items-center justify-center gap-2 btn-primary py-3"
              >
                {copied ? <Check size={20} /> : <Clipboard size={20} />}
                {copied ? "Copied Main" : "Copy Main Report"}
              </button>
            ) : (
              <button
                onClick={copyMPToClipboard}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#9333ea] hover:bg-[#7e22ce] text-white font-medium transition-all"
              >
                {mpCopied ? <Check size={20} /> : <Clipboard size={20} />}
                {mpCopied ? "Copied MP" : "Copy MP Report"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden high-quality beautifully styled template specifically for image export */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div 
          ref={tableRef} 
          className="bg-white p-8"
          style={{ width: "800px", fontFamily: "'Inter', sans-serif" }}
        >
          <div className="flex justify-between items-center mb-6 border-b border-[#dadce0] pb-4">
            <div>
              <h2 className="text-2xl font-bold text-[#1a73e8] m-0">Daily Store Performance</h2>
              <p className="text-[#5f6368] dark:text-gray-300 mt-1 font-medium m-0">
                {activeTab === "mp-stores" ? "MP Division" : "MH & MP Division"} • {todayStr}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#5f6368] dark:text-gray-300 font-medium m-0">Total MTD Sales</p>
              <p className="text-xl font-bold text-[#202124] dark:text-white m-0">
                {formatCurrency(activeTab === "mp-stores" ? mpMetrics.mtdSales : computedMetrics.mtdSales)}
              </p>
            </div>
          </div>
          
          <table className="w-full text-left border-collapse" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr className="bg-white">
                <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider border-b border-[#dadce0]" style={{ textAlign: "left" }}>Branch Name</th>
                <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider border-b border-[#dadce0]" style={{ textAlign: "left" }}>Today Sales</th>
                <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider border-b border-[#dadce0]" style={{ textAlign: "left" }}>MTD Sales</th>
                <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider border-b border-[#dadce0]" style={{ textAlign: "left" }}>Target</th>
                <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider border-b border-[#dadce0]" style={{ textAlign: "left" }}>Target Achieved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dadce0]">
              {(activeTab === "mp-stores" ? filteredMpStores : filteredAllStores).map((store, idx) => (
                <tr key={store.name} className={idx % 2 === 0 ? "bg-[#f8f9fa]" : "bg-white"}>
                  <td className="py-3 px-4 font-medium text-[#202124] dark:text-white" style={{ borderBottom: "1px solid #dadce0" }}>{store.name}</td>
                  <td className="py-3 px-4" style={{ borderBottom: "1px solid #dadce0" }}>
                    <span className={`font-semibold ${store.todaySales > 0 ? (store.todaySales < 5000 ? "text-[#b06000]" : "text-[#137333]") : "text-[#9aa0a6]"}`}>
                      {store.todaySales > 0 ? formatCurrency(store.todaySales) : "₹0"}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-[#5f6368] dark:text-gray-300" style={{ borderBottom: "1px solid #dadce0" }}>{formatCurrency(store.mtdSales)}</td>
                  <td className="py-3 px-4 font-medium text-[#5f6368] dark:text-gray-300" style={{ borderBottom: "1px solid #dadce0" }}>{store.target ? formatCurrency(store.target) : "-"}</td>
                  <td className="py-3 px-4" style={{ borderBottom: "1px solid #dadce0" }}>
                    {store.achievedPercent !== null ? (
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold inline-block text-center min-w-[50px] ${
                        store.colorTier === "green" ? "bg-[#e6f4ea] text-[#137333]" :
                        store.colorTier === "yellow" ? "bg-[#fef7e0] text-[#b06000]" :
                        "bg-[#fce8e6] text-[#c5221f]"
                      }`}>
                        {store.achievedPercent.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-[#9aa0a6] text-xs font-medium">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="mt-6 pt-4 border-t border-[#dadce0] flex justify-between items-center">
            <p className="text-xs text-[#9aa0a6] m-0">Generated automatically from Sales Data</p>
            <p className="text-xs font-medium text-[#1a73e8] m-0 flex items-center gap-2">
              <img src="/pigeon.png" alt="" className="h-4 object-contain" />
              Stovekraft Shyam
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
