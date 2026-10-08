const { Client } = require('pg'); 
const client = new Client({ user: 'postgres', host: 'localhost', database: 'sheet_formatter', password: 'shyam@123', port: 5432 }); 
client.connect().then(() => client.query("SELECT * FROM sales_record WHERE \"fileId\" = 'file_1791437314305_f3ing' LIMIT 1")).then(res => console.log(res.rows)).catch(console.error).finally(() => client.end());
