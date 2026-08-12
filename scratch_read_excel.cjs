const xlsx = require('xlsx');
const path = 'C:\\Users\\priya\\Downloads\\48bbb4b09b9340188901efe56eb0cc76.xlsx';

const workbook = xlsx.readFile(path);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Headers:");
console.log(data[0]);

const rows = xlsx.utils.sheet_to_json(worksheet);
console.log("\nFirst 2 rows of data:");
console.log(rows.slice(0, 2));
