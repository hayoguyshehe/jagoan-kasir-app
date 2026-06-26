const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: '103.63.25.248',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'WGBu5FuMDNEppfVL6Ak1IhjlJgHs3L0Y',
});

async function runMigrations() {
  try {
    await client.connect();
    console.log('Connected to DB!');

    const files = [
      'migrations/20260624163002_initial-schema.sql',
      'migrations/20260624163133_rls-policies.sql',
      'seed.sql'
    ];

    for (const file of files) {
      if (fs.existsSync(file)) {
        console.log(`Executing ${file}...`);
        const sql = fs.readFileSync(file, 'utf8');
        await client.query(sql);
        console.log(`Finished ${file}!`);
      } else {
        console.log(`Warning: ${file} not found.`);
      }
    }

    console.log('All migrations applied successfully!');
  } catch (err) {
    console.error('Error running migrations:', err);
  } finally {
    await client.end();
  }
}

runMigrations();
