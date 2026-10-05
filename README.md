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
3. Start the API:

	```powershell
	npm run dev --prefix server
	```

4. In a second terminal, install and start the client:

	```powershell
	npm install --prefix client
	npm run dev --prefix client
	```

Open the Vite URL shown in the client terminal. Users can create a student account with a name, email, username, and password, then sign in with their username and password. Passwords are stored as bcrypt hashes. Authentication endpoints are `POST /api/auth/register`, `POST /api/auth/login`, and the bearer-token protected `GET /api/auth/me`.

Mock UX Status: Completed and published.