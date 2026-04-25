🖨️ PLA — Print Ledger Assistant
What it is: A cyber-physical kiosk system for USF's 3D printing lab that enforces print authorization via ID card swipe and kills unauthorized prints in real time.
The problem it solves: The paper log system is ignored, students cancel each other's prints, staff can't monitor printers remotely, and there's no way to catch excessive usage.

Stack

Backend: Node.js + TypeScript + Express
Database: Supabase (Postgres + Realtime)
Frontend: React + Vite + Tailwind CSS
Protocol: Raw TCP via Node.js net module
Hardware: MSR90 Magnetic Card Reader
Printer Communication: Marlin G-code (M105, M26, M27)


Architecture

Kiosk laptop hosts a Wi-Fi hotspot
All printers connect to the hotspot
No extra hardware on the printers
Kiosk is the only point of control


Feature Priority
v1 (Hackathon — ship this):

Card swipe authentication via MSR90
Watchdog polling every 2 seconds via M105
Sniper fires M26 on unauthorized prints
Automatic job logging to Supabase
Live admin dashboard with printer status
Security event log

v2 (After hackathon):

USB file selection at kiosk
File size verification via M27
Printer assignment with timed window

v3 (Future):

Filament tracking via M114
Quota enforcement
Predictive filament ordering
Cryptographic file verification


Database Tables
Four tables, all created in Supabase:
students — card_id, first_name, last_name, student_id, is_admin
printers — name, ip, status (idle / armed / printing / sniped)
jobs — student, printer, file_name, file_size, estimated_time, estimated_weight_grams, job_reason, started_at, ended_at, status
events — printer, student, event_type, timestamp

Card Swipe Format
MSR90 outputs raw track data. You parse:

card_id → the card number, used to look up the student
first_name / last_name → extracted from track 1


Repo Structure
pla/
├── client/src/
│   ├── pages/        ← Kiosk, AdminLog, PrinterStatus
│   └── components/   ← PrinterCard, JobTable, EventLog
└── server/src/
    ├── server.ts
    ├── radar.ts
    ├── db.ts
    └── routes/       ← auth, jobs, printers

Git Workflow

Feature work happens on branches
Only working code merges to main
.env never gets pushed, .env.example does
You own backend, teammate owns frontend


What's Done

✅ GitHub repo created and public
✅ Folder structure scaffolded
✅ README written
✅ Supabase project created
✅ db.ts connected to Supabase
✅ Four tables created in Supabase

What's Next

Run the updated SQL with split name and new job columns
Write the card swipe parser
Build the auth endpoint
Port the watchdog into the project