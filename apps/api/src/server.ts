import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';

const PORT = process.env.PORT || 4000;
const app = createApp();

export const server = app.listen(PORT, () => {
  console.log(`RevenIQ API server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
