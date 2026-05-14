'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { ViewType } from '@/types'

interface CalendarContextType {
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  currentDate: Date
  setCurrentDate: (date: Date) => void
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined)

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<ViewType>('week')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())

  return (
    <CalendarContext.Provider
      value={{
        currentView,
        setCurrentView,
        currentDate,
        setCurrentDate,
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar() {
  const context = useContext(CalendarContext)
  if (!context) {
    throw new Error('useCalendar must be used within CalendarProvider')
  }
  return context
}
