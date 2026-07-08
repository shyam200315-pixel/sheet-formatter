const xlsx = require('xlsx');

const f2 = 'C:\\Users\\priya\\Downloads\\9afe08cb1b664f27b46f248efa3f82c5.xlsx';

function findHeaderIndex(worksheet, requiredHeadersArrays) {
    const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    for (let r = range.s.r; r <= range.e.r; r++) {
      let foundCount = 0;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = worksheet[xlsx.utils.encode_cell({ r, c })];
        if (cell && cell.v) {
          const val = String(cell.v).trim().toUpperCase();
          for (const req of requiredHeadersArrays) {
            if (Array.isArray(req)) {
              if (req.includes(val)) {
                foundCount++;
                break;
              }
            } else {
              if (req === val) {
                foundCount++;
                break;
              }
            }
          }
        }
      }
      if (foundCount >= requiredHeadersArrays.length) {
        return r;
      }
    }
    return 0;
}

const stockWb = xlsx.readFile(f2);
const stockSheet = stockWb.Sheets[stockWb.SheetNames[0]];

const stockHeaderRow = findHeaderIndex(stockSheet, [['ITEM CODE', 'BARCODE', 'POS ITEM CODE'], ['QUANTITY REQ', 'CLOSING STOCK', 'REQ QTY'], ['BRANCH NAME', 'STORE CODE']]);
console.log('stockHeaderRow:', stockHeaderRow);

const stockData = xlsx.utils.sheet_to_json(stockSheet, { defval: '', range: stockHeaderRow });
console.log('Headers parsed:', Object.keys(stockData[0] || {}));
console.log('First row:', stockData[0]);
