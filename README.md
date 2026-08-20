# BiteSize Backend — Micro-Learning & Flashcard Code Snippet Platform

BiteSize is a full-stack developer micro-learning platform that converts code snippets into interactive spaced-repetition flashcards with native PostgreSQL Full-Text Search.

---

## 🏗 System Architecture

```
[ React + TypeScript Frontend ]  (Deployed on Vercel)
               │
               ▼  HTTPS / REST API
[ Node.js + Express Backend ]    (Deployed on Render)
               │
               ▼  pg Pool / Prisma ORM 7
[ Neon PostgreSQL Cloud DB ]     (Serverless Postgres)
```

---

## 🛠 Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React |
| **Backend Core** | Node.js (ESM), Express 5, TypeScript |
| **Database & ORM** | Neon PostgreSQL, Prisma ORM 7 (`@prisma/adapter-pg`), PostgreSQL FTS |
| **Testing & CI/CD** | Vitest, Supertest, GitHub Actions CI, Render & Vercel Auto-deploy |

---

## 🚀 Key Engineering Implementations

### 1. PostgreSQL Full-Text Search (FTS)
Instead of expensive fuzzy searches or `LIKE '%term%'` full table scans, BiteSize leverages native PostgreSQL Full-Text Search via Prisma.
- Query tokens are sanitized against special syntax operators (`&`, `|`, `!`, `:`, `*`).
- Generates `tsquery` boolean combinations across indexed `title` and `bodyText` fields.
- Tag filters leverage PostgreSQL relational array operations (`languageTags: { has: tag }`).

### 2. Spaced-Repetition Review Algorithm
The scheduling engine determines card review eligibility using raw SQL relational interval math:

$$\text{Next Review Date} = \text{lastReviewedDate} + (\text{timesReviewed} \times 3 \times \text{INTERVAL '1 day'})$$

- **Performance Rating "Easy"**: Increments `timesReviewed` count by 1, pushing the next review date exponentially further.
- **Performance Rating "Hard"**: Resets `timesReviewed` count back to 0, placing the card back into the daily review queue.

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env` in the backend directory:

```bash
cp .env.example .env
```

Define required variables:

```env
DATABASE_URL="postgresql://username:password@ep-example.neon.tech/neondb?sslmode=require"
PORT=5000
NODE_ENV=development
```

---

## 💻 Local Setup & Execution

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

### 5. Start Production Server
```bash
npm start
```

---

## 🧪 Testing Suite

Automated integration testing powered by Vitest and Supertest.

```bash
npm test
```

### Coverage Overview:
- `GET /api/health` — System status and health metrics
- `GET /api/snippets` — Snippet list retrieval, Full-Text Search tokenization, and tag filtering
- `POST /api/snippets` — Snippet creation, input validation (400 Bad Request), tag sanitization
- `GET /api/review/daily` — Spaced repetition retrieval queue
- `POST /api/review/:id` — Rating score updates (`easy`/`hard`) and 404 error handling

---

## 🔄 CI/CD & Deployment Workflow

```
Git Push to main ──► GitHub Actions CI ──► Run Vitest Tests ──► Compile TS ──► Auto-deploy (Render/Vercel)
```

1. **GitHub Actions (`.github/workflows/ci.yml`)**:
   - Triggers on `push` and `pull_request` to `main`.
   - Setup Node 20, installs dependencies (`npm ci`), runs `npx prisma generate`, executes test suite (`npm test`), and verifies production build (`npm run build`).
2. **Automated Deployments**:
   - **Render**: Automatically pulls `main` upon passing CI checks and executes `npm start`.
   - **Vercel**: Automatically builds and serves the Vite bundle from edge CDN nodes.
