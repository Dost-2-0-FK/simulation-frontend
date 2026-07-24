import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface DropdownOption {
  key: string
  label: string
}

interface Props {
  value: string
  options: DropdownOption[]
  onChange: (key: string) => void
  // Fired as the user moves through the open list (mouse hover or arrow-key
  // navigation), with `null` once nothing in the list is highlighted anymore.
  // Lets a caller mirror the highlight elsewhere (e.g. on a map) — something a
  // native <select>'s OS-rendered popup can't expose to the page at all.
  onHighlightChange?: (key: string | null) => void
  disabled?: boolean
  className?: string
}

export default function Dropdown({ value, options, onChange, onHighlightChange, disabled, className }: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const selected = options.find((o) => o.key === value)

  const close = () => {
    setOpen(false)
    setActiveIndex(null)
  }

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  // The active option is the single source of truth for the highlight, so closing
  // (by any path — outside click, Escape, selecting an option) always clears it.
  useEffect(() => {
    onHighlightChange?.(activeIndex !== null ? options[activeIndex]?.key ?? null : null)
  }, [activeIndex, options, onHighlightChange])

  // Focus the listbox on open so arrow keys work immediately, without relying on the
  // `autofocus` attribute (unreliable for elements inserted after initial page load).
  // useLayoutEffect (not useEffect) so focus lands synchronously with the DOM update that
  // opens the list, before the browser paints or any next keystroke can be dispatched.
  useLayoutEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  const selectIndex = (index: number) => {
    const opt = options[index]
    if (!opt) return
    onChange(opt.key)
    close()
  }

  const moveActive = (delta: number) => {
    setActiveIndex((prev) => {
      const base = prev ?? options.findIndex((o) => o.key === value)
      const next = (base + delta + options.length) % options.length
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
      return next
    })
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="w-full truncate rounded border border-gray-300 bg-white px-2 py-1 text-left text-sm disabled:opacity-50"
      >
        {selected?.label ?? '—'}
      </button>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onMouseLeave={() => setActiveIndex(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              moveActive(1)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              moveActive(-1)
            } else if (e.key === 'Enter' && activeIndex !== null) {
              e.preventDefault()
              selectIndex(activeIndex)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              close()
            }
          }}
          className="absolute z-40 mt-1 max-h-56 w-max min-w-full overflow-auto rounded border border-gray-300 bg-white text-sm shadow-lg"
        >
          {options.map((opt, index) => (
            <li
              key={opt.key}
              role="option"
              aria-selected={opt.key === value}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectIndex(index)}
              className={`cursor-pointer whitespace-nowrap px-2 py-1 ${
                index === activeIndex ? 'bg-blue-100' : opt.key === value ? 'bg-blue-50 font-medium' : ''
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
