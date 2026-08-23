import React, { useState, useMemo } from 'react';
import { Trophy, Tag, Store, Package, TrendingUp, Filter, ArrowLeft, LayoutList, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import * as XLSX from "xlsx";
import FileDropZone from "./FileDropZone";

export default function BestSellers() {
  const [jsonData, setJsonData] = useState(null);
  const [error, setError] = useState("");
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [viewMode, setViewMode] = useState("category"); // 'category' | 'store'
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStore, setSelectedStore] = useState("All");
  const [selectedStateFilter, setSelectedStateFilter] = useState("All States");
  const [expandedCategories, setExpandedCategories] = useState({});

  const getStateFromBranch = (branch) => {
    if (!branch) return "";
    const storeCode = branch.split('-')[0].trim();
    if (storeCode.length >= 3) {
      const st = storeCode.substring(1, 3).toUpperCase();
      if (st === "MP" || st === "MH") return st;
    }
    if (branch.toUpperCase().includes(" MP")) return "MP";
    if (branch.toUpperCase().includes(" MH")) return "MH";
    return "Other";
  };

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

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
        let headerRowIndex = 0;
        for (let r = range.s.r; r <= range.e.r; r++) {
          let foundCategory = false;
          let foundBranchName = false;
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
            if (cell && cell.v) {
              const val = String(cell.v).trim().toUpperCase();
              if (val === "BRANCH NAME") foundBranchName = true;
              if (val === "CATEGORY") foundCategory = true;
            }
          }
          if (foundBranchName && foundCategory) {
            headerRowIndex = r;
            break;
          }
        }

        const parsedData = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          range: headerRowIndex,
        });

        if (parsedData.length === 0) {
          throw new Error(`The sheet "${sheetName}" does not contain any rows after headers.`);
        }

        const sampleRow = parsedData[0];
        if (!("BRANCH NAME" in sampleRow) || !("CATEGORY" in sampleRow) || !("NET QTY" in sampleRow)) {
          throw new Error("Missing required columns: BRANCH NAME, CATEGORY, or NET QTY.");
        }

        setValidationSuccess(true);
        setTimeout(() => {
          setJsonData(parsedData);
        }, 1000);

      } catch (err) {
        setError(err.message || "Failed to process the spreadsheet.");
      }
    };

    reader.onerror = () => {
      setError("Error reading the Excel file.");
    };

    reader.readAsArrayBuffer(file);
  };

  const resetData = () => {
    setJsonData(null);
    setValidationSuccess(false);
    setError("");
    setSelectedCategory("All");
    setSelectedStore("All");
    setSelectedStateFilter("All States");
    setExpandedCategories({});
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleStoreSelect = (e) => {
    setSelectedStore(e.target.value);
    setExpandedCategories({}); // Reset expanded state when store changes
  };

  const insights = useMemo(() => {
    if (!jsonData) return null;

    const categories = new Set();
    const stores = new Set();
    const overallItems = {};
    const overallCategories = {};
    const storeCategorySales = {}; // store -> { category -> qty }
    const storeCategoryItemSales = {}; // store -> { category -> { item -> qty } }

    jsonData.forEach(row => {
      const store = row["BRANCH NAME"]?.trim();
      const item = row["ITEM DESCRIPTION"]?.trim();
      const category = row["CATEGORY"]?.trim();
      const qty = Number(row["NET QTY"]) || 0;

      if (!store || qty <= 0) return;
      
      const state = getStateFromBranch(store);
      if (selectedStateFilter !== "All States" && state !== selectedStateFilter) return;

      // Ignore EXCHANGE category as per user request
      if (category && category.toUpperCase() === 'EXCHANGE') return;

      stores.add(store);

      if (category) {
        categories.add(category);
        overallCategories[category] = (overallCategories[category] || 0) + qty;
        
        if (!storeCategorySales[store]) {
          storeCategorySales[store] = {};
          storeCategoryItemSales[store] = {};
        }
        storeCategorySales[store][category] = (storeCategorySales[store][category] || 0) + qty;

        if (item) {
          if (!storeCategoryItemSales[store][category]) {
            storeCategoryItemSales[store][category] = {};
          }
          storeCategoryItemSales[store][category][item] = (storeCategoryItemSales[store][category][item] || 0) + qty;
        }
      }

      if (item) {
        overallItems[item] = (overallItems[item] || 0) + qty;
      }
    });

    const getTop = (map) => {
      let topName = 'N/A';
      let topQty = 0;
      for (const [name, qty] of Object.entries(map)) {
        if (qty > topQty) {
          topQty = qty;
          topName = name;
        }
      }
      return { name: topName, qty: topQty };
    };

    const overallTopItem = getTop(overallItems);
    const overallTopCategory = getTop(overallCategories);

    // Breakdown for selected Category
    const storeBreakdown = [];
    if (selectedCategory !== "All") {
      for (const [storeName, categoriesMap] of Object.entries(storeCategorySales)) {
        const qty = categoriesMap[selectedCategory] || 0;
        if (qty > 0) {
          storeBreakdown.push({ store: storeName, qty });
        }
      }
      storeBreakdown.sort((a, b) => b.qty - a.qty);
    }

    // Breakdown for selected Store
    const categoryBreakdown = [];
    if (selectedStore !== "All" && storeCategorySales[selectedStore]) {
      for (const [cat, qty] of Object.entries(storeCategorySales[selectedStore])) {
        if (qty > 0) {
          categoryBreakdown.push({ category: cat, qty });
        }
      }
      categoryBreakdown.sort((a, b) => b.qty - a.qty);
    }

    return {
      categories: Array.from(categories).sort(),
      stores: Array.from(stores).sort(),
      overallTopItem,
      overallTopCategory,
      storeBreakdown,
      categoryBreakdown,
      storeCategoryItemSales
    };
  }, [jsonData, selectedCategory, selectedStore, selectedStateFilter]);

  if (!jsonData) {
    return (
      <div className="flex flex-col items-center mt-6">
        <h1 className="text-3xl font-normal text-[#202124] dark:text-white mb-2 text-center">
          Product & Store Analytics
        </h1>
        <p className="text-[#5f6368] dark:text-gray-300 mb-10 text-center max-w-lg">
          Upload your "Item Wise Collection Report" to see exactly how many units of specific categories (like Chimneys) each store has sold.
        </p>

        <div className="w-full max-w-2xl">
          <FileDropZone 
            onFileSelect={handleFileSelect} 
            error={error} 
            validationSuccess={validationSuccess} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-16">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={resetData}
            className="p-2 rounded-full hover:bg-[rgba(60,64,67,0.08)] text-[#5f6368] dark:text-gray-300 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-normal tracking-tight text-[#202124] dark:text-white mb-1">
              Product & Store Analytics
            </h1>
            <p className="text-sm text-[#5f6368] dark:text-gray-300">
              Item-wise collection analysis
            </p>
          </div>
        </div>
        
        <div className="w-full md:w-64">
          <label className="block text-xs font-medium text-[#5f6368] dark:text-gray-300 mb-1 uppercase tracking-wider">State Filter</label>
          <select
            value={selectedStateFilter}
            onChange={(e) => {
              setSelectedStateFilter(e.target.value);
              setSelectedStore("All");
            }}
            className="w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
          >
            <option value="All States">All States</option>
            <option value="MP">Madhya Pradesh (MP)</option>
            <option value="MH">Maharashtra (MH)</option>
          </select>
        </div>
      </div>

      {/* Top Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="google-card p-6 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border border-blue-100 dark:border-blue-900/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy size={80} className="text-blue-600" />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Package size={24} />
            </div>
            <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">Overall Best Selling Item</h2>
          </div>
          <div className="relative z-10">
            <div className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white mb-2 truncate" title={insights.overallTopItem.name}>
              {insights.overallTopItem.name}
            </div>
            <div className="text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 inline-block px-3 py-1 rounded-full border border-blue-100 dark:border-blue-900/50">
              {insights.overallTopItem.qty.toLocaleString()} Units Sold
            </div>
          </div>
        </div>

        <div className="google-card p-6 bg-gradient-to-br from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 border border-purple-100 dark:border-purple-900/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Tag size={80} className="text-purple-600" />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <TrendingUp size={24} />
            </div>
            <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">Overall Best Category</h2>
          </div>
          <div className="relative z-10">
            <div className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white mb-2 truncate" title={insights.overallTopCategory.name}>
              {insights.overallTopCategory.name}
            </div>
            <div className="text-sm font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/30 inline-block px-3 py-1 rounded-full border border-purple-100 dark:border-purple-900/50">
              {insights.overallTopCategory.qty.toLocaleString()} Units Sold
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Section */}
      <div className="google-card overflow-hidden">
        
        {/* Toggle Headers */}
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setViewMode("category")}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 px-2 sm:px-6 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              viewMode === "category" 
                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-b-2 border-indigo-600" 
                : "bg-white/60 dark:bg-slate-800/60 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Filter size={16} />
            <span className="hidden sm:inline">Category-Wise Store Breakdown</span>
            <span className="sm:hidden">By Category</span>
          </button>
          <button
            onClick={() => setViewMode("store")}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 px-2 sm:px-6 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              viewMode === "store" 
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-600" 
                : "bg-white/60 dark:bg-slate-800/60 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Store size={16} />
            <span className="hidden sm:inline">Store-Wise Category Breakdown</span>
            <span className="sm:hidden">By Store</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {viewMode === "category" && (
            <div>
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-xl font-medium text-gray-800 dark:text-gray-200">Analyze a Category</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">See exactly how many units each store sold of a specific category.</p>
                </div>
                <div className="w-full md:w-72 shrink-0">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Select Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setExpandedCategories({});
                    }}
                    className="w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 shadow-sm"
                  >
                    <option value="All">-- Select a Category --</option>
                    {insights.categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCategory !== 'All' ? (
                <div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-900/50 rounded-lg p-4 mb-6 flex justify-between items-center">
                    <span className="font-medium text-indigo-900 dark:text-indigo-300">Total {selectedCategory} Sold:</span>
                    <span className="text-xl font-bold text-indigo-700 dark:text-indigo-400">
                      {insights.storeBreakdown.reduce((sum, item) => sum + item.qty, 0).toLocaleString()} Units
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                        <tr>
                          <th className="px-6 py-4 font-medium">Rank</th>
                          <th className="px-6 py-4 font-medium">Store Name</th>
                          <th className="px-6 py-4 font-medium text-right">Units Sold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.storeBreakdown.map((item, index) => {
                          const isExpanded = expandedCategories[item.store];
                          const itemsMap = insights.storeCategoryItemSales[item.store]?.[selectedCategory] || {};
                          
                          return (
                            <React.Fragment key={item.store}>
                              <tr 
                                onClick={() => toggleCategory(item.store)}
                                className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border-b hover:bg-gray-50 dark:bg-slate-800/50 transition-colors cursor-pointer group"
                              >
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-medium ${
                                    index < 3 ? 'bg-indigo-100 text-indigo-700 dark:text-indigo-400' : 'bg-gray-100 text-gray-600 dark:text-gray-300'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                  <div className="flex items-center gap-2">
                                    <Store size={16} className="text-gray-400 dark:text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                    {item.store}
                                    {isExpanded ? (
                                      <ChevronUp size={16} className="text-gray-400 dark:text-gray-400" />
                                    ) : (
                                      <ChevronDown size={16} className="text-gray-400 dark:text-gray-400" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right font-semibold text-gray-700 dark:text-gray-300">
                                  {item.qty.toLocaleString()}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan="3" className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50/50 border-b border-gray-100">
                                    <div className="pl-14 pr-6">
                                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase mb-3 tracking-wider flex items-center gap-1">
                                        <ChevronRight size={14} /> 
                                        Specific Items Sold
                                      </h4>
                                      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                        <ul className="divide-y divide-gray-100">
                                          {Object.entries(itemsMap)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([itemName, itemQty]) => (
                                              <li key={itemName} className="flex justify-between items-center py-2 px-4 hover:bg-gray-50 dark:bg-slate-800/50 transition-colors">
                                                <span className="text-sm text-gray-600 dark:text-gray-300">{itemName}</span>
                                                <span className="font-medium text-sm text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/50">
                                                  {itemQty}
                                                </span>
                                              </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {insights.storeBreakdown.length === 0 && (
                          <tr>
                            <td colSpan="3" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                              No sales found for this category.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 border-dashed">
                  <div className="icon-filter inline-block">
                    <Filter size={48} className="mx-auto text-gray-300 mb-4" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 font-medium">Select a category from the dropdown</p>
                  <p className="text-gray-400 dark:text-gray-400 text-sm mt-1">to view a detailed breakdown of sales across all stores.</p>
                </div>
              )}
            </div>
          )}

          {viewMode === "store" && (
            <div>
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-xl font-medium text-gray-800 dark:text-gray-200">Analyze a Store</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">See all categories sold by a specific store. Click on a category to see specific items.</p>
                </div>
                <div className="w-full md:w-80 shrink-0">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Select Store</label>
                  <select
                    value={selectedStore}
                    onChange={handleStoreSelect}
                    className="w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 shadow-sm"
                  >
                    <option value="All">-- Select a Store --</option>
                    {insights.stores.map(store => (
                      <option key={store} value={store}>{store}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedStore !== 'All' ? (
                <div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 rounded-lg p-4 mb-6 flex justify-between items-center">
                    <span className="font-medium text-emerald-900">Total Units Sold by {selectedStore}:</span>
                    <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                      {insights.categoryBreakdown.reduce((sum, item) => sum + item.qty, 0).toLocaleString()} Units
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                        <tr>
                          <th className="px-6 py-4 font-medium">Rank</th>
                          <th className="px-6 py-4 font-medium">Category Name</th>
                          <th className="px-6 py-4 font-medium text-right">Units Sold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.categoryBreakdown.map((item, index) => {
                          const isExpanded = expandedCategories[item.category];
                          const itemsMap = insights.storeCategoryItemSales[selectedStore]?.[item.category] || {};
                          
                          return (
                            <React.Fragment key={item.category}>
                              <tr 
                                onClick={() => toggleCategory(item.category)}
                                className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border-b hover:bg-gray-50 dark:bg-slate-800/50 transition-colors cursor-pointer group"
                              >
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-medium ${
                                    index < 3 ? 'bg-emerald-100 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:text-gray-300'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                  <div className="flex items-center gap-2">
                                    <LayoutList size={16} className="text-gray-400 dark:text-gray-400 group-hover:text-emerald-500 transition-colors" />
                                    {item.category}
                                    {isExpanded ? (
                                      <ChevronUp size={16} className="text-gray-400 dark:text-gray-400" />
                                    ) : (
                                      <ChevronDown size={16} className="text-gray-400 dark:text-gray-400" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right font-semibold text-gray-700 dark:text-gray-300">
                                  {item.qty.toLocaleString()}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan="3" className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50/50 border-b border-gray-100">
                                    <div className="pl-14 pr-6">
                                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase mb-3 tracking-wider flex items-center gap-1">
                                        <ChevronRight size={14} /> 
                                        Specific Items Sold
                                      </h4>
                                      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                        <ul className="divide-y divide-gray-100">
                                          {Object.entries(itemsMap)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([itemName, itemQty]) => (
                                              <li key={itemName} className="flex justify-between items-center py-2 px-4 hover:bg-gray-50 dark:bg-slate-800/50 transition-colors">
                                                <span className="text-sm text-gray-600 dark:text-gray-300">{itemName}</span>
                                                <span className="font-medium text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-100">
                                                  {itemQty}
                                                </span>
                                              </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {insights.categoryBreakdown.length === 0 && (
                          <tr>
                            <td colSpan="3" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                              No sales found for this store.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 border-dashed">
                  <div className="icon-store inline-block">
                    <Store size={48} className="mx-auto text-gray-300 mb-4" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 font-medium">Select a store from the dropdown</p>
                  <p className="text-gray-400 dark:text-gray-400 text-sm mt-1">to view a detailed breakdown of all categories sold by them.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
