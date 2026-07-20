export {}

declare global {
  interface Window {
    QRScanner: new (element: HTMLElement) => { stop(): void; destroy(): void }
    jsQR?: unknown
  }
}
