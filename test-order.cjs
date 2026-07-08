const xlsx = require('xlsx');

const f1 = 'C:\\Users\\priya\\Downloads\\barshi.xlsx';
const orderWb = xlsx.readFile(f1);
const orderSheet = orderWb.Sheets[orderWb.SheetNames[0]];

const data = xlsx.utils.sheet_to_json(orderSheet, { defval: '' });
console.log('Columns in order data:', Object.keys(data[0] || {}));
console.log('First row:', data[0]);
