import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';  

import authRoutes from './routes/auth.routes';
import drawRoutes from './routes/draw.routes';
import {
  tokenRouter,
  winnerRouter,
  notificationRouter,
  analyticsRouter,
  auditRouter,
  adminRouter,
} from './routes/index';
import { errorHandler, notFound } from './middleware/error';

dotenv.config();

const app = express();

// ─── Security 
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing  
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging  
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Health Check  
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/draws', drawRoutes);
app.use('/api/v1/tokens', tokenRouter);
app.use('/api/v1/winners', winnerRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/audit', auditRouter);
app.use('/api/v1/admin', adminRouter);


if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');   

  app.use(express.static(clientDist));
app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}


if (process.env.NODE_ENV !== 'production') {
  app.use(notFound);
}
app.use(errorHandler);

export default app;