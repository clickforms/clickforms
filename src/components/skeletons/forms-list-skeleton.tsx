import { Sk, SkRegion } from './primitives';
import { SkTable } from './table-skeleton';

/** Mirrors FormsListClient: header, toolbar card (new / search / icons / view toggle), the
 * forms table and its pagination footer. */
export function FormsListSkeleton() {
  return (
    <SkRegion label="Loading forms…">
      <div className="forms-list-page">
        <header className="forms-list-header">
          <div>
            <h1 className="settings-page-title">Forms</h1>
            <p className="settings-page-lead">
              Create, publish, and manage the forms in this organisation.
            </p>
          </div>
        </header>

        <div className="card forms-toolbar-card">
          <div className="forms-toolbar">
            <Sk w="6.5rem" h="2.6rem" r="0.6rem" />
            <div className="forms-toolbar-icons">
              <Sk w="min(20rem, 100%)" h="2.6rem" r="0.6rem" />
              <Sk w="2.6rem" h="2.6rem" r="0.6rem" className="sk-toolbar-icon" />
              <Sk w="2.6rem" h="2.6rem" r="0.6rem" className="sk-toolbar-icon" />
              <Sk w="6.5rem" h="2.6rem" r="0.6rem" style={{ marginLeft: 'auto' }} />
            </div>
          </div>
        </div>

        <div className="card admin-table-card">
          <SkTable
            tableClassName="forms-table"
            rows={8}
            columns={[
              { label: 'Form name', kind: 'name' },
              { label: 'Created', w: '5.5rem' },
              { label: 'Last updated', w: '5.5rem' },
              { label: 'Responses', w: '2.5rem' },
              { label: 'Status', kind: 'badge' },
              { kind: 'none', className: 'forms-row-toggle-cell' },
              { label: 'Created by', kind: 'user' },
              { label: 'Actions', kind: 'actions' },
            ]}
          />
          <div className="forms-pagination">
            <Sk w="8rem" h="0.75rem" />
            <div className="forms-pagination-controls">
              <Sk w="2rem" h="2rem" r="0.5rem" />
              <Sk w="2rem" h="2rem" r="0.5rem" />
            </div>
          </div>
        </div>
      </div>
    </SkRegion>
  );
}
