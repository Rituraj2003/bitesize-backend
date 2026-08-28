import { Router, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/health - Health check endpoint for CI/CD & monitoring
 */
router.get('/health', (_req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/snippets - Fetch user snippets with PostgreSQL Full-Text Search and tag filtering
 */
router.get('/snippets', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { search, tag } = req.query;

    const queryOptions: any = {
      orderBy: { createdAt: 'desc' },
    };

    const conditions: any[] = [
      { userId: req.userId! },
    ];

    // Flexible Search Filter (supports partial typing like 'r', 're', 'react')
    if (search && typeof search === 'string' && search.trim() !== '') {
      const searchTerm = search.trim();
      const formattedSearch = searchTerm.split(/\s+/).join('&');

      conditions.push({
        OR: [
          { title: { search: formattedSearch } },
          { bodyText: { search: formattedSearch } },
        ],
      });
    }

    // Multi-tag relational scanning
    if (tag && typeof tag === 'string' && tag !== 'all') {
      conditions.push({
        languageTags: {
          has: tag.toLowerCase(),
        },
      });
    }

    queryOptions.where = { AND: conditions };

    const snippets = await prisma.snippet.findMany(queryOptions);
    logger.info(`Retrieved ${snippets.length} snippets for user ${req.userId}`, { count: snippets.length, userId: req.userId, search, tag });
    res.json(snippets);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/snippets - Create a new code snippet attached to the authenticated user
 */
router.post('/snippets', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
        userId: req.userId!,
      },
    });

    logger.info(`Snippet created successfully with ID: ${newSnippet.id} for user ${req.userId}`, { snippetId: newSnippet.id, title: newSnippet.title, userId: req.userId });
    res.status(201).json(newSnippet);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/review/daily - Daily spaced-repetition retrieval engine for authenticated user
 */
router.get('/review/daily', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const BASE_INTERVAL_MULTIPLIER = 3;

    const reviewQueue: any[] = await prisma.$queryRaw`
      SELECT * FROM "Snippet"
      WHERE "userId" = ${req.userId!}
        AND "lastReviewedDate" + ("timesReviewed" * ${BASE_INTERVAL_MULTIPLIER} * INTERVAL '1 day') <= ${today}
      ORDER BY "lastReviewedDate" ASC
      LIMIT 5;
    `;

    logger.info(`Retrieved ${reviewQueue.length} daily review cards for user ${req.userId}`, { queueSize: reviewQueue.length, userId: req.userId });
    res.json(reviewQueue);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/review/:id - Update review performance rating for a snippet
 */
router.post('/review/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params['id'];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { performanceRating } = req.body;

    if (!id) {
      throw new AppError('Snippet ID parameter is required', 400);
    }

    const currentSnippet = await prisma.snippet.findFirst({
      where: {
        id,
        userId: req.userId!,
      },
    });

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

    logger.info(`Updated review score for snippet ID ${id} user ${req.userId}`, { snippetId: id, rating: performanceRating, timesReviewed: updatedReviewsCount, userId: req.userId });
    res.json(updatedSnippet);
  } catch (error) {
    next(error);
  }
});

export default router;
