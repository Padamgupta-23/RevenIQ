import dotenv from 'dotenv';
dotenv.config();

import { app } from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`RevenIQ API server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

