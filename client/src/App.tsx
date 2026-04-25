import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import { EventLog } from './components/EventLog'
import { JobTable } from './components/JobTable'
import { PrinterCard } from './components/PrinterCard'
import { AdminLog } from './pages/AdminLog'
import { Kiosk } from './pages/Kiosk'
import { PrinterStatus } from './pages/PrinterStatus'
import type { EventItem, Job, Printer } from './types'

const printers: Printer[] = [
  {
    id: 'prusa-a',
    name: 'Prusa MK4 A',
    ip: '10.10.0.21',
    location: 'Hotspot Bay 1',
    status: 'printing',
    activeJob: 'gearbox-cover.gcode',
    material: 'PLA',
    nozzleTemp: 214,
    bedTemp: 61,
    progress: 68,
    lastSeen: '2s ago',
  },
  {
    id: 'prusa-b',
    name: 'Prusa MK4 B',
    ip: '10.10.0.22',
    location: 'Hotspot Bay 2',
    status: 'armed',
    activeJob: 'Awaiting authorized print',
    material: 'PETG',
    nozzleTemp: 0,
    bedTemp: 0,
    progress: 0,
    lastSeen: '4s ago',
  },
  {
    id: 'bambu-c',
    name: 'Bambu P1S C',
    ip: '10.10.0.23',
    location: 'Hotspot Bay 3',
    status: 'sniped',
    activeJob: 'prototype-enclosure.gcode',
    material: 'PLA-CF',
    nozzleTemp: 31,
    bedTemp: 24,
    progress: 11,
    lastSeen: '8s ago',
  },
]

const jobs: Job[] = [
  {
    id: 'job-1042',
    studentName: 'Avery Nguyen',
    studentId: 'U84722195',
    printerName: 'Prusa MK4 A',
    fileName: 'gearbox-cover.gcode',
    status: 'printing',
    startedAt: '4:08 PM',
    estimatedTime: '2h 15m',
    reason: 'Senior design prototype',
  },
  {
    id: 'job-1041',
    studentName: 'Mila Santos',
    studentId: 'U91200481',
    printerName: 'Bambu P1S C',
    fileName: 'prototype-enclosure.gcode',
    status: 'sniped',
    startedAt: '3:51 PM',
    estimatedTime: '4h 10m',
    reason: 'Unauthorized restart',
  },
  {
    id: 'job-1038',
    studentName: 'Noah Patel',
    studentId: 'U70044113',
    printerName: 'Prusa MK4 B',
    fileName: 'lab-badge-reel.gcode',
    status: 'queued',
    startedAt: '3:22 PM',
    estimatedTime: '1h 05m',
    reason: 'Class assignment',
  },
]

const events: EventItem[] = [
  {
    id: 'evt-901',
    timestamp: '4:14:02 PM',
    type: 'security',
    title: 'Sniper fired on Bambu P1S C',
    detail: 'M26 issued after print began without a matched swipe session.',
    printerName: 'Bambu P1S C',
  },
  {
    id: 'evt-900',
    timestamp: '4:08:17 PM',
    type: 'auth',
    title: 'Card swipe accepted',
    detail: 'Avery Nguyen authenticated and armed Prusa MK4 A.',
    printerName: 'Prusa MK4 A',
  },
  {
    id: 'evt-899',
    timestamp: '4:06:10 PM',
    type: 'system',
    title: 'Watchdog heartbeat normal',
    detail: 'All printers responded to M105 polling in under 320 ms.',
    printerName: 'All printers',
  },
]

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <p className="sidebar__eyebrow">USF 3D Print Lab</p>
          <h1>Print Ledger Assistant</h1>
          <p className="sidebar__summary">
            Kiosk authorization, printer monitoring, and security events in one
            control surface.
          </p>
        </div>

        <nav className="sidebar__nav" aria-label="Primary">
          <NavLink to="/kiosk" className="nav-link">
            Kiosk
          </NavLink>
          <NavLink to="/printers" className="nav-link">
            Printer Status
          </NavLink>
          <NavLink to="/admin" className="nav-link">
            Admin Log
          </NavLink>
        </nav>

        <section className="sidebar__panel">
          <p className="sidebar__panel-label">Live fleet</p>
          <div className="sidebar__fleet">
            {printers.map((printer) => (
              <PrinterCard key={printer.id} printer={printer} compact />
            ))}
          </div>
        </section>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="topbar__label">Hackathon v1 focus</p>
            <p className="topbar__text">
              Card swipe auth, watchdog polling, sniper enforcement, and live
              visibility.
            </p>
          </div>
          <div className="topbar__metrics" aria-label="system metrics">
            <div className="metric-chip">
              <span className="metric-chip__value">3</span>
              <span className="metric-chip__label">Printers online</span>
            </div>
            <div className="metric-chip">
              <span className="metric-chip__value">1</span>
              <span className="metric-chip__label">Active security event</span>
            </div>
          </div>
        </header>

        <Routes>
          <Route
            path="/kiosk"
            element={<Kiosk printers={printers} jobs={jobs} events={events} />}
          />
          <Route
            path="/printers"
            element={<PrinterStatus printers={printers} jobs={jobs} />}
          />
          <Route
            path="/admin"
            element={<AdminLog jobs={jobs} events={events} />}
          />
          <Route path="*" element={<Navigate to="/kiosk" replace />} />
        </Routes>

        <section className="footer-grid">
          <JobTable jobs={jobs.slice(0, 2)} title="Current jobs" />
          <EventLog events={events.slice(0, 2)} title="Recent security flow" />
        </section>
      </main>
    </div>
  )
}

export default App
