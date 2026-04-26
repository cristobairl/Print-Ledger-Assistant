# Print Ledger Assistant

Print Ledger Assistant is a kiosk-based 3D print lab management system that combines student swipe authentication, printer authorization, unauthorized print sniping, live job logging, and filament tracking in one workflow.

It is designed to give labs a lightweight control layer without requiring proprietary printer hardware, premium printers, or separate spool readers. 

![Build Status](https://img.shields.io/badge/build-passing-brightgreen) ![Hackabull](https://img.shields.io/badge/Hackabull-Participant-blue)![License](https://img.shields.io/badge/license-MIT-blue)

## What it does

Print Ledger Assistant currently supports five core features:

1. **Student authentication** by magnetic card swipe (MSR90).
2. **Student print log collection** before a print session starts.
3. **Timed printer authorization** bridging kiosk software with physical hardware.
4. **Auto-snipe of unauthorized printer activity** with `~M26`.
5. **Live filament tracking per printer** using E-axis telemetry, without proprietary hardware.

## Why this exists

Whether you are coordinating a massive hardware track for an event like HackUSF, managing university lab resources, or running a 3D-printing storefront with multiple high-speed printers, relying on paper logs and trust-based usage leads to recurring problems:

- Students skip logging prints.
- Staff cannot easily see what is running from one kiosk.
- Printers can be started without an approved session (ghost prints).
- There is no reliable connection between a student, a printer, and a job.
- Filament usage is hard to track without expensive or proprietary systems.

Print Ledger Assistant addresses this by treating a central kiosk as the point of coordination between the student, the database, and the printer watchdog.

## Core Workflows & Architecture

### 1. Authorize Then Walk (Session Creation)
This workflow bridges a digital action with a physical one, allowing a student to securely start a print.

```mermaid
sequenceDiagram
    participant Student
    participant Kiosk (MSR90)
    participant Backend & DB
    participant Printer

    Student->>Kiosk: Swipes Magstripe Card
    Kiosk->>Backend: POST /api/auth/card
    Backend-->>Backend: Authenticate & Check Filament Quota
    Backend->>Backend: Create "Pending" Session (90s window)
    Kiosk->>Student: "Walk to printer and start print from SD"
    Student->>Printer: Selects file & Starts Print
    loop Every 1 second
        Backend->>Printer: M27 (Check Status)
        Printer-->>Backend: "SD printing file"
    end
    Backend->>Backend: Match Pending Session -> Update to "Active"
