// Lazily injects the vendored qr-code-scanner assets (public/qr-scanner/) as plain
// <script>/<link> tags, exactly once per session no matter how many QrScanner
// instances mount. These are non-module IIFEs (see scanner.js) and must run in
// global scope rather than go through Vite's module graph.
let scriptsPromise: Promise<void> | null = null

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (existing.hasAttribute('data-loaded')) return resolve()
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = false // preserve execution order relative to the next injectScript call
    script.addEventListener('load', () => {
      script.setAttribute('data-loaded', 'true')
      resolve()
    })
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)))
    document.head.appendChild(script)
  })
}

// jsQR must load (and set window.jsQR) before scanner.js, whose fallback decoder
// path checks `typeof window.jsQR !== "function"`.
export function loadScannerScripts(): Promise<void> {
  if (!scriptsPromise) {
    if (!document.querySelector('link[data-qr-scanner-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/qr-scanner/scanner.css'
      link.setAttribute('data-qr-scanner-css', 'true')
      document.head.appendChild(link)
    }
    scriptsPromise = injectScript('/qr-scanner/vendor/jsQR.js').then(() =>
      injectScript('/qr-scanner/scanner.js'),
    )
  }
  return scriptsPromise
}
