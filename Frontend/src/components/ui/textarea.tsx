import * as React from "react"
import { cn } from "cn"

export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={cn(
                    "flex min-h-[80px] w-full rounded-xl border border-[#243041] bg-[#1a2431] px-3.5 py-2.5 text-sm text-[#f4f6f7] placeholder:text-[#9ba9ba]/60 transition-all focus:border-[#caef6b] focus:outline-none focus:ring-1 focus:ring-[#caef6b] disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Textarea.displayName = "Textarea"
