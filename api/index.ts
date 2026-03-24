import express from 'express';
import { createApiApp } from '../backend/createApiApp';

const app = express();

app.use(express.json());

// Apply the routes from our central backend logic
const apiRouter = createApiApp();
app.use('/api', apiRouter);

// Export for Vercel Serverless
export default app;
