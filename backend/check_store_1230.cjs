const { Client } = require('pg'); 
const client = new Client({ user: 'postgres', host: 'localhost', database: 'sheet_formatter', password: 'shyam@123', port: 5432 }); 
client.connect().then(() => client.query("SELECT store, COUNT(*) FROM sales_record WHERE \"fileId\" = 'file_1791442830839_b08uc' GROUP BY store LIMIT 5")).then(res => console.log(res.rows)).catch(console.error).finally(() => client.end());
