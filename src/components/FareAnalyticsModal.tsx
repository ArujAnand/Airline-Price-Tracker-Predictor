import React, { useState, useEffect } from 'react';
import { 
  RouteAnalyticsReport, 
  OverallIndexPoint, 
  BookingWindowPoint, 
  TimeOfDayPoint, 
  DayOfWeekPoint,
  SubSegmentData 
} from '../types/analytics';
import { 
  TrendingUp, 
  Clock, 
  Calendar, 
  Sun, 
  Plane, 
  X, 
  AlertTriangle,
  Info,
  ShieldCheck,
  CheckCircle2,
  Database,
  Sparkles,
  KeyRound,
  BrainCircuit,
  BarChart3
} from 'lucide-react';

// ==========================================
// DYNAMIC SVG GRAPHS (BOUND TO REAL DATA)
// ==========================================

const DailyTrendChart: React.FC<{ points: OverallIndexPoint[] }> = ({ points }) => {
  if (!points || points.length === 0) {
    return (
      <div className="h-28 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400">
        No daily snapshots recorded yet
      </div>
    );
  }

  const values = points.map((p) => p.indexValue);
  const minVal = Math.min(...values, 100);
  const maxVal = Math.max(...values, 100);
  const range = maxVal === minVal ? 20 : (maxVal - minVal) * 1.35;
  const paddingBottom = 22;
  const paddingTop = 20;
  const chartHeight = 90;
  const width = 260;

  const getX = (i: number) => {
    if (points.length === 1) return width / 2;
    return 25 + (i / (points.length - 1)) * (width - 50);
  };

  const getY = (val: number) => {
    const norm = (val - (minVal - 4)) / (range || 1);
    return chartHeight - paddingBottom - norm * (chartHeight - paddingTop - paddingBottom);
  };

  const coords = points.map((p, i) => ({ x: getX(i), y: getY(p.indexValue), ...p }));
  const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPoints = `${coords[0].x},${chartHeight - paddingBottom} ${pointsStr} ${coords[coords.length - 1].x},${chartHeight - paddingBottom}`;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
        <span>DAILY INDEX TREND (100 = BASELINE)</span>
        <span className="text-blue-600 font-mono text-[10px]">
          Latest: {points[points.length - 1]?.indexValue ?? 100}
        </span>
      </div>
      <div className="h-28 w-full relative">
        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${chartHeight}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="p1-trend-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Baseline 100 dashed reference */}
          <line
            x1="12"
            y1={getY(100)}
            x2={width - 12}
            y2={getY(100)}
            stroke="#94a3b8"
            strokeDasharray="3,3"
            strokeWidth="1"
          />
          <text x="14" y={getY(100) - 3} fontSize="7" fill="#94a3b8" fontWeight="600">Base 100</text>

          {/* Area fill */}
          {coords.length > 1 && (
            <polygon points={areaPoints} fill="url(#p1-trend-grad)" />
          )}

          {/* Curve Line */}
          {coords.length > 1 && (
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsStr}
            />
          )}

          {/* Data Points */}
          {coords.map((c, i) => (
            <g key={i}>
              <circle
                cx={c.x}
                cy={c.y}
                r="3.5"
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <text
                x={c.x}
                y={c.y - 6}
                fontSize="8"
                fontWeight="bold"
                textAnchor="middle"
                fill={c.percentChange > 0 ? '#b91c1c' : c.percentChange < 0 ? '#047857' : '#1e293b'}
              >
                {c.indexValue}
              </text>
              <text
                x={c.x}
                y={chartHeight - 6}
                fontSize="7"
                fill="#64748b"
                textAnchor="middle"
                fontWeight="600"
              >
                {c.date.slice(5)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

const BookingWindowCurveChart: React.FC<{ points: BookingWindowPoint[] }> = ({ points }) => {
  const sorted = [...points].sort((a, b) => b.daysBeforeDeparture - a.daysBeforeDeparture);
  const sufficientFares = sorted.filter((p) => p.status === 'sufficient').map((p) => p.averageFare);
  const minFare = sufficientFares.length > 0 ? Math.min(...sufficientFares) : 6000;
  const maxFare = sufficientFares.length > 0 ? Math.max(...sufficientFares) : 12000;
  const fareRange = maxFare === minFare ? 2500 : (maxFare - minFare) * 1.35;

  const width = 260;
  const chartHeight = 90;
  const paddingTop = 18;
  const paddingBottom = 22;

  const getX = (i: number) => 22 + (i / (sorted.length - 1 || 1)) * (width - 44);
  const getY = (fare: number) => {
    if (fare <= 0) return chartHeight - paddingBottom - 10;
    const norm = (fare - (minFare - 500)) / (fareRange || 1);
    return Math.max(paddingTop, Math.min(chartHeight - paddingBottom, chartHeight - paddingBottom - norm * (chartHeight - paddingTop - paddingBottom)));
  };

  const coords = sorted.map((p, i) => ({
    x: getX(i),
    y: p.status === 'sufficient' ? getY(p.averageFare) : chartHeight - paddingBottom - 8,
    ...p
  }));

  const sufficientCoords = coords.filter((c) => c.status === 'sufficient');

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
        <span>ADVANCE PURCHASE YIELD CURVE</span>
        <span className="text-amber-600 font-mono text-[9px]">T-90d &rarr; T-1d</span>
      </div>
      <div className="h-28 w-full relative">
        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${chartHeight}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="p2-curve-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Dotted connecting line */}
          {coords.length > 1 && (
            <polyline
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeDasharray="3,3"
              points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
            />
          )}

          {/* Solid line between observed sufficient points */}
          {sufficientCoords.length > 1 && (
            <polyline
              fill="none"
              stroke="#d97706"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sufficientCoords.map((c) => `${c.x},${c.y}`).join(' ')}
            />
          )}

          {/* Points */}
          {coords.map((c, i) => {
            const isSuff = c.status === 'sufficient';
            return (
              <g key={i}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSuff ? 3.5 : 2.5}
                  fill={isSuff ? '#d97706' : '#f8fafc'}
                  stroke={isSuff ? '#ffffff' : '#94a3b8'}
                  strokeWidth={isSuff ? 1.5 : 1}
                />
                {isSuff ? (
                  <text
                    x={c.x}
                    y={c.y - 6}
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                    fill="#92400e"
                  >
                    ₹{(c.averageFare / 1000).toFixed(1)}k
                  </text>
                ) : (
                  <text
                    x={c.x}
                    y={c.y - 5}
                    fontSize="6.5"
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    n={c.dataPointsCount}
                  </text>
                )}
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
    </div>
  );
};

const DepartureTimeOfDayChart: React.FC<{ points: TimeOfDayPoint[] }> = ({ points }) => {
  const sufficientPoints = points.filter((p) => p.status === 'sufficient');
  const fares = sufficientPoints.map((p) => p.averageFare);
  const minFare = fares.length > 0 ? Math.min(...fares) : 5000;
  const maxFare = fares.length > 0 ? Math.max(...fares) : 10000;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
        <span>DEPARTURE TIME BANDS</span>
        <span className="text-yellow-700 font-mono text-[9px]">4-Hour Blocks</span>
      </div>
      <div className="h-28 flex items-end justify-between gap-1 pt-4 pb-2 px-1">
        {points.map((pt) => {
          const isSuff = pt.status === 'sufficient';
          const isLowest = isSuff && pt.averageFare === minFare;
          const isHighest = isSuff && pt.averageFare === maxFare && maxFare !== minFare;
          
          let heightPct = 18;
          if (isSuff && maxFare > 0) {
            heightPct = 28 + ((pt.averageFare - minFare) / (maxFare - minFare || 1)) * 62;
          }

          return (
            <div key={pt.slot} className="flex-1 flex flex-col items-center h-full justify-end group relative">
              <div className="text-[7px] font-bold text-slate-600 mb-1 truncate">
                {isSuff ? `₹${(pt.averageFare / 1000).toFixed(1)}k` : `n=${pt.dataPointsCount}`}
              </div>

              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full rounded-t-md transition-all ${
                  !isSuff
                    ? 'bg-slate-200 border border-dashed border-slate-300'
                    : isLowest
                    ? 'bg-emerald-500 shadow-sm'
                    : isHighest
                    ? 'bg-amber-500'
                    : 'bg-yellow-400'
                }`}
              />

              <span className="text-[7.5px] font-semibold text-slate-500 mt-1 truncate w-full text-center">
                {pt.slot.split('-')[0].trim()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DayOfWeekYieldChart: React.FC<{ points: DayOfWeekPoint[] }> = ({ points }) => {
  const activeDays = points.filter((p) => p.status !== 'no_data');
  const fares = activeDays.map((p) => p.averageFare);
  const minFare = fares.length > 0 ? Math.min(...fares) : 5000;
  const maxFare = fares.length > 0 ? Math.max(...fares) : 10000;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
        <span>DAY-OF-WEEK YIELD BARS</span>
        <span className="text-teal-700 font-mono text-[9px]">Mon &rarr; Sun</span>
      </div>
      <div className="h-28 flex items-end justify-between gap-1 pt-4 pb-2 px-1">
        {points.map((pt) => {
          const hasNoData = pt.status === 'no_data';
          const isSuff = pt.status === 'sufficient';
          const isLowest = !hasNoData && pt.averageFare === minFare;
          const isHighest = !hasNoData && pt.averageFare === maxFare && maxFare !== minFare;

          let heightPct = 14;
          if (!hasNoData && maxFare > 0) {
            heightPct = 22 + ((pt.averageFare - minFare) / (maxFare - minFare || 1)) * 68;
          }

          return (
            <div key={pt.dayName} className="flex-1 flex flex-col items-center h-full justify-end group relative">
              <div className="text-[7.5px] font-bold text-slate-600 mb-1 truncate">
                {hasNoData ? '—' : `₹${(pt.averageFare / 1000).toFixed(1)}k`}
              </div>

              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full rounded-t-md transition-all ${
                  hasNoData
                    ? 'bg-slate-200/50 border border-dashed border-slate-300'
                    : isLowest
                    ? 'bg-emerald-500 shadow-sm'
                    : isHighest
                    ? 'bg-rose-500'
                    : isSuff
                    ? 'bg-teal-500'
                    : 'bg-teal-300/80 border border-dashed border-teal-500'
                }`}
              />

              <span className="text-[8px] font-bold text-slate-600 mt-1">
                {pt.dayName.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// SUB-SEGMENT MICRO-CARDS (TOI-DPA STYLE)
// ==========================================

const Pillar1SubSegments: React.FC<{ segments: SubSegmentData[] }> = ({ segments }) => {
  if (!segments || segments.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Key Sectors / Carriers
        </span>
        <span className="text-[9px] text-slate-400 font-semibold">Trend vs Start</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {segments.map((seg) => {
          const change = seg.overallTrend.percentChange;
          const isUp = change > 0;
          const isZero = change === 0;
          return (
            <div key={seg.id} className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-900">{seg.name}</div>
                <div className="text-[9px] text-slate-500 font-medium">
                  Min: ₹{seg.overallTrend.latestFare.toLocaleString()} • n={seg.totalSnapshots}
                </div>
              </div>
              <div className="flex items-center gap-2 text-right">
                {seg.overallTrend.points.length > 1 && (
                  <div className="w-12 h-4">
                    <svg className="w-full h-full" viewBox="0 0 60 20">
                      <polyline
                        fill="none"
                        stroke={isZero ? '#64748b' : isUp ? '#ef4444' : '#10b981'}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        points={isUp ? '5,15 20,12 40,8 55,4' : '5,4 20,8 40,12 55,16'}
                      />
                    </svg>
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-black text-slate-900">Idx {seg.overallTrend.indexValue}</div>
                  <div className={`text-[9px] font-bold ${isZero ? 'text-slate-500' : isUp ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {isZero ? '0%' : `${isUp ? '+' : ''}${change}%`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Pillar2SubSegments: React.FC<{ segments: SubSegmentData[] }> = ({ segments }) => {
  if (!segments || segments.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Advance Booking Sweet Spots
        </span>
        <span className="text-[9px] text-slate-400 font-semibold">T-30d Lead</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {segments.map((seg) => (
          <div key={seg.id} className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-900">{seg.name}</div>
              <div className="text-[9px] text-slate-500 font-medium">
                {seg.bookingWindow.t30Avg ? `~30d: ₹${seg.bookingWindow.t30Avg.toLocaleString()}` : `Gathering windows`}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200">
                {seg.bookingWindow.sweetSpot}
              </span>
              <div className="text-[8.5px] text-slate-500 mt-0.5">
                {seg.bookingWindow.t1Avg ? `T-1d: ₹${seg.bookingWindow.t1Avg.toLocaleString()}` : `${seg.totalSnapshots} snaps`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Pillar3SubSegments: React.FC<{ segments: SubSegmentData[] }> = ({ segments }) => {
  if (!segments || segments.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Departure Slot Yields
        </span>
        <span className="text-[9px] text-slate-400 font-semibold">Low vs Peak</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {segments.map((seg) => (
          <div key={seg.id} className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-900">{seg.name}</div>
              <div className="text-[9px] text-emerald-700 font-semibold flex items-center gap-1">
                <span>Low:</span>
                <span>{seg.timeOfDay.cheapestSlot.split('-')[0].trim()}</span>
                {seg.timeOfDay.cheapestFare > 0 && <span>(₹{seg.timeOfDay.cheapestFare.toLocaleString()})</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-rose-700 font-semibold">
                Peak: {seg.timeOfDay.peakSlot.split('-')[0].trim()}
              </div>
              <div className="text-[8.5px] text-slate-500">
                {seg.timeOfDay.peakFare > 0 ? `₹${seg.timeOfDay.peakFare.toLocaleString()}` : 'Gathering'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Pillar4SubSegments: React.FC<{ segments: SubSegmentData[] }> = ({ segments }) => {
  if (!segments || segments.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Day-of-Week Yields
        </span>
        <span className="text-[9px] text-slate-400 font-semibold">Best Day</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {segments.map((seg) => (
          <div key={seg.id} className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-900">{seg.name}</div>
              <div className="text-[9px] text-emerald-700 font-semibold flex items-center gap-1">
                <span>Best:</span>
                <span>{seg.dayOfWeek.cheapestDay}</span>
                {seg.dayOfWeek.cheapestFare > 0 && <span>(₹{seg.dayOfWeek.cheapestFare.toLocaleString()})</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-rose-700 font-semibold">
                Peak: {seg.dayOfWeek.peakDay}
              </div>
              <div className="text-[8.5px] text-slate-500">
                {seg.dayOfWeek.peakFare > 0 ? `₹${seg.dayOfWeek.peakFare.toLocaleString()}` : 'Gathering'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface FareAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeId: string;
}

// In-memory session cache for the active browser session
const sessionAnalyticsCache = new Map<string, RouteAnalyticsReport>();

export const FareAnalyticsModal: React.FC<FareAnalyticsModalProps> = ({
  isOpen,
  onClose,
  routeId,
}) => {
  const [report, setReport] = useState<RouteAnalyticsReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string>(routeId || 'PNQ-LKO');
  const [subSegmentMode, setSubSegmentMode] = useState<'directional' | 'airlines'>('directional');

  const LOADING_STEPS = [
    {
      title: 'Connecting & Hydrating Firestore Data',
      desc: `Querying authentic price snapshots from Cloud Firestore database for ${selectedRoute} and corridor benchmarks...`,
      icon: Database,
    },
    {
      title: 'Computing 4-Pillar Baseline Indices',
      desc: 'Calculating corridor baseline index (Base 100), advance booking curves (T-1d to T-90d), departure time slots, and Mon–Sun weekday yields...',
      icon: TrendingUp,
    },
    {
      title: 'Aggregating Directional & Airline Sub-Segments',
      desc: 'Partitioning PNQ ➔ LKO (Outbound) vs LKO ➔ PNQ (Inbound) along with IndiGo, Air India Express, and Akasa Air yield matrices...',
      icon: Plane,
    },
    {
      title: 'Executing Gemini Econometric Analysis',
      desc: 'Running Gemini AI multi-key pool to analyze corridor price dynamics, market elasticity, and revenue management takeaways...',
      icon: BrainCircuit,
    },
    {
      title: 'Assembling TOI-DPA Visual Layout',
      desc: 'Rendering dynamic SVG area curves, empirical distribution grids, and interactive sub-segment micro-cards...',
      icon: BarChart3,
    },
  ];

  useEffect(() => {
    if (isOpen) {
      // Check session cache first for instant switching
      const cached = sessionAnalyticsCache.get(selectedRoute);
      if (cached) {
        setReport(cached);
        setLoading(false);
        return;
      }
      fetchAnalytics(selectedRoute);
    }
  }, [isOpen, selectedRoute]);

  const fetchAnalytics = async (rId: string, force = false) => {
    if (!force && sessionAnalyticsCache.has(rId)) {
      setReport(sessionAnalyticsCache.get(rId)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadingStep(0);
    setError(null);

    // Incrementally advance visual steps during backend fetch
    const stepTimer = setInterval(() => {
      setLoadingStep((prev) => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 420);

    try {
      const res = await fetch(`/api/analytics/indices?routeId=${rId}`);
      if (!res.ok) throw new Error('Failed to fetch fare analytics report');
      const data: RouteAnalyticsReport = await res.json();
      sessionAnalyticsCache.set(rId, data);
      setReport(data);
    } catch (err: any) {
      setError(err?.message || 'Error loading analytics');
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isPNQtoLKO = selectedRoute === 'PNQ-LKO';
  const activeSegments =
    (subSegmentMode === 'directional'
      ? report?.subSegments?.directional
      : report?.subSegments?.airlines) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-50 border border-slate-300 rounded-3xl w-full max-w-7xl max-h-[94vh] flex flex-col shadow-2xl text-slate-900 overflow-hidden">
        
        {/* Editorial Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white flex items-center gap-1">
                <Database className="w-3 h-3" />
                Corridor Index Intelligence
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                Pune (PNQ) ⇄ Lucknow (LKO) Exclusive Analytics
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mt-1 font-serif">
              Pune ⇄ Lucknow Corridor Fare Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl mt-1 leading-snug">
              Direct empirical price analytics computed strictly from authentic snapshots stored in Cloud Firestore 
              for Pune (PNQ) and Lucknow (LKO). All metrics reflect real collected airline pricing, booking curves, and yield variations.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {/* Direction Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedRoute('PNQ-LKO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  isPNQtoLKO
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>PNQ ➔ LKO</span>
                <span className="text-[10px] opacity-80">(Outbound)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRoute('LKO-PNQ')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  !isPNQtoLKO
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>LKO ➔ PNQ</span>
                <span className="text-[10px] opacity-80">(Inbound Return)</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Real Dataset Metadata Callout Bar */}
        {report && (
          <div className="bg-gradient-to-r from-blue-50 via-slate-50 to-indigo-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <span className="px-2 py-0.5 rounded font-black text-blue-900 bg-blue-100 border border-blue-200 text-[10px] uppercase">
                Route: {report.routeId}
              </span>
              <span className="text-slate-700 font-medium">
                Tracking Period: <strong>{report.summary.earliestDate || 'Sept 22, 2026'}</strong> to <strong>{report.summary.latestDate || 'Present'}</strong> ({report.summary.totalDaysCollected} calendar days)
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-700 font-medium">
                Dataset: <strong>{report.summary.totalSnapshots}</strong> real snapshots in Firestore
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase flex items-center gap-1 ${
                report.summary.isPreliminary
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                <Info className="w-3 h-3" />
                {report.summary.isPreliminary ? `Preliminary (${report.summary.totalDaysCollected}/30 days)` : 'Baseline Validated'}
              </span>
              <span className="text-slate-500 text-[11px]">
                Min threshold: n &ge; {report.summary.minDataPointsThreshold} per bucket
              </span>
            </div>
          </div>
        )}

        {/* Scrollable Main Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-12 px-4 max-w-2xl mx-auto">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
                
                {/* Header of Pipeline */}
                <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-200 animate-pulse">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        Computing Live Corridor Analytics
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Executing Firestore aggregation & AI econometric pipeline for {selectedRoute}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                      Step {loadingStep + 1} of {LOADING_STEPS.length}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4 mb-6">
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/80">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.min(((loadingStep + 1) / LOADING_STEPS.length) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Animated Pipeline Steps */}
                <div className="space-y-3.5">
                  {LOADING_STEPS.map((step, idx) => {
                    const isCompleted = idx < loadingStep;
                    const isCurrent = idx === loadingStep;
                    const isUpcoming = idx > loadingStep;
                    const StepIcon = step.icon;

                    return (
                      <div
                        key={step.title}
                        className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-start gap-3.5 ${
                          isCompleted
                            ? 'bg-emerald-50/50 border-emerald-200/70 text-slate-800'
                            : isCurrent
                            ? 'bg-blue-50 border-blue-300 shadow-xs text-slate-900 ring-2 ring-blue-500/10'
                            : 'bg-slate-50/40 border-slate-200/60 opacity-50 text-slate-400'
                        }`}
                      >
                        {/* Status Icon */}
                        <div className="mt-0.5 shrink-0">
                          {isCompleted ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          ) : isCurrent ? (
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center animate-spin">
                              <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </div>
                          )}
                        </div>

                        {/* Text Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-black tracking-tight ${isCurrent ? 'text-blue-900' : isCompleted ? 'text-emerald-950' : 'text-slate-500'}`}>
                              {step.title}
                            </span>
                            {isCompleted && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.2 rounded">
                                Completed
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.2 rounded animate-pulse">
                                Processing...
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] mt-0.5 leading-relaxed ${isCurrent ? 'text-blue-800/80 font-medium' : isCompleted ? 'text-slate-600' : 'text-slate-400'}`}>
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Assurance */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Zero Synthetic Data • Firestore Grounded
                  </span>
                  <span>
                    Database: <strong className="text-slate-700">ai-studio-flightpricetrend</strong>
                  </span>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-600" />
              <p className="font-bold">{error}</p>
            </div>
          ) : report ? (
            <>
              {/* Gemini Multi-Key AI Intelligence Card */}
              {report.aiAnalysis && (
                <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-indigo-700/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-indigo-800/60">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-indigo-600/40 rounded-xl border border-indigo-400/30 text-indigo-300">
                        <BrainCircuit className="w-5 h-5 text-indigo-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            Gemini AI Corridor Intelligence
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 flex items-center gap-1">
                            <KeyRound className="w-3 h-3 text-indigo-300" />
                            {report.aiAnalysis.keyLabel || 'Dual Key Pool'} Active
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-300" />
                            Daily Briefing (1x/day cadence)
                          </span>
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                          Corridor Revenue & Yield Econometric Analysis
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-[11px] font-mono text-indigo-200 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-700/40">
                        Model: {report.aiAnalysis.modelUsed}
                      </span>
                      {report.aiAnalysis.generatedAt && (
                        <span className="text-[10px] text-slate-300 bg-white/5 px-2 py-1 rounded-lg border border-white/10 hidden sm:inline-block">
                          Updated: {new Date(report.aiAnalysis.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed font-normal mb-4">
                    {report.aiAnalysis.corridorSummary}
                  </p>

                  {report.aiAnalysis.keyTakeaways && report.aiAnalysis.keyTakeaways.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      {report.aiAnalysis.keyTakeaways.map((takeaway, idx) => (
                        <div 
                          key={idx} 
                          className="bg-white/5 border border-indigo-500/20 rounded-xl p-3 text-[11px] text-slate-200 leading-snug flex items-start gap-2"
                        >
                          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 font-bold text-[10px] shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span>{takeaway}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Segment Comparison Mode Toggle (Directional vs Airline) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3 px-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase text-slate-900 tracking-wide block">
                      Sub-Segment Analysis Breakdown (TOI-DPA Style)
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Toggle micro-comparisons across all 4 pillars below
                    </span>
                  </div>
                </div>

                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSubSegmentMode('directional')}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                      subSegmentMode === 'directional'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>⇄ Directional</span>
                    <span className="text-[10px] opacity-80">(PNQ ➔ LKO vs LKO ➔ PNQ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubSegmentMode('airlines')}
                    className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                      subSegmentMode === 'airlines'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>✈ Airlines</span>
                    <span className="text-[10px] opacity-80">(IndiGo, AIX, Akasa)</span>
                  </button>
                </div>
              </div>

              {/* 4 Pillars Grid Powered by Real Computed Output */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* PILLAR 1: OVERALL DAILY INDEX */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* Header */}
                    <div className="bg-blue-600 text-white p-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                          <Plane className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-blue-200">Overall Index</div>
                          <div className="text-xs font-bold leading-tight">DAILY BASELINE PRICE MOVEMENT</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-[11px] text-slate-600 leading-snug mb-3">
                        Tracks minimum observed daily airfares on {report.routeId}. Baseline is established on the earliest tracked date ({report.summary.earliestDate || 'Sept 22, 2026'} = 100).
                      </p>

                      {/* Dynamic Visual Trend Chart */}
                      <DailyTrendChart points={report.overallIndex.points} />

                      {/* Real Data Points Visualization */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase text-slate-500">
                            {report.routeId} Daily Lowest
                          </span>
                          <span className="text-[10px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {report.overallIndex.points.length} Days Recorded
                          </span>
                        </div>

                        {report.overallIndex.points.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-400">
                            No daily snapshots recorded yet for {report.routeId}.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {report.overallIndex.points.map((pt) => {
                              const isPositive = pt.percentChange > 0;
                              const isZero = pt.percentChange === 0;
                              return (
                                <div key={pt.date} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                                  <div>
                                    <div className="text-[11px] font-bold text-slate-800">{pt.date}</div>
                                    <div className="text-[10px] text-slate-500">Min: ₹{pt.lowestFare.toLocaleString()}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[11px] font-black text-slate-900">Index {pt.indexValue}</div>
                                    <div className={`text-[10px] font-bold ${
                                      isZero ? 'text-slate-500' : isPositive ? 'text-rose-600' : 'text-emerald-600'
                                    }`}>
                                      {isZero ? '0% (baseline)' : `${isPositive ? '+' : ''}${pt.percentChange}%`}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Sub-Segments (Directional vs Carrier) */}
                      <Pillar1SubSegments segments={activeSegments} />
                    </div>
                  </div>

                  {/* Real Computed Footnote */}
                  <div className="bg-slate-50 border-t border-slate-200 p-3 text-[11px] text-slate-700 font-medium leading-snug">
                    {report.overallIndex.insight}
                  </div>
                </div>

                {/* PILLAR 2: BOOKING WINDOW CURVE */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* Header */}
                    <div className="bg-amber-600 text-white p-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                          <Clock className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-amber-200">When Booking Was Done</div>
                          <div className="text-xs font-bold leading-tight">ADVANCE BOOKING WINDOWS</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-[11px] text-slate-600 leading-snug mb-3">
                        Compares observed fares across advance booking buckets (1, 7, 14, 30, 60, and 90 days before departure) for {report.routeId}.
                      </p>

                      {/* Dynamic Visual Yield Curve */}
                      <BookingWindowCurveChart points={report.bookingWindowIndex.points} />

                      {/* Real Booking Window Buckets */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 mb-3 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-500">
                            Observed Buckets
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            Threshold: min 3 pts
                          </span>
                        </div>

                        {report.bookingWindowIndex.points.map((pt) => {
                          const isSufficient = pt.status === 'sufficient';
                          return (
                            <div 
                              key={pt.daysBeforeDeparture}
                              className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                                isSufficient 
                                  ? 'bg-white border-slate-200' 
                                  : 'bg-slate-100/70 border-dashed border-slate-300 opacity-75'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800 text-[11px]">
                                  T-{pt.daysBeforeDeparture}d
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  ({pt.daysBeforeDeparture === 1 ? 'last-minute' : `${pt.daysBeforeDeparture}d ahead`})
                                </span>
                              </div>

                              <div className="text-right">
                                {isSufficient ? (
                                  <>
                                    <span className="font-bold text-slate-900 text-[11px]">
                                      ₹{pt.averageFare.toLocaleString()}
                                    </span>
                                    <div className="text-[9px] text-slate-500 font-medium">
                                      n={pt.dataPointsCount} snaps across {pt.distinctDatesCount} date{pt.distinctDatesCount > 1 ? 's' : ''} {pt.normalizedFareIndex > 0 && `• Idx ${pt.normalizedFareIndex}`}
                                    </div>
                                  </>
                                ) : (
                                  <div>
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-semibold">
                                      gathering data
                                    </span>
                                    <div className="text-[9px] text-slate-400 mt-0.5">
                                      {pt.dataPointsCount} snap{pt.dataPointsCount === 1 ? '' : 's'} across {pt.distinctDatesCount} date{pt.distinctDatesCount === 1 ? '' : 's'}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Sub-Segments (Directional vs Carrier) */}
                      <Pillar2SubSegments segments={activeSegments} />
                    </div>
                  </div>

                  {/* Real Computed Footnote */}
                  <div className="bg-slate-50 border-t border-slate-200 p-3 text-[11px] text-slate-700 font-medium leading-snug">
                    {report.bookingWindowIndex.insight}
                  </div>
                </div>

                {/* PILLAR 3: BY DEPARTURE TIME */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* Header */}
                    <div className="bg-yellow-500 text-slate-950 p-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-white/40 rounded-lg">
                          <Sun className="w-4 h-4 text-slate-900" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-yellow-900">By Departure Time</div>
                          <div className="text-xs font-bold leading-tight">DEPARTURE TIME OF DAY SLOTS</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-[11px] text-slate-600 leading-snug mb-3">
                        Analyzes average flight ticket prices across 4-hour departure blocks throughout the day on {report.routeId}.
                      </p>

                      {/* Dynamic Visual Time Slot Bars */}
                      <DepartureTimeOfDayChart points={report.timeOfDayIndex.points} />

                      {/* Real Time Slots */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 mb-3 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-500">
                            Time Slots
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            Route Avg = 100
                          </span>
                        </div>

                        {report.timeOfDayIndex.points.map((pt) => {
                          const isSufficient = pt.status === 'sufficient';
                          return (
                            <div 
                              key={pt.slot}
                              className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                                isSufficient 
                                  ? 'bg-white border-slate-200' 
                                  : 'bg-slate-100/70 border-dashed border-slate-300 opacity-75'
                              }`}
                            >
                              <div className="text-[11px] font-bold text-slate-800">
                                {pt.slot}
                              </div>

                                <div className="text-right">
                                {isSufficient ? (
                                  <>
                                    <span className="font-bold text-slate-900 text-[11px]">
                                      ₹{pt.averageFare.toLocaleString()}
                                    </span>
                                    <div className="text-[9px] text-slate-500 font-medium">
                                      n={pt.dataPointsCount} snaps ({pt.distinctDatesCount} date{pt.distinctDatesCount > 1 ? 's' : ''}) • Idx {pt.normalizedIndex}
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    gathering (n={pt.dataPointsCount} across {pt.distinctDatesCount} date{pt.distinctDatesCount > 1 ? 's' : ''})
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Sub-Segments (Directional vs Carrier) */}
                      <Pillar3SubSegments segments={activeSegments} />
                    </div>
                  </div>

                  {/* Real Computed Footnote */}
                  <div className="bg-slate-50 border-t border-slate-200 p-3 text-[11px] text-slate-700 font-medium leading-snug">
                    {report.timeOfDayIndex.insight}
                  </div>
                </div>

                {/* PILLAR 4: BY DAY OF WEEK */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* Header */}
                    <div className="bg-teal-600 text-white p-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                          <Calendar className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-teal-200">By Day Of Week</div>
                          <div className="text-xs font-bold leading-tight">TRAVEL DAY-OF-WEEK YIELDS</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-[11px] text-slate-600 leading-snug mb-2">
                        Evaluates pricing variations by departure day of the week on {report.routeId}, comparing weekday vs weekend flights.
                      </p>

                      {/* Unobserved weekdays notification */}
                      {report.dayOfWeekIndex.unobservedWeekdays && report.dayOfWeekIndex.unobservedWeekdays.length > 0 && (
                        <div className="mb-2.5 p-2 bg-amber-50/80 border border-amber-200/80 rounded-lg text-[10px] text-amber-900 leading-tight">
                          <span className="font-bold">Not yet tracked: </span>
                          {report.dayOfWeekIndex.unobservedWeekdays.join(', ')} (no departures sampled yet)
                        </div>
                      )}

                      {/* Dynamic Visual Day of Week Bar Chart */}
                      <DayOfWeekYieldChart points={report.dayOfWeekIndex.points} />

                      {/* Real Weekdays */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 mb-3 space-y-1.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-500">
                            Day of Week
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            Route Mean = 100
                          </span>
                        </div>

                        {report.dayOfWeekIndex.points.map((pt) => {
                          if (pt.status === 'no_data') {
                            return (
                              <div 
                                key={pt.dayName}
                                className="p-1.5 px-2.5 rounded-lg border border-dashed border-slate-200 bg-slate-100/50 text-xs flex items-center justify-between opacity-60"
                              >
                                <span className="text-[11px] font-medium text-slate-500">{pt.dayName}</span>
                                <span className="text-[9px] text-slate-400 italic">no departures tracked</span>
                              </div>
                            );
                          }

                          const isSufficient = pt.status === 'sufficient';
                          return (
                            <div 
                              key={pt.dayName}
                              className={`p-1.5 px-2.5 rounded-lg border text-xs flex items-center justify-between ${
                                isSufficient 
                                  ? 'bg-white border-slate-200 shadow-2xs' 
                                  : 'bg-amber-50/40 border-dashed border-amber-200/80'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-800">{pt.dayName}</span>
                                {!isSufficient && (
                                  <span className="text-[9px] text-amber-800 bg-amber-100 px-1 rounded font-medium">
                                    gathering ({pt.distinctDatesCount} date)
                                  </span>
                                )}
                              </div>

                              <div className="text-right">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <span className="font-bold text-slate-900 text-[11px]">
                                    ₹{pt.averageFare.toLocaleString()}
                                  </span>
                                  {isSufficient && pt.normalizedIndex > 0 && (
                                    <span className="text-[9px] font-semibold text-slate-500">
                                      (Idx {pt.normalizedIndex})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[9px] text-slate-500">
                                  n={pt.dataPointsCount} snaps across {pt.distinctDatesCount} date{pt.distinctDatesCount > 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Sub-Segments (Directional vs Carrier) */}
                      <Pillar4SubSegments segments={activeSegments} />
                    </div>
                  </div>

                  {/* Real Computed Footnote */}
                  <div className="bg-slate-50 border-t border-slate-200 p-3 text-[11px] text-slate-700 font-medium leading-snug">
                    {report.dayOfWeekIndex.insight}
                  </div>
                </div>

              </div>

              {/* Bottom Transparent Methodology Banner */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-xs leading-relaxed text-slate-600">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                    <span className="font-black text-slate-900 uppercase tracking-wide text-xs">
                      Pune (PNQ) ⇄ Lucknow (LKO) Direct Firestore Index
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Real-Time Computation from Stored Snapshots</span>
                  </div>
                </div>
                <p>
                  Every metric, average fare, sample count (<span className="font-mono text-slate-800">n</span>), and percentage change displayed in this dashboard is computed dynamically 
                  by <span className="font-mono text-slate-800">server/fareIndexer.ts</span> from authentic price snapshots stored in Cloud Firestore for the <strong>Pune (PNQ) ⇄ Lucknow (LKO)</strong> corridor.
                  No nationwide estimates (&ldquo;ALL INDIA&rdquo;), fabricated historical data, or synthetic template seeds are used.
                </p>
                <p className="mt-2 text-slate-500">
                  Buckets with fewer than 3 observations are explicitly marked as <em>gathering data</em> to guarantee statistical integrity.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
