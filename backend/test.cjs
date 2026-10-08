const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'sheet_formatter',
  password: 'shyam@123',
  port: 5432,
});

client.connect()
  .then(() => client.query("SELECT SUM(amount) as sales, SUM(qty) as qty, TO_CHAR(date, 'YYYY-MM') as month FROM sales_record WHERE store LIKE '%SATNA%' GROUP BY TO_CHAR(date, 'YYYY-MM')"))
  .then(res => console.log(res.rows))
  .catch(err => console.error(err))
  .finally(() => client.end());
