import { ChartColumn, ChartLine, ChartPie, CircleDashed } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ChartKind } from '../../engine/model/types.ts'

export const CHART_ICONS: Record<ChartKind, ReactNode> = {
  bar: <ChartColumn size={20} />,
  line: <ChartLine size={20} />,
  pie: <ChartPie size={20} />,
  donut: <CircleDashed size={20} />,
}
