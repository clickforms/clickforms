import { Sk, SkRegion } from './primitives';
import { SkTable } from './table-skeleton';

/** Mirrors FilesClient: toolbar (search, upload, bulk actions) over the files table. */
export function FilesSkeleton() {
  return (
    <SkRegion label="Loading files…">
      <div className="card admin-table-card">
        <div className="files-toolbar">
          <Sk w="min(20rem, 100%)" h="2.6rem" r="0.6rem" />
          <div className="files-toolbar-right">
            <Sk w="8rem" h="2.6rem" r="0.6rem" />
            <Sk w="2.6rem" h="2.6rem" r="0.6rem" />
          </div>
        </div>
        <SkTable
          tableClassName="files-table"
          rows={9}
          columns={[
            { kind: 'check', className: 'files-table-check' },
            { label: 'File Name', kind: 'name' },
            { label: 'File Type', w: '4.5rem' },
            { label: 'Created', w: '5.5rem' },
            { label: 'Size', w: '3.5rem' },
            { label: 'Form', w: '7rem' },
            { label: 'Status', kind: 'badge' },
          ]}
        />
      </div>
    </SkRegion>
  );
}
