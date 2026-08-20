import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

// Mock the prisma client module
vi.mock('../src/db/prisma.js', () => {
  return {
    prisma: {
      snippet: {
        findMany: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $queryRaw: vi.fn(),
    },
    pool: {
      end: vi.fn(),
    },
  };
});

describe('BiteSize API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Health Check Endpoint
  describe('GET /api/health', () => {
    it('should return 200 OK with status and timestamp', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  // 2. Snippet Retrieval & Search Endpoints
  describe('GET /api/snippets', () => {
    it('should return all snippets ordered by createdAt desc', async () => {
      const mockSnippets = [
        {
          id: '1',
          title: 'React Hooks Overview',
          bodyText: 'useState and useEffect explanation',
          languageTags: ['react', 'typescript'],
          timesReviewed: 0,
          lastReviewedDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      vi.mocked(prisma.snippet.findMany).mockResolvedValue(mockSnippets as any);

      const response = await request(app).get('/api/snippets');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('React Hooks Overview');
    });

    it('should correctly filter snippets by search term', async () => {
      vi.mocked(prisma.snippet.findMany).mockResolvedValue([]);

      const response = await request(app).get('/api/snippets?search=react hooks');
      expect(response.status).toBe(200);
      expect(prisma.snippet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              {
                OR: [
                  { title: { contains: 'react hooks', mode: 'insensitive' } },
                  { bodyText: { contains: 'react hooks', mode: 'insensitive' } },
                ],
              },
            ]),
          },
        })
      );
    });

    it('should filter snippets by language tag', async () => {
      vi.mocked(prisma.snippet.findMany).mockResolvedValue([]);

      const response = await request(app).get('/api/snippets?tag=TypeScript');
      expect(response.status).toBe(200);
      expect(prisma.snippet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              {
                languageTags: {
                  has: 'typescript',
                },
              },
            ]),
          },
        })
      );
    });
  });

  // 3. Snippet Creation Endpoint
  describe('POST /api/snippets', () => {
    it('should create a new snippet with lowercase tags and return 201 Created', async () => {
      const newSnippetData = {
        title: 'Express Error Middleware',
        bodyText: 'How to handle central errors in Express',
        languageTags: ['Express', 'NodeJS'],
      };

      const createdSnippet = {
        id: '2',
        title: newSnippetData.title,
        bodyText: newSnippetData.bodyText,
        languageTags: ['express', 'nodejs'],
        timesReviewed: 0,
        lastReviewedDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      vi.mocked(prisma.snippet.create).mockResolvedValue(createdSnippet as any);

      const response = await request(app)
        .post('/api/snippets')
        .send(newSnippetData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', '2');
      expect(response.body.languageTags).toEqual(['express', 'nodejs']);
    });

    it('should return 400 Bad Request when required title or bodyText is missing', async () => {
      const invalidData = { title: '' };

      const response = await request(app)
        .post('/api/snippets')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('required params');
    });
  });

  // 4. Spaced Repetition Review Deck Endpoint
  describe('GET /api/review/daily', () => {
    it('should execute raw SQL query to fetch daily due review cards', async () => {
      const mockQueue = [
        {
          id: '1',
          title: 'Prisma Raw Query',
          bodyText: 'Using $queryRaw for relational interval math',
          timesReviewed: 1,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockQueue as any);

      const response = await request(app).get('/api/review/daily');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });
  });

  // 5. Update Review Rating Endpoint
  describe('POST /api/review/:id', () => {
    it('should increment timesReviewed when rating is "easy"', async () => {
      const existingSnippet = {
        id: 'snippet-123',
        title: 'Algorithms',
        timesReviewed: 2,
      };

      vi.mocked(prisma.snippet.findUnique).mockResolvedValue(existingSnippet as any);
      vi.mocked(prisma.snippet.update).mockResolvedValue({
        ...existingSnippet,
        timesReviewed: 3,
        lastReviewedDate: new Date().toISOString(),
      } as any);

      const response = await request(app)
        .post('/api/review/snippet-123')
        .send({ performanceRating: 'easy' });

      expect(response.status).toBe(200);
      expect(prisma.snippet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'snippet-123' },
          data: expect.objectContaining({
            timesReviewed: 3,
          }),
        })
      );
    });

    it('should reset timesReviewed to 0 when rating is "hard"', async () => {
      const existingSnippet = {
        id: 'snippet-123',
        title: 'Algorithms',
        timesReviewed: 5,
      };

      vi.mocked(prisma.snippet.findUnique).mockResolvedValue(existingSnippet as any);
      vi.mocked(prisma.snippet.update).mockResolvedValue({
        ...existingSnippet,
        timesReviewed: 0,
        lastReviewedDate: new Date().toISOString(),
      } as any);

      const response = await request(app)
        .post('/api/review/snippet-123')
        .send({ performanceRating: 'hard' });

      expect(response.status).toBe(200);
      expect(prisma.snippet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'snippet-123' },
          data: expect.objectContaining({
            timesReviewed: 0,
          }),
        })
      );
    });

    it('should return 404 Not Found if snippet does not exist', async () => {
      vi.mocked(prisma.snippet.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/review/non-existent-id')
        .send({ performanceRating: 'easy' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toBe('Record not found');
    });
  });
});
