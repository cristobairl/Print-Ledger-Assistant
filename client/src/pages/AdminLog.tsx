import { EventLog } from '../components/EventLog'
import { JobTable } from '../components/JobTable'
import type { EventItem, Job } from '../types'

type AdminLogProps = {
  jobs: Job[]
  events: EventItem[]
}

export function AdminLog({ jobs, events }: AdminLogProps) {
  return (
    <section className="page-stack">
      <section className="surface surface--hero">
        <div className="section-heading">
          <div>
            <p className="section-heading__eyebrow">Admin dashboard</p>
            <h2>Operational history and security review</h2>
          </div>
        </div>
        <p className="hero-panel__text">
          This view mirrors the backend event model in `jobs` and `events`,
          giving staff one place to spot sniped prints, verify kiosk activity,
          and inspect current reasons for lab usage.
        </p>
      </section>

      <JobTable jobs={jobs} title="Recent jobs" />
      <EventLog events={events} title="Event history" />
    </section>
  )
}
