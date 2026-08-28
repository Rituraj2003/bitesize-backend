import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { generateToken } from '../src/utils/auth.js';

// Mock the prisma client module
vi.mock('../src/db/prisma.js', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      snippet: {
        findMany: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
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
  const testUserId = 'test-user-id-123';
  const authToken = generateToken(testUserId);
  const authHeader = `Bearer ${authToken}`;

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

  // 2. Authentication Endpoints
  describe('POST /api/auth/register', () => {
    it('should register a new user and return user object with JWT token', async () => {
      const newUser = {
        id: testUserId,
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(newUser as any);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
    });
  });

  // 3. Snippet Retrieval & Search Endpoints
  describe('GET /api/snippets', () => {
    it('should return 401 Unauthorized if authorization header is missing', async () => {
      const response = await request(app).get('/api/snippets');
      expect(response.status).toBe(401);
    });

    it('should return user snippets ordered by createdAt desc when authenticated', async () => {
      const mockSnippets = [
        {
          id: '1',
          title: 'React Hooks Overview',
          bodyText: 'useState and useEffect explanation',
          languageTags: ['react', 'typescript'],
          timesReviewed: 0,
          userId: testUserId,
          lastReviewedDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      vi.mocked(prisma.snippet.findMany).mockResolvedValue(mockSnippets as any);

      const response = await request(app)
        .get('/api/snippets')
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('React Hooks Overview');
    });

    it('should correctly filter snippets by search term', async () => {
      vi.mocked(prisma.snippet.findMany).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/snippets?search=react hooks')
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(prisma.snippet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { userId: testUserId },
              {
                OR: [
                  { title: { search: 'react&hooks' } },
                  { bodyText: { search: 'react&hooks' } },
                ],
              },
            ]),
          },
        })
      );
    });
  });

  // 4. Snippet Creation Endpoint
  describe('POST /api/snippets', () => {
    it('should create a new snippet attached to authenticated user and return 201 Created', async () => {
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
        userId: testUserId,
        lastReviewedDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      vi.mocked(prisma.snippet.create).mockResolvedValue(createdSnippet as any);

      const response = await request(app)
        .post('/api/snippets')
        .set('Authorization', authHeader)
        .send(newSnippetData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id', '2');
      expect(response.body.languageTags).toEqual(['express', 'nodejs']);
    });
  });

  // 5. Spaced Repetition Review Deck Endpoint
  describe('GET /api/review/daily', () => {
    it('should execute raw SQL query to fetch daily due review cards for authenticated user', async () => {
      const mockQueue = [
        {
          id: '1',
          title: 'Prisma Raw Query',
          bodyText: 'Using $queryRaw for relational interval math',
          timesReviewed: 1,
          userId: testUserId,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockQueue as any);

      const response = await request(app)
        .get('/api/review/daily')
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });
  });

  // 6. Update Review Rating Endpoint
  describe('POST /api/review/:id', () => {
    it('should increment timesReviewed when rating is "easy"', async () => {
      const existingSnippet = {
        id: 'snippet-123',
        title: 'Algorithms',
        timesReviewed: 2,
        userId: testUserId,
      };

      vi.mocked(prisma.snippet.findFirst).mockResolvedValue(existingSnippet as any);
      vi.mocked(prisma.snippet.update).mockResolvedValue({
        ...existingSnippet,
        timesReviewed: 3,
        lastReviewedDate: new Date().toISOString(),
      } as any);

      const response = await request(app)
        .post('/api/review/snippet-123')
        .set('Authorization', authHeader)
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

    it('should return 404 Not Found if snippet does not exist', async () => {
      vi.mocked(prisma.snippet.findFirst).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/review/non-existent-id')
        .set('Authorization', authHeader)
        .send({ performanceRating: 'easy' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toBe('Record not found');
    });
  });
});
