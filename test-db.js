import dotenv from 'dotenv';
import { getPool } from './src/db.js';

dotenv.config();

console.log('Environment loaded, DATABASE_URL:', process.env.DATABASE_URL);

const pool = getPool();
console.log('Pool created:', !!pool);

if (pool) {
  console.log('Database connection successful');
  pool.end();
} else {
  console.log('Failed to create database pool');
}
