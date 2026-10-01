import React from 'react';

export interface ChartPoint {
  daysBeforeDeparture: number;
  label?: string;
  averageFare: number | null;
  minFare?: number | null;
  maxFare?: number | null;
  dataPointsCount: number;
  distinctDatesCount?: number;
  status: 'sufficient' | 'insufficient_data';
}

interface BookingWindowCurveChartProps {
  points: ChartPoint[];
  title?: string;
  subtitle?: string;
  departureDateLabel?: string;
}

export const BookingWindowCurveChart: React.FC<BookingWindowCurveChartProps> = ({
  points,
  title = 'ADVANCE PURCHASE YIELD CURVE',
  subtitle = 'T-90d → T-1d',
  departureDateLabel
}) => {
  // Sort descending by days to departure (e.g. 90 down to 1)
  const sorted = [...points].sort((a, b) => b.daysBeforeDeparture - a.daysBeforeDeparture);
  
  const validFares = sorted
    .filter((p) => (p.status === 'sufficient' || p.dataPointsCount > 0) && p.averageFare !== null && p.averageFare > 0)
    .map((p) => p.averageFare as number);

  const minFare = validFares.length > 0 ? Math.min(...validFares) : 6000;
  const maxFare = validFares.length > 0 ? Math.max(...validFares) : 12000;
  const fareRange = maxFare === minFare ? 2500 : (maxFare - minFare) * 1.35;

  const width = 280;
  const chartHeight = 100;
  const paddingTop = 20;
  const paddingBottom = 24;

  const getX = (i: number) => 24 + (i / (sorted.length - 1 || 1)) * (width - 48);
  const getY = (fare: number | null) => {
    if (fare === null || fare <= 0) return chartHeight - paddingBottom - 8;
    const norm = (fare - (minFare - 500)) / (fareRange || 1);
    return Math.max(paddingTop, Math.min(chartHeight - paddingBottom, chartHeight - paddingBottom - norm * (chartHeight - paddingTop - paddingBottom)));
  };

  const coords = sorted.map((p, i) => {
    const hasObs = p.dataPointsCount > 0 && p.averageFare !== null && p.averageFare > 0;
    return {
      x: getX(i),
      y: hasObs ? getY(p.averageFare) : chartHeight - paddingBottom - 6,
      hasObs,
      ...p
    };
  });

  const observedCoords = coords.filter((c) => c.hasObs);
  const sufficientCoords = coords.filter((c) => c.status === 'sufficient' && c.hasObs);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
        <span className="flex items-center gap-1.5">
          <span>{title}</span>
          {departureDateLabel && (
            <span className="text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-semibold text-[9px] border border-blue-200">
              {departureDateLabel}
            </span>
          )}
        </span>
        <span className="text-amber-600 font-mono text-[9px]">{subtitle}</span>
      </div>

      <div className="h-28 w-full relative">
        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${chartHeight}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="bw-curve-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Dotted connecting line across all milestones */}
          {coords.length > 1 && (
            <polyline
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.2"
              strokeDasharray="3,3"
              points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
            />
          )}

          {/* Solid line between observed points with sufficient data */}
          {sufficientCoords.length > 1 ? (
            <polyline
              fill="none"
              stroke="#d97706"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sufficientCoords.map((c) => `${c.x},${c.y}`).join(' ')}
            />
          ) : observedCoords.length > 1 ? (
            <polyline
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeDasharray="4,2"
              points={observedCoords.map((c) => `${c.x},${c.y}`).join(' ')}
            />
          ) : null}

          {/* Point nodes and labels */}
          {coords.map((c, i) => {
            const isSuff = c.status === 'sufficient' && c.hasObs;
            const hasAnyObs = c.hasObs;

            return (
              <g key={i}>
                {/* Node Circle */}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSuff ? 3.5 : hasAnyObs ? 2.8 : 2}
                  fill={isSuff ? '#d97706' : hasAnyObs ? '#fed7aa' : '#f8fafc'}
                  stroke={isSuff ? '#ffffff' : hasAnyObs ? '#ea580c' : '#94a3b8'}
                  strokeWidth={isSuff ? 1.5 : 1}
                />

                {/* Price / Status Label */}
                {hasAnyObs && c.averageFare !== null ? (
                  <text
                    x={c.x}
                    y={c.y - 6}
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    fill={isSuff ? '#92400e' : '#b45309'}
                  >
                    ₹{(c.averageFare / 1000).toFixed(1)}k
                  </text>
                ) : (
                  <text
                    x={c.x}
                    y={c.y - 5}
                    fontSize="6"
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {c.dataPointsCount > 0 ? `n=${c.dataPointsCount}` : '—'}
                  </text>
                )}

                {/* T-minus Axis Label */}
                <text
                  x={c.x}
                  y={chartHeight - 6}
                  fontSize="7"
                  fill="#64748b"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  T-{c.daysBeforeDeparture}d
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Metric Breakdown Row */}
      <div className="mt-2 pt-2 border-t border-slate-200/80 grid grid-cols-5 sm:grid-cols-10 gap-1 text-center">
        {sorted.map((pt) => {
          const hasObs = pt.dataPointsCount > 0 && pt.averageFare !== null;
          return (
            <div
              key={pt.daysBeforeDeparture}
              className={`p-1 rounded text-[9px] border transition ${
                hasObs
                  ? pt.status === 'sufficient'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950 font-medium'
                    : 'bg-white border-slate-200 text-slate-800'
                  : 'bg-slate-100/50 border-dashed border-slate-200 text-slate-400'
              }`}
            >
              <div className="font-bold text-[8.5px] text-slate-600">
                T-{pt.daysBeforeDeparture}d
              </div>
              <div className="font-semibold truncate">
                {hasObs ? `₹${(pt.averageFare! / 1000).toFixed(1)}k` : '—'}
              </div>
              <div className="text-[7.5px] text-slate-400">
                {pt.dataPointsCount > 0 ? `n=${pt.dataPointsCount}` : 'no data'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
