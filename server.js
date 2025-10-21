import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import api from './src/routes.js';

dotenv.config();

const app = express();

// Security & Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://beyond26advisors.com',
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// API Routes
app.use('/api', api);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler for non-API routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
