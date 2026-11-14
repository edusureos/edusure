# EduSure

EduSure is a responsive student-portal frontend for viewing academic information in one place. The interface includes a sign-in screen and a portal dashboard with profile details, attendance, performance, homework, fee records, events, quick links, and academic navigation.

> **Current project status:** EduSure's sign-in is a client-side demonstration flow. Student records and academic data are not connected to a database or an EduSure backend yet. Empty sections display explanatory messages rather than invented student data or statistics. Do not use real credentials with this prototype.

## Features

- Responsive EduSure sign-in screen with field validation, password visibility, and a forgot-password dialog.
- Student portal dashboard with academic overview, search, date, and notices.
- Dashboard navigation for attendance, timetable, fee submission, progress reports, academic calendar, and notices.
- Profile drawer with Student Name, Class, Date of Birth, Father's Name, and Mobile Number fields. Missing information displays **Not available yet**.
- Empty states for academic information that has not been connected or published.
- Keyboard-accessible dialogs and navigation, with reduced-motion support.

## Technology

- React 19
- Vite 8
- Tailwind CSS 4
- Lucide React icons
- Oxlint

## Project structure

```text
frontend/
  public/                 # EduSure logo, favicon, and static assets
  src/
    Edusure/              # Login, portal, profile, and reusable UI components
    App.jsx               # Login-to-portal application flow
    index.css             # EduSure styles and design tokens
    main.jsx              # React application entry point
  index.html
  package.json
  vite.config.js

backend/                  # Separate  FastAPI service; not an EduSure API
venv/                     # Optional Python environment for the service
```

## Run the EduSure frontend

Requirements: Node.js and npm.

From the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite. The default development URL is:

```text
http://localhost:5173
```

The development server can also be started on a specific local interface and port:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

## Available frontend commands

Run these commands from `frontend/`:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build in `frontend/dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run Oxlint |

## EduSure data and authentication

The current portal does not fetch student profiles or academic records from a database. The login form validates input locally and simulates a successful sign-in; it does not authenticate against a server. Profile fields are prepared to accept future data, but currently show **Not available yet** when values are absent.

Do not treat the dashboard's empty states as live records, and do not enter sensitive credentials. Connecting real authentication and student data requires a dedicated EduSure backend and database integration.

## Existing backend in this repository

The `backend/` directory contains a separate **edusure** FastAPI application for waste-collection routes and analytics. It is not the backend for EduSure's student portal. The Vite configuration proxies `/api` requests to `http://127.0.0.1:8000`, but the EduSure portal currently does not use this API for student data.

To run the separate service, from the project root:

```powershell
.\venv\Scripts\activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Its API documentation is available at `http://127.0.0.1:8000/docs`. Starting this service is not required to run EduSure.
