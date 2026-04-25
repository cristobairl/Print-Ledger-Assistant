🖨️ PLA — Print Ledger Assistant

A cyber-physical security and management layer for university 3D printing labs.


The Problem
At USF's 3D printing lab, students are required to log their name, print time, filament weight, and student ID on a paper sheet before every print. In practice, nobody does it.

The paper log is ignored — there is no enforcement mechanism
Staff have no way to know if a printer is running without physically walking over to it
Students can cancel each other's prints with no accountability
There is no way to catch students who print excessively
A previous digital system failed because the printer kept running even when a student exceeded their quota

The lab needs something physical. Something that cannot be opted out of.

What PLA Does
PLA is a kiosk-based print management system that sits between the student and the printer. It enforces accountability at the hardware level — not the honor system level.
A student cannot start a print without swiping their ID. If a print starts without authorization, the system kills it instantly.

Features
✅ v1 — Core (Shipped)

Card Swipe Authentication — Students swipe their university ID via an MSR90 magnetic card reader. Unrecognized cards are blocked.
Ghost Print Detection — A watchdog polls every printer every 2 seconds via raw TCP. If a print starts on an unauthorized printer, the system fires an abort command instantly.
Automatic Job Logging — Every print job is recorded automatically: who printed, on which printer, when it started, when it ended, and whether it was completed or aborted.
Live Admin Dashboard — Admins see real-time printer status across the entire lab. Armed, printing, idle, or sniped — all visible from one screen.
Security Event Log — Every unauthorized print attempt is logged with a timestamp and printer ID, giving staff a full audit trail.

🔜 v2 — Coming Soon

USB File Selection — Students plug their USB into the kiosk, select their .gcode file, and the system automatically extracts file name, estimated print time, and filament usage. No manual entry required.
File Verification — File size is recorded at selection and verified against the active print via M27 to confirm the correct file is running.
Printer Assignment with Timed Window — The kiosk assigns an available printer and opens a timed window for the student to begin their print.

🔮 v3 — Planned

Filament Tracking — E-axis data from M114 calculates actual filament consumed per job.
Quota Enforcement — Per-student filament and time budgets enforced automatically.
Predictive Filament Ordering — Aggregate usage data to forecast when to reorder and how much.
Cryptographic File Verification — Checksum embedded in G-code at selection time for exact file identity confirmation.


How It Works
PLA uses a Local Command Bridge architecture. A Node.js server runs on a dedicated kiosk laptop and communicates with printers over raw TCP on port 8899 using the Marlin G-code protocol.
[Kiosk Laptop]
      │
[Wi-Fi Hotspot]
      │
 ┌────┼────┐
[P1] [P2] [P3]
The kiosk hosts the hotspot. The printers connect to it. There is no external router, no third-party network dependency, and no additional hardware required on the printers themselves.
The Watchdog
Every 2 seconds, PLA sends M105 to each printer and parses the response for target bed temperature. A target above 0 means a print has started. If that printer has no active authorized session, M26 is fired immediately — aborting the print.

Tech Stack
LayerTechnologyBackendNode.js + TypeScript + ExpressDatabaseSupabase (Postgres + Realtime)FrontendReact + Vite + Tailwind CSSProtocolRaw TCP via Node.js net moduleHardwareMSR90 Magnetic Card Reader (HID)Printer CommunicationMarlin G-code (M105, M26, M27)

Database Schema
sql-- coming soon

Setup
bash# coming soon

Network Configuration
The kiosk laptop hosts a Wi-Fi hotspot. All printers connect to this hotspot and are assigned static IPs via MAC address reservation. The hotspot lives and dies with the kiosk — there is no external point of failure.

Built At
USF Hackathon 2025 — built in 24 hours.
PLA stands for Print Ledger Assistant. PLA is also the most common 3D printing filament material. That's not a coincidence.
