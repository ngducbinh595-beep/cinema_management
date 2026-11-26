import * as React from "react"
import { cn } from "cn"

export interface LabelProps
    extends React.LabelHTMLAttributes<HTMLLabelElement> { }

export const Label: React.FC<LabelProps> = ({ className, ...props }) => {
    return (
        <label
            className={cn(
                "text-xs font-semibold text-[#9ba9ba] uppercase tracking-wider select-none",
                className
            )}
            {...props}
        />
    )
}
