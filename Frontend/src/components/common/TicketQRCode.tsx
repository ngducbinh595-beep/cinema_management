import React, { useMemo } from "react"
import { generateQRMatrix } from "@/lib/qrcode"

interface TicketQRCodeProps {
  value: string
  size?: number
  className?: string
  fgColor?: string
  bgColor?: string
}

export const TicketQRCode: React.FC<TicketQRCodeProps> = ({
  value,
  size = 160,
  className = "",
  fgColor = "#090d14",
  bgColor = "#ffffff",
}) => {
  const matrix = useMemo(() => generateQRMatrix(value), [value])
  const quietZone = 3
  const moduleCount = matrix.length
  const viewBoxSize = moduleCount + quietZone * 2

  const pathData = useMemo(() => {
    const parts: string[] = []
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c]) {
          parts.push(`M${c + quietZone} ${r + quietZone}h1v1h-1z`)
        }
      }
    }
    return parts.join("")
  }, [matrix, moduleCount])

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label="Mã QR vé xem phim"
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill={bgColor} rx={1.5} />
      <path d={pathData} fill={fgColor} />
    </svg>
  )
}
