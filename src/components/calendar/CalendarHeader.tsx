'use client'

import { useCalendar } from '@/providers/CalendarProvider'
import { Button } from '@/components/ui/Button'
import { ViewType } from '@/types'
import { formatDateJa, addWeeks, subWeeks, addMonths, subMonths, addDays, subDays } from '@/lib/date'

export function CalendarHeader() {
  const { currentView, setCurrentView, currentDate, setCurrentDate } = useCalendar()

  const handlePrev = () => {
    if (currentView === 'day') {
      setCurrentDate(subDays(currentDate, 1))
    } else if (currentView === 'week') {
      setCurrentDate(subWeeks(currentDate, 1))
    } else {
      setCurrentDate(subMonths(currentDate, 1))
    }
  }

  const handleNext = () => {
    if (currentView === 'day') {
      setCurrentDate(addDays(currentDate, 1))
    } else if (currentView === 'week') {
      setCurrentDate(addWeeks(currentDate, 1))
    } else {
      setCurrentDate(addMonths(currentDate, 1))
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrev}>
            前へ
          </Button>
          <Button variant="secondary" size="sm" onClick={handleToday}>
            今日
          </Button>
          <Button variant="secondary" size="sm" onClick={handleNext}>
            次へ
          </Button>
        </div>

        <h2 className="text-xl font-semibold">
          {formatDateJa(currentDate, 'yyyy年MM月')}
        </h2>

        <div className="flex items-center gap-2">
          <Button
            variant={currentView === 'day' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setCurrentView('day')}
          >
            日
          </Button>
          <Button
            variant={currentView === 'week' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setCurrentView('week')}
          >
            週
          </Button>
          <Button
            variant={currentView === 'month' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setCurrentView('month')}
          >
            月
          </Button>
        </div>
      </div>
    </div>
  )
}
