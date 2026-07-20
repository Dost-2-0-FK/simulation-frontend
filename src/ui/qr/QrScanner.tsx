import { useEffect, useRef, useState } from 'react'
import { loadScannerScripts } from './loadScannerScripts'
// window.QRScanner / window.jsQR are typed ambiently by ./qrScannerGlobal.d.ts
// (picked up automatically by tsconfig's include glob, no import needed here).

export interface QrScannerProps {
  onScan: (content: string) => void
  /** For failures the vendored widget can't know about itself (script load failure,
   * or a caller's own post-scan payload parsing failure it wants surfaced here). */
  onError?: (message: string) => void
  className?: string
}

// Thin React wrapper around the vendored qr-code-scanner widget (public/qr-scanner/).
// Renders the exact DOM structure scanner.js expects, instantiates it once scripts
// are loaded, forwards its `qrscan` event, and destroys the instance (camera stream +
// its own listeners) on unmount — important since StrictMode/effect re-runs can create
// a fresh instance on the same DOM node, and a leftover click listener from a prior
// instance would fire start() twice and race on the shared <video> element.
export default function QrScanner({ onScan, onError, className }: QrScannerProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadScannerScripts()
      .then(() => {
        if (cancelled) return
        if (typeof window.QRScanner !== 'function') {
          throw new Error('QR scanner failed to initialize.')
        }
        setReady(true)
      })
      .catch((err: Error) => {
        if (cancelled) return
        const message = err.message || 'Failed to load QR scanner.'
        setLoadError(message)
        onError?.(message)
      })
    return () => {
      cancelled = true
    }
    // onError intentionally omitted: callers typically pass an inline arrow function,
    // and re-running this effect on every render would re-trigger the script load check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // window.QRScanner is guaranteed present once `ready` is true (checked above
    // before setReady(true) fires), so no fallback branch is needed here.
    if (!ready || !rootRef.current) return
    const el = rootRef.current
    const instance = new window.QRScanner(el)
    const handleScan = (e: Event) => {
      const detail = (e as CustomEvent<{ content: string }>).detail
      onScan(detail?.content ?? '')
    }
    el.addEventListener('qrscan', handleScan)
    return () => {
      el.removeEventListener('qrscan', handleScan)
      instance.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return (
    <div className={className}>
      {loadError && <div className="text-xs text-red-600">{loadError}</div>}
      <section ref={rootRef} className="qr-scanner" data-qr-scanner>
        <video data-scanner-video playsInline muted aria-hidden="true" />
        <div className="qr-scanner__aperture" aria-hidden="true">
          <i />
        </div>
        <p className="qr-scanner__status" data-scanner-status aria-live="polite">
          {ready ? 'Scanner ready' : 'Loading scanner…'}
        </p>
        <div className="qr-scanner__controls">
          <button type="button" data-scanner-start disabled={!ready}>
            Start scanner
          </button>
        </div>
        <output className="qr-scanner__result" data-scanner-result hidden>
          <small>QR content</small>
          <span data-scanner-content />
        </output>
      </section>
    </div>
  )
}
