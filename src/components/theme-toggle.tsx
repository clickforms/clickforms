'use client';

// Shared dark/light theme toggle switch — originally lived only in the org workspace's
// AdminSidebar (src/app/forms/admin-sidebar.tsx), extracted here so the platform-admin
// shell (src/app/admin/admin-platform-shell.tsx) can reuse the exact same control and
// icons rather than duplicating them, now that /admin also supports dark mode.

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 1.5v1.4M8 13.1v1.4M2.9 2.9l1 1M12.1 12.1l1 1M1.5 8h1.4M13.1 8h1.4M2.9 13.1l1-1M12.1 3.9l1-1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.8 9.9A5.8 5.8 0 1 1 6.1 2.2a4.6 4.6 0 0 0 7.7 7.7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ThemeToggleProps {
  isDarkTheme: boolean;
  onToggleTheme: () => void;
}

/** Full row switch — icon + "Dark mode"/"Light mode" label + track — styled via
 * .theme-toggle's --sidebar-* vars, so it only reads correctly against the org
 * workspace's permanently-dark sidebar rail (see AdminSidebar). Not for use anywhere
 * else — see ThemeToggleIconButton below for a light-surface/header equivalent. */
export function ThemeToggle({ isDarkTheme, onToggleTheme }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={isDarkTheme}
      onClick={onToggleTheme}
    >
      <span className="theme-toggle-left">
        <span className="admin-sidebar-nav-icon">{isDarkTheme ? <MoonIcon /> : <SunIcon />}</span>
        <span className="admin-sidebar-nav-item-label">
          {isDarkTheme ? 'Dark mode' : 'Light mode'}
        </span>
      </span>
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
    </button>
  );
}

/** Compact icon-only toggle for horizontal, light-surface headers (the platform-admin
 * top bar, which has no dark sidebar rail to anchor .theme-toggle's own styling to).
 * Styled with the same --color-* tokens as .admin-header-menu, so it already adapts to
 * [data-theme="dark"] automatically rather than needing its own override. */
export function ThemeToggleIconButton({ isDarkTheme, onToggleTheme }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className="admin-platform-theme-toggle"
      role="switch"
      aria-checked={isDarkTheme}
      aria-label={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={onToggleTheme}
    >
      {isDarkTheme ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
