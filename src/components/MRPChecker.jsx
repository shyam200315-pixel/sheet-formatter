import React, { useState, useEffect, useMemo } from 'react';
import { Search, Tag, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MRPChecker() {
  const [searchQuery, setSearchQuery] = useState("");
  const [mrpDict, setMrpDict] = useState({});
  const [sapMapping, setSapMapping] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/mrp_data.json').then(res => res.json()),
      fetch('/sap_mapping.json').then(res => res.json())
    ])
      .then(([mrpData, sapData]) => {
        setMrpDict(mrpData);
        setSapMapping(sapData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load databases", err);
        setLoading(false);
      });
  }, []);

  const resultInfo = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return null;
    
    let hanaCode = trimmed;
    let isSapCode = false;
    
    // Check if it's an SAP code
    if (sapMapping[trimmed]) {
      hanaCode = sapMapping[trimmed];
      isSapCode = true;
    }
    
    const data = mrpDict[hanaCode];
    if (!data) return null;
    
    return {
      data,
      hanaCode,
      isSapCode,
      originalQuery: trimmed
    };
  }, [searchQuery, mrpDict, sapMapping]);

  const hasSearchedAndNotFound = searchQuery.trim().length > 0 && !resultInfo;

  return (
    <div className="w-full max-w-3xl mx-auto mt-4">
      <div className="google-card p-8">
        <h2 className="text-2xl font-semibold mb-6 flex items-center justify-center gap-2 text-gray-800">
          <Tag className="text-[#1a73e8]" size={28} />
          MRP Checker
        </h2>
        
        <div className="relative mb-8 max-w-lg mx-auto">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-full leading-5 bg-white placeholder-gray-400 focus:outline-none focus:border-[#1a73e8] focus:ring-0 transition-colors sm:text-lg font-mono shadow-sm"
            placeholder="Enter Item Code (e.g. 19000002)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={loading}
          />
        </div>

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-gray-500 py-10"
            >
              <div className="w-8 h-8 border-4 border-[#1a73e8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              Loading database...
            </motion.div>
          )}

          {resultInfo && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#f8f9fa] rounded-xl p-6 border border-[#dadce0]"
            >
              <div className="mb-6 text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{resultInfo.data.name}</h3>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-sm text-gray-500 font-mono tracking-wider">HANA CODE: {resultInfo.hanaCode}</p>
                  {resultInfo.isSapCode && (
                    <span className="bg-[#e8f0fe] text-[#1a73e8] text-xs px-2 py-0.5 rounded font-medium">
                      Matched via SAP: {resultInfo.originalQuery}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center justify-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Old MRP (25-26)</span>
                  <span className="text-2xl font-bold text-gray-800">₹{resultInfo.data.old_mrp}</span>
                </div>
                
                <div className="bg-white p-5 rounded-lg shadow-sm border-2 border-[#1a73e8] border-opacity-20 flex flex-col items-center justify-center relative">
                  <span className="text-xs font-semibold text-[#1a73e8] uppercase tracking-wider mb-2">New MRP (26-27)</span>
                  <span className="text-2xl font-bold text-gray-800">
                    {resultInfo.data.new_mrp === "Not Available" ? (
                      <span className="text-sm font-normal text-gray-500">Not Available</span>
                    ) : (
                      `₹${resultInfo.data.new_mrp}`
                    )}
                  </span>
                </div>

                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center justify-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Difference</span>
                  <div className="flex items-center gap-1">
                    {resultInfo.data.difference === "N/A" ? (
                      <span className="text-sm font-normal text-gray-500">N/A</span>
                    ) : (
                      <>
                        {Number(resultInfo.data.difference) > 0 ? (
                          <TrendingUp size={24} className="text-green-500" />
                        ) : Number(resultInfo.data.difference) < 0 ? (
                          <TrendingDown size={24} className="text-red-500" />
                        ) : (
                          <Minus size={24} className="text-gray-400" />
                        )}
                        <span className={`text-2xl font-bold ${Number(resultInfo.data.difference) > 0 ? 'text-green-600' : Number(resultInfo.data.difference) < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {Number(resultInfo.data.difference) > 0 ? '+' : ''}{resultInfo.data.difference}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {resultInfo.data.source === "file2" && (
                <div className="mt-6 flex items-start gap-3 text-amber-700 bg-amber-50 p-4 rounded-lg text-sm border border-amber-200">
                  <Info size={18} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Note:</strong> This item was not found in the updated 26-27 list. The pricing shown above is based solely on the historical Master File.
                  </div>
                </div>
              )}

              {resultInfo.data.source === "pdf" && (
                <div className="mt-6 flex items-start gap-3 text-purple-700 bg-purple-50 p-4 rounded-lg text-sm border border-purple-200">
                  <Info size={18} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Note:</strong> This item was entirely missing from the Excel sheets and was found in the 2025-26 PDF Catalogue instead. Pricing has been omitted as the catalogue MRPs are outdated.
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {hasSearchedAndNotFound && (
            <motion.div
              key="not-found"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center p-12 text-gray-500 bg-gray-50 rounded-xl border border-gray-100"
            >
              <Search className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-900">Code Not Found</p>
              <p className="text-sm mt-2 max-w-sm mx-auto">We couldn't find '{searchQuery}' in either the Updated MRP or Master files.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
