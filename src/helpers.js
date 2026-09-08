import * as XLSX from "xlsx";

/**
 * Official master list of all 18 stores (10 MH, 8 MP).
 * These stores will always be present in the report, metrics, and averages,
 * even if some stores have zero sales on day 1 / month start.
 */
export const MASTER_STORES = [
  // Maharashtra (10 stores)
  "WMH001 - NED - VAZIRABAD",
  "WMH002 - NED - BHAGYA NAGAR",
  "WMH003 - BDE - BEED",
  "WMH004 - PBN - PARBHANI",
  "WMH005 - YTL - YAVATMAL",
  "WMH006 - BTW - BARSHI",
  "WMH007 - PUN - RAVET PUNE",
  "WMH008 - STR - SATARA",
  "WMH009 - KOP - KOLHAPUR",
  "WMH011 - BDL - BADLAPUR",
  // Madhya Pradesh (8 stores)
  "WMP001 - BPL - SEHORE CITY",
  "WMP002 - BPL - GULMOHAR COLONY",
  "WMP003 - IND - MR 09 ROAD",
  "WMP004 - IND - ANNAPURNA RD",
  "WMP005 - STA - SATNA",
  "WMP006 - BPL - KOLAR ROAD",
  "WMP007 - REW - REWA",
  "WMP008 - SVP - SHIVPURI"
];

const STORE_STORAGE_KEY = "known_master_stores";

/**
 * Gets all known master stores (default 18 + any newly discovered stores saved from uploaded sheets).
 * @returns {string[]}
 */
export function getKnownStores() {
  const storeSet = new Set(MASTER_STORES);
  try {
    const saved = localStorage.getItem(STORE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach(s => {
          if (s && typeof s === "string" && s.trim()) {
            storeSet.add(s.trim());
          }
        });
      }
    }
  } catch (e) {
    console.error("Failed to load known stores:", e);
  }
  return Array.from(storeSet);
}

/**
 * Permanently saves any new stores discovered in files to localStorage so they are remembered in future months.
 * @param {Iterable<string>} stores 
 * @returns {string[]}
 */
export function saveKnownStores(stores) {
  try {
    const current = new Set(getKnownStores());
    let hasNew = false;
    for (const s of stores) {
      if (s && typeof s === "string" && s.trim()) {
        const norm = normalizeStoreName(s);
        if (!current.has(norm)) {
          current.add(norm);
          hasNew = true;
        }
      }
    }
    if (hasNew || !localStorage.getItem(STORE_STORAGE_KEY)) {
      localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(Array.from(current)));
    }
    return Array.from(current);
  } catch (e) {
    console.error("Failed to save known stores:", e);
    return Array.from(stores);
  }
}

/**
 * Normalizes store/branch names to canonical master store names.
 * Handles aliases, extra whitespace, branch code matching, Pune WMP->WMH typo, etc.
 * @param {string} storeName 
 * @returns {string}
 */
export function normalizeStoreName(storeName) {
  if (!storeName || typeof storeName !== "string") return storeName || "";
  let trimmed = storeName.trim();
  
  // Replace letter 'O' with '0' in store code patterns (e.g. WMHOO7 -> WMH007, WMPOO6 -> WMP006)
  trimmed = trimmed.replace(/^WM([HM])([O0-9]{1,3})/i, (_, state, num) => {
    return `WM${state.toUpperCase()}${num.replace(/O/gi, "0")}`;
  });

  const clean = trimmed.replace(/[\s\-_]+/g, "").toUpperCase();

  // 1. High-priority keyword / alias matching (overrides wrong state prefix like WMH006 for Kolar or WMP007 for Pune)
  if (clean.includes("KOLAR")) {
    return "WMP006 - BPL - KOLAR ROAD";
  }
  if (clean.includes("BARSHI") || clean.includes("BTW")) {
    return "WMH006 - BTW - BARSHI";
  }
  if (clean.includes("PUN") || clean.includes("PIMPRI") || clean.includes("RAVET")) {
    return "WMH007 - PUN - RAVET PUNE";
  }
  if (clean.includes("SATNA") || clean.includes("STN")) {
    return "WMP005 - STA - SATNA";
  }
  if (clean.includes("SEHORE")) {
    return "WMP001 - BPL - SEHORE CITY";
  }
  if (clean.includes("GULMOHAR")) {
    return "WMP002 - BPL - GULMOHAR COLONY";
  }
  if (clean.includes("MR09") || clean.includes("MR9")) {
    return "WMP003 - IND - MR 09 ROAD";
  }
  if (clean.includes("ANNAPURNA")) {
    return "WMP004 - IND - ANNAPURNA RD";
  }
  if (clean.includes("REWA")) {
    return "WMP007 - REW - REWA";
  }
  if (clean.includes("SHIVPURI")) {
    return "WMP008 - SVP - SHIVPURI";
  }
  if (clean.includes("VAZIRABAD")) {
    return "WMH001 - NED - VAZIRABAD";
  }
  if (clean.includes("BHAGYA")) {
    return "WMH002 - NED - BHAGYA NAGAR";
  }
  if (clean.includes("BEED")) {
    return "WMH003 - BDE - BEED";
  }
  if (clean.includes("PARBHANI")) {
    return "WMH004 - PBN - PARBHANI";
  }
  if (clean.includes("YAVATMAL")) {
    return "WMH005 - YTL - YAVATMAL";
  }
  if (clean.includes("SATARA")) {
    return "WMH008 - STR - SATARA";
  }
  if (clean.includes("KOLHAPUR")) {
    return "WMH009 - KOP - KOLHAPUR";
  }
  if (clean.includes("BADLAPUR")) {
    return "WMH011 - BDL - BADLAPUR";
  }

  // 2. Exact match against master store cleaned strings
  for (const master of MASTER_STORES) {
    if (master.replace(/[\s\-_]+/g, "").toUpperCase() === clean) {
      return master;
    }
  }

  // 3. Try matching by store code prefix with flexible digits (e.g. WMP006, WMP06, WMP6, WMP-006, WMP 006)
  const flexibleCodeMatch = trimmed.match(/^WM([HM])[- ]?(\d{1,3})/i);
  if (flexibleCodeMatch) {
    const state = flexibleCodeMatch[1].toUpperCase();
    const num = flexibleCodeMatch[2].padStart(3, "0");
    const formattedCode = `WM${state}${num}`;
    const found = MASTER_STORES.find(s => s.toUpperCase().startsWith(formattedCode));
    if (found) return found;
  }

  return trimmed;
}


/**
 * Parses a string in DD/MM/YYYY or DD-MM-YYYY format, Excel serial numbers, or Date objects into a valid Date.
 * @param {string|number|Date} dateVal 
 * @returns {Date|null}
 */
export function parseBillDate(dateVal) {
  if (dateVal === null || dateVal === undefined || dateVal === "") return null;
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal;
  
  if (typeof dateVal === "number") {
    // Excel serial number (1900 date system)
    return new Date(Math.round((dateVal - 25569) * 86400 * 1000));
  }

  const dateStr = String(dateVal).trim();
  if (!dateStr) return null;

  // Match DD/MM/YYYY or DD-MM-YYYY or D/M/YYYY or D-M-YYYY, ignoring anything after a space (like time)
  const matchDmy = dateStr.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})(?:\s+.*)?$/);
  if (matchDmy) {
    return new Date(Number(matchDmy[3]), Number(matchDmy[2]) - 1, Number(matchDmy[1]));
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  const matchYmd = dateStr.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})(?:\s+.*)?$/);
  if (matchYmd) {
    return new Date(Number(matchYmd[1]), Number(matchYmd[2]) - 1, Number(matchYmd[3]));
  }

  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Finds the 0-indexed row number containing the column headers.
 * Looks for the first row containing both "BRANCH NAME" and "BILL DATE".
 * @param {object} worksheet 
 * @returns {number}
 */
export function findHeaderRowIndex(worksheet) {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    let foundBranchName = false;
    let foundBillDate = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v) {
        const val = String(cell.v).trim().toUpperCase();
        if (val === "BRANCH NAME" || val === "FROM BRANCH NAME" || val === "FROM STORE" || val === "TO STORE") foundBranchName = true;
        if (val === "BILL DATE") foundBillDate = true;
      }
    }
    if (foundBranchName && foundBillDate) {
      return r;
    }
  }
  return 0;
}

/**
 * Extracts today's date from the worksheet header (e.g. "From DD/MM/YYYY to DD/MM/YYYY").
 * @param {object} worksheet 
 * @returns {string}
 */
export function extractTodayStrFromHeader(worksheet) {
  for (const key in worksheet) {
    if (key[0] === "!") continue;
    const cell = worksheet[key];
    if (cell && cell.v && typeof cell.v === "string") {
      const match = cell.v.match(/to\s+(\d{2}[/\-]\d{2}[/\-]\d{4})/i);
      if (match) {
        return match[1].replace(/-/g, "/");
      }
    }
  }
  return "";
}

/**
 * Derives the target date from either the worksheet header, the latest date in the data, or the current system date.
 * @param {object} worksheet 
 * @param {array} jsonData 
 * @returns {{ today: Date, todayStr: string }}
 */
export function getTargetDate(worksheet, jsonData) {
  let todayStr = extractTodayStrFromHeader(worksheet);
  let today;

  if (todayStr) {
    const [dayPart, monthPart, yearPart] = todayStr.split("/");
    today = new Date(Number(yearPart), Number(monthPart) - 1, Number(dayPart));
  } else {
    // Fallback: Find the latest date in the sheet data
    const dates = [];
    for (const row of jsonData) {
      const d = row["BILL DATE"];
      const parsed = parseBillDate(d);
      if (parsed) {
        dates.push({ str: d, date: parsed });
      }
    }
    if (dates.length > 0) {
      dates.sort((a, b) => b.date - a.date);
      todayStr = dates[0].str;
      today = dates[0].date;
    } else {
      // Ultimate fallback: system date
      today = new Date();
      const day = String(today.getDate()).padStart(2, "0");
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();
      todayStr = `${day}/${month}/${year}`;
    }
  }

  return { today, todayStr };
}

// Local Database implementation using IndexedDB (Replaces Firebase)
function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DashboardDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('historicalData')) {
        db.createObjectStore('historicalData');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save data to IndexedDB
 * @param {Array} data 
 */
export async function saveHistoricalData(data) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('historicalData', 'readwrite');
      const store = tx.objectStore('historicalData');
      const req = store.put(data, 'main_chunk');
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    throw new Error(`Local DB Save Error: ${error.message}`);
  }
}

/**
 * Load data from IndexedDB
 */
export async function loadHistoricalData() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('historicalData', 'readonly');
      const store = tx.objectStore('historicalData');
      const req = store.get('main_chunk');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error("Local DB Load Error:", error);
    return null;
  }
}

/**
 * Append data to IndexedDB
 * @param {Array} newData 
 */
export async function appendHistoricalData(newData) {
  try {
    const existingData = (await loadHistoricalData()) || [];
    const mergedData = [...existingData, ...newData];
    await saveHistoricalData(mergedData);
    return true;
  } catch (error) {
    throw new Error(`Local DB Append Error: ${error.message}`);
  }
}

/**
 * Clear data from IndexedDB
 */
export async function clearHistoricalData() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('historicalData', 'readwrite');
      const store = tx.objectStore('historicalData');
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    throw new Error(`Local DB Clear Error: ${error.message}`);
  }
}

/**
 * Extracts store code (e.g. 'WMH001 - NED - VAZIRABAD' -> 'WMH001')
 */
export const extractStoreCode = (branchStr) => {
  if (!branchStr || typeof branchStr !== "string") return "UNKNOWN";
  const trimmed = branchStr.trim();
  const match = trimmed.match(/^WM[HM]\d{3}/i);
  if (match) return match[0].toUpperCase();
  const norm = normalizeStoreName(trimmed);
  const matchNorm = norm.match(/^WM[HM]\d{3}/i);
  if (matchNorm) return matchNorm[0].toUpperCase();
  return trimmed.split(/[\s\-]/)[0].toUpperCase();
};

/**
 * State extraction (MH vs MP)
 */
export const getStateFromStore = (storeStr) => {
  if (!storeStr || typeof storeStr !== "string") return "MH";
  const upper = storeStr.toUpperCase().trim();
  if (upper.startsWith("WMP") || upper.includes(" MP")) return "MP";
  if (upper.startsWith("WMH") || upper.includes(" MH")) return "MH";
  return "MH";
};

/**
 * Transforms array of sales row objects from IndexedDB or JSON into a sales map indexed by `${storeCode}::${itemCode}`
 */
export function processSalesRowsToMap(salesRows) {
  if (!salesRows || !Array.isArray(salesRows) || salesRows.length === 0) {
    return { salesMap: {}, periodInfo: { periodDays: 90, periodMonths: 3.0, labelText: "No Sales Data" }, totalRows: 0 };
  }

  const salesMap = {};
  let minDate = null;
  let maxDate = null;
  let validRowsCount = 0;

  for (const row of salesRows) {
    if (!row || typeof row !== "object") continue;

    const getVal = (candidateKeys) => {
      for (const k of candidateKeys) {
        for (const key in row) {
          if (key.trim().toUpperCase() === k.toUpperCase()) {
            return row[key];
          }
        }
      }
      return "";
    };

    const rawBranch = String(getVal(["BRANCH NAME", "FROM BRANCH NAME", "STORE NAME", "BRANCH"]) || "").trim();
    if (!rawBranch) continue;

    const storeCode = extractStoreCode(rawBranch);
    const rawItemCode = String(getVal(["ITEM CODE", "BARCODE", "POS ITEM CODE", "HANA CODE"]) || "").trim();
    const rawAddlCode = String(getVal(["ADDL ITEM CODE"]) || "").trim();
    const itemCode = (rawItemCode || rawAddlCode).toUpperCase();
    if (!itemCode) continue;

    const desc = String(getVal(["ITEM DESCRIPTION", "DESCRIPTION", "MODEL NAME"]) || "").trim();
    const brand = String(getVal(["BRAND", "BRAND NAME"]) || "").trim();
    const category = String(getVal(["CATEGORY", "MAIN PRODUCT"]) || "").trim();
    const qty = parseFloat(getVal(["NET QTY", "TOTAL QTY", "QTY", "SOLD QTY", "QUANTITY"])) || 0;
    const amount = parseFloat(getVal(["NET SALE AMOUNT", "GROSS SALE AMOUNT", "AMOUNT", "NET AMOUNT", "SALES AMOUNT"])) || 0;
    const billDateStr = String(getVal(["BILL DATE", "DATE"]) || "").trim();

    if (billDateStr) {
      const dObj = parseBillDate(billDateStr);
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
    validRowsCount++;
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

  return {
    salesMap,
    periodInfo: { periodDays, periodMonths, labelText: dateLabel, minDate, maxDate },
    totalRows: validRowsCount
  };
}

