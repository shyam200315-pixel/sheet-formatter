import React, { useState, useEffect, useMemo } from 'react';
import { Search, Tag, TrendingUp, TrendingDown, Minus, Info, Flame, Check, Copy, ExternalLink, Percent, Layers, Gift, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to compute effective offer details dynamically from MRP and Offer schemes
function getComputedOffer(item) {
  if (!item) return null;
  const rawMrp = (typeof item.new_mrp === 'number' && item.new_mrp > 0)
    ? item.new_mrp
    : (typeof item.old_mrp === 'number' && item.old_mrp > 0 ? item.old_mrp : null);

  if (!item.offers || item.offers.length === 0) {
    if (item.active_offer_price) {
      const discPct = rawMrp && rawMrp > item.active_offer_price 
        ? Math.round(((rawMrp - item.active_offer_price) / rawMrp) * 100) 
        : null;
      return {
        price: item.active_offer_price,
        label: item.active_offer_label || `Offer Rate: ₹${item.active_offer_price.toLocaleString('en-IN')}`,
        schemeName: "Special Scheme Rate",
        discountPct: discPct,
        savings: rawMrp ? rawMrp - item.active_offer_price : null
      };
    }
    return null;
  }

  let bestPrice = null;
  let bestLabel = null;
  let bestSchemeName = null;
  let bestDiscountPct = null;

  for (const o of item.offers) {
    let p = null;
    let label = null;
    let scheme = o.scheme || "Offer Scheme";
    let discPct = null;

    // 1. Direct Fixed Flat Rate (e.g. ₹3099, ₹3089, ₹99)
    if (o.effectiveAug31 && typeof o.effectiveAug31 === 'number' && o.effectiveAug31 >= 10) {
      p = o.effectiveAug31;
      label = `Flat Rate: ₹${p.toLocaleString('en-IN')}`;
      scheme = `Flat Rate Scheme (₹${p.toLocaleString('en-IN')})`;
      if (rawMrp && rawMrp > p) discPct = Math.round(((rawMrp - p) / rawMrp) * 100);
    } else if (o.newOffer && typeof o.newOffer === 'number' && o.newOffer >= 10) {
      p = o.newOffer;
      label = `Offer Rate: ₹${p.toLocaleString('en-IN')}`;
      scheme = `New Offer (₹${p.toLocaleString('en-IN')})`;
      if (rawMrp && rawMrp > p) discPct = Math.round(((rawMrp - p) / rawMrp) * 100);
    } else if (o.discRate && typeof o.discRate === 'number' && o.discRate >= 10 && o.discType === 'Flat Rate') {
      p = o.discRate;
      label = `Flat Rate: ₹${p.toLocaleString('en-IN')}`;
      scheme = `Flat Rate (₹${p.toLocaleString('en-IN')})`;
      if (rawMrp && rawMrp > p) discPct = Math.round(((rawMrp - p) / rawMrp) * 100);
    } 
    // 2. Percentage Discounts: 0.5 (50%), 0.4 (40%), 0.35 (35%), 0.3 (30%), 0.7 (70%)
    else if (rawMrp) {
      let pct = null;
      if (typeof o.effectiveAug31 === 'number' && o.effectiveAug31 < 1 && o.effectiveAug31 > 0) {
        pct = o.effectiveAug31;
      } else if (typeof o.newOffer === 'number' && o.newOffer < 1 && o.newOffer > 0) {
        pct = o.newOffer;
      } else if (typeof o.discRate === 'number' && o.discRate < 1 && o.discRate > 0) {
        pct = o.discRate;
      } else if (typeof o.discRate === 'number' && o.discRate >= 1 && o.discRate <= 90 && o.discType === 'Flat Discount') {
        pct = o.discRate / 100;
      } else if (o.scheme === 'Flat 50% Off' || (o.description && o.description.includes('50%'))) {
        pct = 0.50;
      } else if (o.scheme && o.scheme.includes('30%') && o.scheme.includes('40%')) {
        pct = 0.30; // user requested: "aagar buy 1 30 buy 2 40 he to 30 ke hisab se calculate krdo"
      }

      if (pct !== null) {
        p = Math.round(rawMrp * (1 - pct));
        discPct = Math.round(pct * 100);
        label = `Flat ${discPct}% Off: ₹${p.toLocaleString('en-IN')}`;
        scheme = o.scheme && o.scheme.includes('30%') ? "Buy 1 @ 30% Off Scheme" : `Flat ${discPct}% Discount`;
      }
    }

    // 3. Buy 2 schemes
    if (!p) {
      if (o.scheme === 'Buy 2 @ ₹999/-') {
        p = 500;
        label = `Buy 2 @ ₹999 (₹500/pc)`;
        scheme = "Buy 2 @ ₹999/- Scheme";
        if (rawMrp && rawMrp > 500) discPct = Math.round(((rawMrp - 500) / rawMrp) * 100);
      } else if (o.scheme === 'Buy 2 @ ₹649/-') {
        p = 325;
        label = `Buy 2 @ ₹649 (₹325/pc)`;
        scheme = "Trivia Buy 2 @ ₹649/- Scheme";
        if (rawMrp && rawMrp > 325) discPct = Math.round(((rawMrp - 325) / rawMrp) * 100);
      }
    }

    if (p !== null) {
      if (bestPrice === null || p < bestPrice) {
        bestPrice = p;
        bestLabel = label;
        bestSchemeName = scheme;
        bestDiscountPct = discPct;
      }
    }
  }

  if (bestPrice !== null) {
    return {
      price: bestPrice,
      label: bestLabel,
      schemeName: bestSchemeName,
      discountPct: bestDiscountPct,
      savings: rawMrp ? rawMrp - bestPrice : null
    };
  }

  return null;
}

// Render individual scheme offer pill details
function renderSchemeRateDetail(offer, rawMrp) {
  // Flat fixed rate
  if (offer.effectiveAug31 && typeof offer.effectiveAug31 === 'number' && offer.effectiveAug31 >= 10) {
    return (
      <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-orange-200/50 dark:border-slate-700">
        <span className="text-gray-500 dark:text-gray-400">Fixed Scheme Rate:</span>
        <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">
          ₹{offer.effectiveAug31.toLocaleString('en-IN')}
        </span>
      </div>
    );
  }
  if (offer.newOffer && typeof offer.newOffer === 'number' && offer.newOffer >= 10) {
    return (
      <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-orange-200/50 dark:border-slate-700">
        <span className="text-gray-500 dark:text-gray-400">Offer Price:</span>
        <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">
          ₹{offer.newOffer.toLocaleString('en-IN')}
        </span>
      </div>
    );
  }

  // Percentage discount calculation (50%, 40%, 35%, 30%)
  let pct = null;
  if (typeof offer.effectiveAug31 === 'number' && offer.effectiveAug31 < 1 && offer.effectiveAug31 > 0) {
    pct = offer.effectiveAug31;
  } else if (typeof offer.newOffer === 'number' && offer.newOffer < 1 && offer.newOffer > 0) {
    pct = offer.newOffer;
  } else if (typeof offer.discRate === 'number' && offer.discRate < 1 && offer.discRate > 0) {
    pct = offer.discRate;
  } else if (typeof offer.discRate === 'number' && offer.discRate >= 1 && offer.discRate <= 90 && offer.discType === 'Flat Discount') {
    pct = offer.discRate / 100;
  } else if (offer.scheme === 'Flat 50% Off' || (offer.description && offer.description.includes('50%'))) {
    pct = 0.50;
  }

  if (pct !== null && rawMrp) {
    const calcRate = Math.round(rawMrp * (1 - pct));
    return (
      <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-orange-200/50 dark:border-slate-700">
        <span className="text-gray-500 dark:text-gray-400">Calculated Rate ({(pct * 100).toFixed(0)}% Off MRP):</span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
          ₹{calcRate.toLocaleString('en-IN')}
        </span>
      </div>
    );
  }

  // Buy 1 @ 30% & Buy 2+ @ 40%
  if (offer.scheme && offer.scheme.includes('30%') && offer.scheme.includes('40%') && rawMrp) {
    const buy1Rate = Math.round(rawMrp * (1 - 0.30));
    const buy2Rate = Math.round(rawMrp * (1 - 0.40));
    return (
      <div className="mt-2 pt-2 border-t border-orange-200/50 dark:border-slate-700 space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">Buy 1 Rate (30% Off):</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{buy1Rate.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">Buy 2+ Rate (40% Off):</span>
          <span className="font-bold text-emerald-700 dark:text-emerald-300">₹{buy2Rate.toLocaleString('en-IN')} / pc</span>
        </div>
      </div>
    );
  }

  // Buy 2 combos
  if (offer.scheme === 'Buy 2 @ ₹999/-') {
    return (
      <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-orange-200/50 dark:border-slate-700">
        <span className="text-gray-500 dark:text-gray-400">Combo Scheme Rate:</span>
        <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">
          ₹999 for 2 (₹500 / pc)
        </span>
      </div>
    );
  }
  if (offer.scheme === 'Buy 2 @ ₹649/-') {
    return (
      <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-orange-200/50 dark:border-slate-700">
        <span className="text-gray-500 dark:text-gray-400">Trivia Combo Rate:</span>
        <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">
          ₹649 for 2 (₹325 / pc)
        </span>
      </div>
    );
  }

  return null;
}

export default function MRPChecker() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHanaCode, setSelectedHanaCode] = useState(null);
  const [mrpDict, setMrpDict] = useState({});
  const [sapMapping, setSapMapping] = useState({});
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/mrp_data.json').then(res => res.json()),
      fetch('/sap_mapping.json').then(res => res.json())
    ])
      .then(([mrpData, sapData]) => {
        setMrpDict(mrpData || {});
        setSapMapping(sapData || {});
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load databases", err);
        setLoading(false);
      });
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return [];

    const results = [];
    const addedCodes = new Set();

    // 1. Direct exact HANA Code match
    if (mrpDict[q]) {
      results.push({ hanaCode: q, data: mrpDict[q], matchType: 'exact_hana' });
      addedCodes.add(q);
    }

    // 2. Direct exact SAP Code match
    if (sapMapping[q] && mrpDict[sapMapping[q]]) {
      const hCode = sapMapping[q];
      if (!addedCodes.has(hCode)) {
        results.push({ hanaCode: hCode, data: mrpDict[hCode], matchType: 'exact_sap', matchedSap: q });
        addedCodes.add(hCode);
      }
    }

    // 3. Suffix match (e.g. "3040", "3278", "330"), Partial HANA/SAP match, Name match, or Offer match
    for (const [code, item] of Object.entries(mrpDict)) {
      if (addedCodes.has(code)) continue;

      let matched = false;
      let matchType = '';
      let matchedSap = null;

      if (code.endsWith(q) || code.includes(q)) {
        matched = true;
        matchType = code.endsWith(q) ? 'suffix_code' : 'partial_code';
      } else if (item.sap_code && item.sap_code.toUpperCase().includes(q)) {
        matched = true;
        matchType = 'partial_sap';
        matchedSap = item.sap_code;
      } else if (item.name && item.name.toUpperCase().includes(q)) {
        matched = true;
        matchType = 'name';
      } else if (item.category && item.category.toUpperCase().includes(q)) {
        matched = true;
        matchType = 'category';
      } else if (item.offers && item.offers.some(o => JSON.stringify(o).toUpperCase().includes(q))) {
        matched = true;
        matchType = 'offer';
      }

      if (matched) {
        results.push({ hanaCode: code, data: item, matchType, matchedSap });
        addedCodes.add(code);
      }

      if (results.length >= 30) break;
    }

    return results;
  }, [searchQuery, mrpDict, sapMapping]);

  // Selected item information
  const activeItem = useMemo(() => {
    if (selectedHanaCode && mrpDict[selectedHanaCode]) {
      return {
        hanaCode: selectedHanaCode,
        data: mrpDict[selectedHanaCode]
      };
    }
    if (searchResults.length === 1) {
      return searchResults[0];
    }
    return null;
  }, [selectedHanaCode, searchResults, mrpDict]);

  // Computed offer for active item
  const computedOffer = useMemo(() => {
    if (!activeItem || !activeItem.data) return null;
    return getComputedOffer(activeItem.data);
  }, [activeItem]);

  const rawMrp = useMemo(() => {
    if (!activeItem || !activeItem.data) return null;
    return (typeof activeItem.data.new_mrp === 'number' && activeItem.data.new_mrp > 0)
      ? activeItem.data.new_mrp
      : (typeof activeItem.data.old_mrp === 'number' && activeItem.data.old_mrp > 0 ? activeItem.data.old_mrp : null);
  }, [activeItem]);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(type);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSelectedHanaCode(null);
  };

  const sampleChips = [
    { label: "19000330 (Storm Tawa - 50% Off)", query: "19000330" },
    { label: "19003040 (Airfryer - ₹3,099)", query: "19003040" },
    { label: "19003278 (Cooktop - ₹3,089)", query: "19003278" },
    { label: "16002127 (Trivia Bottle)", query: "16002127" },
    { label: "16000890 (Cast Iron - Buy 1@30% Buy 2@40%)", query: "16000890" }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto mt-4 px-2 sm:px-4">
      <div className="google-card p-6 sm:p-8 backdrop-blur-xl bg-white/75 dark:bg-slate-900/75 border border-white/40 dark:border-slate-800 shadow-2xl rounded-3xl">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-2xl mb-3 text-[#1a73e8] dark:text-blue-400">
            <Tag size={32} className="stroke-[2.5]" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            MRP & Scheme Offer Checker
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Search by Item Code, SAP Code, or Name to view MRP, Flat 50%/40%/30% discount rates, and active schemes
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-4 max-w-2xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
            <Search size={22} />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-12 py-4 text-base sm:text-lg font-medium border-2 border-gray-200/80 dark:border-slate-700/80 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-inner text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#1a73e8] focus:ring-4 focus:ring-[#1a73e8]/10 transition-all font-mono"
            placeholder="Enter Item Code (e.g. 19000330, 19003040, 3278, Tawa, Airfryer)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedHanaCode(null);
            }}
            disabled={loading}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 max-w-2xl mx-auto">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">Quick search:</span>
          {sampleChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSearchQuery(chip.query);
                setSelectedHanaCode(null);
              }}
              className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-300 hover:text-[#1a73e8] dark:hover:text-blue-400 border border-gray-200 dark:border-slate-700 transition-colors"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-gray-500 dark:text-gray-400 py-12"
            >
              <div className="w-10 h-10 border-4 border-[#1a73e8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              Loading master database & active scheme catalogue...
            </motion.div>
          )}

          {/* Multiple matches selector */}
          {!loading && searchResults.length > 1 && !activeItem && (
            <motion.div
              key="multiple-results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8 bg-gray-50/80 dark:bg-slate-800/60 rounded-2xl p-4 border border-gray-200 dark:border-slate-700"
            >
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Layers size={14} /> Found {searchResults.length} matching items (Click to view details):
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {searchResults.map((res) => {
                  const resOffer = getComputedOffer(res.data);
                  return (
                    <button
                      key={res.hanaCode}
                      onClick={() => setSelectedHanaCode(res.hanaCode)}
                      className="flex flex-col text-left p-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-slate-700 hover:border-[#1a73e8] transition-all group"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono text-xs font-bold text-[#1a73e8] dark:text-blue-400 group-hover:underline">
                          {res.hanaCode}
                        </span>
                        {resOffer && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            ₹{resOffer.price.toLocaleString('en-IN')} {resOffer.discountPct ? `(${resOffer.discountPct}% Off)` : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-1 mt-0.5">
                        {res.data.name}
                      </span>
                      {res.data.category && (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {res.data.category}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Active Item Detail View */}
          {!loading && activeItem && (
            <motion.div
              key={`item-${activeItem.hanaCode}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              {/* Product Header Card */}
              <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-purple-50/80 dark:from-slate-800/80 dark:via-indigo-950/40 dark:to-slate-800/80 rounded-2xl p-6 border border-blue-100 dark:border-slate-700 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    {activeItem.data.category && (
                      <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-[#1a73e8] dark:text-blue-300 text-xs font-bold rounded-full uppercase tracking-wider">
                        {activeItem.data.category}
                      </span>
                    )}
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white leading-snug">
                      {activeItem.data.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-sm">
                      <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/80 px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700">
                        <span className="text-gray-500 dark:text-gray-400 text-xs">HANA:</span>
                        <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{activeItem.hanaCode}</span>
                        <button
                          onClick={() => handleCopy(activeItem.hanaCode, 'hana')}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1"
                          title="Copy HANA code"
                        >
                          {copiedCode === 'hana' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                      </div>

                      {activeItem.data.sap_code && (
                        <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/80 px-3 py-1 rounded-lg border border-gray-200 dark:border-slate-700">
                          <span className="text-gray-500 dark:text-gray-400 text-xs">SAP:</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{activeItem.data.sap_code}</span>
                          <button
                            onClick={() => handleCopy(activeItem.data.sap_code, 'sap')}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1"
                            title="Copy SAP code"
                          >
                            {copiedCode === 'sap' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <a 
                    href={`https://www.google.com/search?q=${encodeURIComponent(activeItem.data.name + " HSN Code and GST Slab")}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-[#1a73e8] dark:text-blue-400 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-4 py-2.5 rounded-xl border border-blue-200 dark:border-slate-700 shadow-sm transition-all flex-shrink-0"
                  >
                    <Search size={15} />
                    Search HSN & GST
                    <ExternalLink size={13} className="text-gray-400" />
                  </a>
                </div>
              </div>

              {/* Active Offer Hero Banner */}
              {computedOffer && (
                <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-2xl p-5 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                      <Flame size={32} className="text-yellow-200 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                          🔥 {computedOffer.schemeName || "Active Scheme Offer"}
                        </span>
                        {computedOffer.discountPct && (
                          <span className="text-xs font-black bg-yellow-400 text-orange-950 px-2 py-0.5 rounded-full">
                            {computedOffer.discountPct}% OFF
                          </span>
                        )}
                      </div>
                      <h4 className="text-xl sm:text-2xl font-extrabold mt-1">
                        Effective Price: ₹{computedOffer.price.toLocaleString('en-IN')}
                      </h4>
                      {computedOffer.savings && computedOffer.savings > 0 && (
                        <p className="text-xs text-amber-100 mt-0.5 font-medium">
                          You save ₹{computedOffer.savings.toLocaleString('en-IN')} on MRP
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-center sm:text-right bg-black/20 px-5 py-2.5 rounded-2xl backdrop-blur-sm border border-white/10">
                    <span className="text-xs uppercase tracking-wider text-amber-100 font-semibold block">Calculated Offer Rate</span>
                    <span className="text-3xl sm:text-4xl font-black tracking-tight">₹{computedOffer.price.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              {/* Pricing 4-Card Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                
                {/* Old MRP */}
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Old MRP (25-26)</span>
                  <span className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300">
                    {activeItem.data.old_mrp && activeItem.data.old_mrp !== "Not Available" 
                      ? `₹${Number(activeItem.data.old_mrp).toLocaleString('en-IN')}` 
                      : <span className="text-sm font-normal text-gray-400">N/A</span>}
                  </span>
                </div>
                
                {/* New MRP */}
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 sm:p-5 border-2 border-blue-500/30 dark:border-blue-400/30 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-bl-full"></div>
                  <span className="text-xs font-bold text-[#1a73e8] dark:text-blue-400 uppercase tracking-wider mb-1">New MRP (26-27)</span>
                  <span className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">
                    {activeItem.data.new_mrp && activeItem.data.new_mrp !== "Not Available" 
                      ? `₹${Number(activeItem.data.new_mrp).toLocaleString('en-IN')}` 
                      : (activeItem.data.old_mrp && activeItem.data.old_mrp !== "Not Available" 
                          ? `₹${Number(activeItem.data.old_mrp).toLocaleString('en-IN')}` 
                          : <span className="text-sm font-normal text-gray-400">N/A</span>)}
                  </span>
                </div>

                {/* Offer / Effective Price */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl p-4 sm:p-5 border border-emerald-200 dark:border-emerald-800 shadow-sm flex flex-col items-center justify-center text-center relative">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Offer Rate</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300">
                    {computedOffer 
                      ? `₹${computedOffer.price.toLocaleString('en-IN')}` 
                      : (activeItem.data.offers && activeItem.data.offers.length > 0 
                          ? <span className="text-xs font-semibold text-emerald-600">See Offers Below</span> 
                          : <span className="text-sm font-normal text-gray-400">Regular MRP</span>)}
                  </span>
                  {computedOffer && computedOffer.discountPct && (
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-full mt-1">
                      {computedOffer.discountPct}% OFF
                    </span>
                  )}
                </div>

                {/* MRP Difference */}
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">MRP Variance</span>
                  <div className="flex items-center gap-1">
                    {activeItem.data.difference === "N/A" || !activeItem.data.difference ? (
                      <span className="text-sm font-normal text-gray-400">0</span>
                    ) : (
                      <>
                        {Number(activeItem.data.difference) > 0 ? (
                          <TrendingUp size={20} className="text-emerald-500" />
                        ) : Number(activeItem.data.difference) < 0 ? (
                          <TrendingDown size={20} className="text-rose-500" />
                        ) : (
                          <Minus size={20} className="text-gray-400" />
                        )}
                        <span className={`text-xl sm:text-2xl font-bold ${Number(activeItem.data.difference) > 0 ? 'text-emerald-600' : Number(activeItem.data.difference) < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
                          {Number(activeItem.data.difference) > 0 ? '+' : ''}{activeItem.data.difference}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* All Active Offers & Schemes Section */}
              {activeItem.data.offers && activeItem.data.offers.length > 0 && (
                <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold text-base">
                    <Gift className="text-orange-500" size={20} />
                    <span>Applicable August / September Schemes & Discounts ({activeItem.data.offers.length})</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeItem.data.offers.map((offer, idx) => (
                      <div 
                        key={idx} 
                        className="p-3.5 rounded-xl bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-slate-800 dark:to-amber-950/20 border border-orange-200/80 dark:border-orange-900/40 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                              {offer.scheme || "Special Offer"}
                            </span>
                            {offer.discPct && (
                              <span className="text-[11px] font-bold bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
                                {offer.discPct} OFF
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1">
                            {offer.description || offer.offerName || "Discount Scheme Applied"}
                          </p>
                        </div>

                        {renderSchemeRateDetail(offer, rawMrp)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Info Badges */}
              {activeItem.data.source === "file2" && (
                <div className="flex items-start gap-3 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl text-xs border border-amber-200 dark:border-amber-800">
                  <Info size={18} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Note:</strong> Pricing information is synced from the Master File catalogue.
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Not Found State */}
          {!loading && searchQuery.trim().length > 0 && searchResults.length === 0 && (
            <motion.div
              key="not-found"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center p-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-800"
            >
              <Search className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-lg font-bold text-gray-900 dark:text-white">Code Not Found</p>
              <p className="text-sm mt-1 max-w-sm mx-auto">
                Could not find '{searchQuery}' in the Master Database, 26-27 MRP list, or August/September Offer catalogue.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
