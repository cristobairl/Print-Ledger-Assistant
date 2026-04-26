# Print Ledger Assistant Rules

This file is the working source of truth for AI agents touching this repo.

If this file conflicts with older notes, old screenshots, or stale docs, trust:

1. `rules.md`
2. the current code in `client/src` and `server/src`
3. the live database schema

## 1. Project purpose

Print Ledger Assistant is a kiosk and watchdog system for a 3D print lab.

It does five core jobs:

1. authenticate students by magnetic card swipe
2. collect a student print log before a session starts
3. authorize one printer for a short window so the student can start the print
4. auto-snipe unauthorized printer activity with `~M26`
5. track live filament availability and usage per printer without proprietary hardware

Filament tracking works by tying each printer to one active spool in the system, then sending that live filament state back to the application so admins can monitor spool availability and usage without proprietary hardware or more expensive printers.

This is not a generic dashboard app. It is a cyber-physical workflow tied to real printer behavior.

## 2. Current architecture

### Frontend

- Framework: React + TypeScript + Vite
- Active routes are defined in `client/src/App.tsx`
- Client dev server is expected on `http://127.0.0.1:3001`

Live client pages:

- `client/src/pages/Kiosk.tsx`
- `client/src/pages/StudentLanding.tsx`
- `client/src/pages/AdminLanding.tsx`
- `client/src/pages/PrinterStatus.tsx`
- `client/src/pages/FilamentInventory.tsx`

Active shared client component:

- `client/src/components/PrinterCard.tsx`

### Backend

- Framework: Node.js + TypeScript + Express
- Server is expected on `http://127.0.0.1:3000`
- App bootstrap is in `server/src/server.ts`

Live backend routes:

- `/auth`
- `/jobs`
- `/printers`
- `/events`
- `/filament`
- `/settings`

Core watchdog logic lives in:

- `server/src/radar.ts`
- `server/src/printer-status.ts`

### Database

Supabase is the source of truth for persisted records:

- `students`
- `printers`
- `jobs`
- `events`
- `filament_spools`
- `filament_events`

Important: live printer authorization state is runtime state in `PrinterRadar`, not persisted in Supabase.

## 3. Active user flows

### Kiosk swipe flow

1. Student swipes card at `/kiosk`
2. Client sends raw swipe data to `POST /auth/swipe`
3. Backend parses track data and upserts the student record
4. Client maps backend snake_case fields into camelCase route state
5. Student goes to `/student`
6. Admin goes to `/admin`

Important:

- The backend auth response currently uses snake_case fields such as `first_name`, `card_id`, `student_id`, and `is_admin`
- The client intentionally maps that response into `LandingState`
- Do not "clean this up" in only one place and break the other side

### Student print session flow

The correct flow is:

1. Student fills out the print form
2. Student selects a printer
3. Client calls `POST /jobs/session`
4. Backend creates the job record and authorizes the printer in the same request
5. Student gets a 2 minute USB connect window

Do not split this back into:

1. `POST /jobs`
2. then `POST /printers/:id/authorize`

That older two-step flow created a race where the printer could heat up before the authorization stuck, which caused false snipes.

### Printer monitoring flow

`PrinterRadar` polls printers every 1 second.

Current behavior:

- activity probe: `~M27`
- telemetry probe: `~M105`
- preferred ports: `8899`, then `8000`
- abort command: `~M26`

Unauthorized `heating` or `printing` can trigger auto-snipe.

Current detection rules are firmware-tuned and intentionally conservative:

- idle is not just "no reply"
- placeholder `~M27` responses are treated carefully
- nozzle-only heat should not act like a real print start
- bed heating is used as the early signal for snipe decisions

Do not casually rewrite printer state detection without testing against the real printer behavior.

## 4. Current policy and timing rules

- Student session authorization window: 2 minutes
- Student/admin inactivity auto-close: 3 minutes
- Default print time limit: 5 hours
- Weekend-specific rules are not enforced right now
- Student form currently ships with hackathon defaults for faster demo entry

If policy changes are needed, prefer using the existing settings/policy path instead of scattering new constants.

## 5. Filament tracking rules

Filament tracking is live and should be treated as part of the product, not demo-only code.

Current rules:

- one active spool per printer
- students can still see printers with missing or low filament
- unassigned or insufficient filament makes a printer unavailable for selection
- usable filament includes a safety buffer
- filament reservation begins when an authorized session enters live printer activity
- final deduction is settled when the print ends or is interrupted

Operational goal:

- filament tracking should work from the existing kiosk, printer link, and database model
- admins should be able to see live spool state in the application
- the system should not depend on proprietary spool readers or premium printer hardware to provide that visibility

Relevant files:

- `server/src/filament.ts`
- `server/src/routes/filament.ts`
- `server/sql/filament_tracking.sql`
- `client/src/pages/FilamentInventory.tsx`

Do not reintroduce spreadsheet-like logic in the client when the backend already owns spool state and event history.

## 6. UI and product guardrails

This app is kiosk-first, not marketing-first.

Keep these product rules:

- no landing-page marketing sections
- no extra nav chrome for student flow
- keep important actions above the fold
- keep copy short and operational
- avoid AI-sounding helper text, over-explanations, and narrated section blurbs
- prefer the existing aesthetic and spacing patterns already in `App.css`

For students:

- the form should be the primary focus
- printer availability must be clear and practical
- avoid showing backend/process explanations that students do not need

For admins:

- active tools and attention items come first
- diagnostics and inventory matter more than decorative copy

## 7. Agent guardrails

If you are an AI agent working in this repo:

### Do

- read the current route tree before adding pages
- reuse existing pages and flows where possible
- keep printer logic in the backend
- keep client state aligned with backend truth
- remove stale prototype files instead of leaving ghost alternatives around
- verify builds after cleanup or refactors

### Do not

- create duplicate versions of the same page
- leave unused prototype files in `client/src`
- add placeholder components that are not routed or used
- reintroduce old Vite starter assets unless they are truly needed
- split the student start-session flow back into multiple requests
- bypass `PrinterRadar` for live printer state
- hardcode fake printers into production logic beyond the existing fallback display behavior
- rename live API fields on one side only
- commit generated `dist` output

## 8. Files that matter most

When changing core behavior, start here:

### Client

- `client/src/App.tsx`
- `client/src/App.css`
- `client/src/types.ts`
- `client/src/pages/Kiosk.tsx`
- `client/src/pages/StudentLanding.tsx`
- `client/src/pages/AdminLanding.tsx`
- `client/src/pages/PrinterStatus.tsx`
- `client/src/pages/FilamentInventory.tsx`
- `client/src/components/PrinterCard.tsx`

### Server

- `server/src/server.ts`
- `server/src/radar.ts`
- `server/src/printer-status.ts`
- `server/src/print-policy.ts`
- `server/src/filament.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/jobs.ts`
- `server/src/routes/printers.ts`
- `server/src/routes/events.ts`
- `server/src/routes/filament.ts`
- `server/src/routes/settings.ts`

## 9. Cleanup standard

Before finishing work, check for:

- orphaned pages
- orphaned components
- unused assets
- stale docs that describe old behavior
- duplicate flows that compete with the real one

This repo should contain the working product, not a museum of half-finished versions.
