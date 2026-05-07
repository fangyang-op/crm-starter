'use client'

import * as React from 'react'

import { Upload } from 'lucide-react'

import { cn } from '@/lib/utils'

interface FileUploadButtonProps {
  /** MIME accept string (e.g. "application/pdf,image/png"). */
  accept: string
  /** Max file size in MB. Used in the default label only — actual cap is
   *  enforced server-side. Defaults to 10. */
  maxMB?: number
  /** Override the auto-generated 「選擇檔案 (...)」 label. */
  label?: string
  onChange: (file: File) => void
  disabled?: boolean
  /** Optional id so a parent <Label htmlFor=...> works. */
  id?: string
  className?: string
  /**
   * 'area' (default) — full-width dashed drop-zone style, for upload sections
   * inside dialogs/sheets where the upload is the primary action.
   *
   * 'button' — compact inline button (no full label), suitable for table row
   * actions or icon-bar slots. Falls back to a tiny "選檔" label when `label`
   * isn't provided so it doesn't blow out the surrounding layout.
   */
  variant?: 'area' | 'button'
}

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',
}

/** Turn "application/pdf,image/png,image/jpeg" → "PDF / PNG / JPEG". */
function formatAccept(accept: string): string {
  const parts = accept
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const labels: string[] = []
  for (const p of parts) {
    const friendly = MIME_LABELS[p] ?? p.split('/').pop()?.toUpperCase() ?? p
    if (!labels.includes(friendly)) labels.push(friendly)
  }
  return labels.join(' / ')
}

export function FileUploadButton({
  accept,
  maxMB = 10,
  label,
  onChange,
  disabled,
  id,
  className,
  variant = 'area',
}: FileUploadButtonProps) {
  const isButton = variant === 'button'
  const text = label ?? (isButton ? '選檔' : `選擇檔案 (${formatAccept(accept)},最大 ${maxMB}MB)`)

  return (
    <label
      htmlFor={id}
      className={cn(
        'group cursor-pointer transition-colors',
        isButton
          ? // Compact inline button style — fits next to other action buttons
            // in a table row. Keeps the dashed border so it's visually
            // recognisable as an upload trigger.
            'inline-flex items-center gap-1 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:bg-muted/60 hover:text-foreground'
          : // Full-width drop-zone style. Stacked icon + label, vertical
            // padding gives the eye somewhere to land.
            'flex w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:bg-muted/60 hover:text-foreground',
        'focus-within:border-primary focus-within:ring-2 focus-within:ring-ring',
        disabled && 'pointer-events-none cursor-not-allowed opacity-60',
        className,
      )}
    >
      <Upload
        size={isButton ? 12 : 16}
        className="text-muted-foreground group-hover:text-primary"
      />
      <span className="select-none">{text}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onChange(file)
          // Reset so picking the same file twice fires onChange again.
          e.target.value = ''
        }}
        className="sr-only"
      />
    </label>
  )
}
