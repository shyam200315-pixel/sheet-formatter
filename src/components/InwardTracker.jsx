import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, AlertTriangle, CheckCircle, Search, Download, Filter } from 'lucide-react';
import FileDropZone from './FileDropZone';
import { findHeaderRowIndex, parseBillDate } from '../helpers';
import toast from 'react-hot-toast';

export default function InwardTracker() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("ALL");

  const displayHeaders = ["BRANCH/STORE", "BILL NO.", "BILL DATE", "GOODS IN TRANSIT", "PUR QTY"];

  const handleFileSelect = (file) => {
    setError("");
    setValidationSuccess(false);

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
                totalQty: 0
              };
            }
            
            invoicesMap[billNo].totalQty += qty;
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
    return data.filter(inv => {
      const matchSearch = inv.branch.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          inv.billNo.toLowerCase().includes(searchQuery.toLowerCase());
      const matchBranch = selectedBranch === "ALL" || inv.branch === selectedBranch;
      return matchSearch && matchBranch;
    });
  }, [data, searchQuery, selectedBranch]);

  const exportToExcel = async () => {
    if (filteredData.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Pending Inwards");

      // Define Columns
      worksheet.columns = [
        { header: 'SNO.', key: 'sno', width: 8 },
        { header: 'BRANCH NAME', key: 'branch', width: 35 },
        { header: 'SUPPLIER NAME', key: 'supplier', width: 45 },
        { header: 'BILL NO.', key: 'billNo', width: 18 },
        { header: 'BILL DATE', key: 'billDate', width: 15 },
        { header: 'TOTAL QTY', key: 'totalQty', width: 12 },
        { header: 'DAYS OLD', key: 'daysOld', width: 12 },
        { header: 'STATUS', key: 'status', width: 20 },
        { header: 'REMARKS', key: 'remarks', width: 35 },
      ];

      // Style Header Row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A73E8' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 25;

      // Add Data Rows with Styling
      filteredData.forEach((inv, idx) => {
        const status = inv.daysOld <= 8 ? "Safe Zone" : (inv.daysOld > 30 ? "Critical Alert" : "Red Alert");
        
        const row = worksheet.addRow({
          sno: idx + 1,
          branch: inv.branch,
          supplier: inv.supplier,
          billNo: inv.billNo,
          billDate: inv.billDate,
          totalQty: inv.totalQty,
          daysOld: inv.daysOld,
          status: status,
          remarks: '' // Blank space for user
        });

        // Style each cell in the row
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          // Borders for all cells
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFDADCE0' } },
            left: { style: 'thin', color: { argb: 'FFDADCE0' } },
            bottom: { style: 'thin', color: { argb: 'FFDADCE0' } },
            right: { style: 'thin', color: { argb: 'FFDADCE0' } }
          };

          // Alignment
          // Branch (2), Supplier (3), and Remarks (9) left aligned, others centered
          const isLeftAligned = [2, 3, 9].includes(colNumber);
          cell.alignment = { vertical: 'middle', horizontal: isLeftAligned ? 'left' : 'center', wrapText: true };

          // Status colors
          if (colNumber === 8) {
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

      // Write buffer and save file
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), "Pending_Inwards_Report.xlsx");
      toast.success("Formatted Excel report downloaded successfully!");
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
            <div className="p-4 rounded-full bg-[#e8f0fe] text-[#1a73e8] mb-6 shadow-sm">
              <Truck size={48} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-normal text-[#202124] mb-2 text-center">
              Upload Stock Transfer Report
            </h1>
            <p className="text-[#5f6368] mb-10 text-center max-w-lg">
              Track pending inwardings and see how many days old each invoice is.
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
                <h1 className="text-3xl font-normal tracking-tight text-[#202124] flex items-center gap-3">
                  Pending Inwardings
                </h1>
                <p className="text-sm text-[#5f6368] mt-1">
                  Showing {filteredData.length} invoices that are currently in transit.
                </p>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 btn-primary px-4 py-2 text-sm shadow-sm"
                >
                  <Download size={18} />
                  Export Excel
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-full border border-[#dadce0] text-[#5f6368] font-medium hover:bg-[#f8f9fa] transition-colors text-sm"
                >
                  Upload New
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-white rounded-xl shadow-sm border border-[#dadce0]">
              <div className="relative flex-1 md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search branch or bill no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] sm:text-sm transition-colors shadow-sm"
                />
              </div>

              <div className="relative flex-1 md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] sm:text-sm appearance-none shadow-sm text-gray-700"
                >
                  <option value="ALL">All Stores</option>
                  {storeStats.map((store, idx) => (
                    <option key={idx} value={store.branch}>
                      {store.branch} ({store.count} pending)
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-[#dadce0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-[#dadce0]">
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider">Branch</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider">Supplier</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider">Bill No.</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider">Bill Date</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider text-right">Qty</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider text-right">Age (Days)</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f3f4]">
                    {filteredData.length > 0 ? (
                      filteredData.map((inv, idx) => (
                        <tr key={idx} className="hover:bg-[#f8f9fa] transition-colors">
                          <td className="py-3 px-4 text-sm font-medium text-[#202124]">{inv.branch}</td>
                          <td className="py-3 px-4 text-sm text-[#5f6368] truncate max-w-[150px]" title={inv.supplier}>{inv.supplier}</td>
                          <td className="py-3 px-4 text-sm text-[#5f6368] font-mono">{inv.billNo}</td>
                          <td className="py-3 px-4 text-sm text-[#5f6368]">{inv.billDate}</td>
                          <td className="py-3 px-4 text-sm text-[#202124] font-medium text-right">{inv.totalQty}</td>
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
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-[#5f6368] text-sm">
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
