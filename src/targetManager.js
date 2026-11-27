import * as XLSX from "xlsx";
import { normalizeStoreName } from "./helpers";

export const TARGETS_STORAGE_KEY = "store_targets_custom_v1";
export const TARGET_PASSWORD_KEY = "validator_target_password";
export const DEFAULT_TARGET_PASSWORD = "shyam";

/**
 * 18 Official Master Stores with baseline targets
 */
export const MASTER_STORES_INFO = [
  // Maharashtra (10 stores) - Total: ₹79,00,000
  { code: "WMH001", state: "MH", name: "WMH001 - NED - VAZIRABAD", defaultTarget: 450000 },
  { code: "WMH002", state: "MH", name: "WMH002 - NED - BHAGYA NAGAR", defaultTarget: 450000 },
  { code: "WMH003", state: "MH", name: "WMH003 - BDE - BEED", defaultTarget: 1000000 },
  { code: "WMH004", state: "MH", name: "WMH004 - PBN - PARBHANI", defaultTarget: 500000 },
  { code: "WMH005", state: "MH", name: "WMH005 - YTL - YAVATMAL", defaultTarget: 2000000 },
  { code: "WMH006", state: "MH", name: "WMH006 - BTW - BARSHI", defaultTarget: 600000 },
  { code: "WMH007", state: "MH", name: "WMH007 - PUN - RAVET PUNE", defaultTarget: 800000 },
  { code: "WMH008", state: "MH", name: "WMH008 - STR - SATARA", defaultTarget: 700000 },
  { code: "WMH009", state: "MH", name: "WMH009 - KOP - KOLHAPUR", defaultTarget: 600000 },
  { code: "WMH011", state: "MH", name: "WMH011 - BDL - BADLAPUR", defaultTarget: 800000 },

  // Madhya Pradesh (8 stores) - Total: ₹29,40,000
  { code: "WMP001", state: "MP", name: "WMP001 - BPL - SEHORE CITY", defaultTarget: 300000 },
  { code: "WMP002", state: "MP", name: "WMP002 - BPL - GULMOHAR COLONY", defaultTarget: 400000 },
  { code: "WMP003", state: "MP", name: "WMP003 - IND - MR 09 ROAD", defaultTarget: 400000 },
  { code: "WMP004", state: "MP", name: "WMP004 - IND - ANNAPURNA RD", defaultTarget: 300000 },
  { code: "WMP005", state: "MP", name: "WMP005 - STA - SATNA", defaultTarget: 300000 },
  { code: "WMP006", state: "MP", name: "WMP006 - BPL - KOLAR ROAD", defaultTarget: 300000 },
  { code: "WMP007", state: "MP", name: "WMP007 - REW - REWA", defaultTarget: 600000 },
  { code: "WMP008", state: "MP", name: "WMP008 - SVP - SHIVPURI", defaultTarget: 340000 },
];

/**
 * Creates the base targets dictionary indexed by store code (e.g. WMP001) and canonical names
 */
export function getDefaultStoreTargetsMap() {
  const map = {};
  MASTER_STORES_INFO.forEach(store => {
    map[store.code] = store.defaultTarget;
    map[store.name] = store.defaultTarget;
  });

  // Common aliases
  map["WMH007 - PUN -RAVET PUNE"] = 800000;
  map["WMP007 - PUN -RAVET PUNE"] = 800000;
  map["WMH007 - PUN - PIMPRI"] = 800000;
  map["WMH009 - KOP -  KOLHAPUR"] = 600000;
  map["WMP005 - STN - SATNA"] = 300000;
  map["WMP006 - BPL -  KOLAR ROAD"] = 300000;

  return map;
}

/**
 * Retrieve current targets map from localStorage or fallback to defaults
 */
export function getLocalStoreTargets() {
  try {
    const raw = localStorage.getItem(TARGETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...getDefaultStoreTargetsMap(), ...parsed };
      }
    }
  } catch (e) {
    console.warn("Failed to load targets from localStorage:", e);
  }
  return getDefaultStoreTargetsMap();
}

/**
 * Save targets map to localStorage
 */
export function saveLocalStoreTargets(targetsMap) {
  try {
    localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(targetsMap));
  } catch (e) {
    console.warn("Failed to save targets to localStorage:", e);
  }
}

/**
 * Calculate grand total monthly target from the 18 master stores
 */
export function calculateGrandTotalTarget(targetsMap) {
  if (!targetsMap) return 10840000;
  let total = 0;
  MASTER_STORES_INFO.forEach(store => {
    const val = targetsMap[store.code] ?? targetsMap[store.name] ?? store.defaultTarget;
    total += Number(val) || 0;
  });
  return total;
}

/**
 * Calculate MP-only commitment/target total
 */
export function calculateMPCommitment(targetsMap) {
  if (!targetsMap) return 2940000;
  let total = 0;
  MASTER_STORES_INFO.filter(s => s.state === "MP").forEach(store => {
    const val = targetsMap[store.code] ?? targetsMap[store.name] ?? store.defaultTarget;
    total += Number(val) || 0;
  });
  return total;
}

/**
 * Resolves any store name or branch string to its target in targetsMap
 */
export function getStoreTargetValue(storeName, targetsMap = null) {
  if (!storeName) return null;
  const currentMap = targetsMap || getLocalStoreTargets();
  const canonical = normalizeStoreName(storeName);

  // 1. Direct match with canonical or original
  if (currentMap[canonical] !== undefined) return currentMap[canonical];
  if (currentMap[storeName] !== undefined) return currentMap[storeName];

  // 2. Match by store code extracted (e.g. WMP001 or WMH003)
  const codeMatch = storeName.match(/(WM[HP]\s*[-_]?\s*\d{1,3})/i);
  if (codeMatch) {
    const cleanDigits = codeMatch[1].replace(/\D/g, "");
    const prefix = codeMatch[1].toUpperCase().includes("WMP") ? "WMP" : "WMH";
    const fullCode = `${prefix}${cleanDigits.padStart(3, "0")}`;
    if (currentMap[fullCode] !== undefined) return currentMap[fullCode];
  }

  // 3. Fallback to clean name / suffix matching
  const nameClean = storeName.replace(/\s+/g, "").toUpperCase();
  for (const [key, value] of Object.entries(currentMap)) {
    const keyClean = key.replace(/\s+/g, "").toUpperCase();
    if (keyClean === nameClean) return value;

    const keyParts = key.split("-");
    const storeParts = storeName.split("-");
    if (keyParts.length >= 2 && storeParts.length >= 2) {
      const keySuffix = keyParts.slice(1).join("").replace(/\s+/g, "").toUpperCase();
      const storeSuffix = storeParts.slice(1).join("").replace(/\s+/g, "").toUpperCase();
      if (keySuffix === storeSuffix) return value;
    }
  }

  return null;
}

/**
 * Helper to match a user input token (like "wmp001" or "sehore") to a master store
 */
export function matchStoreFromToken(token) {
  if (!token) return null;
  const clean = String(token).trim().toUpperCase();

  // Try store code pattern: e.g. WMP001, WMP1, WMP-001, WMH005
  const codeMatch = clean.match(/(WM[HP])\s*[-_]?\s*(\d{1,3})/i);
  if (codeMatch) {
    const prefix = codeMatch[1].toUpperCase();
    const num = codeMatch[2].padStart(3, "0");
    const formatted = `${prefix}${num}`;
    const found = MASTER_STORES_INFO.find(s => s.code === formatted);
    if (found) return found;
  }

  // Direct code match
  const directMatch = MASTER_STORES_INFO.find(s => s.code === clean);
  if (directMatch) return directMatch;

  // City or keyword match
  const keywordMap = [
    { key: "SEHORE", code: "WMP001" },
    { key: "GULMOHAR", code: "WMP002" },
    { key: "MR 09", code: "WMP003" },
    { key: "MR09", code: "WMP003" },
    { key: "ANNAPURNA", code: "WMP004" },
    { key: "SATNA", code: "WMP005" },
    { key: "KOLAR", code: "WMP006" },
    { key: "REWA", code: "WMP007" },
    { key: "SHIVPURI", code: "WMP008" },
    { key: "VAZIRABAD", code: "WMH001" },
    { key: "BHAGYA", code: "WMH002" },
    { key: "BEED", code: "WMH003" },
    { key: "PARBHANI", code: "WMH004" },
    { key: "YAVATMAL", code: "WMH005" },
    { key: "BARSHI", code: "WMH006" },
    { key: "RAVET", code: "WMH007" },
    { key: "PIMPRI", code: "WMH007" },
    { key: "SATARA", code: "WMH008" },
    { key: "KOLHAPUR", code: "WMH009" },
    { key: "BADLAPUR", code: "WMH011" },
  ];

  for (const item of keywordMap) {
    if (clean.includes(item.key)) {
      return MASTER_STORES_INFO.find(s => s.code === item.code) || null;
    }
  }

  return null;
}

/**
 * Parse an amount string into numeric value:
 * Supports: "10000", "3,50,000", "3.5L", "4Lakh", "50k", etc.
 */
export function parseAmount(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  let str = String(val).trim().toUpperCase();
  str = str.replace(/₹/g, "").replace(/RS\.?/gi, "").trim();

  // Check for Lakhs multiplier (e.g. 3.5L or 3.5 LAKH)
  if (str.includes("LAKH") || str.endsWith("L")) {
    const numPart = parseFloat(str.replace(/LAKHS?|L/g, "").trim());
    if (!isNaN(numPart)) return Math.round(numPart * 100000);
  }

  // Check for Thousands multiplier (e.g. 50K)
  if (str.endsWith("K")) {
    const numPart = parseFloat(str.replace(/K/g, "").trim());
    if (!isNaN(numPart)) return Math.round(numPart * 1000);
  }

  // Check for Cr multiplier (e.g. 1.08CR)
  if (str.includes("CR")) {
    const numPart = parseFloat(str.replace(/CRS?|CR/g, "").trim());
    if (!isNaN(numPart)) return Math.round(numPart * 10000000);
  }

  // Remove commas
  const cleanNumber = str.replace(/,/g, "").trim();
  const parsed = parseFloat(cleanNumber);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

/**
 * Parse free-form text entered by the user
 * Examples:
 * WMP001 350000
 * WMP002 : 4,00,000
 * WMP003\t450000
 */
export function parseTargetText(rawText, currentTargetsMap) {
  if (!rawText || !rawText.trim()) {
    return { updates: [], unmatched: [], previewMap: { ...currentTargetsMap } };
  }

  const lines = rawText.split(/\r?\n|;/).map(l => l.trim()).filter(Boolean);
  const updates = [];
  const unmatched = [];
  const previewMap = { ...currentTargetsMap };

  for (const line of lines) {
    // Try to split line into store token and target amount token
    // Could be separated by tabs, spaces, colons, equals, hyphens, or commas
    // Regex looks for store code or store name first, then numbers
    const parts = line.split(/[\t:=,]|(?<=[a-zA-Z])\s+(?=[0-9])|\s{2,}/).map(p => p.trim()).filter(Boolean);

    let storeMatched = null;
    let amountFound = null;

    if (parts.length >= 2) {
      // First try part 0 as store, part 1 as amount
      storeMatched = matchStoreFromToken(parts[0]);
      amountFound = parseAmount(parts[1]);

      // If not, try part 1 as store, part 0 as amount
      if (!storeMatched && parseAmount(parts[0]) > 0) {
        storeMatched = matchStoreFromToken(parts[1]);
        amountFound = parseAmount(parts[0]);
      }
    } else {
      // Single line like "WMP001 300000" split by simple space
      const sub = line.split(/\s+/);
      if (sub.length >= 2) {
        storeMatched = matchStoreFromToken(sub[0]);
        amountFound = parseAmount(sub.slice(1).join(""));
      }
    }

    if (storeMatched && amountFound > 0) {
      const oldVal = previewMap[storeMatched.code] ?? previewMap[storeMatched.name] ?? storeMatched.defaultTarget;
      previewMap[storeMatched.code] = amountFound;
      previewMap[storeMatched.name] = amountFound;

      // Update or replace existing item in updates list
      const existingIdx = updates.findIndex(u => u.code === storeMatched.code);
      const updateItem = {
        code: storeMatched.code,
        name: storeMatched.name,
        state: storeMatched.state,
        oldTarget: oldVal,
        newTarget: amountFound,
        diff: amountFound - oldVal,
      };

      if (existingIdx >= 0) {
        updates[existingIdx] = updateItem;
      } else {
        updates.push(updateItem);
      }
    } else {
      unmatched.push(line);
    }
  }

  return { updates, unmatched, previewMap };
}

/**
 * Parse an Excel file for store targets
 */
export async function parseTargetExcelFile(file, currentTargetsMap) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (!json || json.length === 0) {
          throw new Error("The uploaded spreadsheet is empty.");
        }

        // Find header row containing store code / name and target
        let headerRowIdx = -1;
        let storeColIdx = -1;
        let targetColIdx = -1;

        for (let i = 0; i < Math.min(15, json.length); i++) {
          const row = json[i];
          if (!row || !Array.isArray(row)) continue;

          for (let c = 0; c < row.length; c++) {
            const cellVal = String(row[c] || "").trim().toUpperCase();
            if (
              cellVal.includes("STORE") ||
              cellVal.includes("BRANCH") ||
              cellVal.includes("CODE") ||
              cellVal === "NAME"
            ) {
              if (storeColIdx === -1) storeColIdx = c;
            }
            if (
              cellVal.includes("TARGET") ||
              cellVal.includes("COMMITMENT") ||
              cellVal.includes("BUDGET") ||
              cellVal.includes("GOAL")
            ) {
              if (targetColIdx === -1) targetColIdx = c;
            }
          }

          if (storeColIdx !== -1 && targetColIdx !== -1) {
            headerRowIdx = i;
            break;
          }
        }

        const updates = [];
        const unmatched = [];
        const previewMap = { ...currentTargetsMap };

        // If header found, iterate through rows
        const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
        for (let i = startRow; i < json.length; i++) {
          const row = json[i];
          if (!row || row.length === 0) continue;

          let storeToken = "";
          let targetVal = 0;

          if (storeColIdx !== -1 && targetColIdx !== -1) {
            storeToken = row[storeColIdx];
            targetVal = parseAmount(row[targetColIdx]);
          } else {
            // Fallback: look for store-like column and number column
            for (let c = 0; c < row.length; c++) {
              const matched = matchStoreFromToken(row[c]);
              if (matched) {
                storeToken = row[c];
                // look for amount in adjacent columns
                for (let k = 0; k < row.length; k++) {
                  if (k !== c) {
                    const amt = parseAmount(row[k]);
                    if (amt > 1000) {
                      targetVal = amt;
                      break;
                    }
                  }
                }
                break;
              }
            }
          }

          const matchedStore = matchStoreFromToken(storeToken);
          if (matchedStore && targetVal > 0) {
            const oldVal = previewMap[matchedStore.code] ?? previewMap[matchedStore.name] ?? matchedStore.defaultTarget;
            previewMap[matchedStore.code] = targetVal;
            previewMap[matchedStore.name] = targetVal;

            const existingIdx = updates.findIndex(u => u.code === matchedStore.code);
            const updateItem = {
              code: matchedStore.code,
              name: matchedStore.name,
              state: matchedStore.state,
              oldTarget: oldVal,
              newTarget: targetVal,
              diff: targetVal - oldVal,
            };

            if (existingIdx >= 0) {
              updates[existingIdx] = updateItem;
            } else {
              updates.push(updateItem);
            }
          } else if (storeToken && String(storeToken).trim().length > 2) {
            unmatched.push(`${storeToken} -> ${targetVal || "No amount"}`);
          }
        }

        resolve({ updates, unmatched, previewMap });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read Excel file."));
    reader.readAsArrayBuffer(file);
  });
}
