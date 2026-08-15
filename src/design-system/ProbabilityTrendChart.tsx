import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type ProbabilityTrendPoint = {
  label: string
  home: number
  draw: number
  away: number
}

export type ProbabilityTrendChartProps = {
  points: ProbabilityTrendPoint[]
  height?: number
  ariaLabel?: string
}

/**
 * Small shared primitive for probability history: model snapshots, market
 * movement, calibration examples, or admin evidence. Values are supplied as
 * 0..1 probabilities and displayed as percentages.
 */
export function ProbabilityTrendChart({
  points,
  height = 280,
  ariaLabel = 'Home, draw and away probability trend',
}: ProbabilityTrendChartProps) {
  const data = points.map((point) => ({
    label: point.label,
    Home: Math.round(point.home * 1000) / 10,
    Draw: Math.round(point.draw * 1000) / 10,
    Away: Math.round(point.away * 1000) / 10,
  }))

  return (
    <div role="img" aria-label={ariaLabel} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--tx3)', fontSize: 12 }} />
          <YAxis
            domain={[0, 100]}
            unit="%"
            width={44}
            tick={{ fill: 'var(--tx3)', fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)}%`]}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-input)',
              color: 'var(--tx)',
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="Home" stroke="var(--acc)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Draw" stroke="var(--amb)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Away" stroke="var(--cyn)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
