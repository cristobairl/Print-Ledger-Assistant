Print Ledger Assistant
Print Ledger Assistant is a kiosk-based 3D print lab management system that combines student swipe authentication, printer authorization, unauthorized print sniping, live job logging, and filament tracking in one workflow.
It is designed to give labs a lightweight control layer without requiring proprietary printer hardware, premium printers, or separate spool readers.
Project Status & Links
Show Image
Show Image
Show Image
Show Image
Show Image
Show Image
Live Demo · GitHub Repo · Documentation

Placeholder visuals

Placeholder: add hero screenshot or kiosk photo here


Placeholder: add architecture diagram here


Placeholder: add workflow / pipeline graphic here

What it does
Print Ledger Assistant currently supports five core features:

Student authentication by magnetic card swipe
Student print log collection before a print session starts
Timed printer authorization for a selected printer
Auto-snipe of unauthorized printer activity with ~M26
Live filament tracking per printer without proprietary hardware

Why this exists
Many student print labs still rely on paper logs, manual oversight, and trust-based printer usage. That leads to a few recurring problems:

students skip logging prints
staff cannot easily see what is running from one kiosk
printers can be started without an approved session
there is no reliable connection between a student, a printer, and a job
filament usage is hard to track without expensive or proprietary systems

Print Ledger Assistant addresses that by treating the kiosk as the point of coordination between the student, the database, and the printer watchdog.

Current product scope
Student side

swipe into the kiosk with a magnetic card reader
land on the student print page
enter required job details
see printer availability before starting
see filament availability per printer
start a timed print session
review recent personal job history

Admin side

swipe into the admin dashboard
see active printers and printer attention items
open printer diagnostics
review snipe events
configure print time limits
manage filament inventory
assign one active spool per printer

Watchdog side

poll printers over raw TCP
inspect ~M27 activity responses
inspect ~M105 temperature responses
classify printer state as idle, heating, printing, offline, or unknown
authorize supervised print sessions
auto-snipe unauthorized heating/printing activity with ~M26


How it works
1. Kiosk authentication
The card reader behaves like a keyboard. The kiosk listens for a full track-data burst, sends it to the backend, and the backend:

parses the swipe
looks up the student in Supabase
creates the student if needed
refreshes the stored name if the swipe data changed

2. Student session start
The student fills out the form, selects a printer, and starts a print session.
The backend uses a single combined request to:

create the jobs record
authorize the selected printer

This prevents the old race condition where the printer could begin heating before authorization was attached.
3. Printer authorization window
Once a student starts a session, the printer is authorized for a short USB connection window.
Current default:

print session start window: 2 minutes

4. Watchdog and auto-snipe
The watchdog runs in the backend and polls printers every second.
Current live command flow:

~M27 for printer activity / print-state hints
~M105 for temperature telemetry
~M26 for auto-snipe on unauthorized activity

If the backend sees unauthorized bed heating or printing activity, it sends ~M26 once per incident and waits for the printer to settle back to idle.
5. Filament tracking
Each printer can have one active spool in the system.
The application uses that relationship to:

show usable grams left on the student printer picker
block jobs that exceed available filament
let admins manage spool inventory centrally
track spool assignment and usage through events

This gives the lab live filament visibility without relying on proprietary spool readers or more expensive printers.

Tech stack
Frontend

React
TypeScript
Vite

Backend

Express.js
TypeScript
Node.js
Supabase client

Hardware & Protocols

Magnetic card reader (USB keyboard input)
TCP/WebSockets for printer communication
Raw TCP socket connections for printer polling

Data and infrastructure

Supabase Postgres (database)
Supabase authentication and API client
TCP printer communication via Node.js sockets
WebSocket support for live updates


Project structure
textPrint-Ledger-Assistant/
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

Getting Started
Prerequisites

Node.js: Ensure you have a recent version of Node.js and npm installed.
Supabase: This project uses Supabase for its database and authentication. You will need a free account and a new project.
Git: For cloning the repository.

Installation & Setup

Clone the repository:

bash    git clone https://github.com/cristobairl/Print-Ledger-Assistant.git
    cd Print-Ledger-Assistant

Configure the Server:

Navigate to the server directory: cd server
Create a .env file by copying the example: cp .env.example .env
Edit the .env file and add your Supabase project URL and Anon Key. You can find these in your Supabase project's Settings > API.
Install dependencies: npm install


Configure the Client:

Navigate to the client directory: cd ../client
Install dependencies: npm install



Running the Application
You need to run both the server and the client in two separate terminals.
Terminal 1: Start the Backend
bash# In the /server directory
npm run dev
Terminal 2: Start the Frontend
bash# In the /client directory
npm run dev
Open your browser to the local URL provided by Vite (usually http://localhost:5173) to see the application running.

Important runtime behavior
Ports

frontend: 3001
backend: 3000

Current print policy defaults

student printer start window: 2 minutes
inactivity timeout: 3 minutes
max declared print time: 5 hours

Filament behavior

one active spool per printer
students can see filament status before selecting a printer
printers without enough usable filament are visible but not selectable


Key routes
Frontend routes
RoutePurpose/kioskMain kiosk entry point/studentStudent print form & history/adminAdmin dashboard & monitoring/printersPrinter status & diagnostics/filamentFilament inventory management
Backend routes
MethodEndpointPurposePOST/auth/swipeProcess magnetic card swipeGET/jobs/student/:studentIdGet student's job historyPOST/jobsCreate a new print jobPOST/jobs/sessionStart authorized print sessionGET/printers/statusGet live printer statusPOST/printers/:printerId/authorizeAuthorize printer for printPOST/printers/:printerId/deauthorizeRevoke printer authorizationGET/eventsGet system event logGET/filament/spoolsList all spoolsPOST/filament/spoolsCreate new spoolPATCH/filament/spools/:spoolIdUpdate spool (decrement usage)GET/filament/eventsGet filament tracking eventsGET/settings/printingGet print policy settingsPATCH/settings/printingUpdate print policy

UI Screenshots & Feature Overview
Kiosk Swipe Screen
Students begin with the magnetic card swipe interface:

Full-screen card reader prompt
Automatic student lookup upon successful swipe
Visual feedback with student name display
Smooth transition to print form

Student Print Form
Intuitive form captures all required information:

Dropdown for printer selection (shows available printers only)
Real-time filament availability display per printer
Input fields: material type, estimated duration, job name
Visual warnings when filament is insufficient
Submit button activates authorization window countdown

Admin Dashboard
Comprehensive monitoring and control:

Live printer status grid showing idle/heating/printing/offline states
Active jobs list with student name and time elapsed
Snipe event log with incident details and timestamps
Quick-access printer diagnostics panel
Filament inventory overview with spool assignments
Settings panel for print time limits

Printer Diagnostics View
Detailed real-time monitoring:

Current printer state and temperature telemetry
Active authorization window status
Raw M27/M105 command responses
Snipe event history for specific printer
Manual M26 abort trigger (admin only)

Filament Tracker
Spool and inventory management:

List of all spools with material type and remaining grams
Printer-to-spool assignment interface
Historical usage trends per spool
Low-inventory alerts
Spool creation form for new inventory


Notes on printer compatibility
The watchdog logic is tuned to the current printer link behavior in this repo.
Important assumptions:

printers answer on raw TCP
~M27 and ~M105 are available
~M26 is accepted as the abort command for the tested printer path

If printer firmware or protocol changes, the watchdog parsing and command assumptions may need to be updated.

Repo guidance
The repo uses rules.md as the current agent-facing source of truth for:

system behavior
UI constraints
cleanup rules
AI implementation guardrails

If README.md and rules.md ever drift, update both.

Roadmap
Phase 1: Core System (Current)

Student swipe authentication
Print job logging
Printer authorization & watchdog
Auto-snipe unauthorized activity
Basic filament tracking

Phase 2: Enhanced Monitoring (Planned)

Stronger printer compatibility profiling
Temperature anomaly detection
Print duration anomaly detection
More automated job-to-filament reconciliation

Phase 3: Analytics & Insights (Future)

Richer student usage analytics
Admin statistical dashboards
Printer utilization heatmaps
Filament consumption forecasting

Phase 4: Advanced Features (Backlog)

Multi-printer batch processing
QR code integration for file uploads
Email/SMS notifications for job completion
Integration with slicer software
Cost allocation per material type


Placeholder: add product roadmap graphic here


Demo placeholders

Placeholder: add kiosk swipe screenshot
Placeholder: add student print form screenshot
Placeholder: add admin dashboard screenshot
Placeholder: add printer diagnostics screenshot
Placeholder: add filament tracker screenshot


CI/CD Pipeline
Build & Test

Run ESLint on client and server
Run TypeScript compiler (tsc --noEmit)
Unit tests for backend services (printer status, filament logic, print policy)
Server: npm run build (output to dist/)
Client: npm run build (output to dist/)
Build size monitoring

Release Flow

Development: Push to dev branch → runs full test suite
Staging: Merge to staging → deploys to preview environment
Production: Tag release → builds Docker image → deploys to main cluster

Deployment Environment

Server: Node.js + Express on containerized platform
Client: Static SPA served via CDN
Database: Supabase-managed Postgres (auto-backup)
Monitoring: Error tracking and performance metrics

Local Development
bash# Install dependencies
npm install

# Run with file watching
npm run dev

# Type check without build
npm run typecheck

# Lint and fix issues
npm run lint --fix

# Build for production
npm run build

Placeholder: add CI/CD section here


Support & Contribution
For issues, feature requests, or contributions:

Report Bugs: Open a GitHub issue with reproduction steps
Feature Requests: Use GitHub Discussions
Contributing: Fork the repo, create a feature branch, and submit a pull request

Maintained by @cristobairl

License
See LICENSE.
