import * as React from "react"
import { cn } from "cn"

export interface SwitchProps {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
    className?: string
    id?: string
}

export const Switch: React.FC<SwitchProps> = ({
    checked = false,
    onCheckedChange,
    disabled = false,
    className,
    id,
}) => {
    return (
        <button
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange?.(!checked)}
            className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#caef6b]",
                checked ? "bg-[#caef6b]" : "bg-[#243041]",
                disabled && "cursor-not-allowed opacity-50",
                className
            )}
        >
            <span
                className={cn(
                    "pointer-events-none inline-block size-5 transform rounded-full bg-[#090d14] shadow-lg ring-0 transition duration-200 ease-in-out",
                    checked ? "translate-x-5" : "translate-x-0"
                )}
            />
        </button>
    )
}
