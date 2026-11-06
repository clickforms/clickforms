import { range, Sk, SkRegion } from './primitives';
import { SkTable } from './table-skeleton';

/** Mirrors OrgLogsClient: header, category chips, search row and the log table. */
export function LogsSkeleton() {
  return (
    <SkRegion label="Loading logs…">
      <div>
        <div className="users-page-header">
          <div>
            <h1 className="users-page-title">Logs</h1>
            <p className="users-page-subtitle">
              Every logged activity in your organisation, most recent first.
            </p>
          </div>
        </div>

        <div className="card admin-table-card">
          <div className="admin-filter-chip-row">
            {range(5).map((chip) => (
              <Sk key={chip} w={`${4.5 + (chip % 3)}rem`} h="2rem" r="pill" />
            ))}
          </div>
          <div className="table-search-row">
            <Sk w="min(22rem, 100%)" h="2.6rem" r="0.6rem" />
          </div>
          <SkTable
            tableClassName="forms-table"
            rows={9}
            columns={[
              { label: 'Action', kind: 'badge' },
              { label: 'Entity', w: '6rem' },
              { label: 'Details', kind: 'name' },
              { label: 'Actor', kind: 'user', w: '6rem' },
              { label: 'When', w: '6rem' },
            ]}
          />
        </div>
      </div>
    </SkRegion>
  );
}
