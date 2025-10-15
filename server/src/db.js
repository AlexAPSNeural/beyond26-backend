import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL;
let pool = null;

export function getPool() {
  if (!url) return null;
  if (!pool) pool = new Pool({ connectionString: url });
  return pool;
}