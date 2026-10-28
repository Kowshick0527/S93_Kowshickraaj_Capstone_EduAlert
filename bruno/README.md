# EduAlert API - Bruno collection

This collection documents all 15 HTTP endpoints currently defined by `server/server.js`.

## Run locally

1. Start the API using the steps in the repository README. The default API URL is `http://localhost:5000`.
2. Open the `bruno` folder in Bruno and select the `Local` environment.
3. Run **Register account** or **Register account (users alias)** with a unique email and username, then copy the returned `token` into the environment's `token` variable.
4. For authenticated requests, use a student token. Faculty-only operations such as listing users require a faculty account/token.
5. To test Google sign-in, replace `googleCredential` with a valid Google ID token for the configured OAuth client. The upload example sends a minimal PDF header; change `name`, `contentType`, and `data` together when testing PNG or JPEG files.
6. Copy returned IDs into `userId`, `fileId`, or `attendanceId` before running the related requests. Use the response body for JSON endpoints and the downloaded response for the file download endpoint.

The collection uses only sample values and contains no credentials. Requests requiring authentication send `Authorization: Bearer {{token}}`.

## Endpoint index

| Method | Path | Access |
| --- | --- | --- |
| GET | `/` | Public |
| POST | `/api/auth/register` | Public |
| POST | `/api/users` | Public registration alias |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/google` | Public; Google OAuth must be configured |
| GET | `/api/auth/me` | Authenticated |
| GET | `/api/files` | Authenticated; own files |
| POST | `/api/files` | Authenticated; own files, PDF/PNG/JPEG up to 5 MB |
| GET | `/api/files/:id/download` | Authenticated; own files |
| POST | `/api/ai/autocomplete` | Authenticated; requires the server-side AI provider key |
| GET | `/api/users` | Faculty |
| PUT | `/api/users/:id` | Authenticated; own account or faculty |
| POST | `/api/attendance` | Authenticated; own record or faculty |
| GET | `/api/attendance` | Authenticated; own records or faculty |
| PUT | `/api/attendance/:id` | Authenticated; own record or faculty |
