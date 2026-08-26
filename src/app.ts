import express, { Express } from 'express';
import cors from 'cors';
import snippetRouter from './routes/snippet.routes.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';

const app: Express = express();

// Middleware Configurations
app.use(cors());
app.use(express.json()); //populates req.body
app.use(requestLogger);  // records request log time 

// API Routes
app.use('/api', snippetRouter);

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
