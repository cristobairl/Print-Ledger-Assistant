import type { Job } from '../types'

type JobTableProps = {
  jobs: Job[]
  title?: string
}

export function JobTable({
  jobs,
  title = 'Jobs',
}: JobTableProps) {
  return (
    <section className="surface">
      <div className="section-heading">
        <div>
          <p className="section-heading__eyebrow">Queue</p>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Printer</th>
              <th>File</th>
              <th>Status</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <strong>{job.studentName}</strong>
                  <span>{job.studentId}</span>
                </td>
                <td>{job.printerName}</td>
                <td>
                  <strong>{job.fileName}</strong>
                  <span>{job.reason}</span>
                </td>
                <td>
                  <span className={`status-pill status-pill--${job.status}`}>
                    {job.status}
                  </span>
                </td>
                <td>
                  <strong>{job.startedAt}</strong>
                  <span>{job.estimatedTime}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
