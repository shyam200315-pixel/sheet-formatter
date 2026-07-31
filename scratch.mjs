import xlsx from 'xlsx';

const file = 'C:\\Users\\priya\\Downloads\\01f69f992bb74877a5ec70fbd4f009a3.xlsx';

try {
    const wb = xlsx.readFile(file);
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log('Rows:', data.length);
    // Find the header row (assume it's the one with 'BRANCH NAME' or 'CLOSING STOCK')
    let headerIdx = -1;
    for (let i=0; i<Math.min(20, data.length); i++) {
        if (data[i] && data[i].some(c => String(c).toUpperCase().includes('BRANCH NAME'))) {
            headerIdx = i;
            break;
        }
    }
    console.log('Header Index:', headerIdx);
    if (headerIdx !== -1) {
        console.log('Headers:', data[headerIdx]);
        console.log('Sample Data 1:', data[headerIdx + 1]);
        console.log('Sample Data 2:', data[headerIdx + 2]);
    }
} catch (e) {
    console.error('Error reading file:', e);
}
