import { useEffect, useRef } from 'react'
// alias echarts's `use` (it is NOT a React hook — avoids a react-hooks false positive)
import { init, use as registerECharts, type EChartsType } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'

// register only what we use → the lazy chunk is a fraction of the full echarts bundle
registerECharts([BarChart, GridComponent, CanvasRenderer])

// Imperative ECharts wrapper, resize-observed. Charts are canvas (opaque to a screen
// reader), so callers MUST pass an `ariaLabel` and also render a text/table alternative
// (the data-behind-viz principle).
export function EChart({
  option,
  height = 200,
  ariaLabel,
}: {
  option: EChartsOption
  height?: number
  ariaLabel?: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<EChartsType | null>(null)

  useEffect(() => {
    if (!el.current) return
    chart.current = init(el.current, undefined, { renderer: 'canvas' })
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      chart.current?.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(option, true)
  }, [option])

  return <div ref={el} style={{ height, width: '100%' }} role="img" aria-label={ariaLabel} />
}
