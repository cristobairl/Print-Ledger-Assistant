Markdown
# Print Ledger Assistant

[![Status](https://img.shields.io/badge/Status-Active-success.svg)](#)
[![Tech](https://img.shields.io/badge/Stack-React%20%7C%20Vite%20%7C%20TypeScript-blue.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#)

**Print Ledger Assistant** is a kiosk-based 3D print lab management system. It streamlines student swipe authentication, printer authorization, unauthorized print sniping, live job logging, and filament tracking into a single workflow. 

This system provides a lightweight control layer for labs without requiring proprietary printer hardware, premium printers, or separate spool readers.

---

## 🔗 Project Links
(#) • [**GitHub Repo**](https://github.com/cristobairl/Print-Ledger-Assistant) • [**Documentation**](https://github.com/Parallel-7/flashforge-api-docs/wiki)(#)

---

## ✨ Core Features
* **Student Authentication:** Magnetic card swipe integration (HID keyboard emulation).
* **Log Collection:** Mandatory job metadata entry before print sessions begin.
* **Timed Authorization:** Secure window for printer access to prevent "ghost" sessions.
* **Auto-Snipe:** Detects and halts unauthorized printer activity via `~M26` commands.
* **Filament Tracking:** Real-time gram-tracking per printer with inventory management.

---

## 🛠 Tech Stack
* **Framework:** [React](https://reactjs.org/)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Database/Auth:** [Supabase](https://supabase.com/)
* **Styling:** CSS3 / Tailwind (as configured)

---

## 📂 Project Structure
```text
Print-Ledger-Assistant/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # View logic (Kiosk, Student, Admin, etc.)
│   ├── hooks/          # Custom React hooks (Watchdog, Auth)
│   ├── services/       # Supabase client & API logic
│   ├── types/          # TypeScript interfaces/definitions
│   ├── App.tsx         # Main routing and layout
│   └── main.tsx        # Entry point
├── public/             # Static assets
├── index.html          # HTML template
├── vite.config.ts      # Vite configuration
└── tsconfig.json       # TypeScript configuration
🚀 Getting Started
Prerequisites
A Supabase project (URL and Anon Key required).

A magnetic card reader configured in HID (keyboard) mode.

Installation & Setup
Clone the repository:

Bash
git clone [https://github.com/cristobairl/Print-Ledger-Assistant.git](https://github.com/cristobairl/Print-Ledger-Assistant.git)
cd Print-Ledger-Assistant
Install dependencies:

Bash
npm install
Environment Variables:
Create a .env file in the root directory:

Code snippet
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
Running for Development
Bash
npm run dev
Open your browser to the local URL provided by Vite (usually http://localhost:5173).

⚙️ Print Policy & Watchdog
The application maintains a "Watchdog" state that polls printers and enforces the following:

Start Window: 2 minutes (Time allowed to start a print after authorization).

Inactivity Timeout: 3 minutes of idle state triggers a kiosk reset.

Watchdog Polling: * ~M27: Inspects printer activity.

~M105: Monitors temperature telemetry.

~M26: Triggered automatically if heating/printing occurs outside an authorized session.

🛣 Roadmap
Phase 1: Core authentication, logging, and filament tracking.

Phase 2: Temperature and duration anomaly detection.

Phase 3: Advanced analytics and utilization heatmaps.

Phase 4: QR code integration for direct file uploads.

🤝 Contribution
Bugs: Please open a GitHub Issue.

Pull Requests: Fork the repo and submit a PR for review.

Maintained by: @cristobairl

License: MIT
