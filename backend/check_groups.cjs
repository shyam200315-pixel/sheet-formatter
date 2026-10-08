const { Client } = require('pg'); 
const client = new Client({ user: 'postgres', host: 'localhost', database: 'sheet_formatter', password: 'shyam@123', port: 5432 }); 
client.connect().then(() => client.query('SELECT "syncGroup", COUNT(*) FROM sales_record GROUP BY "syncGroup"')).then(res => console.log(res.rows)).catch(console.error).finally(() => client.end());
