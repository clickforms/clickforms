import { Sk, SkRegion } from './primitives';
import { SkTable } from './table-skeleton';

/** Mirrors UsersClient: header with Add user, then the users table. */
export function UsersSkeleton() {
  return (
    <SkRegion label="Loading users…">
      <div className="users-page">
        <div className="users-page-header">
          <div>
            <h1 className="users-page-title">Users</h1>
            <p className="users-page-subtitle">
              Give each of your staff their own login with different levels of access. Share the
              invite link with them after adding a user.
            </p>
          </div>
          <Sk w="7.5rem" h="2.5rem" r="0.6rem" />
        </div>

        <div className="card users-table-card">
          <SkTable
            baseClass="users-table"
            rows={6}
            columns={[
              { label: 'Name', kind: 'user', w: '7rem' },
              { label: 'Email', w: '11rem' },
              { label: 'Role', kind: 'badge' },
              { label: 'Forms owned', w: '1.5rem' },
              { label: 'Assigned', w: '1.5rem' },
              { label: '2FA', kind: 'badge' },
              { label: 'Created', w: '5rem' },
              { kind: 'icon' },
            ]}
          />
        </div>
      </div>
    </SkRegion>
  );
}
