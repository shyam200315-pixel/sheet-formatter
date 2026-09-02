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
  
  // Fix Pune branch being incorrectly marked as WMP in source Excel
  if (trimmed.toUpperCase().includes("PUN")) {
    trimmed = trimmed.replace(/WMP/gi, "WMH");
  }

  // Try matching by store code prefix like WMH001, WMP005, etc.
  const codeMatch = trimmed.match(/^(WM[HM]\d{3})/i);
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase();
    const found = MASTER_STORES.find(s => s.toUpperCase().startsWith(code));
    if (found) return found;
  }

  // Try matching by exact clean text without whitespace
  const clean = trimmed.replace(/\s+/g, "").toUpperCase();
  for (const master of MASTER_STORES) {
    if (master.replace(/\s+/g, "").toUpperCase() === clean) {
      return master;
    }
  }

  // Handle specific aliases / partial names
  if (clean.includes("PUN") || clean.includes("PIMPRI") || clean.includes("RAVET")) {
    return "WMH007 - PUN - RAVET PUNE";
  }
  if (clean.includes("SATNA")) {
    return "WMP005 - STA - SATNA";
  }
  if (clean.includes("KOLAR")) {
    return "WMP006 - BPL - KOLAR ROAD";
  }
  if (clean.includes("KOLHAPUR")) {
    return "WMH009 - KOP - KOLHAPUR";
  }

  return trimmed;
}


/**
 * Parses a string in DD/MM/YYYY or DD-MM-YYYY format into a Date object.
 * @param {string} dateStr 
 * @returns {Date|null}
 */
export function parseBillDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  // Match DD/MM/YYYY or DD-MM-YYYY, ignoring anything after a space (like time)
  const match = trimmed.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4})(?:\s+.*)?$/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
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
