Print Ledger Assistant
Status Stack Printer

Print Ledger Assistant is a kiosk-based 3D print lab management system built for FlashForge printer fleets. It provides secure student authentication, enforces print authorization, prevents unauthorized usage, and tracks filament consumption in real time.

✨ Core Features

Magnetic Card Authentication
HID-mode card swipe system for seamless student login at the kiosk.

FlashForge Watchdog (Port 8899)
Direct low-level printer communication using:

~M27 for print status
~M105 for temperature telemetry
~M26 for job termination

Unauthorized Print Protection ("Snipe")
Automatically aborts any print or heating activity that is not tied to an active authorized session.

Filament Guard
Tracks filament usage in grams in real time using Supabase-backed tables.

Rapid Deployment Database Model
Uses Supabase with anon key access for fast setup in controlled lab environments.

📂 Project Structure
Print-Ledger-Assistant/
├── client/
│   ├── src/
│   │   ├── components/      # Reusable UI elements
│   │   ├── pages/           # Kiosk, Student, Admin views
│   │   ├── App.tsx          # Application routing
│   │   ├── App.css          # Global styles
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── types.ts         # Shared interfaces (Printer, DB)
│   ├── package.json
│   └── vite.config.ts
│
├── server/
│   ├── sql/                 # Database schema definitions
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── db.ts            # Supabase client setup
│   │   ├── filament.ts      # Filament tracking logic
│   │   ├── print-policy.ts  # Authorization + timing rules
│   │   ├── printer-status.ts
│   │   ├── radar.ts         # FlashForge TCP watchdog
│   │   └── server.ts        # Backend entry (Port 3000)
│   ├── .env.example
│   └── package.json
│
├── rules.md                 # System rules / agent logic
└── README.md
🚀 Getting Started
1. Supabase Setup

Create and configure the following tables:

Students
Jobs
Printers
Filament

This system interacts directly with tables using the Supabase Anon Key.

2. Environment Configuration

Create a .env file inside /server:

PORT=3000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
3. Installation & Run

Start Backend

cd server
npm install
npm run dev

Start Frontend

cd client
npm install
npm run dev
⚙️ Printer Control Logic (Port 8899)

The system continuously polls each printer using the FlashForge TCP interface.

Commands
Command	Purpose	Description
~M27	Status	Checks if a print job is active
~M105	Telemetry	Reads extruder and bed temperature
~M26	Snipe	Cancels unauthorized prints or heating
🔐 Enforcement Policies

Authorization Window
Users must begin printing within 2 minutes of authentication.

Snipe Conditions
A print is immediately terminated if:

~M105 detects heating activity without authorization, or
~M27 reports an active job not linked to a valid session
🤝 Support

Maintainer
@cristobairl

License
MIT
