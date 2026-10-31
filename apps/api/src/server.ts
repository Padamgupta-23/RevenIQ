import dotenv from 'dotenv';
dotenv.config();

import { app } from './app.js';
import { initBillingCron } from './jobs/billing.cron.js';

const PORT = process.env.PORT || 4000;

export const server = app.listen(PORT, () => {
  console.log(`RevenIQ API server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  if (process.env.NODE_ENV !== 'test') {
    initBillingCron();
  }
});
