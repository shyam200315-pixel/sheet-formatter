import * as XLSX from "xlsx";

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
