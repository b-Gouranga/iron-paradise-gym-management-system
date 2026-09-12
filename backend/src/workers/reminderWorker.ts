import { generateReminders, processReminders } from '../services/reminders/reminderEngine.js'

/**
 * Standalone background reminder worker.
 *
 * Designed to execute independently of the web application or browser:
 * - Can be invoked via system cron, cloud scheduler, container task, or systemd timer.
 * - Scans memberships, evaluates reminder stages, and dispatches due reminders.
 * - Adheres to all database idempotency and opt-in constraints.
 *
 * Run:
 *   npm run worker:reminders
 */
export async function runReminderWorker(): Promise<void> {
  const startTime = Date.now()
  console.log(`[ReminderWorker] Starting automated reminder scan at ${new Date().toISOString()}...`)

  try {
    // 1. Generate scheduled reminders for eligible memberships
    const genResult = await generateReminders()
    console.log(
      `[ReminderWorker] Candidate scan complete. Scanned: ${genResult.scannedCount}, Generated: ${genResult.generatedCount}, Skipped: ${genResult.skippedCount}`,
    )

    if (genResult.errors.length > 0) {
      console.warn(`[ReminderWorker] Warnings during candidate generation:`, genResult.errors)
    }

    // 2. Process and dispatch all scheduled reminders
    const procResult = await processReminders()
    console.log(
      `[ReminderWorker] Dispatch complete. Processed: ${procResult.processedCount}, Sent: ${procResult.sentCount}, Failed: ${procResult.failedCount}`,
    )

    const elapsed = Date.now() - startTime
    console.log(`[ReminderWorker] Worker run completed successfully in ${elapsed}ms.`)
  } catch (err: any) {
    console.error(`[ReminderWorker] Fatal error executing reminder worker:`, err)
    process.exit(1)
  }
}

// Automatically execute if run directly via CLI/script
if (process.argv[1]?.endsWith('reminderWorker.ts') || process.argv[1]?.endsWith('reminderWorker.js')) {
  runReminderWorker()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
