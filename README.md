# Print Ledger Assistant

Print Ledger Assistant is a kiosk-based 3D print lab management system that combines student swipe authentication, printer authorization, unauthorized print sniping, live job logging, and filament tracking in one workflow.

It is designed to give labs a lightweight control layer without requiring proprietary printer hardware, premium printers, or separate spool readers.

## Placeholder visuals

> Placeholder: add project badge row here  
> Example: build status, demo link, hackathon badge, team badge

> Placeholder: add hero screenshot or kiosk photo here

> Placeholder: add architecture diagram here

> Placeholder: add workflow / pipeline graphic here

## What it does

Print Ledger Assistant currently supports five core features:

1. Student authentication by magnetic card swipe
2. Student print log collection before a print session starts
3. Timed printer authorization for a selected printer
4. Auto-snipe of unauthorized printer activity with `~M26`
5. Live filament tracking per printer without proprietary hardware

## Why this exists

Many student print labs still rely on paper logs, manual oversight, and trust-based printer usage. That leads to a few recurring problems:

- students skip logging prints
- staff cannot easily see what is running from one kiosk
- printers can be started without an approved session
- there is no reliable connection between a student, a printer, and a job
- filament usage is hard to track without expensive or proprietary systems

Print Ledger Assistant addresses that by treating the kiosk as the point of coordination between the student, the database, and the printer watchdog.

## Current product scope

### Student side

- swipe into the kiosk with a magnetic card reader
- land on the student print page
- enter required job details
- see printer availability before starting
- see filament availability per printer
- start a timed print session
- review recent personal job history

### Admin side

- swipe into the admin dashboard
- see active printers and printer attention items
- open printer diagnostics
- review snipe events
- configure print time limits
- manage filament inventory
- assign one active spool per printer

### Watchdog side

- poll printers over raw TCP
- inspect `~M27` activity responses
- inspect `~M105` temperature responses
- classify printer state as idle, heating, printing, offline, or unknown
- authorize supervised print sessions
- auto-snipe unauthorized heating/printing activity with `~M26`

## How it works

### 1. Kiosk authentication

The card reader behaves like a keyboard. The kiosk listens for a full track-data burst, sends it to the backend, and the backend:

- parses the swipe
- looks up the student in Supabase
- creates the student if needed
- refreshes the stored name if the swipe data changed

### 2. Student session start

The student fills out the form, selects a printer, and starts a print session.

The backend uses a single combined request to:

- create the `jobs` record
- authorize the selected printer

This prevents the old race condition where the printer could begin heating before authorization was attached.

### 3. Printer authorization window

Once a student starts a session, the printer is authorized for a short USB connection window.

Current default:

- print session start window: 2 minutes

### 4. Watchdog and auto-snipe

The watchdog runs in the backend and polls printers every second.

Current live command flow:

- `~M27` for printer activity / print-state hints
- `~M105` for temperature telemetry
- `~M26` for auto-snipe on unauthorized activity

If the backend sees unauthorized bed heating or printing activity, it sends `~M26` once per incident and waits for the printer to settle back to idle.

### 5. Filament tracking

Each printer can have one active spool in the system.

The application uses that relationship to:

- show usable grams left on the student printer picker
- block jobs that exceed available filament
- let admins manage spool inventory centrally
- track spool assignment and usage through events

This gives the lab live filament visibility without relying on proprietary spool readers or more expensive printers.

## Tech stack

### Frontend

- React
- TypeScript
- Vite
- React Router

### Backend

- Node.js
- TypeScript
- Express
- Supabase client

### Data and infrastructure

- Supabase Postgres
- raw TCP printer communication via Node `net`
- magnetic card reader input

## Project structure

```text
Print-Ledger-Assistant/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── types.ts
│   ├── package.json
│   └── vite.config.ts
├── server/
│   ├── sql/
│   │   └── filament_tracking.sql
│   ├── src/
│   │   ├── routes/
│   │   ├── db.ts
│   │   ├── filament.ts
│   │   ├── print-policy.ts
│   │   ├── printer-status.ts
│   │   ├── radar.ts
│   │   └── server.ts
│   ├── .env.example
│   └── package.json
├── rules.md
└── README.md
```

## Local development

### Prerequisites

- Node.js
- npm
- a Supabase project
- at least one printer record in Supabase
- optional: a compatible magnetic card reader

### 1. Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 2. Configure the backend environment

Copy the server example environment file and fill in your real values:

```bash
cd server
cp .env.example .env
```

Expected variables:

```env
PORT=3000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-long-anon-key-string-goes-here
```

### 3. Create / update the database schema

At minimum, the app expects the following Supabase tables:

- `students`
- `printers`
- `jobs`
- `events`

For filament tracking, also run:

- `server/sql/filament_tracking.sql`

> Placeholder: add a schema diagram or table relationship graphic here

### 4. Start the backend

```bash
cd server
npm run dev
```

Expected local backend URL:

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

### 5. Start the frontend

```bash
cd client
npm run dev
```

Expected local frontend URL:

- [http://127.0.0.1:3001](http://127.0.0.1:3001)

## Important runtime behavior

### Ports

- frontend: `3001`
- backend: `3000`

### Current print policy defaults

- student printer start window: 2 minutes
- inactivity timeout: 3 minutes
- max declared print time: 5 hours

### Filament behavior

- one active spool per printer
- students can see filament status before selecting a printer
- printers without enough usable filament are visible but not selectable

## Key routes

### Frontend routes

- `/kiosk`
- `/student`
- `/admin`
- `/printers`
- `/filament`

### Backend routes

- `POST /auth/swipe`
- `GET /jobs/student/:studentId`
- `POST /jobs`
- `POST /jobs/session`
- `GET /printers/status`
- `POST /printers/:printerId/authorize`
- `POST /printers/:printerId/deauthorize`
- `GET /events`
- `GET /filament/spools`
- `POST /filament/spools`
- `PATCH /filament/spools/:spoolId`
- `GET /filament/events`
- `GET /settings/printing`
- `PATCH /settings/printing`

## Notes on printer compatibility

The watchdog logic is tuned to the current printer link behavior in this repo.

Important assumptions:

- printers answer on raw TCP
- `~M27` and `~M105` are available
- `~M26` is accepted as the abort command for the tested printer path

If printer firmware or protocol changes, the watchdog parsing and command assumptions may need to be updated.

## Repo guidance

The repo uses [rules.md](./rules.md) as the current agent-facing source of truth for:

- system behavior
- UI constraints
- cleanup rules
- AI implementation guardrails

If `README.md` and `rules.md` ever drift, update both.

## Roadmap placeholders

> Placeholder: add product roadmap graphic here

Potential next areas:

- stronger printer compatibility profiling
- better duration anomaly detection
- richer student/admin analytics
- more automated job-to-filament reconciliation
- CI pipeline and deployment docs

## Demo placeholders

> Placeholder: add kiosk swipe screenshot  
> Placeholder: add student print form screenshot  
> Placeholder: add admin dashboard screenshot  
> Placeholder: add printer diagnostics screenshot  
> Placeholder: add filament tracker screenshot

## Pipeline placeholder

> Placeholder: add CI/CD section here  
> Suggested content later:

- lint / typecheck job
- server build
- client build
- preview deployment
- release flow

## License

See [LICENSE](./LICENSE).
