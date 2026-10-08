const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  password: 'shyam@123',
  host: 'localhost',
  port: 5432,
  database: 'postgres'
});

client.connect()
  .then(() => {
    console.log("Connected to postgres");
    return client.query('CREATE DATABASE sheet_formatter;');
  })
  .then(() => {
    console.log("Database sheet_formatter created successfully!");
    client.end();
  })
  .catch((err) => {
    // If it already exists, that's fine too
    if (err.code === '42P04') {
        console.log("Database already exists.");
    } else {
        console.error("Error:", err.message);
    }
    client.end();
  });
