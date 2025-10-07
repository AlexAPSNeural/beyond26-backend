import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getPool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// In-memory users for demo (same as in routes.js)
const memoryUsers = [
  {
    id: 'admin-user-id',
    email: 'admin@beyond26advisors.com',
    name: 'Admin User',
    role: 'admin',
    password_hash: '$2a$10$rGYI9XVxjwIgFU/9ahaQCeIGgQNPcCvm2A3enC41TqSG1Utoh8AeS' // Password123!
  },
  {
    id: 'edgar-user-id',
    email: 'esmith@beyond26advisors.com',
    name: 'Edgar Smith',
    role: 'admin',
    password_hash: '$2a$10$rGYI9XVxjwIgFU/9ahaQCeIGgQNPcCvm2A3enC41TqSG1Utoh8AeS' // Password123!
  },
  {
    id: 'alex-user-id',
    email: 'asmith@beyond26advisors.com',
    name: 'Alex Smith',
    role: 'employee',
    password_hash: '$2a$10$rGYI9XVxjwIgFU/9ahaQCeIGgQNPcCvm2A3enC41TqSG1Utoh8AeS' // Password123!
  },
  {
    id: 'client-user-id',
    email: 'client@example.com',
    name: 'John Stevens',
    role: 'client',
    password_hash: '$2a$10$rGYI9XVxjwIgFU/9ahaQCeIGgQNPcCvm2A3enC41TqSG1Utoh8AeS' // Password123!
  }
];

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export async function verifyUser(email, password) {
  const pool = getPool();
  
  if (!pool) {
    // Use in-memory users when database is not available
    console.log('Verifying user:', email, 'with in-memory users');
    const user = memoryUsers.find(u => u.email === email);
    console.log('Found user:', user ? user.email : 'none');
    
    if (!user) return null;
    
    // For demo purposes, accept both the hashed password and plain password
    const ok = await bcrypt.compare(password, user.password_hash) || password === 'Password123!' || password === 'Password123';
    console.log('Password check result:', ok);
    
    if (!ok) return null;
    
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };
  }
  
  // Use database when available
  const { rows } = await pool.query(
    'SELECT id, email, role, first_name, last_name, password_hash FROM users WHERE email=$1 LIMIT 1',
    [email]
  );
  
  const user = rows[0];
  if (!user) return null;
  
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name || user.last_name || 'User'
  };
}
