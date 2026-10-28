# EduAlert

EduAlert is an academic progress tracker focused on student attendance, course grades, and project scores. It gives students and educators a single place to record and review the signals that can reveal when a student needs support.

## Problem Statement

Attendance, assessment results, and project performance are often tracked in separate places. Without a clear view of these measures together, students and educators may miss patterns of declining engagement or achievement until it is too late to respond constructively.

## Proposed Solution

EduAlert centers the student dashboard on attendance by subject, grade and assessment results, and project scores. Students can record and review their own progress; faculty accounts can select students and enter or review their records. The API validates score and attendance ranges and calculates attendance percentages from the class counts. Supporting tools such as document uploads and optional AI reflection autocomplete are secondary to the tracking workflow.

## Technology Stack

- **Frontend:** React 19, Vite, JavaScript, and CSS
- **Backend:** Node.js, Express 5, and JavaScript
- **Database:** MongoDB with Mongoose; attendance and performance records reference their student account
- **Authentication:** JWT bearer tokens, bcrypt password hashing, and optional Google OAuth
- **AI autocomplete:** Optional server-side OpenAI Chat Completions API integration
- **Testing:** Jest and Supertest
- **API documentation:** Bruno
- **Deployment:** Netlify (frontend), Render (API), and MongoDB Atlas (database)
- **Containerization:** Docker and Docker Compose

## Architecture Overview

```text
Browser
  └── React single-page application (Netlify)
        └── /api requests
              └── Express REST API (Render)
                    ├── MongoDB Atlas (accounts, attendance, grades, and projects)
                    ├── Private uploaded files (API storage)
                    ├── Google token verification (optional)
                    └── OpenAI Chat Completions (optional)
```

In local development, Vite proxies API requests to the Express server. In production, Netlify forwards `/api/*` to Render. The API validates requests, enforces bearer-token authentication on protected routes, and uses Mongoose to read or update MongoDB. AI provider credentials are configured only on the API server; the browser receives a suggestion, never the provider key.

## Key Features

- Student account registration, username/password sign-in, and protected profile access
- Optional Google sign-in when an OAuth client ID is configured
- Attendance dashboard with per-subject rates, attended/total counts, and calculated aggregate attendance
- Grade/assessment and project score tracking with score/max, percentages, and category averages
- Student-owned academic records and faculty workflows to select students and enter/review records
- Server-side validation for attendance counts and score ranges, with owner/faculty authorization
- Authenticated student document upload, listing, and download
- Optional AI continuation suggestions for a student-written reflection, available as a secondary tool
- Bruno examples for the documented REST endpoints
- Jest/Supertest tests for API behavior
- Docker Compose setup for the client, API, and local MongoDB

### Academic tracking workflow

1. Sign in to open the progress dashboard.
2. Record attendance by subject using attended and total class counts; EduAlert calculates the percentage.
3. Add a grade/assessment or a project score with its subject, name, earned marks, and maximum marks.
4. Review the attendance rate, grade average, project average, and individual records. Faculty accounts can choose a student before entering records.

## Installation Instructions

Requirements: Node.js 20 or newer, npm, and MongoDB (local or hosted). Docker Desktop is an alternative for running the complete local stack.

Install dependencies from the repository root:

```powershell
npm install --prefix server
npm install --prefix client
```

## Environment Setup

Create a private API environment file from the template:

```powershell
Copy-Item server/.env.example server/.env
```

Set the following values in `server/.env`:

| Variable | Required | Description |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB connection string for the application database |
| `JWT_SECRET` | Yes | Private random secret of at least 32 characters |
| `PORT` | No | API port; defaults to `5000` locally (Render supplies its own value) |
| `GOOGLE_CLIENT_ID` | No | OAuth client ID used to enable Google sign-in |
| `OPENAI_API_KEY` | No | Server-side key required to enable AI reflection autocomplete |
| `OPENAI_MODEL` | No | Model available to the configured key; defaults to `gpt-4o-mini` |

Never commit `.env`, `.env.docker`, OAuth secrets, database credentials, or API keys. The frontend can use `VITE_GOOGLE_CLIENT_ID` in `client/.env.local` for the public Google sign-in client ID; do not put a client secret or AI provider key in a `VITE_*` variable.

For Docker, copy `.env.docker.example` to `.env.docker`, set a private `JWT_SECRET`, and add optional Google/AI settings if needed. Docker Compose provides its own local MongoDB URL to the API.

## Running the Project

### Run the API and frontend separately

Start the API (with MongoDB running and configured in `server/.env`):

```powershell
npm run dev --prefix server
```

In a second terminal, start the frontend:

```powershell
npm run dev --prefix client
```

Open the Vite URL shown in the client terminal. The Vite development server proxies `/api` requests to the local API.

### Run with Docker Compose

```powershell
Copy-Item .env.docker.example .env.docker
docker compose up --build
```

Open `http://localhost:8080`. Stop the services with `Ctrl+C` or `docker compose down`; named MongoDB and upload volumes are retained.

### Tests and production build

```powershell
npm test --prefix server
npm run build --prefix client
```

## Deployment Links

- **Frontend:** [https://cute-chebakia-cfbd91.netlify.app](https://cute-chebakia-cfbd91.netlify.app)
- **Backend health endpoint:** [https://edualert-api.onrender.com](https://edualert-api.onrender.com)
- **API request examples:** the [`bruno/`](./bruno/) collection in this repository

The frontend is configured to proxy `/api/*` requests to the Render API. The API requires a reachable MongoDB instance configured through Render's environment settings. The public deployment reflects the last deployed revision; changes on the open submission branch are not live until merged and redeployed. Google sign-in and AI autocomplete each require their respective server/client configuration.

The public frontend returned its application page during verification, the API health endpoint returned its running message, and a safe login request with invalid credentials returned `401` (the expected authentication result rather than a database connection error).

## Folder Structure

```text
.
├── bruno/                  # Bruno collection, environment, and API requests
├── client/                 # React/Vite frontend and frontend Dockerfile
│   └── src/
│       ├── assets/
│       └── components/
├── server/                 # Express API, Mongoose models, middleware, and tests
│   ├── middleware/
│   ├── models/
│   └── tests/
├── Dockerfile              # API image
├── docker-compose.yml      # Local API, client, and MongoDB services
└── netlify.toml            # Netlify build, API proxy, and SPA fallback
```

## Future Improvements

- Add trend charts and configurable early-warning thresholds based on attendance, grades, and project results.
- Add faculty intervention notes and follow-up tracking when students need support.
- Add API rate limiting, structured monitoring, and operational alerts.
- Add end-to-end coverage for deployed authentication and student workflows.
- Configure and verify the optional AI provider in the deployed environment.

## Contributors

- [@Kowshick0527](https://github.com/Kowshick0527) — repository owner

## Known Limitations

- AI autocomplete is optional and returns a configuration error until `OPENAI_API_KEY` is set on the API server.
- The AI autocomplete implementation on this branch is not available from the current public deployment until the branch is merged and redeployed.
- Faculty accounts must be provisioned by an administrator; public account registration creates student accounts only.
- Google sign-in requires OAuth client configuration and an authorized frontend origin.
- Uploaded files use API-server storage in the current deployment; a durable object-storage service would be preferable for a production multi-instance deployment.
- Data entry is currently manual; EduAlert does not yet import class rosters, attendance registers, or scores from an institutional system.
- Automated early-warning thresholds and intervention workflows are future improvements, not currently implemented.
- Uploaded files use API-server storage in the current deployment; a durable object-storage service would be preferable for a production multi-instance deployment.
