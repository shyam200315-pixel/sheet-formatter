import React, { useState, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { 
  Package, 
  Store, 
  Filter, 
  Search, 
  ArrowLeft, 
  UploadCloud,
  Layers,
  Database,
  DollarSign
} from "lucide-react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";

const COLORS = ['#1a73e8', '#e53935', '#fbc02d', '#43a047', '#8e24aa', '#3949ab', '#039be5', '#00897b', '#fb8c00', '#d81b60'];

export default function StockAnalyzer() {
  const [stockData, setStockData] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [selectedStore, setSelectedStore] = useState("All Stores");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        
        // Find header row dynamically
        let headerIdx = -1;
        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
          const row = jsonData[i];
          if (row && row.some(cell => String(cell).toUpperCase().includes("BRANCH NAME"))) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          throw new Error("Could not find header row with 'BRANCH NAME'.");
        }

        const headers = jsonData[headerIdx].map(h => String(h).trim().toUpperCase());
        
        const branchCol = headers.indexOf("BRANCH NAME");
        const genderCol = headers.indexOf("GENDER");
        const mainProdCol = headers.indexOf("MAIN PRODUCT");
        const itemCol = headers.indexOf("ITEM NAME");
        const descCol = headers.indexOf("ITEM DESCRIPTION");
        const stockCol = headers.indexOf("CLOSING STOCK");
        const valueCol = headers.indexOf("CLOSING VALUE(LANDED COST)");
        const godownCol = headers.indexOf("GODOWN NAME");
        const barcodeCol = headers.indexOf("BARCODE");

        if (branchCol === -1 || stockCol === -1) {
          throw new Error("Missing critical columns: 'BRANCH NAME' or 'CLOSING STOCK'.");
        }

        const parsedRows = [];
        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[branchCol]) continue; // Skip empty rows

          parsedRows.push({
            id: i,
            branch: String(row[branchCol]).trim(),
            gender: genderCol !== -1 ? String(row[genderCol]).trim() : "Unknown",
            mainProduct: mainProdCol !== -1 ? String(row[mainProdCol]).trim() : "Unknown",
            item: itemCol !== -1 ? String(row[itemCol]).trim() : "Unknown",
            description: descCol !== -1 ? String(row[descCol]).trim() : "Unknown",
            stock: Number(row[stockCol]) || 0,
            value: valueCol !== -1 ? (Number(row[valueCol]) || 0) : 0,
            godown: godownCol !== -1 ? String(row[godownCol]).trim() : "Unknown",
            barcode: barcodeCol !== -1 ? String(row[barcodeCol]).trim() : "Unknown",
          });
        }

        setStockData(parsedRows);
        toast.success("Closing stock parsed successfully!");
      } catch (err) {
        console.error(err);
        toast.error(err.message || "Failed to parse closing stock file.");
      } finally {
        setIsParsing(false);
      }
    };
    
    reader.onerror = () => {
      toast.error("Error reading the file.");
      setIsParsing(false);
    };
    
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = null; // Reset input
    }
  };

  const handleReset = () => {
    setStockData(null);
    setSelectedStore("All Stores");
    setSelectedCategory("All Categories");
    setSearchTerm("");
  };

  // Derived filters and data
  const { stores, categories, filteredData, metrics, chartData } = useMemo(() => {
    if (!stockData) return { stores: [], categories: [], filteredData: [], metrics: {}, chartData: [] };

    const storeSet = new Set();
    const catSet = new Set();
    
    stockData.forEach(row => {
      if (row.branch) storeSet.add(row.branch);
      if (row.gender) catSet.add(row.gender);
    });

    const storeList = Array.from(storeSet).sort();
    const catList = Array.from(catSet).sort();

    // Filter
    let filtered = stockData.filter(row => {
      const matchStore = selectedStore === "All Stores" || row.branch === selectedStore;
      const matchCat = selectedCategory === "All Categories" || row.gender === selectedCategory;
      const matchSearch = searchTerm === "" || 
        row.item.toLowerCase().includes(searchTerm.toLowerCase()) || 
        row.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchStore && matchCat && matchSearch;
    });

    // Metrics
    let totalQty = 0;
    let totalVal = 0;
    const uniqueItems = new Set();
    
    filtered.forEach(row => {
      totalQty += row.stock;
      totalVal += row.value;
      uniqueItems.add(row.item);
    });

    const metricsData = {
      qty: totalQty,
      val: totalVal,
      unique: uniqueItems.size
    };

    // Chart Data Formulation
    let chartResult = [];
    if (searchTerm !== "" && selectedStore === "All Stores") {
      // Group by Store when searching
      const grouped = {};
      filtered.forEach(r => {
        grouped[r.branch] = (grouped[r.branch] || 0) + r.stock;
      });
      chartResult = Object.entries(grouped)
        .map(([name, val]) => ({ name: name.split('-')[0].trim(), value: val, fullName: name }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);
    } else if (selectedStore !== "All Stores" && selectedCategory !== "All Categories") {
      // Group by Item Name
      const grouped = {};
      filtered.forEach(r => {
        grouped[r.item] = (grouped[r.item] || 0) + r.stock;
      });
      chartResult = Object.entries(grouped)
        .map(([name, val]) => ({ name, value: val }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    } else if (selectedCategory !== "All Categories") {
      // Group by Store
      const grouped = {};
      filtered.forEach(r => {
        grouped[r.branch] = (grouped[r.branch] || 0) + r.stock;
      });
      chartResult = Object.entries(grouped)
        .map(([name, val]) => ({ name: name.split('-')[0].trim(), value: val, fullName: name }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);
    } else {
      // Group by Category
      const grouped = {};
      filtered.forEach(r => {
        grouped[r.gender] = (grouped[r.gender] || 0) + r.stock;
      });
      chartResult = Object.entries(grouped)
        .map(([name, val]) => ({ name, value: val }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15);
    }

    // Sort filtered data for table (by stock desc)
    filtered.sort((a, b) => b.stock - a.stock);

    return {
      stores: storeList,
      categories: catList,
      filteredData: filtered,
      metrics: metricsData,
      chartData: chartResult
    };
  }, [stockData, selectedStore, selectedCategory, searchTerm]);

  // Render initial upload screen
  if (!stockData) {
    return (
      <div className="flex flex-col items-center mt-12 w-full max-w-3xl mx-auto">
        <div className="mb-6 bg-[#e8f0fe] p-4 rounded-full text-[#1a73e8]">
          <Database size={48} />
        </div>
        <h1 className="text-3xl font-normal text-[#202124] mb-3 text-center tracking-tight">
          Stock Analyzer
        </h1>
        <p className="text-[#5f6368] mb-10 text-center max-w-lg text-lg">
          Upload your Closing Stock Excel file to instantly analyze inventory, find scrap, and track category distribution across all branches.
        </p>

        <div className="w-full">
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            id="stock-upload" 
            ref={fileInputRef}
            onChange={handleFileUpload} 
          />
          <label 
            htmlFor="stock-upload" 
            className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              isParsing ? 'bg-[#f1f3f4] border-[#dadce0]' : 'bg-[#f8fafd] border-[#8ab4f8] hover:bg-[#e8f0fe]'
            }`}
          >
            {isParsing ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a73e8] mb-4"></div>
                <p className="text-sm text-[#1a73e8] font-medium">Analyzing Stock Data...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <UploadCloud size={48} className="text-[#1a73e8] mb-4 opacity-80" />
                <p className="text-lg font-medium text-[#1a73e8] mb-1">Click to Upload Stock File</p>
                <p className="text-sm text-[#5f6368]">Supports .xlsx and .xls formats</p>
              </div>
            )}
          </label>
        </div>
      </div>
    );
  }

  const formatCurrency = (val) => {
    return `₹${Math.floor(val).toLocaleString("en-IN")}`;
  };

  return (
    <div className="w-full pb-16 animate-in fade-in duration-300">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="p-2 rounded-full hover:bg-[rgba(60,64,67,0.08)] text-[#5f6368] transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-primary bg-[#e8f0fe] text-[#1a73e8]">Analysis Active</span>
              <span className="text-[#5f6368] text-sm flex items-center gap-1 font-medium">
                <Database size={14} /> {stockData.length.toLocaleString()} Records Loaded
              </span>
            </div>
            <h1 className="text-3xl font-normal tracking-tight text-[#202124]">
              Inventory Insights
            </h1>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="google-card p-4 mb-8 bg-white shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="flex items-center gap-2 text-sm font-medium text-[#5f6368] mb-2">
            <Store size={16} /> Select Branch
          </label>
          <div className="relative">
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full appearance-none bg-[#f1f3f4] border-none rounded-lg px-4 py-3 text-[#202124] focus:ring-2 focus:ring-[#1a73e8] outline-none font-medium transition-shadow cursor-pointer"
            >
              <option value="All Stores">All Stores</option>
              {stores.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-[#5f6368]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full">
          <label className="flex items-center gap-2 text-sm font-medium text-[#5f6368] mb-2">
            <Layers size={16} /> Category (Gender)
          </label>
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none bg-[#f1f3f4] border-none rounded-lg px-4 py-3 text-[#202124] focus:ring-2 focus:ring-[#1a73e8] outline-none font-medium transition-shadow cursor-pointer"
            >
              <option value="All Categories">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-[#5f6368]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full relative">
          <label className="flex items-center gap-2 text-sm font-medium text-[#5f6368] mb-2">
            <Search size={16} /> Search Items
          </label>
          <input
            type="text"
            placeholder="Search by name or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#f1f3f4] border-none rounded-lg pl-10 pr-4 py-3 text-[#202124] focus:ring-2 focus:ring-[#1a73e8] outline-none transition-shadow"
          />
          <Search size={18} className="absolute left-3 bottom-3.5 text-[#5f6368]" />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="google-card p-6 overflow-hidden relative">
          <div className="absolute -right-6 -top-6 text-[#e8f0fe] opacity-50">
            <Package size={120} />
          </div>
          <div className="relative z-10">
            <span className="text-[#5f6368] text-sm font-medium tracking-wide flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#1a73e8]"></span> Total Quantity
            </span>
            <h2 className="text-4xl font-normal tracking-tight text-[#1a73e8]">
              {metrics.qty.toLocaleString()}
            </h2>
            <p className="text-xs text-[#5f6368] mt-2 font-medium">Units in stock</p>
          </div>
        </div>

        <div className="google-card p-6 overflow-hidden relative">
          <div className="absolute -right-6 -top-6 text-[#e6f4ea] opacity-50">
            <DollarSign size={120} />
          </div>
          <div className="relative z-10">
            <span className="text-[#5f6368] text-sm font-medium tracking-wide flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#137333]"></span> Total Value
            </span>
            <h2 className="text-4xl font-normal tracking-tight text-[#137333]">
              {formatCurrency(metrics.val)}
            </h2>
            <p className="text-xs text-[#5f6368] mt-2 font-medium">Landed cost valuation</p>
          </div>
        </div>

        <div className="google-card p-6 overflow-hidden relative">
          <div className="absolute -right-6 -top-6 text-[#fef7e0] opacity-50">
            <Layers size={120} />
          </div>
          <div className="relative z-10">
            <span className="text-[#5f6368] text-sm font-medium tracking-wide flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#f29900]"></span> Unique Items
            </span>
            <h2 className="text-4xl font-normal tracking-tight text-[#e65100]">
              {metrics.unique.toLocaleString()}
            </h2>
            <p className="text-xs text-[#5f6368] mt-2 font-medium">Distinct models/SKUs</p>
          </div>
        </div>
      </div>

      {/* Main Content: Chart and Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chart Area */}
        <div className="lg:col-span-1">
          <div className="google-card p-6 h-full min-h-[400px]">
            <h3 className="text-lg font-medium text-[#202124] mb-1">
              {searchTerm !== "" && selectedStore === "All Stores"
                ? "Search Results by Branch"
                : selectedStore !== "All Stores" && selectedCategory !== "All Categories" 
                ? "Top Models by Quantity" 
                : selectedCategory !== "All Categories" 
                  ? "Distribution by Branch" 
                  : "Distribution by Category"}
            </h3>
            <p className="text-xs text-[#5f6368] mb-6">Top items sorted by stock volume</p>
            
            <div className="w-full h-[300px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {searchTerm === "" && selectedStore === "All Stores" && selectedCategory === "All Categories" ? (
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val) => [`${val} units`, "Stock"]}
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      />
                    </PieChart>
                  ) : (
                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f3f4" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={90} 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fill: '#5f6368', fontSize: 11 }}
                      />
                      <Tooltip 
                        formatter={(val) => [`${val} units`, "Stock"]}
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#5f6368] text-sm">
                  No data to display
                </div>
              )}
            </div>
            
            {/* Legend for Pie Chart */}
            {searchTerm === "" && selectedStore === "All Stores" && selectedCategory === "All Categories" && chartData.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {chartData.slice(0, 8).map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs text-[#5f6368]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="truncate max-w-[80px]" title={entry.name}>{entry.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Table Area */}
        <div className="lg:col-span-2">
          <div className="google-card p-0 overflow-hidden flex flex-col h-full max-h-[600px]">
            <div className="p-5 border-b border-[#dadce0] bg-[#f8f9fa] flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-[#202124]">Detailed Stock Breakdown</h3>
                <p className="text-xs text-[#5f6368] mt-0.5">Showing {filteredData.length} records</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-white">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-white border-b border-[#dadce0] shadow-sm z-10">
                  <tr className="text-[#5f6368] font-medium text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Item Details</th>
                    {selectedStore === "All Stores" && (
                      <th className="px-6 py-4 font-medium">Branch</th>
                    )}
                    <th className="px-6 py-4 font-medium hidden md:table-cell">Godown</th>
                    <th className="px-6 py-4 font-medium text-right">Quantity</th>
                    <th className="px-6 py-4 font-medium text-right hidden sm:table-cell">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f3f4]">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={selectedStore === "All Stores" ? "5" : "4"} className="px-6 py-12 text-center text-[#5f6368]">
                        <Package size={32} className="mx-auto mb-3 opacity-20" />
                        <p>No items found matching the selected filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredData.slice(0, 100).map((row, idx) => (
                      <tr key={row.id} className="hover:bg-[#f8f9fa] transition-colors group">
                        <td className="px-6 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-[#202124] text-wrap line-clamp-2 leading-tight max-w-sm whitespace-normal">
                              {row.description}
                            </span>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[11px] text-[#5f6368] font-mono bg-[#f1f3f4] px-1.5 py-0.5 rounded" title="Item Name">
                                {row.item}
                              </span>
                              <span className="text-[11px] text-[#5f6368] font-mono bg-[#f1f3f4] px-1.5 py-0.5 rounded" title="Barcode">
                                {row.barcode}
                              </span>
                              <span className="text-[11px] text-[#0f9d58] bg-[#e6f4ea] px-1.5 py-0.5 rounded font-medium">
                                {row.mainProduct}
                              </span>
                              {selectedCategory === "All Categories" && (
                                <span className="text-[11px] text-[#1a73e8] bg-[#e8f0fe] px-1.5 py-0.5 rounded font-medium">
                                  {row.gender}
                                </span>
                              )}
                              <span className={`md:hidden px-1.5 py-0.5 rounded text-[11px] font-medium ${
                                row.godown.toUpperCase().includes('EXCHANGE') 
                                  ? 'bg-[#fce8e6] text-[#c5221f]' 
                                  : 'bg-[#f1f3f4] text-[#5f6368]'
                              }`}>
                                {row.godown}
                              </span>
                            </div>
                          </div>
                        </td>
                        {selectedStore === "All Stores" && (
                          <td className="px-6 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-[#202124] text-xs">
                                {row.branch.split('-')[0].trim()}
                              </span>
                              <span className="text-[10px] text-[#5f6368] truncate max-w-[140px]" title={row.branch}>
                                {row.branch.split('-').slice(1).join('-').trim()}
                              </span>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-3 text-[#5f6368] hidden md:table-cell">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            row.godown.toUpperCase().includes('EXCHANGE') 
                              ? 'bg-[#fce8e6] text-[#c5221f]' 
                              : 'bg-[#f1f3f4] text-[#5f6368]'
                          }`}>
                            {row.godown}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-medium text-[#202124] text-base">{row.stock}</span>
                            <span className="sm:hidden text-[10px] text-[#5f6368]">{formatCurrency(row.value)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-[#5f6368] text-right hidden sm:table-cell">
                          {formatCurrency(row.value)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filteredData.length > 100 && (
                <div className="p-4 text-center text-xs text-[#5f6368] bg-[#f8f9fa] border-t border-[#f1f3f4]">
                  Showing top 100 results. Please use search or filters to narrow down.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
