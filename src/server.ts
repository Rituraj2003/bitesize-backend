import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:secretpassword@localhost:5432/bitesize?schema=public";

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware Configurations
app.use(cors());
app.use(express.json()); // Parses incoming JSON application payloads safely

// ==========================================
// ROUTE 1: GET ALL SNIPPETS WITH FULL-TEXT SEARCH
// ==========================================
app.get('/api/snippets', async (req: Request, res: Response) => {
  try {
    const { search, tag } = req.query;

    // Build operational filter arguments dynamically
    let queryOptions: any = {
      orderBy: { createdAt: 'desc' }
    };

    let conditions: any[] = [];

    // 1. ADVANCED: Native PostgreSQL Full-Text Search Token Filter
    if (search && typeof search === 'string' && search.trim() !== '') {
      conditions.push({
        OR: [
          { title: { search: search.trim().split(' ').join(' & ') } },
          { bodyText: { search: search.trim().split(' ').join(' & ') } }
        ]
      });
    }

    // 2. Multi-tag relational scanning
    if (tag && typeof tag === 'string' && tag !== 'all') {
      conditions.push({
        languageTags: {
          has: tag.toLowerCase()
        }
      });
    }

    if (conditions.length > 0) {
      queryOptions.where = { AND: conditions };
    }

    const snippets = await prisma.snippet.findMany(queryOptions);
    res.json(snippets);
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: "Failed to retrieve snippets from database database" });
  }
});

// ==========================================
// ROUTE 2: CREATE NEW MICRO-LEARNING SNIPPET
// ==========================================
app.post('/api/snippets', async (req: Request, res: Response) => {
  try {
    const { title, bodyText, languageTags } = req.body;

    if (!title || !bodyText) {
      return res.status(400).json({ error: "Title and BodyText fields are required params." });
    }

    const newSnippet = await prisma.snippet.create({
      data: {
        title,
        bodyText,
        // Ensure all stored search tokens are downcased to maintain consistent database filtering indices
        languageTags: Array.isArray(languageTags) ? languageTags.map((t: string) => t.toLowerCase()) : []
      }
    });

    res.status(201).json(newSnippet);
  } catch (error) {
    res.status(500).json({ error: "Failed to create database record string instance" });
  }
});

// ==========================================
// ROUTE 3: THE SPACED-REPETITION RETRIEVAL ENGINE
// ==========================================
app.get('/api/review/daily', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const BASE_INTERVAL_MULTIPLIER = 3; // Corresponds to our mathematical exponential step rule scaling

    // Using raw SQL logic to evaluate relational inline date math parameters safely across databases
    const reviewQueue: any[] = await prisma.$queryRaw`
      SELECT * FROM "Snippet"
      WHERE "lastReviewedDate" + ("timesReviewed" * ${BASE_INTERVAL_MULTIPLIER} * INTERVAL '1 day') <= ${today}
      ORDER BY "lastReviewedDate" ASC
      LIMIT 5;
    `;

    res.json(reviewQueue);
  } catch (error) {
    console.error("Queue Retrieval Error:", error);
    res.status(500).json({ error: "Failed to compile your active retention deck algorithm array" });
  }
});

// ==========================================
// ROUTE 4: UPDATE MUTATION STATUS POST-REVIEW
// ==========================================
app.post('/api/review/:id', async (req: Request, res: Response) => {
  try {
    const id  = req.params.id as string;
    const { performanceRating } = req.body; // Expects 'easy' or 'hard' scalar strings

    const currentSnippet = await prisma.snippet.findUnique({ where: { id } });
    if (!currentSnippet) return res.status(404).json({ error: "Record not found" });

    let updatedReviewsCount = currentSnippet.timesReviewed;

    if (performanceRating === 'easy') {
      updatedReviewsCount += 1; // Increment retention scale multiplier step
    } else {
      updatedReviewsCount = 0; // Reset counter to force immediate appearance tomorrow
    }

    const updatedSnippet = await prisma.snippet.update({
      where: { id },
      data: {
        timesReviewed: updatedReviewsCount,
        lastReviewedDate: new Date()
      }
    });

    res.json(updatedSnippet);
  } catch (error) {
    res.status(500).json({ error: "Failed to update review record metrics" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 BiteSize Backend Engine successfully executing on port ${PORT}`);
});