# 🚀 Print Ledger Assistant  
### Status Stack Printer

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20Node%20%7C%20Supabase-orange)

---

## 📖 Overview

**Print Ledger Assistant** is a kiosk-based 3D print lab management system built for  
**FlashForge printer fleets**.

It provides:
- Secure student authentication  
- Print authorization enforcement  
- Automatic prevention of unauthorized usage  
- Real-time filament tracking  

Designed for **labs, schools, and makerspaces**, it turns unmanaged printer fleets into controlled, trackable systems.

---

## 📸 Demo (Coming Soon)

> Add screenshots or a GIF here  
> Example:
> ![Demo](./assets/demo.gif)

---

## ✨ Features

- 🔐 **Magnetic Card Authentication**  
  HID-mode card swipe login for fast student access  

- 🖨 **FlashForge Watchdog (Port 8899)**  
  Direct printer control using:
  - `~M27` → Print status  
  - `~M105` → Temperature telemetry  
  - `~M26` → Job termination  

- 🎯 **Unauthorized Print Protection ("Snipe")**  
  Automatically aborts any print or heating activity without authorization  

- 🧵 **Filament Guard**  
  Tracks filament usage in grams in real time  

- ⚡ **Rapid Deployment Database**  
  Supabase integration using anon key for quick lab setup  

---

## 🧰 Tech Stack

- **Frontend:** React + Vite + TypeScript  
- **Backend:** Node.js + Express  
- **Database:** Supabase  
- **Hardware Interface:** FlashForge TCP API (Port 8899)  

---

## 📂 Project Structure

```bash
Print-Ledger-Assistant/
├── client/
│   ├── src/
│   │   ├── components/      # Reusable UI elements
│   │   ├── pages/           # Kiosk, Student, Admin views
│   │   ├── App.tsx          # Routing logic
│   │   ├── App.css          # Global styles
│   │   ├── index.css
│   │   ├── main.tsx
│   │   └── types.ts         # Interfaces
│   ├── package.json
│   └── vite.config.ts
│
├── server/
│   ├── sql/                 # DB schema
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── db.ts            # Supabase setup
│   │   ├── filament.ts      # Filament logic
│   │   ├── print-policy.ts  # Auth + timing rules
│   │   ├── printer-status.ts
│   │   ├── radar.ts         # TCP watchdog
│   │   └── server.ts        # Entry (Port 3000)
│   ├── .env.example
│   └── package.json
│
├── rules.md
└── README.md
📦 Installation

Clone the repository:

git clone https://github.com/yourusername/print-ledger-assistant.git
cd print-ledger-assistant
⚙️ Configuration

Create a .env file inside /server:

PORT=3000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
▶️ Usage
Start Backend
cd server
npm install
npm run dev
Start Frontend
cd client
npm install
npm run dev
🖨 Printer Control Logic (Port 8899)

The system continuously polls each printer via the FlashForge TCP interface.

Commands
Command	Purpose	Description
~M27	Status	Checks if a print job is active
~M105	Telemetry	Reads extruder and bed temperature
~M26	Snipe	Cancels unauthorized activity
🔐 Enforcement Policies
⏱ Authorization Window

Users must begin printing within 2 minutes of authentication.

🚫 Snipe Conditions

A print is immediately terminated if:

~M105 detects heating without authorization
~M27 reports an active job without a valid session
🤝 Contributing

Pull requests are welcome.
For major changes, open an issue first to discuss what you want to improve.

📄 License

MIT License
See the LICENSE file for details.

🙌 Credits

Maintained by @cristobairl
