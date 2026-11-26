import * as React from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface DatePickerProps {
  value?: Date | string
  onChange?: (date: Date, formattedDate: string) => void
  placeholder?: string
  className?: string
  minDate?: Date | null
  showQuickChips?: boolean
  disabled?: boolean
}

const DAYS_OF_WEEK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

export function formatDateVN(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export function formatFullDateVN(d: Date): string {
  const dayNames = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ]
  const dayName = dayNames[d.getDay()]
  return `${dayName}, ${formatDateVN(d)}`
}

function parseDateInput(val?: Date | string): Date {
  if (!val) return new Date()
  if (val instanceof Date) return val
  // Parse format DD/MM/YYYY
  const parts = val.split("/")
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    const y = parseInt(parts[2], 10)
    return new Date(y, m, d)
  }
  const parsed = new Date(val)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = "Chọn ngày",
  className,
  minDate = new Date(),
  showQuickChips = true,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selectedDate = React.useMemo(() => {
    return value ? parseDateInput(value) : undefined
  }, [value])

  const [currentViewMonth, setCurrentViewMonth] = React.useState(() => {
    return selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) : new Date()
  })

  // Synchronize view month with selectedDate if it changes
  React.useEffect(() => {
    if (selectedDate) {
      setCurrentViewMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    }
  }, [selectedDate])

  // Close popup when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const year = currentViewMonth.getFullYear()
  const month = currentViewMonth.getMonth()

  const prevMonth = () => {
    setCurrentViewMonth(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentViewMonth(new Date(year, month + 1, 1))
  }

  // Days in month
  const firstDayOfMonth = new Date(year, month, 1)
  // Day of week: 0 is Sunday, 1 is Monday ... convert to Monday-first (0: T2, 6: CN)
  const startDay = (firstDayOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const handleSelectDate = (d: number) => {
    const newDate = new Date(year, month, d)
    onChange?.(newDate, formatDateVN(newDate))
    setIsOpen(false)
  }

  const handleQuickSelect = (offsetDays: number) => {
    const now = new Date()
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays)
    onChange?.(target, formatDateVN(target))
    setIsOpen(false)
  }

  const isToday = (d: number) => {
    const now = new Date()
    return (
      now.getDate() === d &&
      now.getMonth() === month &&
      now.getFullYear() === year
    )
  }

  const isSelected = (d: number) => {
    if (!selectedDate) return false
    return (
      selectedDate.getDate() === d &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year
    )
  }

  const isPast = (d: number) => {
    if (!minDate) return false
    const dateToCheck = new Date(year, month, d, 23, 59, 59)
    const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0)
    return dateToCheck < min
  }

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border border-[#243041] bg-[#192331]/90 px-3.5 py-2 text-left text-xs font-medium text-white transition-all hover:border-[#3d4f66] focus:border-[#caef6b] focus:outline-none focus:ring-1 focus:ring-[#caef6b]/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
          className
        )}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <CalendarIcon className="size-4 shrink-0 text-[#caef6b]" />
          <span className="truncate">
            {selectedDate ? formatFullDateVN(selectedDate) : placeholder}
          </span>
        </div>
        <span className="text-[10px] text-[#9ba9ba] shrink-0 ml-1">Thay đổi</span>
      </button>

      {/* Popover Calendar Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[310px] rounded-2xl border border-[#243041] bg-[#121923] p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Quick chips (chỉ hiện khi showQuickChips = true) */}
          {showQuickChips && (
            <div className="mb-3 flex items-center gap-1.5 border-b border-[#1f2c3d] pb-2.5">
              <button
                type="button"
                onClick={() => handleQuickSelect(0)}
                className="rounded-lg border border-[#243041] bg-[#1a2431] px-2 py-1 text-[11px] font-semibold text-[#d3dce7] hover:border-[#caef6b] hover:text-[#caef6b] transition-colors cursor-pointer"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(1)}
                className="rounded-lg border border-[#243041] bg-[#1a2431] px-2 py-1 text-[11px] font-semibold text-[#d3dce7] hover:border-[#caef6b] hover:text-[#caef6b] transition-colors cursor-pointer"
              >
                Ngày mai
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(2)}
                className="rounded-lg border border-[#243041] bg-[#1a2431] px-2 py-1 text-[11px] font-semibold text-[#d3dce7] hover:border-[#caef6b] hover:text-[#caef6b] transition-colors cursor-pointer"
              >
                Ngày kia
              </button>
            </div>
          )}

          {/* Month & Year Header */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg p-1.5 text-[#9ba9ba] hover:bg-[#1a2431] hover:text-white transition-colors cursor-pointer"
              aria-label="Tháng trước"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={month}
                onChange={(e) => setCurrentViewMonth(new Date(year, parseInt(e.target.value, 10), 1))}
                className="rounded-lg border border-[#243041] bg-[#1a2431] px-2 py-1 text-xs font-bold text-white focus:border-[#caef6b] focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i} className="bg-[#121923] text-white">
                    Tháng {i + 1}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => setCurrentViewMonth(new Date(parseInt(e.target.value, 10), month, 1))}
                className="rounded-lg border border-[#243041] bg-[#1a2431] px-2 py-1 text-xs font-bold text-white focus:border-[#caef6b] focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 90 }).map((_, i) => {
                  const y = new Date().getFullYear() + 2 - i
                  return (
                    <option key={y} value={y} className="bg-[#121923] text-white">
                      {y}
                    </option>
                  )
                })}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg p-1.5 text-[#9ba9ba] hover:bg-[#1a2431] hover:text-white transition-colors cursor-pointer"
              aria-label="Tháng sau"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Days of week Header */}
          <div className="mb-1.5 grid grid-cols-7 text-center">
            {DAYS_OF_WEEK.map((d) => (
              <span key={d} className="text-[11px] font-bold text-[#9ba9ba]">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Prev month days */}
            {Array.from({ length: startDay }).map((_, i) => (
              <span
                key={`prev-${i}`}
                className="flex size-9 items-center justify-center text-[11px] text-[#425266] select-none"
              >
                {daysInPrevMonth - startDay + i + 1}
              </span>
            ))}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const past = isPast(dayNum)
              const selected = isSelected(dayNum)
              const today = isToday(dayNum)

              return (
                <button
                  key={`cur-${dayNum}`}
                  type="button"
                  disabled={past}
                  onClick={() => handleSelectDate(dayNum)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl text-xs font-medium transition-all cursor-pointer",
                    past && "opacity-25 cursor-not-allowed hover:bg-transparent text-[#9ba9ba]",
                    !past && !selected && "text-white hover:bg-[#1c293a] hover:text-[#caef6b]",
                    today && !selected && "border border-[#caef6b]/50 text-[#caef6b] font-bold",
                    selected && "bg-[#caef6b] text-[#090d14] font-extrabold shadow-[0_0_12px_rgba(202,239,107,0.4)]"
                  )}
                >
                  {dayNum}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
