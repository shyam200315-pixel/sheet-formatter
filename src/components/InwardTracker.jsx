import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, AlertTriangle, CheckCircle, Search, Download, Filter, ChevronRight, ChevronDown, Package, ChevronsUpDown, Sparkles } from 'lucide-react';
import FileDropZone from './FileDropZone';
import { findHeaderRowIndex, parseBillDate } from '../helpers';
import toast from 'react-hot-toast';

export default function InwardTracker() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [expandedBills, setExpandedBills] = useState(new Set());
  const [masterCatalog, setMasterCatalog] = useState({});
  const [mrpCatalog, setMrpCatalog] = useState({});

  // Load Master and MRP data on mount for rich item descriptions (e.g. 19003278 -> EVA INFRARED COOKTOP)
  useEffect(() => {
    Promise.all([
      fetch('/master.json').then(r => r.json()).catch(() => ({})),
      fetch('/mrp_data.json').then(r => r.json()).catch(() => ({}))
    ]).then(([master, mrp]) => {
      setMasterCatalog(master || {});
      setMrpCatalog(mrp || {});
    });
  }, []);

  const resolveItemName = (code, rawName, product) => {
    const cleanCode = String(code || "").trim();
    if (masterCatalog[cleanCode]?.name && !masterCatalog[cleanCode].name.startsWith('Item from PDF:')) {
      return masterCatalog[cleanCode].name.trim();
    }
    if (mrpCatalog[cleanCode]?.name && !mrpCatalog[cleanCode].name.startsWith('Item from PDF:')) {
      return mrpCatalog[cleanCode].name.trim();
    }
    if (rawName && !rawName.toUpperCase().includes(' NA') && rawName.length > 5) {
      return rawName.trim();
    }
    return rawName || product || cleanCode;
  };

  const displayHeaders = ["BRANCH/STORE", "BILL NO.", "BILL DATE", "GOODS IN TRANSIT", "PUR QTY", "ITEM CODE", "CATEGORY", "PRODUCT"];

  const handleFileSelect = (file) => {
    setError("");
    setValidationSuccess(false);
    setExpandedBills(new Set());

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target.result);
        const workbook = XLSX.read(dataArr, { type: "array" });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error("The Excel file doesn't contain any sheets.");
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const headerRowIndex = findHeaderRowIndex(worksheet);

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          range: headerRowIndex,
        });

        if (jsonData.length === 0) {
          throw new Error(`The sheet "${sheetName}" does not contain any rows after headers.`);
        }

        const sampleRow = jsonData[0];
        
        const possibleBranchHeaders = ["BRANCH NAME", "TO STORE", "FROM STORE"];
        const branchHeader = possibleBranchHeaders.find(h => h in sampleRow);
        
        const strictRequiredHeaders = ["BILL NO.", "BILL DATE", "GOODS IN TRANSIT", "PUR QTY"];
        const missingHeaders = strictRequiredHeaders.filter(h => !(h in sampleRow));
        
        if (!branchHeader) {
          missingHeaders.push("BRANCH NAME (or FROM STORE / TO STORE)");
        }

        if (missingHeaders.length > 0) {
          throw new Error(
            `Unable to locate required columns: ${missingHeaders.join(", ")}. `
          );
        }

        const today = new Date();
        const invoicesMap = {};

        for (const row of jsonData) {
          const inTransit = String(row["GOODS IN TRANSIT"]).trim().toLowerCase();
          
          if (inTransit === "true") {
            const billNo = String(row["BILL NO."] || "N/A").trim();
            const qty = Number(row["PUR QTY"]) || 0;
            
            if (!invoicesMap[billNo]) {
              const billDateStr = row["BILL DATE"];
              const parsedDate = parseBillDate(billDateStr);
              
              let daysOld = 0;
              if (parsedDate) {
                const diffTime = Math.abs(today - parsedDate);
                daysOld = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              }

              invoicesMap[billNo] = {
                branch: branchHeader ? row[branchHeader] || "N/A" : "N/A",
                supplier: row["FROM STORE"] || row["SUPPLIER NAME"] || row["COMPANY NAME"] || "N/A",
                billNo: billNo,
                billDate: billDateStr || "N/A",
                daysOld: daysOld,
                parsedDate: parsedDate,
                totalQty: 0,
                items: []
              };
            }
            
            invoicesMap[billNo].totalQty += qty;
            const itemCode = String(row["ITEM CODE"] || row["ITEMCODE"] || row["CODE"] || "N/A").trim();
            const rawName = String(row["ITEM NAME"] || row["ITEMNAME"] || row["DESCRIPTION"] || "").trim();
            const product = String(row["PRODUCT"] || row["PRODUCT NAME"] || "N/A").trim();

            invoicesMap[billNo].items.push({
              itemCode: itemCode,
              category: String(row["CATEGORY"] || "N/A").trim(),
              product: product,
              rawItemName: rawName,
              barcode: String(row["BARCODE"] || "").trim(),
              qty: qty,
              rate: Number(row["RATE"]) || 0,
              netAmount: Number(row["NET AMOUNT"]) || 0
            });
          }
        }

        const pendingInvoices = Object.values(invoicesMap);
        pendingInvoices.sort((a, b) => b.daysOld - a.daysOld);

        setValidationSuccess(true);
        setTimeout(() => {
          setData(pendingInvoices);
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

  const handleReset = () => {
    setData(null);
    setValidationSuccess(false);
    setError("");
    setSearchQuery("");
    setSelectedBranch("ALL");
    setExpandedBills(new Set());
  };

  const toggleExpand = (billNo) => {
    setExpandedBills(prev => {
      const next = new Set(prev);
      if (next.has(billNo)) {
        next.delete(billNo);
      } else {
        next.add(billNo);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (filteredData.length === 0) return;
    const all = new Set(filteredData.map(i => i.billNo));
    setExpandedBills(all);
  };

  const collapseAll = () => {
    setExpandedBills(new Set());
  };

  const storeStats = useMemo(() => {
    if (!data) return [];
    const stats = {};
    data.forEach(inv => {
      stats[inv.branch] = (stats[inv.branch] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query && selectedBranch === "ALL") return data;

    return data.filter(inv => {
      const matchBranch = selectedBranch === "ALL" || inv.branch === selectedBranch;
      if (!matchBranch) return false;
      if (!query) return true;

      const matchHeader = inv.branch.toLowerCase().includes(query) || 
                          inv.billNo.toLowerCase().includes(query) ||
                          inv.supplier.toLowerCase().includes(query);
      if (matchHeader) return true;

      return inv.items.some(item => {
        const resolvedName = resolveItemName(item.itemCode, item.rawItemName, item.product).toLowerCase();
        return item.itemCode.toLowerCase().includes(query) ||
               item.category.toLowerCase().includes(query) ||
               item.product.toLowerCase().includes(query) ||
               item.rawItemName.toLowerCase().includes(query) ||
               resolvedName.includes(query);
      });
    });
  }, [data, searchQuery, selectedBranch, masterCatalog, mrpCatalog]);

  const exportToExcel = async () => {
    if (filteredData.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      
      // Sheet 1: Summary Report
      const summarySheet = workbook.addWorksheet("Pending Inwards Summary");
      summarySheet.columns = [
        { header: 'SNO.', key: 'sno', width: 8 },
        { header: 'BRANCH NAME', key: 'branch', width: 35 },
        { header: 'SUPPLIER NAME', key: 'supplier', width: 45 },
        { header: 'BILL NO.', key: 'billNo', width: 18 },
        { header: 'BILL DATE', key: 'billDate', width: 15 },
        { header: 'TOTAL QTY', key: 'totalQty', width: 12 },
        { header: 'ITEMS COUNT', key: 'itemsCount', width: 14 },
        { header: 'DAYS OLD', key: 'daysOld', width: 12 },
        { header: 'STATUS', key: 'status', width: 20 },
        { header: 'REMARKS', key: 'remarks', width: 35 },
      ];

      const headerRow = summarySheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A73E8' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 25;

      filteredData.forEach((inv, idx) => {
        const status = inv.daysOld <= 8 ? "Safe Zone" : (inv.daysOld > 30 ? "Critical Alert" : "Red Alert");
        
        const row = summarySheet.addRow({
          sno: idx + 1,
          branch: inv.branch,
          supplier: inv.supplier,
          billNo: inv.billNo,
          billDate: inv.billDate,
          totalQty: inv.totalQty,
          itemsCount: inv.items.length,
          daysOld: inv.daysOld,
          status: status,
          remarks: ''
        });

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFDADCE0' } },
            left: { style: 'thin', color: { argb: 'FFDADCE0' } },
            bottom: { style: 'thin', color: { argb: 'FFDADCE0' } },
            right: { style: 'thin', color: { argb: 'FFDADCE0' } }
          };

          const isLeftAligned = [2, 3, 10].includes(colNumber);
          cell.alignment = { vertical: 'middle', horizontal: isLeftAligned ? 'left' : 'center', wrapText: true };

          if (colNumber === 9) {
            cell.font = { bold: true };
            if (status === "Safe Zone") {
              cell.font.color = { argb: 'FF137333' };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
            } else if (status === "Critical Alert") {
              cell.font.color = { argb: 'FFC5221F' };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE8E6' } };
            } else {
              cell.font.color = { argb: 'FFB06000' };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF7E0' } };
            }
          }
        });
      });

      // Sheet 2: Detailed Item-wise Inward Stock
      const detailSheet = workbook.addWorksheet("Inward Stock Items");
      detailSheet.columns = [
        { header: 'SNO.', key: 'sno', width: 8 },
        { header: 'BRANCH NAME', key: 'branch', width: 35 },
        { header: 'BILL NO.', key: 'billNo', width: 18 },
        { header: 'BILL DATE', key: 'billDate', width: 15 },
        { header: 'ITEM CODE', key: 'itemCode', width: 16 },
        { header: 'ITEM NAME / DESCRIPTION', key: 'itemName', width: 40 },
        { header: 'CATEGORY', key: 'category', width: 22 },
        { header: 'PRODUCT', key: 'product', width: 25 },
        { header: 'PUR QTY', key: 'qty', width: 12 },
        { header: 'DAYS OLD', key: 'daysOld', width: 12 },
        { header: 'STATUS', key: 'status', width: 18 },
      ];

      const detailHeader = detailSheet.getRow(1);
      detailHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      detailHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D652D' } };
      detailHeader.alignment = { vertical: 'middle', horizontal: 'center' };
      detailHeader.height = 25;

      let detailSno = 1;
      filteredData.forEach((inv) => {
        const status = inv.daysOld <= 8 ? "Safe Zone" : (inv.daysOld > 30 ? "Critical Alert" : "Red Alert");
        inv.items.forEach((item) => {
          const resolvedDescription = resolveItemName(item.itemCode, item.rawItemName, item.product);
          const row = detailSheet.addRow({
            sno: detailSno++,
            branch: inv.branch,
            billNo: inv.billNo,
            billDate: inv.billDate,
            itemCode: item.itemCode,
            itemName: resolvedDescription,
            category: item.category,
            product: item.product,
            qty: item.qty,
            daysOld: inv.daysOld,
            status: status
          });

          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFDADCE0' } },
              left: { style: 'thin', color: { argb: 'FFDADCE0' } },
              bottom: { style: 'thin', color: { argb: 'FFDADCE0' } },
              right: { style: 'thin', color: { argb: 'FFDADCE0' } }
            };
            const isLeftAligned = [2, 6, 7, 8].includes(colNumber);
            cell.alignment = { vertical: 'middle', horizontal: isLeftAligned ? 'left' : 'center', wrapText: true };
          });
        });
      });

      // Write buffer and save file
      const buffer = await workbook.xlsx.writeBuffer();
      const dateStr = new Date().toISOString().split('T')[0];
      saveAs(new Blob([buffer]), `Pending_Inwards_Report_${dateStr}.xlsx`);
      toast.success("Formatted Excel report with item descriptions downloaded successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Excel file.");
    }
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!data ? (
          <motion.div
            key="upload-view"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex flex-col items-center mt-6"
          >
            <div className="p-4 rounded-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] text-[#1a73e8] mb-6 shadow-sm icon-truck cursor-pointer">
              <Truck size={48} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-normal text-[#202124] dark:text-white mb-2 text-center">
              Upload Stock Transfer Report
            </h1>
            <p className="text-[#5f6368] dark:text-gray-300 mb-10 text-center max-w-lg">
              Track pending inwardings, click any invoice to see exact items (Item Code, Master Description, Category, Product), and check delivery aging.
            </p>

            <div className="w-full max-w-2xl">
              <FileDropZone 
                onFileSelect={handleFileSelect} 
                error={error} 
                validationSuccess={validationSuccess} 
                requiredHeaders={displayHeaders}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="w-full pb-16"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-normal tracking-tight text-[#202124] dark:text-white flex items-center gap-3">
                  Pending Inwardings
                </h1>
                <p className="text-sm text-[#5f6368] dark:text-gray-300 mt-1">
                  Showing {filteredData.length} invoices in transit. <span className="text-[#1a73e8] dark:text-blue-400 font-medium">Click any row to view stock items (Item Code, Master Name, Category, Product).</span>
                </p>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 btn-primary px-4 py-2 text-sm shadow-sm cursor-pointer"
                >
                  <Download size={18} />
                  Export Excel
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-full border border-[#dadce0] text-[#5f6368] dark:text-gray-300 font-medium hover:bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-colors text-sm cursor-pointer"
                >
                  Upload New
                </button>
              </div>
            </div>

            {/* Filters & Actions Row */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-xl shadow-sm border border-[#dadce0]">
              <div className="relative flex-1 md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400 dark:text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search branch, bill, item code, master name (e.g. EVA), product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg leading-5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] sm:text-sm transition-colors shadow-sm"
                />
              </div>

              <div className="relative flex-1 md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-4 w-4 text-gray-400 dark:text-gray-400" />
                </div>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] sm:text-sm appearance-none shadow-sm text-gray-700 dark:text-gray-300"
                >
                  <option value="ALL">All Stores</option>
                  {storeStats.map((store, idx) => (
                    <option key={idx} value={store.branch}>
                      {store.branch} ({store.count} pending)
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>

              {/* Expand / Collapse All */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Expand all invoice item breakdowns"
                >
                  <ChevronsUpDown size={14} />
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
                  title="Collapse all"
                >
                  Collapse All
                </button>
              </div>
            </div>

            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-xl shadow-sm border border-[#dadce0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border-b border-[#dadce0]">
                      <th className="py-3 px-4 w-10 text-center text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider"></th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider">Branch</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider">Supplier</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider">Bill No.</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider">Bill Date</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider text-right">Items / Qty</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider text-right">Age (Days)</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] dark:text-gray-300 uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f3f4] dark:divide-slate-700/60">
                    {filteredData.length > 0 ? (
                      filteredData.map((inv, idx) => {
                        const isExpanded = expandedBills.has(inv.billNo);
                        return (
                          <React.Fragment key={inv.billNo || idx}>
                            <tr 
                              onClick={() => toggleExpand(inv.billNo)}
                              className={`cursor-pointer transition-all duration-200 select-none ${
                                isExpanded 
                                  ? "bg-blue-50/70 dark:bg-slate-800/90 shadow-inner" 
                                  : "hover:bg-blue-50/40 dark:hover:bg-slate-700/50"
                              }`}
                            >
                              <td className="py-3 px-3 text-center text-gray-400">
                                <div className="flex items-center justify-center">
                                  {isExpanded ? (
                                    <ChevronDown size={18} className="text-[#1a73e8] transition-transform duration-200" />
                                  ) : (
                                    <ChevronRight size={18} className="text-gray-400 hover:text-[#1a73e8] transition-transform duration-200" />
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm font-medium text-[#202124] dark:text-white">
                                <div className="flex items-center gap-2">
                                  <span>{inv.branch}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-[#5f6368] dark:text-gray-300 truncate max-w-[160px]" title={inv.supplier}>
                                {inv.supplier}
                              </td>
                              <td className="py-3 px-4 text-sm font-mono font-medium text-[#1a73e8] dark:text-blue-400">
                                {inv.billNo}
                              </td>
                              <td className="py-3 px-4 text-sm text-[#5f6368] dark:text-gray-300">
                                {inv.billDate}
                              </td>
                              <td className="py-3 px-4 text-sm text-right">
                                <span className="font-bold text-[#202124] dark:text-white">{inv.totalQty}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                  ({inv.items.length} {inv.items.length === 1 ? 'item' : 'items'})
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm font-bold text-right">
                                <span className={inv.daysOld > 8 ? "text-[#d93025]" : "text-[#137333]"}>
                                  {inv.daysOld}
                                </span>
                              </td>
                              <td className="py-3 px-4 flex justify-center">
                                {inv.daysOld <= 8 ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#e6f4ea] text-[#137333]">
                                    <CheckCircle size={14} /> Safe Zone
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                    inv.daysOld > 30 ? 'bg-[#fce8e6] text-[#c5221f] border border-[#f4c7c3]' : 'bg-[#fef7e0] text-[#b06000]'
                                  }`}>
                                    <AlertTriangle size={14} /> 
                                    {inv.daysOld > 30 ? 'Critical Alert' : 'Red Alert'}
                                  </span>
                                )}
                              </td>
                            </tr>

                            {/* Expandable Stock Items Detail Row */}
                            {isExpanded && (
                              <tr className="bg-slate-50/90 dark:bg-slate-900/80">
                                <td colSpan="8" className="p-0 border-y border-slate-200 dark:border-slate-700">
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="p-4 sm:p-5 border-l-4 border-[#1a73e8] bg-gradient-to-r from-blue-50/40 via-white/50 to-slate-50/40 dark:from-slate-900/90 dark:via-slate-800/90 dark:to-slate-900/90"
                                  >
                                    {/* Header info */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-[#1a73e8] dark:text-blue-300">
                                          <Package size={16} />
                                        </div>
                                        <div>
                                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            Inward Stock Details for Bill #{inv.billNo}
                                          </h4>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Destination: <span className="font-medium text-gray-700 dark:text-gray-200">{inv.branch}</span>
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-[#1a73e8] dark:text-blue-300 font-semibold">
                                          {inv.items.length} {inv.items.length === 1 ? 'SKU' : 'SKUs'}
                                        </span>
                                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-semibold">
                                          {inv.totalQty} Total Qty
                                        </span>
                                      </div>
                                    </div>

                                    {/* Sub-table with Item Code, Resolved Description, Category, Product, Qty */}
                                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800/90">
                                      <table className="w-full text-left text-xs">
                                        <thead>
                                          <tr className="bg-slate-100/90 dark:bg-slate-700/80 text-[#5f6368] dark:text-gray-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                                            <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[#1a73e8] dark:text-blue-400">
                                              Item Code
                                            </th>
                                            <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                              Item Description / Name
                                            </th>
                                            <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">
                                              Category
                                            </th>
                                            <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">
                                              Product Model
                                            </th>
                                            <th className="py-2.5 px-3 text-right font-semibold uppercase tracking-wider">
                                              Inward Qty
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                          {inv.items.map((item, itemIdx) => {
                                            const resolvedName = resolveItemName(item.itemCode, item.rawItemName, item.product);
                                            return (
                                              <tr 
                                                key={itemIdx} 
                                                className="hover:bg-blue-50/30 dark:hover:bg-slate-700/30 transition-colors"
                                              >
                                                <td className="py-2.5 px-3 text-center text-gray-400 font-mono">
                                                  {itemIdx + 1}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono font-bold text-[#1a73e8] dark:text-blue-400">
                                                  <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800">
                                                    {item.itemCode}
                                                  </span>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                  <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-900 dark:text-white text-xs">
                                                      {resolvedName}
                                                    </span>
                                                    {item.rawItemName && item.rawItemName !== resolvedName && (
                                                      <span className="text-[10px] text-gray-400 font-mono">
                                                        Code ref: {item.rawItemName}
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                  <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium">
                                                    {item.category}
                                                  </span>
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-gray-700 dark:text-gray-300">
                                                  {item.product}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-gray-900 dark:text-white">
                                                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                                                    {item.qty}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" className="py-8 text-center text-[#5f6368] dark:text-gray-300 text-sm">
                          No pending inwardings found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
