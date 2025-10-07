
import express from 'express';import morgan from 'morgan';import helmet from 'helmet';import cors from 'cors';import path from 'node:path';import dotenv from 'dotenv';import { fileURLToPath } from 'node:url';import api from './src/routes.js';dotenv.config();const __filename=fileURLToPath(import.meta.url);const __dirname=path.dirname(__filename);const app=express();app.use(helmet());app.use(cors());app.use(express.json({limit:'2mb'}));app.use(morgan('dev'));app.use('/api',api);

// Health check endpoint for Docker
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});const clientDir=path.resolve(__dirname,'../client/dist');app.use(express.static(clientDir));app.get('*',(req,res)=>{res.sendFile(path.join(clientDir,'index.html'))});const port=process.env.PORT||4000;app.listen(port,()=>console.log(`API on http://localhost:${port}`));
