import { useEffect, useRef } from 'react'
import { Application } from 'pixi.js'
import type maplibregl from 'maplibre-gl'

interface Props {
  map: maplibregl.Map | null
}

export default function PixiOverlay({ map }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const appRef = useRef<Application | null>(null)

  useEffect(() => {
    if (!canvasRef.current || !map || appRef.current) return

    const canvas = canvasRef.current

    const app = new Application()

    app
      .init({
        canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 0, // transparent — map shows through
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        appRef.current = app

        // Re-render Pixi whenever MapLibre redraws so sprites stay in sync
        const onMapRender = () => {
          app.renderer.render(app.stage)
        }
        map.on('render', onMapRender)

        const onResize = () => {
          app.renderer.resize(window.innerWidth, window.innerHeight)
        }
        window.addEventListener('resize', onResize)

        ;(canvas as any).__cleanup = () => {
          map.off('render', onMapRender)
          window.removeEventListener('resize', onResize)
          app.destroy(false)
          appRef.current = null
        }
      })

    return () => {
      ;(canvas as any).__cleanup?.()
    }
  }, [map])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none', // clicks pass through to MapLibre
        zIndex: 1,
      }}
    />
  )
}
