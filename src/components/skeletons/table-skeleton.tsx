import { range, Sk } from './primitives';

export type SkCellKind = 'text' | 'name' | 'badge' | 'user' | 'actions' | 'icon' | 'check' | 'none';

export interface SkColumn {
  label?: string;
  kind?: SkCellKind;
  /** Width of the bar for text-like cells; varied per row when omitted. */
  w?: string;
  className?: string;
}

const VARIANTS = ['72%', '58%', '84%', '66%', '78%'];

function variant(row: number, col: number): string {
  return VARIANTS[(row * 3 + col * 2) % VARIANTS.length] ?? '70%';
}

function Cell({
  kind = 'text',
  w,
  row,
  col,
}: {
  kind?: SkCellKind;
  w?: string;
  row: number;
  col: number;
}) {
  switch (kind) {
    case 'none':
      return null;
    case 'name':
      return <Sk w={w ?? variant(row, col)} h="0.9rem" />;
    case 'badge':
      return <Sk w="4.5rem" h="1.5rem" r="pill" />;
    case 'user':
      return (
        <span className="sk-cell-user">
          <Sk w="1.6rem" h="1.6rem" r="circle" />
          <Sk w={w ?? '6rem'} h="0.8rem" />
        </span>
      );
    case 'actions':
      return (
        <span className="sk-cell-actions">
          <Sk w="3.75rem" h="1.9rem" r="0.5rem" />
          <Sk w="3.75rem" h="1.9rem" r="0.5rem" />
        </span>
      );
    case 'icon':
      return <Sk w="1.4rem" h="1.4rem" r="circle" />;
    case 'check':
      return <Sk w="1rem" h="1rem" r="0.25rem" />;
    default:
      return <Sk w={w ?? variant(row, col)} h="0.8rem" />;
  }
}

/** Table placeholder using the real `admin-table` classes, so header row, cell padding and
 * row heights match the loaded table. Header labels are static text and render as-is. */
export function SkTable({
  columns,
  rows = 8,
  tableClassName,
}: {
  columns: SkColumn[];
  rows?: number;
  tableClassName?: string;
}) {
  const cols = columns.map((column, id) => ({ ...column, id }));
  return (
    <div className="admin-table-scroll">
      <table className={`admin-table${tableClassName ? ` ${tableClassName}` : ''}`}>
        <thead>
          <tr>
            {cols.map((column) => (
              <th key={column.id} className={column.className}>
                {column.label ?? ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {range(rows).map((row) => (
            <tr key={row}>
              {cols.map((column) => (
                <td key={column.id} className={column.className}>
                  <Cell kind={column.kind} w={column.w} row={row} col={column.id} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
