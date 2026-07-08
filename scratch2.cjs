const xlsx = require('xlsx');

const f1 = 'C:\\Users\\priya\\Downloads\\barshi.xlsx';
const f2 = 'C:\\Users\\priya\\Downloads\\9afe08cb1b664f27b46f248efa3f82c5.xlsx';

function analyze() {
    const wb1 = xlsx.readFile(f1);
    const data1 = xlsx.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);
    const b1 = data1.filter(row => String(row['Hana code']) === '19004214');
    console.log('--- barshi.xlsx for 19004214 ---');
    console.log(b1);

    const wb2 = xlsx.readFile(f2);
    const data2 = xlsx.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);
    // Find column name for Store name
    let storeCol = Object.keys(data2[0] || {}).find(k => k.includes('1')); // 'CLOSING STOCK REPORT From ..._1' usually holds store name
    
    // Check in closing stock where hana code is 19004214 and store is BARSHI
    const b2 = data2.filter(row => {
        const isHana = Object.values(row).some(v => String(v).includes('19004214'));
        const isBarshi = Object.values(row).some(v => typeof v === 'string' && v.toUpperCase().includes('BARSHI'));
        return isHana && isBarshi;
    });
    console.log('\n--- closing stock for 19004214 AND BARSHI ---');
    console.log(b2);
    
    // Also, just BARSHI store stock for this code
    const b3 = data2.filter(row => {
        const isHana = Object.values(row).some(v => String(v).includes('19004214'));
        const isWMH006 = Object.values(row).some(v => typeof v === 'string' && v.toUpperCase().includes('WMH006'));
        return isHana && isWMH006;
    });
    console.log('\n--- closing stock for 19004214 AND WMH006 ---');
    console.log(b3);
}
analyze();
