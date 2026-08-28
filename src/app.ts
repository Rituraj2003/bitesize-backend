import express, { Express } from 'express';
import cors from 'cors';
import snippetRouter from './routes/snippet.routes.js';
import authRouter from './routes/auth.routes.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';

const app: Express = express();

// Open CORS Middleware (Allows Vercel, Localhost, Postman, Mobile)
app.use(cors());

app.use(express.json()); // populates req.body
app.use(requestLogger); // records request log time

// API Routes
app.use('/api/auth', authRouter);
app.use('/api', snippetRouter);

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
