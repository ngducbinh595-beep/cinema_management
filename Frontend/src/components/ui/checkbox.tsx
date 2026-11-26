import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "cn"

export interface CheckboxProps {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
    className?: string
    id?: string
}

export const Checkbox: React.FC<CheckboxProps> = ({
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
            role="checkbox"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange?.(!checked)}
            className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-md border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#caef6b]",
                checked
                    ? "border-[#caef6b] bg-[#caef6b] text-[#090d14]"
                    : "border-[#243041] bg-[#1a2431] hover:border-[#3b4c63]",
                disabled && "cursor-not-allowed opacity-50",
                className
            )}
        >
            {checked && <Check className="size-3.5 stroke-[3]" />}
        </button>
    )
}
