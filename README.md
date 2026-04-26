# Print Ledger Assistant

[![Status](https://img.shields.io/badge/Status-Active-success.svg)](#)
[![Tech](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20Supabase-blue.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#)

**Print Ledger Assistant** is a kiosk-based 3D print lab management system that combines student swipe authentication, printer authorization, unauthorized print sniping, live job logging, and filament tracking in one workflow. It is designed to give labs a lightweight control layer without requiring proprietary printer hardware, premium printers, or separate spool readers.

---

## 🔗 Project Status & Links
[**Live Demo**](#) • [**GitHub Repo**](https://github.com/cristobairl/Print-Ledger-Assistant) • [**Documentation**](#)

---

## 📸 Placeholder Visuals
* **Hero Screenshot:** [Add hero screenshot or kiosk photo here]
* **System Architecture:** [Add architecture diagram here]
* **Workflow Logic:** [Add workflow / pipeline graphic here]

---

## ✨ What It Does
Print Ledger Assistant currently supports five core features:
* **Student Authentication:** Magnetic card swipe integration.
* **Log Collection:** Mandatory job data entry before sessions.
* **Timed Authorization:** Secure window for printer access.
* **Auto-Snipe:** Kills unauthorized activity via `~M26` commands.
* **Live Tracking:** Gram-accurate filament usage per printer.

---

## 🛠 Tech Stack
| Layer | Technology |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite |
| **Backend** | Express.js, TypeScript, Node.js |
| **Database** | Supabase (PostgreSQL) |
| **Hardware** | USB Magnetic Card Reader (HID) |
| **Protocols** | Raw TCP Sockets, WebSockets |

---

## 📂 Project Structure
```text
Print-Ledger-Assistant/
├── client/                 # Frontend React Application
│   ├── src/
│   │   ├── components/     # UI building blocks
│   │   ├── pages/          # View logic (Kiosk, Admin, etc.)
│   │   └── types.ts        # TypeScript interfaces
├── server/                 # Backend Node.js API
│   ├── sql/                # Schema definitions
│   ├── src/
│   │   ├── radar.ts        # Printer polling & watchdog
│   │   ├── filament.ts     # Inventory logic
│   │   └── server.ts       # Main entry point
├── rules.md                # Agent/AI development rules
└── README.md
🚀 Getting Started
Prerequisites
Node.js: v18 or higher.

Supabase: Active project for database/auth.

Git: For version control.

Installation & Setup
Clone the repository:

Bash
git clone [https://github.com/cristobairl/Print-Ledger-Assistant.git](https://github.com/cristobairl/Print-Ledger-Assistant.git)
cd Print-Ledger-Assistant
Configure the Server:

Bash
cd server
cp .env.example .env
# Edit .env with your Supabase URL and Anon Key
npm install
Configure the Client:

Bash
cd ../client
npm install
Running the Application
You need to run both the server and the client in separate terminals.

Terminal 1 (Backend): cd server && npm run dev

Terminal 2 (Frontend): cd client && npm run dev

⚙️ Important Runtime Behavior
Ports & Policy
Frontend: 3001 | Backend: 3000

Start Window: 2 minutes (Time allowed to start print after auth).

Inactivity Timeout: 3 minutes.

Max Job Time: 5 hours (Default).

Watchdog Logic
The watchdog polls printers every second using:

~M27: Inspects printer activity.

~M105: Gathers temperature telemetry.

~M26: Sent automatically if unauthorized heating/printing is detected.

🛣 Roadmap
Phase 1 (Core): Swipe auth, watchdog, basic filament tracking.

Phase 2 (Monitoring): Temperature and duration anomaly detection.

Phase 3 (Analytics): Student usage stats and admin dashboards.

Phase 4 (Advanced): QR code integration and slicer software hooks.

🤝 Support & Contribution
Bugs: Open a GitHub Issue.

Features: Use GitHub Discussions.

Contributing: Fork the repo and submit a PR.

Maintained by: @cristobairl

License: MIT
