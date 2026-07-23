import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer';

export async function generateSubmissionPdfFromPreviewUrl(
  previewUrl: string,
  cookieHeader: string | null,
): Promise<Buffer> {
  // Explicit, guaranteed-writable, per-invocation profile dir — belt-and-braces
  // alongside the Dockerfile's `ENV HOME=/tmp` fix for the exact same underlying
  // issue (Chromium's crashpad crash-reporting subsystem computing paths from
  // $HOME/the default profile dir and failing when that's missing/unwritable,
  // surfacing as "chrome_crashpad_handler: --database is required"). A fresh dir
  // per call also means two admins exporting PDFs at the same time never race on
  // a shared default profile.
  const userDataDir = join(tmpdir(), `clickforms-pdf-${randomUUID()}`);

  const browser = await puppeteer.launch({
    headless: true,
    // In production this points at the system Chromium installed via apt (see
    // Dockerfile) — Puppeteer's own Chrome-for-Testing download is skipped at
    // build time because it doesn't reliably ship linux-arm64 builds. Locally,
    // this env var is unset and Puppeteer falls back to its normal downloaded
    // browser.
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // Docker's default /dev/shm is 64MB, which Chrome reliably exhausts and
      // crashes on mid-render; fall back to disk-backed shared memory instead.
      '--disable-dev-shm-usage',
      // Debian's `chromium` apt package (see Dockerfile) ships with crashpad crash
      // reporting on by default, which tries to spawn `chrome_crashpad_handler` on
      // launch — that subprocess needs a --database directory Puppeteer never
      // configures, so it exits immediately ("chrome_crashpad_handler: --database
      // is required") and takes the whole browser launch down with it in
      // production ("Failed to launch the browser process"). This feature is only
      // useful for reporting Chrome's own crashes upstream to Google, which we'd
      // never see anyway — disable it outright rather than configuring a dump dir.
      '--disable-crash-reporter',
    ],
  });

  try {
    const page = await browser.newPage();
    // The preview page reads this header to skip rendering the "Submission
    // preview" banner entirely (see src/app/f/[slug]/submissions/[submissionId]/preview/page.tsx).
    // We used to strip the banner client-side via page.evaluate() after load,
    // but that raced with React hydration — the DOM mutation could land while
    // React was still hydrating the page, throwing a hydration-mismatch error
    // in the (headless, but real) browser console. Skipping it server-side
    // avoids the mutation, and the race, entirely.
    const headers: Record<string, string> = { 'x-forms-pdf-export': '1' };
    if (cookieHeader) {
      headers.cookie = cookieHeader;
    }
    await page.setExtraHTTPHeaders(headers);

    // Puppeteer's default viewport (800x600) is what actually lays out the page's CSS —
    // page.pdf()'s width/height below only set the *output paper size*, not the layout
    // viewport, and nothing sizes the two to match on its own. Left at the default, the
    // page renders its content at 800px wide, then gets printed onto an ~960px-usable-
    // width page (11in minus the margins below): different Chromium builds handle that
    // mismatch differently (scale to fit vs. clip at the paper edge), which is exactly
    // why exports looked fine locally (Puppeteer's own bundled Chrome-for-Testing) but
    // came out with content cut off along the right edge in production (Debian's
    // apt-installed `chromium`, a different build entirely — see Dockerfile). Setting an
    // explicit viewport matching the printable width (960px, the same width
    // .export-form's own max-width targets — see submission-export-styles.ts) removes
    // the ambiguity outright, independent of whichever Chromium build renders it.
    await page.setViewport({ width: 960, height: 1280 });

    await page.goto(previewUrl, { waitUntil: 'load', timeout: 30_000 });

    // page.pdf() defaults to Chromium's separate "print" CSS media pipeline,
    // which can render subtly differently from what's actually shown on the
    // preview page admins review before exporting (font metrics, form-control
    // chrome, etc.) — our export stylesheet has no @media print rules of its
    // own to compensate. Forcing "screen" emulation makes the PDF match the
    // preview pixel-for-pixel instead of drifting from it.
    await page.emulateMediaType('screen');

    const pdf = await page.pdf({
      // A4's 8.27in width, minus the 0.5in side margins below, leaves only
      // ~698px of usable content — well short of .export-form's 960px
      // max-width, so that cap never actually kicks in and every field
      // renders visibly narrower/more cramped than on the live/preview form.
      // 11in wide minus the same margins works out to exactly 960px of
      // usable content, so the export hits the same 960px width the live
      // form does on a normal desktop viewport. Height stays at A4's to
      // leave per-page vertical pagination unchanged.
      width: '11in',
      height: '11.69in',
      printBackground: true,
      // 16px read as cramped against the page edge — especially on page 2+,
      // where a section pushed down by break-inside: avoid landed right at
      // the top margin with no breathing room. Standard document margins
      // (~0.5–0.6in) read as a real printed page instead of a screenshot.
      margin: { top: '0.6in', right: '0.5in', bottom: '0.6in', left: '0.5in' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
    // Chrome doesn't clean this up itself on close — left alone, every export would
    // leak a profile directory under /tmp indefinitely.
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function submissionPdfFilename(formName: string, submittedAt: Date | null): string {
  const base = formName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  const datePart = submittedAt
    ? submittedAt.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return `${base || 'submission'}-${datePart}.pdf`;
}
