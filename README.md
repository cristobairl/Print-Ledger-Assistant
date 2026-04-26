# Print Ledger Assistant

[![Status](https://img.shields.io/badge/Status-Active-success.svg)](#)
[![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Vite%20%7C%20TypeScript-blue.svg)](#)
[![Printer](https://img.shields.io/badge/Hardware-FlashForge-orange.svg)](#)

**Print Ledger Assistant** is a kiosk-based 3D print lab management system designed for FlashForge printer fleets. It handles student swipe authentication, printer authorization, unauthorized print "sniping," and real-time filament tracking.

---

## ✨ Key Features
* **Magnetic Card Swipe:** HID-mode student authentication.
* **FlashForge Watchdog:** Direct control via Port 8899 using `~M27`, `~M105`, and `~M26`.
* **Unauthorized Snipe:** Automated print abortion for unlogged sessions.
* **Filament Guard:** Real-time gram tracking via Supabase tables.
* **No-Auth Database:** Direct table interaction for rapid lab deployment.

---

## 📂 Project Structure
```text
Print-Ledger-Assistant/
├── client/
│   ├── src/
│   │   ├── components/      # UI elements
│   │   ├── pages/           # Kiosk, Student, Admin views
│   │   ├── App.tsx          # Main routing logic
│   │   ├── App.css          # Global styling
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── types.ts         # Printer & DB interfaces
│   ├── package.json
│   └── vite.config.ts
├── server/
│   ├── sql/                 # Table definitions
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── db.ts            # Supabase initialization
│   │   ├── filament.ts      # Tracking logic
│   │   ├── print-policy.ts  # Timing/auth rules
│   │   ├── printer-status.ts
│   │   ├── radar.ts         # FlashForge TCP watchdog
│   │   └── server.ts        # Entry point (Port 3000)
│   ├── .env.example
│   └── package.json
├── rules.md                 # Agent-facing source of truth
└── README.md
```
🚀 Getting Started1. Supabase SetupEnsure your Supabase tables (Students, Jobs, Printers, Filament) are configured. This project uses direct table access via the Anon Key.2. Environment ConfigurationCreate a .env file in the server directory:Code snippetPORT=3000
SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
SUPABASE_ANON_KEY=your-long-anon-key-string-goes-here
3. InstallationStart the Backend:Bashcd server
npm install
npm run dev
Start the Frontend:Bashcd client
npm install
npm run dev
⚙️ Printer Control Logic (Port 8899)The watchdog polls printers every second based on FlashForge API Docs:CommandPurposeDescription~M27StatusInspects if the printer is currently building.~M105TelemetryMonitors real-time extruder/bed temperatures.~M26SnipeAborts unauthorized heating or printing activity.PoliciesAuthorization Window: 2 minutes.Snipe Trigger: If ~M105 shows active heating or ~M27 shows a busy state without an authorized session in the DB, ~M26 is sent immediately.🤝 SupportMaintainer: @cristobairlLicense: MIT
