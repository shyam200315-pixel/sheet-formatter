const { Client } = require('pg'); 
const client = new Client({ user: 'postgres', host: 'localhost', database: 'sheet_formatter', password: 'shyam@123', port: 5432 }); 
client.connect().then(() => client.query("DELETE FROM sales_record WHERE store = ''")).then(res => console.log('Deleted rows:', res.rowCount)).catch(console.error).finally(() => client.end());
