# EduAlert

EduAlert is an early academic warning system that helps students and educators notice academic concerns and respond with timely support.

## Problem Statement

Students may not recognize academic difficulties until they affect major assessments. Information and support can also be spread across different systems, making it harder to follow progress and take an early, constructive next step.

## Proposed Solution

EduAlert provides a web application and API for student accounts, attendance records, and private document uploads. An optional AI writing assistant can suggest a continuation to a student's learning reflection. The application is designed to grow into a broader early-warning and intervention platform.

## Technology Stack

- **Frontend:** React 19, Vite, JavaScript, and CSS
- **Backend:** Node.js, Express 5, and JavaScript
- **Database:** MongoDB with Mongoose
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
                    ├── MongoDB Atlas (accounts and attendance)
                    ├── Private uploaded files (API storage)
                    ├── Google token verification (optional)
                    └── OpenAI Chat Completions (optional)
```

In local development, Vite proxies API requests to the Express server. In production, Netlify forwards `/api/*` to Render. The API validates requests, enforces bearer-token authentication on protected routes, and uses Mongoose to read or update MongoDB. AI provider credentials are configured only on the API server; the browser receives a suggestion, never the provider key.

## Key Features

- Student account registration, username/password sign-in, and protected profile access
- Optional Google sign-in when an OAuth client ID is configured
- Authenticated student document upload, listing, and download
- Attendance record creation, retrieval, and updates with owner/faculty authorization checks
- Faculty-only user listing and permitted account updates
- Optional AI continuation suggestions for a student-written reflection, with a review-before-use workflow
- Bruno examples for the documented REST endpoints
- Jest/Supertest tests for API behavior
- Docker Compose setup for the client, API, and local MongoDB

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

The frontend is configured to proxy `/api/*` requests to the Render API. The API requires a reachable MongoDB instance configured through Render's environment settings. Google sign-in and AI autocomplete each require their respective server/client configuration.

The public frontend returned its application page during verification, the API health endpoint returned its running message, and a safe login request with invalid credentials returned `401` (the expected authentication result rather than a database connection error). Feature changes on this submission branch are not live until the branch is merged and the services are redeployed.

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

- Expand the frontend into dedicated student and faculty progress dashboards.
- Add trend-based early-warning indicators and faculty intervention workflows.
- Add API rate limiting, structured monitoring, and operational alerts.
- Add end-to-end coverage for deployed authentication and student workflows.
- Configure and verify the optional AI provider in the deployed environment.

## Contributors

- [@Kowshick0527](https://github.com/Kowshick0527) — repository owner

## Known Limitations

- AI autocomplete is optional and returns a configuration error until `OPENAI_API_KEY` is set on the API server.
- The AI autocomplete implementation on this branch is not available from the current public deployment until the branch is merged and redeployed.
- Google sign-in requires OAuth client configuration and an authorized frontend origin.
- Uploaded files use API-server storage in the current deployment; a durable object-storage service would be preferable for a production multi-instance deployment.
- The public API health route confirms that the API process responds. Database-backed routes should also be checked when validating the live database connection.
