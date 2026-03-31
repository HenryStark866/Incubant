import { createApiApp } from '../backend/createApiApp';

// Apply the routes from our central backend logic
const app = createApiApp();

// Export for Vercel Serverless
export default app;
