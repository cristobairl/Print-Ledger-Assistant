# Print Ledger Assistant

[![Status](https://img.shields.io/badge/Status-Active-success.svg)](#)
[![Tech](https://img.shields.io/badge/Stack-React%20%7C%20Vite%20%7C%20TypeScript-blue.svg)](#)
[![Printer](https://img.shields.io/badge/API-FlashForge%20TCP-orange.svg)](#)

**Print Ledger Assistant** is a kiosk-based 3D print lab management system. It provides a lightweight control layer for student-run labs using FlashForge printers, integrating student swipe authentication, printer authorization, and unauthorized print "sniping" via raw TCP commands.

---

## ✨ Core Features
* **Student Authentication:** Magnetic card swipe (HID/Keyboard mode) with instant student lookup.
* **FlashForge TCP Watchdog:** Direct communication over Port 8899 using `~M27`, `~M105`, and `~M26`.
* **Auto-Snipe Logic:** Automatically aborts unauthorized heating or printing activity.
* **Filament Management:** Real-time gram tracking synchronized with Supabase tables.
* **Kiosk Interface:** Full-screen optimized dashboard for lab check-ins.

---

## 🛠 Tech Stack
* **Frontend:** [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Database:** [Supabase](https://supabase.com/) (Direct Table Access / PostgREST)
* **Printer Protocol:** Raw TCP Sockets (Port 8899) based on [Parallel-7/flashforge-api-docs](https://github.com/Parallel-7/flashforge-api-docs).

---

## 📂 Project Structure

---
Print-Ledger-Assistant/
├── client/             # Vite + React App
│   ├── src/
│   │   ├── services/   # Supabase & FlashForge TCP logic
│   │   ├── hooks/      # Watchdog & Polling hooks
│   │   ├── pages/      # Kiosk, Admin, and Student forms
│   │   └── types.ts    # Printer state & DB interfaces
├── rules.md            # System logic & behavior rules
├── LICENSE             # MIT
└── README.md
🚀 Getting Started1. Supabase ConfigurationThis project interacts directly with Supabase tables. Ensure your tables (Students, Jobs, Printers, Filament) are accessible via the Anon Key.2. Environment SetupCreate a .env file in the client directory:Code snippetVITE_SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
VITE_SUPABASE_ANON_KEY=your-long-anon-key-string-goes-here
PORT=3000
3. InstallationBashcd client
npm install
npm run dev
⚙️ Printer Control Logic (Port 8899)The system polls printers every second to enforce lab policy:CommandUsageDescription~M27StatusChecks if the printer is currently building/busy.~M105TelemetryMonitors extruder and bed temperatures.~M26SnipeImmediately halts current heating or print if unauthorized.Auth PolicyAuth Window: 2 minutes to start a print after kiosk check-in.Unauthorized State: If ~M105 shows heating OR ~M27 shows busy without an active DB session, the watchdog triggers ~M26.🤝 SupportFor issues or feature requests, please refer to the rules.md for implementation guardrails or open a GitHub issue.Maintained by: @cristobairl
