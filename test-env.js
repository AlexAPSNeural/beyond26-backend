import dotenv from 'dotenv';
dotenv.config();

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('URL exists:', !!process.env.DATABASE_URL);
