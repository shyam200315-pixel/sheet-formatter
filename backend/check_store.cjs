const { Client } = require('pg'); 
const client = new Client({ user: 'postgres', host: 'localhost', database: 'sheet_formatter', password: 'shyam@123', port: 5432 }); 
client.connect().then(() => client.query("SELECT store, COUNT(*) FROM sales_record WHERE \"fileId\" = 'file_1791435822385_lhp2f' GROUP BY store")).then(res => console.log(res.rows)).catch(console.error).finally(() => client.end());
