import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/health - Health check endpoint for CI/CD & monitoring
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/snippets - Fetch all snippets with PostgreSQL Full-Text Search and tag filtering
 */
router.get('/snippets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, tag } = req.query;

    const queryOptions: any = {
      orderBy: { createdAt: 'desc' },
    };

    const conditions: any[] = [];

    // Safe Full-Text Search Token Filter
    if (search && typeof search === 'string' && search.trim() !== '') {
      // Sanitize special Postgres search characters to prevent syntax errors
      const sanitized = search
        .trim()
        .replace(/[&|!():*]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .join(' & ');

      if (sanitized) {
        conditions.push({
          OR: [
            { title: { search: sanitized } },
            { bodyText: { search: sanitized } },
          ],
        });
      }
    }

    // Multi-tag relational scanning
    if (tag && typeof tag === 'string' && tag !== 'all') {
      conditions.push({
        languageTags: {
          has: tag.toLowerCase(),
        },
      });
    }

    if (conditions.length > 0) {
      queryOptions.where = { AND: conditions };
    }

    const snippets = await prisma.snippet.findMany(queryOptions);
    logger.info(`Retrieved ${snippets.length} snippets`, { count: snippets.length, search, tag });
    res.json(snippets);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/snippets - Create a new code snippet
 */
router.post('/snippets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, bodyText, languageTags } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '' || !bodyText || typeof bodyText !== 'string' || bodyText.trim() === '') {
      throw new AppError('Title and BodyText fields are required params.', 400);
    }

    const tags = Array.isArray(languageTags)
      ? languageTags.filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase())
      : [];

    const newSnippet = await prisma.snippet.create({
      data: {
        title: title.trim(),
        bodyText: bodyText.trim(),
        languageTags: tags,
      },
    });

    logger.info(`Snippet created successfully with ID: ${newSnippet.id}`, { snippetId: newSnippet.id, title: newSnippet.title });
    res.status(201).json(newSnippet);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/review/daily - Daily spaced-repetition retrieval engine
 */
router.get('/review/daily', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const BASE_INTERVAL_MULTIPLIER = 3;

    const reviewQueue: any[] = await prisma.$queryRaw`
      SELECT * FROM "Snippet"
      WHERE "lastReviewedDate" + ("timesReviewed" * ${BASE_INTERVAL_MULTIPLIER} * INTERVAL '1 day') <= ${today}
      ORDER BY "lastReviewedDate" ASC
      LIMIT 5;
    `;

    logger.info(`Retrieved ${reviewQueue.length} daily review cards`, { queueSize: reviewQueue.length });
    res.json(reviewQueue);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/review/:id - Update review performance rating for a snippet
 */
router.post('/review/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params['id'];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { performanceRating } = req.body;

    if (!id) {
      throw new AppError('Snippet ID parameter is required', 400);
    }

    const currentSnippet = await prisma.snippet.findUnique({ where: { id } });
    if (!currentSnippet) {
      throw new AppError('Record not found', 404);
    }

    let updatedReviewsCount = currentSnippet.timesReviewed;

    if (performanceRating === 'easy') {
      updatedReviewsCount += 1;
    } else {
      updatedReviewsCount = 0;
    }

    const updatedSnippet = await prisma.snippet.update({
      where: { id },
      data: {
        timesReviewed: updatedReviewsCount,
        lastReviewedDate: new Date(),
      },
    });

    logger.info(`Updated review score for snippet ID ${id}`, { snippetId: id, rating: performanceRating, timesReviewed: updatedReviewsCount });
    res.json(updatedSnippet);
  } catch (error) {
    next(error);
  }
});

export default router;
