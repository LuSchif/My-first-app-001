import { Bell, X } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { loadCalendar } from './calendarStore.ts'
import {
  currentReminders,
  dismissReminder,
  reminderText,
  startReminders,
  subscribeReminders,
} from './reminders.ts'

/** Reminders that are due, shown on top of whatever is open while Broomit runs. */
export function ReminderToasts() {
  const reminders = useSyncExternalStore(subscribeReminders, currentReminders)
  useEffect(() => {
    void loadCalendar().then(startReminders)
  }, [])
  if (!reminders.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-[70] grid justify-items-center gap-2 px-3">
      {reminders.map((r) => (
        <div
          key={r.key}
          role="alert"
          className="pointer-events-auto flex w-full max-w-sm animate-pop-in items-center gap-3 rounded-panel bg-ink py-2 pr-2 pl-4 text-ink-inverse shadow-overlay"
        >
          <Bell size={18} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{r.title}</span>
            <span className="block text-xs opacity-80">{reminderText(r)}</span>
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismissReminder(r.key)}
            className="grid size-10 place-items-center rounded-control hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
