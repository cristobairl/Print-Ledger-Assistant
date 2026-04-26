import type { Printer } from '../types'

type PrinterCardProps = {
  printer: Printer
  onAuthorizationChange: (printerId: string, authorize: boolean) => void
}

const activityLabel: Record<Printer['activity']['state'], string> = {
  idle: 'Idle',
  heating: 'Heating',
  printing: 'Printing',
  unknown: 'Unknown',
}

const connectivityLabel: Record<Printer['connectivity']['state'], string> = {
  online: 'Online',
  offline: 'Offline',
}

export function PrinterCard({ printer, onAuthorizationChange }: PrinterCardProps) {
  const lastSeen = printer.connectivity.lastSeenAt
    ? new Date(printer.connectivity.lastSeenAt).toLocaleString()
    : 'No reply yet'
  const portLabel = printer.connectivity.lastPort ?? 'n/a'

  return (
    <article className="printer-card">
      <div className="printer-card__header">
        <div>
          <p className="printer-card__name">{printer.name}</p>
          <p className="printer-card__meta">
            {printer.ip} | Port {portLabel}
          </p>
        </div>
        <div className="printer-card__pills">
          <span className={`status-pill status-pill--${printer.connectivity.state}`}>
            {connectivityLabel[printer.connectivity.state]}
          </span>
          <span className={`status-pill status-pill--${printer.activity.state}`}>
            {activityLabel[printer.activity.state]}
          </span>
        </div>
      </div>

      <div className="printer-card__body">
        <div className="printer-card__section">
          <div className="printer-card__section-header">
            <div>
              <p className="label">Authorization</p>
              <p className="value value--compact">{printer.authorization.state}</p>
            </div>
            <button
              type="button"
              className="printer-card__button"
              onClick={() =>
                onAuthorizationChange(
                  printer.id,
                  printer.authorization.state !== 'authorized',
                )
              }
            >
              {printer.authorization.state === 'authorized' ? 'Deauthorize' : 'Authorize'}
            </button>
          </div>
          <p className="detail">
            {printer.authorization.state === 'authorized'
              ? 'Printer is cleared for supervised activity.'
              : 'Printer is not authorized for unattended activity.'}
          </p>
        </div>

        <div className="printer-card__stats">
          <div>
            <p className="label">Activity</p>
            <p className="value value--compact">{activityLabel[printer.activity.state]}</p>
            <p className="detail">Source: {printer.activity.command}</p>
            <p className="detail">{printer.activity.reason}</p>
          </div>
          <div>
            <p className="label">Enforcement</p>
            <p className="value value--compact">{printer.enforcement.mode}</p>
            <p className="detail">{printer.enforcement.reason}</p>
          </div>
        </div>

        <div className="printer-card__stats">
          <div>
            <p className="label">Nozzle</p>
            <p className="value value--compact">
              {formatTemperature(printer.telemetry.nozzle.current, printer.telemetry.nozzle.target)}
            </p>
          </div>
          <div>
            <p className="label">Bed</p>
            <p className="value value--compact">
              {formatTemperature(printer.telemetry.bed.current, printer.telemetry.bed.target)}
            </p>
          </div>
        </div>

        <div className="printer-card__section">
          <p className="label">Raw activity reply</p>
          <pre className="printer-card__raw">
            {printer.activity.rawResponse ?? 'No raw activity reply recorded yet.'}
          </pre>
        </div>

        <div className="printer-card__section">
          <p className="label">Raw telemetry reply</p>
          <pre className="printer-card__raw">
            {printer.telemetry.rawResponse ?? 'No raw response recorded yet.'}
          </pre>
        </div>
      </div>

      <p className="printer-card__footer">
        Last watchdog reply: {lastSeen}
        {printer.connectivity.lastError ? ` | ${printer.connectivity.lastError}` : ''}
      </p>
    </article>
  )
}

function formatTemperature(current: number | null, target: number | null) {
  if (current === null || target === null) {
    return 'n/a'
  }

  return `${current.toFixed(1)} / ${target.toFixed(1)} C`
}
