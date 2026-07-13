'use client';

import Link from 'next/link';
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/toast';
import { getErrorMessage, readApiError } from '@/lib/error-message';
import { formatFileSize } from '@/lib/format-file-size';

/** Keep in sync with MAX_UPLOAD_SIZE_BYTES in src/lib/s3.ts — not imported from there
 * because that module pulls in the AWS SDK and must stay server-only. */
const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

export interface FileRow {
  id: string;
  source: 'library' | 'submission';
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  /** Display date — library upload time, or submission finalized time. */
  submittedAt: string;
  statusLabel: string;
  statusClassName: string;
  fieldKey: string | null;
  formId: string | null;
  formName: string | null;
  submissionId: string | null;
  downloadUrl: string | null;
}

type SortColumn =
  | 'filename'
  | 'mimeType'
  | 'submittedAt'
  | 'sizeBytes'
  | 'formName'
  | 'statusLabel';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 25;

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'filename', label: 'File Name' },
  { key: 'mimeType', label: 'File Type' },
  { key: 'submittedAt', label: 'Created' },
  { key: 'sizeBytes', label: 'Size' },
  { key: 'formName', label: 'Form' },
  { key: 'statusLabel', label: 'Status' },
];

function uniqueForms(files: FileRow[]): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const file of files) {
    if (file.formId && file.formName) byId.set(file.formId, file.formName);
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function visiblePageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M3 4.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadCloudIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M12.5 12.5L9 9l-3.5 3.5M9 9v6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.8 13.2A3.5 3.5 0 0012 7.1a5 5 0 00-9.5 1.4A3.2 3.2 0 004.8 14.5h9.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5v7M5.5 7 8 9.5 10.5 7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.5v1.5a1 1 0 001 1h8a1 1 0 001-1v-1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11.5 11.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 4.5h9M6 4.5V3.5h4v1M5.5 4.5l.5 8h4l.5-8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function computePanelStyle(trigger: HTMLElement, panel: HTMLElement): CSSProperties {
  const triggerRect = trigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const gap = 6;
  const viewportPadding = 8;

  let top = triggerRect.bottom + gap;
  if (top + panelRect.height > window.innerHeight - viewportPadding) {
    const aboveTop = triggerRect.top - panelRect.height - gap;
    top = aboveTop >= viewportPadding ? aboveTop : viewportPadding;
  }

  let left = triggerRect.right - panelRect.width;
  left = Math.max(
    viewportPadding,
    Math.min(left, window.innerWidth - panelRect.width - viewportPadding),
  );

  return { position: 'fixed', top, left };
}

type MenuItem =
  | { kind: 'link'; label: string; href: string; icon: ReactNode }
  | { kind: 'anchor'; label: string; href: string; icon: ReactNode }
  | { kind: 'button'; label: string; icon: ReactNode; onClick: () => void; danger?: boolean }
  | { kind: 'disabled'; label: string; icon: ReactNode; title?: string };

function FileActionsMenu({ file, onDelete }: { file: FileRow; onDelete: (file: FileRow) => void }) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    setPanelStyle(computePanelStyle(triggerRef.current, panelRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function reposition() {
      if (!triggerRef.current || !panelRef.current) return;
      setPanelStyle(computePanelStyle(triggerRef.current, panelRef.current));
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setPanelStyle(null);
  }, [open]);

  const items: MenuItem[] = [
    file.downloadUrl
      ? { kind: 'anchor', label: 'Download', href: file.downloadUrl, icon: <DownloadIcon /> }
      : {
          kind: 'disabled',
          label: 'Download',
          icon: <DownloadIcon />,
          title: 'Download link unavailable',
        },
  ];

  if (file.source === 'submission' && file.formId && file.submissionId) {
    items.push({
      kind: 'link',
      label: 'View submission',
      href: `/forms/${file.formId}/submissions/${file.submissionId}`,
      icon: <ViewIcon />,
    });
  }

  if (file.source === 'library') {
    items.push({
      kind: 'button',
      label: 'Delete',
      icon: <DeleteIcon />,
      danger: true,
      onClick: () => onDelete(file),
    });
  }

  const panel =
    open && typeof document !== 'undefined' ? (
      <ul
        ref={panelRef}
        className="actions-menu-panel"
        id={menuId}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: this is the WAI-ARIA APG menu pattern (ul[role=menu] > li[role=none] > [role=menuitem]) — the recommended accessible implementation, not an oversight
        role="menu"
        style={{ ...panelStyle, visibility: panelStyle ? 'visible' : 'hidden' }}
      >
        {items.map((item) => {
          if (item.kind === 'disabled') {
            return (
              <li key={item.label} role="none">
                <span
                  className="actions-menu-item actions-menu-item--disabled"
                  title={item.title ?? 'Unavailable'}
                >
                  <span className="actions-menu-icon">{item.icon}</span>
                  {item.label}
                </span>
              </li>
            );
          }
          if (item.kind === 'anchor') {
            return (
              <li key={item.label} role="none">
                <a
                  href={item.href}
                  className="actions-menu-item"
                  role="menuitem"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                >
                  <span className="actions-menu-icon">{item.icon}</span>
                  {item.label}
                </a>
              </li>
            );
          }
          if (item.kind === 'link') {
            return (
              <li key={item.label} role="none">
                <Link
                  href={item.href}
                  className="actions-menu-item"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <span className="actions-menu-icon">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          }
          return (
            <li key={item.label} role="none">
              <button
                type="button"
                className={
                  item.danger ? 'actions-menu-item actions-menu-item--danger' : 'actions-menu-item'
                }
                role="menuitem"
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
              >
                <span className="actions-menu-icon">{item.icon}</span>
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div className="actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className="actions-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        Actions
        <ChevronIcon />
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

function BulkActionsMenu({
  selectedCount,
  onDownloadSelected,
}: {
  selectedCount: number;
  onDownloadSelected: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    setPanelStyle(computePanelStyle(triggerRef.current, panelRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function reposition() {
      if (!triggerRef.current || !panelRef.current) return;
      setPanelStyle(computePanelStyle(triggerRef.current, panelRef.current));
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setPanelStyle(null);
  }, [open]);

  const panel =
    open && typeof document !== 'undefined' ? (
      <ul
        ref={panelRef}
        className="actions-menu-panel"
        id={menuId}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: this is the WAI-ARIA APG menu pattern (ul[role=menu] > li[role=none] > [role=menuitem]) — the recommended accessible implementation, not an oversight
        role="menu"
        style={{ ...panelStyle, visibility: panelStyle ? 'visible' : 'hidden' }}
      >
        <li role="none">
          <button
            type="button"
            className="actions-menu-item"
            role="menuitem"
            disabled={selectedCount === 0}
            onClick={() => {
              onDownloadSelected();
              setOpen(false);
            }}
          >
            <span className="actions-menu-icon">
              <DownloadIcon />
            </span>
            Download selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
        </li>
      </ul>
    ) : null;

  return (
    <div className="actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className="button button--ghost files-toolbar-actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        Actions
        <ChevronIcon />
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

interface ColumnFilters {
  filename: string;
  mimeType: string;
  submittedAt: string;
  sizeBytes: string;
  formName: string;
  statusLabel: string;
}

const EMPTY_FILTERS: ColumnFilters = {
  filename: '',
  mimeType: '',
  submittedAt: '',
  sizeBytes: '',
  formName: '',
  statusLabel: '',
};

async function uploadLibraryFile(file: File): Promise<FileRow> {
  const presignResponse = await fetch('/api/files/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  });
  if (!presignResponse.ok) {
    throw new Error(await readApiError(presignResponse, 'Failed to start upload'));
  }
  const { uploadUrl, storageKey } = (await presignResponse.json()) as {
    uploadUrl: string;
    storageKey: string;
  };

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error('Upload to storage failed. Check S3 configuration and try again.');
  }

  const confirmResponse = await fetch('/api/files/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storageKey,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  });
  if (!confirmResponse.ok) {
    throw new Error(await readApiError(confirmResponse, 'Failed to save uploaded file'));
  }

  const { file: saved } = (await confirmResponse.json()) as {
    file: {
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      uploadedAt: string;
      downloadUrl: string | null;
    };
  };

  return {
    id: saved.id,
    source: 'library',
    filename: saved.filename,
    mimeType: saved.mimeType,
    sizeBytes: saved.sizeBytes,
    uploadedAt: saved.uploadedAt,
    submittedAt: saved.uploadedAt,
    statusLabel: 'Active',
    statusClassName: 'badge--success',
    fieldKey: null,
    formId: null,
    formName: null,
    submissionId: null,
    downloadUrl: saved.downloadUrl,
  };
}

interface FilesClientProps {
  initialFiles: FileRow[];
  downloadsUnavailableReason: string | null;
}

export function FilesClient({ initialFiles, downloadsUnavailableReason }: FilesClientProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState(initialFiles);
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [sortColumn, setSortColumn] = useState<SortColumn>('submittedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  const forms = useMemo(() => uniqueForms(files), [files]);

  function toggleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'submittedAt' || column === 'sizeBytes' ? 'desc' : 'asc');
    }
  }

  function setColumnFilter(key: keyof ColumnFilters, value: string) {
    setColumnFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  async function handleFilesSelected(fileList: FileList | File[]) {
    const selected = Array.from(fileList);
    if (selected.length === 0) return;

    setIsUploading(true);
    let uploaded = 0;
    try {
      for (const file of selected) {
        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
          toast.error(`${file.name} exceeds the ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB limit.`);
          continue;
        }
        const row = await uploadLibraryFile(file);
        setFiles((current) => [row, ...current]);
        uploaded += 1;
      }
      if (uploaded > 0) {
        toast.success(uploaded === 1 ? 'File uploaded' : `${uploaded} files uploaded`);
        setPage(1);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Upload failed'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(file: FileRow) {
    if (file.source !== 'library') return;
    const previous = files;
    setFiles((current) => current.filter((entry) => entry.id !== file.id));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(file.id);
      return next;
    });

    try {
      const response = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to delete file'));
      }
      toast.success('File deleted');
    } catch (error) {
      setFiles(previous);
      toast.error(getErrorMessage(error, 'Failed to delete file'));
    }
  }

  const visibleFiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = files.filter((file) => {
      if (term && !file.filename.toLowerCase().includes(term)) return false;
      if (
        columnFilters.filename &&
        !file.filename.toLowerCase().includes(columnFilters.filename.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        columnFilters.mimeType &&
        !file.mimeType.toLowerCase().includes(columnFilters.mimeType.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        columnFilters.submittedAt &&
        !formatCreatedAt(file.submittedAt)
          .toLowerCase()
          .includes(columnFilters.submittedAt.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        columnFilters.sizeBytes &&
        !formatFileSize(file.sizeBytes)
          .toLowerCase()
          .includes(columnFilters.sizeBytes.trim().toLowerCase())
      ) {
        return false;
      }
      if (columnFilters.formName) {
        const formName = file.formName ?? '';
        if (!formName.toLowerCase().includes(columnFilters.formName.trim().toLowerCase())) {
          return false;
        }
      }
      if (
        columnFilters.statusLabel &&
        !file.statusLabel.toLowerCase().includes(columnFilters.statusLabel.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      let result = 0;
      switch (sortColumn) {
        case 'filename':
          result = a.filename.localeCompare(b.filename);
          break;
        case 'mimeType':
          result = a.mimeType.localeCompare(b.mimeType);
          break;
        case 'formName':
          result = (a.formName ?? '').localeCompare(b.formName ?? '');
          break;
        case 'sizeBytes':
          result = a.sizeBytes - b.sizeBytes;
          break;
        case 'statusLabel':
          result = a.statusLabel.localeCompare(b.statusLabel);
          break;
        case 'submittedAt':
          result = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
          break;
      }
      return sortDirection === 'asc' ? result : -result;
    });
  }, [files, search, columnFilters, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(visibleFiles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = visibleFiles.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, visibleFiles.length);
  const pageFiles = visibleFiles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const allPageSelected =
    pageFiles.length > 0 && pageFiles.every((file) => selectedIds.has(file.id));
  const somePageSelected = pageFiles.some((file) => selectedIds.has(file.id));

  function toggleSelectAllOnPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        for (const file of pageFiles) next.delete(file.id);
      } else {
        for (const file of pageFiles) next.add(file.id);
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function downloadSelected() {
    for (const file of files) {
      if (!selectedIds.has(file.id) || !file.downloadUrl) continue;
      window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        className="files-hidden-input"
        multiple
        onChange={(event) => {
          if (event.target.files) void handleFilesSelected(event.target.files);
        }}
      />

      {downloadsUnavailableReason ? (
        <div className="card files-page-s3-warning">
          <p className="files-page-s3-warning-text">
            Download links are unavailable: {downloadsUnavailableReason} File metadata below is
            still accurate.
          </p>
        </div>
      ) : null}

      <div className="card admin-table-card">
        <div className="files-toolbar">
          <input
            className="text-input files-toolbar-search"
            placeholder="Search Files..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            aria-label="Search files"
          />
          <div className="files-toolbar-right">
            <button
              type="button"
              className="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloudIcon />
              {isUploading ? 'Uploading…' : 'Upload File'}
            </button>
            <BulkActionsMenu
              selectedCount={selectedIds.size}
              onDownloadSelected={downloadSelected}
            />
          </div>
        </div>

        {files.length === 0 ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop is a convenience on top of the "Upload File" button below, which is the fully keyboard-accessible path
          <div
            className={
              isDragging ? 'files-empty-state files-empty-state--dragging' : 'files-empty-state'
            }
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (event.currentTarget.contains(event.relatedTarget as Node)) return;
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              if (event.dataTransfer.files.length > 0) {
                void handleFilesSelected(event.dataTransfer.files);
              }
            }}
          >
            <div className="files-empty-icon" aria-hidden="true">
              <UploadCloudIcon />
            </div>
            <h2 className="files-empty-title">Upload your first file</h2>
            <p className="files-empty-copy">
              Drop files here, or choose files to add to your organisation library. Files uploaded
              on form submissions will also appear here.
            </p>
            <button
              type="button"
              className="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloudIcon />
              {isUploading ? 'Uploading…' : 'Upload File'}
            </button>
          </div>
        ) : (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table files-table">
                <thead>
                  <tr>
                    <th className="files-table-check">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        disabled={pageFiles.length === 0}
                        ref={(input) => {
                          if (input) input.indeterminate = somePageSelected && !allPageSelected;
                        }}
                        onChange={toggleSelectAllOnPage}
                        aria-label="Select all files on this page"
                      />
                    </th>
                    {COLUMNS.map((column) => (
                      <th key={column.key}>
                        <button
                          type="button"
                          className="table-sort-button"
                          onClick={() => toggleSort(column.key)}
                        >
                          {column.label}
                          <span className="table-sort-stack" aria-hidden="true">
                            <span
                              className={
                                sortColumn === column.key && sortDirection === 'asc'
                                  ? 'table-sort-arrow table-sort-arrow--active'
                                  : 'table-sort-arrow'
                              }
                            >
                              ▲
                            </span>
                            <span
                              className={
                                sortColumn === column.key && sortDirection === 'desc'
                                  ? 'table-sort-arrow table-sort-arrow--active'
                                  : 'table-sort-arrow'
                              }
                            >
                              ▼
                            </span>
                          </span>
                        </button>
                      </th>
                    ))}
                    <th aria-label="Actions" />
                  </tr>
                  <tr className="files-table-filter-row">
                    <th className="files-table-check" />
                    {(
                      [
                        'filename',
                        'mimeType',
                        'submittedAt',
                        'sizeBytes',
                        'formName',
                        'statusLabel',
                      ] as const
                    ).map((key) => (
                      <th key={key}>
                        <input
                          className="text-input files-column-filter"
                          value={columnFilters[key]}
                          onChange={(event) => setColumnFilter(key, event.target.value)}
                          aria-label={`Filter by ${key}`}
                          list={
                            key === 'formName'
                              ? 'files-form-filter-options'
                              : key === 'statusLabel'
                                ? 'files-status-filter-options'
                                : undefined
                          }
                        />
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pageFiles.map((file) => (
                    <tr key={`${file.source}-${file.id}`}>
                      <td className="files-table-check" data-label="Select">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(file.id)}
                          onChange={() => toggleSelect(file.id)}
                          aria-label={`Select ${file.filename}`}
                        />
                      </td>
                      <td data-label="File Name">
                        {file.downloadUrl ? (
                          <a
                            href={file.downloadUrl}
                            className="admin-table-name-link"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {file.filename}
                          </a>
                        ) : (
                          <span className="files-table-filename">{file.filename}</span>
                        )}
                      </td>
                      <td data-label="File Type" className="users-table-muted">
                        {file.mimeType}
                      </td>
                      <td data-label="Created">{formatCreatedAt(file.submittedAt)}</td>
                      <td data-label="Size">{formatFileSize(file.sizeBytes)}</td>
                      <td data-label="Form">
                        {file.formId && file.formName && file.submissionId ? (
                          <Link
                            href={`/forms/${file.formId}/submissions/${file.submissionId}`}
                            className="admin-table-name-link"
                          >
                            {file.formName}
                          </Link>
                        ) : (
                          <span className="users-table-muted">—</span>
                        )}
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${file.statusClassName}`}>{file.statusLabel}</span>
                      </td>
                      <td data-label="Actions">
                        <FileActionsMenu file={file} onDelete={handleDelete} />
                      </td>
                    </tr>
                  ))}
                  {visibleFiles.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 2} className="admin-table-empty">
                        No files match your filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              <datalist id="files-form-filter-options">
                {forms.map((form) => (
                  <option key={form.id} value={form.name} />
                ))}
              </datalist>
              <datalist id="files-status-filter-options">
                <option value="Active" />
                <option value="Submitted" />
                <option value="Approved" />
                <option value="Rejected" />
              </datalist>
            </div>

            <div className="files-pagination">
              <p className="files-pagination-summary">
                {visibleFiles.length === 0
                  ? 'Showing 0 entries'
                  : `Showing ${pageStart} to ${pageEnd} of ${visibleFiles.length} entries`}
              </p>
              <div className="files-pagination-controls">
                <button
                  type="button"
                  className="files-pagination-button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </button>
                {visiblePageNumbers(currentPage, totalPages).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={
                      pageNumber === currentPage
                        ? 'files-pagination-button files-pagination-button--active'
                        : 'files-pagination-button'
                    }
                    onClick={() => setPage(pageNumber)}
                    aria-current={pageNumber === currentPage ? 'page' : undefined}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  className="files-pagination-button"
                  disabled={currentPage >= totalPages || visibleFiles.length === 0}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
