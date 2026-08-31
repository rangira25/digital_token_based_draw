import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import pool from './config/database';

const PORT = parseInt(process.env.PORT || '5000', 10);

const startServer = async () => {
  try {
    // Test DB connection
    const client = await pool.connect();
    console.log('PostgreSQL connected successfully');
    client.release();

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
      console.log(`API base: http://localhost:${PORT}/api/v1`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await pool.end();
        console.log('Database pool closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
