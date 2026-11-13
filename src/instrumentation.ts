// Next.js runs register() once when the server process starts. Used to switch on daily log
// files (see src/lib/file-logging.ts). Only in the Node.js runtime: the file system isn't
// available anywhere else.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installFileLogging } = await import('@/lib/file-logging');
    installFileLogging();
  }
}
