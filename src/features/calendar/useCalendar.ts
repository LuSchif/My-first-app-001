import { useEffect, useSyncExternalStore } from 'react'
import { calendarSnapshot, loadCalendar, refreshAll, subscribeCalendar } from './calendarStore.ts'

/** The calendar's data, loaded on first use and kept up to date while shown. */
export function useCalendar() {
  const data = useSyncExternalStore(subscribeCalendar, calendarSnapshot)
  useEffect(() => {
    void loadCalendar()
    // Timetables change during the day; look again every half hour and when coming back.
    const timer = setInterval(() => void refreshAll(), 30 * 60 * 1000)
    const onVisible = () => document.visibilityState === 'visible' && void refreshAll()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return data
}
