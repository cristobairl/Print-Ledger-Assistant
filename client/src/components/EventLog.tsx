import type { EventItem } from '../types'

type EventLogProps = {
  events: EventItem[]
  title?: string
}

export function EventLog({
  events,
  title = 'Event log',
}: EventLogProps) {
  return (
    <section className="surface">
      <div className="section-heading">
        <div>
          <p className="section-heading__eyebrow">Audit</p>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="event-list">
        {events.map((event) => (
          <article key={event.id} className="event-item">
            <div className="event-item__header">
              <span className={`event-dot event-dot--${event.type}`} />
              <div>
                <p className="event-item__title">{event.title}</p>
                <p className="event-item__meta">
                  {event.timestamp} | {event.printerName}
                </p>
              </div>
            </div>
            <p className="event-item__detail">{event.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
