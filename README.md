# EduAlert – Early Academic Warning System

EduAlert is an early academic warning system designed to help college students and faculty identify declining academic performance before examinations.

## Mock UX Design

Figma Link:
https://pluck-vivid-59634963.figma.site

This Mock UX demonstrates the application's primary screens, navigation flow, and major user journeys.

The design covers student and faculty dashboards, attendance and assessment monitoring, early warning alerts, at-risk student identification, and faculty intervention tracking.

## Run locally

1. Install the API dependencies and create its environment file:

	```powershell
	npm install --prefix server
	Copy-Item server/.env.example server/.env
	```

2. In `server/.env`, set `MONGO_URI` to a running MongoDB database and replace `JWT_SECRET` with a random secret of at least 32 characters. Keep this file private.
3. To enable Google sign-in, create a Google OAuth client ID for a Web application. Add `http://localhost:5173` as an authorized JavaScript origin, then set the same client ID as `GOOGLE_CLIENT_ID` in `server/.env` and `VITE_GOOGLE_CLIENT_ID` in `client/.env.local`. Never put a client secret in the frontend.
4. Start the API:

	```powershell
	npm run dev --prefix server
	```

5. In a second terminal, install and start the client:

	```powershell
	npm install --prefix client
	npm run dev --prefix client
	```

Open the Vite URL shown in the client terminal. Users can create a student account with a name, email, username, and password, then sign in with their username and password or Google. Passwords are stored as bcrypt hashes. Google ID tokens are verified by the API before issuing the application's JWT. Authentication endpoints are `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/google`, and the bearer-token protected `GET /api/auth/me`.

Mock UX Status: Completed and published.

## Backend deployment

The EduAlert API is deployed on Render: [https://edualert-api.onrender.com](https://edualert-api.onrender.com). Its `GET /` health endpoint returns `{"message":"EduAlert API is running"}`.

The Render web service is configured with `server/` as its root directory, `npm install` as its build command, and `npm start` as its start command. Render supplies the `PORT` environment variable at runtime.

Set these values in the Render service's environment settings; do not commit them to the repository:

- `MONGO_URI`: the connection string for the hosted MongoDB database.
- `JWT_SECRET`: a private random secret of at least 32 characters.
- `GOOGLE_CLIENT_ID` (optional): the Google OAuth client ID used to enable Google sign-in.

The MongoDB deployment must allow connections from the Render service. Keep database credentials and all other secret values private.

## Student document uploads

After signing in, students can upload PDF, PNG, and JPEG documents up to 5 MB from their student space. Uploads are stored under `server/uploads` (excluded from Git), and each document's metadata is associated with its owner in MongoDB. The authenticated `GET /api/files` endpoint lists the current user's documents, while `GET /api/files/:id/download` serves only files owned by the signed-in user.
