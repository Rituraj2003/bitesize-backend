import 'dotenv/config';
import app from './app.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 5050;

app.listen(Number(PORT), '0.0.0.0', () => {
  logger.info(`🚀 BiteSize Backend Engine successfully executing on port ${PORT}`);
});