const { Client } = require('pg'); 
const client = new Client({ user: 'postgres', host: 'localhost', database: 'sheet_formatter', password: 'shyam@123', port: 5432 }); 
client.connect().then(() => client.query("SELECT COUNT(*) FROM sales_record")).then(res => console.log('Total:', res.rows[0].count)).catch(console.error).finally(() => client.end());
