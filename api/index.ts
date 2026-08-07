import { createApp } from '../server';

export default async function handler(req: any, res: any) {
  try {
    const app = await createApp();
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel serverless execution error:', err);
    res.status(500).json({ error: err?.message || 'Serverless database connection failed' });
  }
}
