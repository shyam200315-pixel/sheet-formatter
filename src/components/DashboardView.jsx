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

const STORE_TARGETS = {
  "WMH001 - NED - VAZIRABAD": 350000,
  "WMH002 - NED - BHAGYA NAGAR": 450000,
  "WMH003 - BDE - BEED": 1200000,
  "WMH004 - PBN - PARBHANI": 350000,
  "WMH005 - YTL - YAVATMAL": 1200000,
  "WMH006 - BTW - BARSHI": 375000,
  "WMP007 - PUN -RAVET PUNE": 550000,
  "WMH007 - PUN - PIMPRI": 550000, // Alias for Pune
  "WMH009 - KOP -  KOLHAPUR": 450000,
  "WMP001 - BPL - SEHORE CITY": 600000,
  "WMP002 - BPL - GULMOHAR COLONY": 500000,
  "WMP003 - IND - MR 09 ROAD": 375000,
  "WMP004 - IND - ANNAPURNA RD": 350000,
  "WMP006 - BPL -  KOLAR ROAD": 450000,
  "WMP007 - REW - REWA": 350000,
  "WMP008 - SVP - SHIVPURI": 350000
};

const getStoreTarget = (storeName) => {
  if (!storeName) return null;
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
  const [showTargetSettings, setShowTargetSettings] = useState(false);
  const [scrapValue, setScrapValue] = useState(null);
  const [isUploadingScrap, setIsUploadingScrap] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const tableRef = React.useRef(null);

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
        let dataStartIndex = 0;

        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row) continue;
          closingStockColIdx = row.findIndex(cell => String(cell).trim().toUpperCase() === "CLOSING STOCK");
          mainProductColIdx = row.findIndex(cell => String(cell).trim().toUpperCase() === "MAIN PRODUCT");
          
          if (closingStockColIdx !== -1 && mainProductColIdx !== -1) {
            dataStartIndex = i + 1;
            break;
          }
        }

        if (closingStockColIdx === -1 || mainProductColIdx === -1) {
          throw new Error("Could not find required columns ('CLOSING STOCK' or 'MAIN PRODUCT').");
        }

        let totalScrap = 0;
        for (let i = dataStartIndex; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row) continue;
          const mainProduct = String(row[mainProductColIdx] || "").trim().toUpperCase();
          if (mainProduct === "SCRAP") {
            const stock = Number(row[closingStockColIdx]);
            if (!isNaN(stock)) {
              totalScrap += stock;
            }
          }
        }

        setScrapValue(totalScrap);
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
    allStores,
    todayStoreSales,
    formattedRow,
    storesBelowFiveThousand,
    jsonData,
    parseBillDate,
  } = reportData;

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
          const storeName = row["BRANCH NAME"];
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

    // Stores below 5k based on current calculations
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
  }, [jsonData, allStores, today, todayStr, totalDays, monthlyCommitment]);

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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formattedOutputText);
    setCopied(true);
    toast.success("Report copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
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
      } else if (index < 5) {
        store.colorTier = "green";
      } else if (index < 10) {
        store.colorTier = "yellow";
      } else {
        store.colorTier = "red";
      }
    });

    // Finally sort by MTD sales for the table display order
    return stores.sort((a, b) => b.mtdSales - a.mtdSales);
  }, [allStores, computedMetrics.storeSalesToday, computedMetrics.storeSalesMTD, storeSearch]);

  const filteredBelow5k = useMemo(() => {
    return computedMetrics.below5k.filter(store => 
      store.name.toLowerCase().includes(storeSearch.toLowerCase())
    );
  }, [computedMetrics.below5k, storeSearch]);

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
            className="p-2 rounded-full hover:bg-[rgba(60,64,67,0.08)] text-[#5f6368] transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-success">Live Report</span>
              <span className="text-[#5f6368] text-sm flex items-center gap-1 font-medium">
                <Calendar size={14} />MH & MP Division
              </span>
            </div>
            <h1 className="text-3xl font-normal tracking-tight text-[#202124]">
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
            <div className="google-card p-6 border-[#1a73e8] border-opacity-30 bg-[#e8f0fe] bg-opacity-30 mb-2">
              <h3 className="text-sm font-medium mb-4 text-[#1a73e8] flex items-center gap-2">
                Configure Targets & Commitments
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-[#5f6368] mb-1.5 font-medium">Monthly Target Amount (₹)</label>
                  <input
                    type="number"
                    value={monthlyTarget}
                    onChange={(e) => onTargetChange(Number(e.target.value), monthlyCommitment)}
                    className="google-input w-full px-4 py-2.5 text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#5f6368] mb-1.5 font-medium">Monthly Commitment Amount (₹)</label>
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
            <span className="text-[#5f6368] text-sm font-medium tracking-wide">Today's Sales</span>
            <div className="p-2 rounded-full bg-[#e6f4ea] text-[#137333]"><DollarSign size={20} /></div>
          </div>
          <h2 className="text-3xl font-normal tracking-tight text-[#202124]">
            {formatCurrency(computedMetrics.todaySales)}
          </h2>
          <p className="text-xs text-[#5f6368] mt-2 font-medium">
            Report date: {todayStr}
          </p>
        </div>

        <div className="google-card p-6">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[#5f6368] text-sm font-medium tracking-wide">MTD Sales Actual</span>
            <div className="p-2 rounded-full bg-[#e8f0fe] text-[#1a73e8]"><TrendingUp size={20} /></div>
          </div>
          <h2 className="text-3xl font-normal tracking-tight text-[#202124]">
            {formatCurrency(computedMetrics.mtdSales)}
          </h2>
          <div className="w-full bg-[#f1f3f4] rounded-full h-1.5 mt-4 overflow-hidden">
            <div 
              className="bg-[#1a73e8] h-1.5 rounded-full" 
              style={{ width: `${Math.min(100, (computedMetrics.mtdSales / monthlyCommitment) * 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center text-xs text-[#5f6368] mt-2 font-medium">
            <span>Commitment progress</span>
            <span>{((computedMetrics.mtdSales / monthlyCommitment) * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="google-card p-6">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[#5f6368] text-sm font-medium tracking-wide">Current DRR</span>
            <div className="p-2 rounded-full bg-[#e8f0fe] text-[#1a73e8]"><Percent size={20} /></div>
          </div>
          <h2 className="text-3xl font-normal tracking-tight text-[#202124]">
            {formatCurrency(computedMetrics.currentDRR)}
          </h2>
          <p className="text-xs text-[#5f6368] mt-2 font-medium">
            Daily Run Rate on active days
          </p>
        </div>

        <div className="google-card p-6">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[#5f6368] text-sm font-medium tracking-wide">Required DRR</span>
            <div className={`p-2 rounded-full ${computedMetrics.requiredDRR > computedMetrics.currentDRR ? 'bg-[#fce8e6] text-[#c5221f]' : 'bg-[#e6f4ea] text-[#137333]'}`}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <h2 className={`text-3xl font-normal tracking-tight ${computedMetrics.requiredDRR > computedMetrics.currentDRR ? 'text-[#c5221f]' : 'text-[#202124]'}`}>
            {formatCurrency(computedMetrics.requiredDRR)}
          </h2>
          <p className="text-xs text-[#5f6368] mt-2 font-medium">
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
              <span className="text-sm text-[#5f6368] font-medium block">Total Store Count</span>
              <span className="text-xl font-medium text-[#202124]">{allStores.size} Stores</span>
            </div>
          </div>
        </div>

        <div className="google-card p-5 flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-[#e8f0fe] text-[#1a73e8]"><TrendingUp size={24} /></div>
            <div>
              <span className="text-sm text-[#5f6368] font-medium block">Avg Sales Today</span>
              <span className="text-xl font-medium text-[#202124]">{formatCurrency(computedMetrics.avgPerStoreToday)}</span>
            </div>
          </div>
        </div>

        <div className="google-card p-5 flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-[#e8f0fe] text-[#1a73e8]"><TrendingUp size={24} /></div>
            <div>
              <span className="text-sm text-[#5f6368] font-medium block">Avg Sales MTD</span>
              <span className="text-xl font-medium text-[#202124]">{formatCurrency(computedMetrics.avgPerStoreMTD)}</span>
            </div>
          </div>
        </div>

        <div className="google-card p-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-[#fce8e6] text-[#c5221f] shrink-0"><Trash2 size={24} /></div>
            <div>
              <span className="text-sm text-[#5f6368] font-medium block whitespace-nowrap">Total Scrap</span>
              {scrapValue !== null ? (
                <span className="text-xl font-medium text-[#202124]">{scrapValue} Units</span>
              ) : (
                <span className="text-sm text-[#5f6368] italic whitespace-nowrap">No data</span>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center">
            {isUploadingScrap ? (
              <span className="text-xs text-[#5f6368]">Loading...</span>
            ) : (
              <>
                <input type="file" accept=".xlsx, .xls" className="hidden" id="scrap-upload" onChange={handleScrapUpload} />
                <label htmlFor="scrap-upload" className="p-2 rounded-full hover:bg-[#f1f3f4] text-[#1a73e8] cursor-pointer transition-colors" title="Upload Closing Stock">
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
              <h3 className="text-lg font-medium text-[#202124]">MTD Cumulative Trajectory</h3>
              <p className="text-sm text-[#5f6368]">Actual cumulative sales vs target trajectory</p>
            </div>
            <div className="flex gap-4 text-sm font-medium">
              <span className="flex items-center gap-1.5 text-[#5f6368]">
                <span className="w-3 h-3 rounded-full bg-[#1a73e8] inline-block"></span>
                Actual
              </span>
              <span className="flex items-center gap-1.5 text-[#5f6368]">
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
            <h3 className="text-lg font-medium text-[#202124]">Top 10 Stores Today</h3>
            <p className="text-sm text-[#5f6368]">Highest contributors for {todayStr}</p>
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
              <div className="flex items-center justify-center h-full text-[#5f6368] text-sm">
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
          <div className="p-6 border-b border-[#dadce0] bg-[#f8f9fa] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex bg-[#e8eaed] p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab("all-stores")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "all-stores" ? "bg-white text-[#202124] shadow-sm" : "text-[#5f6368] hover:text-[#202124]"}`}
              >
                All Stores ({filteredAllStores.length})
              </button>
              <button 
                onClick={() => setActiveTab("below-5k")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "below-5k" ? "bg-white text-[#202124] shadow-sm" : "text-[#5f6368] hover:text-[#202124]"}`}
              >
                Below 5K today ({filteredBelow5k.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6368]" size={18} />
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
                disabled={isCapturing || activeTab !== "all-stores"}
                title={activeTab === "all-stores" ? "Copy table as Image" : "Switch to All Stores to copy image"}
                className={`p-2.5 rounded-md flex items-center justify-center transition-colors ${
                  activeTab === "all-stores" && !isCapturing 
                    ? "bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc]" 
                    : "bg-[#f1f3f4] text-[#9aa0a6] cursor-not-allowed"
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
            {activeTab === "all-stores" ? (
              <div className="bg-white">
                <table className="google-table">
                <thead className="bg-white sticky top-0 shadow-sm">
                  <tr>
                    <th>Branch Name</th>
                    <th>Today Sales</th>
                    <th>MTD Sales</th>
                    <th>Target Achieved</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllStores.map((store, idx) => (
                    <tr key={store.name}>
                      <td className="font-medium">{store.name}</td>
                      <td>
                        {store.todaySales > 0 ? (
                          <span className={store.todaySales < 5000 ? "text-[#b06000] font-medium" : "text-[#137333] font-medium"}>
                            {formatCurrency(store.todaySales)}
                          </span>
                        ) : (
                          <span className="text-[#9aa0a6]">-</span>
                        )}
                      </td>
                      <td className="text-[#5f6368]">{formatCurrency(store.mtdSales)}</td>
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
                  {filteredAllStores.length === 0 && (
                    <tr>
                      <td colSpan="4" className="text-center text-[#5f6368] py-12">
                        No stores match your search
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            ) : (
              <table className="google-table">
                <thead className="bg-white sticky top-0 shadow-sm">
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
              <h3 className="text-lg font-medium text-[#202124]">Export Report</h3>
              <button 
                onClick={downloadReport}
                className="p-2 rounded-full hover:bg-[rgba(60,64,67,0.08)] text-[#5f6368] transition-colors"
                title="Download txt file"
              >
                <Download size={20} />
              </button>
            </div>
            <p className="text-sm text-[#5f6368] mb-6">
              Text-formatted report ready for pasting.
            </p>

            <pre className="output-code max-h-[300px]">
              {formattedOutputText}
            </pre>
          </div>

          <div className="mt-6">
            <button
              onClick={copyToClipboard}
              className="w-full flex items-center justify-center gap-2 btn-primary py-3"
            >
              {copied ? <Check size={20} /> : <Clipboard size={20} />}
              {copied ? "Copied to Clipboard" : "Copy to Clipboard"}
            </button>
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
              <p className="text-[#5f6368] mt-1 font-medium m-0">MH & MP Division • {todayStr}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#5f6368] font-medium m-0">Total MTD Sales</p>
              <p className="text-xl font-bold text-[#202124] m-0">{formatCurrency(computedMetrics.mtdSales)}</p>
            </div>
          </div>
          
          <table className="w-full text-left border-collapse" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr className="bg-[#f8f9fa]">
                <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider border-b border-[#dadce0]" style={{ textAlign: "left" }}>Branch Name</th>
                <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider border-b border-[#dadce0]" style={{ textAlign: "left" }}>Today Sales</th>
                <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider border-b border-[#dadce0]" style={{ textAlign: "left" }}>MTD Sales</th>
                <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider border-b border-[#dadce0]" style={{ textAlign: "left" }}>Target Achieved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dadce0]">
              {filteredAllStores.map((store, idx) => (
                <tr key={store.name} className={idx % 2 === 0 ? "bg-white" : "bg-[#f8f9fa]"}>
                  <td className="py-3 px-4 font-medium text-[#202124]" style={{ borderBottom: "1px solid #dadce0" }}>{store.name}</td>
                  <td className="py-3 px-4" style={{ borderBottom: "1px solid #dadce0" }}>
                    <span className={`font-semibold ${store.todaySales < 5000 ? "text-[#b06000]" : "text-[#137333]"}`}>
                      {store.todaySales > 0 ? formatCurrency(store.todaySales) : "-"}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-[#5f6368]" style={{ borderBottom: "1px solid #dadce0" }}>{formatCurrency(store.mtdSales)}</td>
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
