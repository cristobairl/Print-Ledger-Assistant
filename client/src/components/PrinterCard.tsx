import type { Printer } from '../types'

type PrinterCardProps = {
  printer: Printer
  compact?: boolean
}

const statusLabel: Record<Printer['status'], string> = {
  idle: 'Idle',
  armed: 'Armed',
  printing: 'Printing',
  sniped: 'Sniped',
}

export function PrinterCard({ printer, compact = false }: PrinterCardProps) {
  return (
    <article className={`printer-card ${compact ? 'printer-card--compact' : ''}`}>
      <div className="printer-card__header">
        <div>
          <p className="printer-card__name">{printer.name}</p>
          <p className="printer-card__meta">
            {printer.location} | {printer.ip}
          </p>
        </div>
        <span className={`status-pill status-pill--${printer.status}`}>
          {statusLabel[printer.status]}
        </span>
      </div>

      <div className="printer-card__body">
        <div>
          <p className="label">Active job</p>
          <p className="value">{printer.activeJob}</p>
        </div>

        {!compact && (
          <>
            <div className="printer-card__stats">
              <div>
                <p className="label">Material</p>
                <p className="value">{printer.material}</p>
              </div>
              <div>
                <p className="label">Nozzle</p>
                <p className="value">{printer.nozzleTemp} C</p>
              </div>
              <div>
                <p className="label">Bed</p>
                <p className="value">{printer.bedTemp} C</p>
              </div>
            </div>

            <div>
              <div className="progress-row">
                <p className="label">Progress</p>
                <p className="value">{printer.progress}%</p>
              </div>
              <div
                className="progress-bar"
                role="progressbar"
                aria-valuenow={printer.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${printer.progress}%` }} />
              </div>
            </div>
          </>
        )}
      </div>

      <p className="printer-card__footer">Last watchdog response: {printer.lastSeen}</p>
    </article>
  )
}
