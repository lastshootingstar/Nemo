import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import 'dotenv/config';

// Import routes
import uploadRoutes from './routes/upload';
import analysisRoutes from './routes/analysis';
import chatRoutes from './routes/chat';

const app = new Hono();
const port = process.env.PORT ? parseInt(process.env.PORT) : 7776;

// Enable CORS for all routes
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    message: 'NemoClinical Backend is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.route('/api/upload', uploadRoutes);
app.route('/api/analysis', analysisRoutes);
app.route('/api/chat', chatRoutes);

// Error handling middleware
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    success: false,
    error: 'Internal server error',
    message: err.message
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  }, 404);
});

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  console.log(`🚀 NemoClinical Backend is running on http://localhost:${port}`);
  console.log(`📊 Ready to process data analysis requests`);
  console.log(`🤖 DeepSeek AI integration ${process.env.DEEPSEEK_API_KEY ? 'enabled' : 'disabled'}`);
});


