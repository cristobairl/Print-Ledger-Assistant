import { PrinterCard } from '../components/PrinterCard'
import type { Job, Printer } from '../types'

type PrinterStatusProps = {
  printers: Printer[]
  jobs: Job[]
}

export function PrinterStatus({ printers, jobs }: PrinterStatusProps) {
  return (
    <section className="page-stack">
      <section className="surface surface--hero">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Fleet overview</p>
            <h2>Watchdog and printer visibility</h2>
          </div>
        </div>
        <div className="hero-stats">
          <article>
            <span>Watchdog cadence</span>
            <strong>2 sec</strong>
          </article>
          <article>
            <span>Jobs in queue</span>
            <strong>{jobs.length}</strong>
          </article>
          <article>
            <span>Sniped today</span>
            <strong>{printers.filter((printer) => printer.status === 'sniped').length}</strong>
          </article>
        </div>
      </section>

      <section className="surface">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Printer cards</p>
            <h2>Realtime status</h2>
          </div>
        </div>
        <div className="printer-list">
          {printers.map((printer) => (
            <PrinterCard key={printer.id} printer={printer} />
          ))}
        </div>
      </section>
    </section>
  )
}
