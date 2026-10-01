import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  TrendingDown, 
  TrendingUp, 
  Clock, 
  Plane, 
  Calendar, 
  RefreshCw, 
  X,
  Database
} from 'lucide-react';

export interface HistoryObservation {
  id: string;
  observedAt: string;
  fare: number;
  source: string;
  provenance: string;
  airline: string;
  flightNumber: string;
  departureDate: string;
  dataSource: 'SUPABASE' | 'CACHE' | 'FIRESTORE';
}

export interface FlightHistoryData {
  flightNumber: string;
  airline: string;
  departureDate: string;
  observations: HistoryObservation[];
  totalObservations: number;
  lowestObservedFare: number | null;
  latestObservedFare: number | null;
  firstObservedFare: number | null;
  priceDelta: number | null;
  priceDeltaPercent: number | null;
}

interface Props {
  flightNumber: string;
  departureDate: string;
  airline?: string;
  onClose: () => void;
}

export const FlightFareHistoryChart: React.FC<Props> = ({
  flightNumber,
  departureDate,
  airline = 'Unknown',
  onClose
}) => {
  const [data, setData] = useState<FlightHistoryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    obs: HistoryObservation;
    x: number;
    y: number;
  } | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/fare-tracker/history?flightNumber=${encodeURIComponent(flightNumber)}&departureDate=${encodeURIComponent(departureDate)}`
      );
      if (!res.ok) throw new Error('Failed to load observed fare history');
      const json: FlightHistoryData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Failed to load flight history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [flightNumber, departureDate]);

  const observations = data?.observations || [];
  const prices = observations.map(o => o.fare);
  const timestamps = observations.map(o => new Date(o.observedAt).getTime());

  const minFare = prices.length > 0 ? Math.min(...prices) : 5000;
  const maxFare = prices.length > 0 ? Math.max(...prices) : 15000;
  const fareSpan = maxFare === minFare ? 1000 : maxFare - minFare;
  const paddedMin = Math.max(0, minFare - fareSpan * 0.15);
  const paddedMax = maxFare + fareSpan * 0.15;
  const fullFareSpan = Math.max(1, paddedMax - paddedMin);

  const minTime = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
  const maxTime = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
  const timeSpan = Math.max(1, maxTime - minTime);

  const width = 640;
  const height = 220;
  const padLeft = 55;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;

  const points = observations.map((o) => {
    const t = new Date(o.observedAt).getTime();
    const x = timeSpan === 0 
      ? width / 2 
      : padLeft + ((t - minTime) / timeSpan) * (width - padLeft - padRight);
    const y = padTop + (1 - (o.fare - paddedMin) / fullFareSpan) * (height - padTop - padBottom);
    return { ...o, x, y };
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                Observed Fare History
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {flightNumber} • {departureDate}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1 flex items-center gap-1.5">
              <Plane className="w-4 h-4 text-blue-600" />
              <span>{flightNumber} ({data?.airline || airline})</span>
              <span className="text-slate-400 font-normal">|</span>
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-slate-700">{departureDate}</span>
            </h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              Chronological market snapshots recorded directly from Google Flights. Strictly factual; zero synthetic or predicted points.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              title="Reload history"
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              {error}
            </div>
          )}

          {loading && !data && (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-medium">Querying authentic fare observation repository...</p>
            </div>
          )}

          {data && (
            <>
              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Lowest Observed</div>
                  <div className="text-lg font-bold text-emerald-700 mt-0.5">
                    {data.lowestObservedFare !== null ? `₹${data.lowestObservedFare.toLocaleString('en-IN')}` : 'N/A'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Latest Observed</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {data.latestObservedFare !== null ? `₹${data.latestObservedFare.toLocaleString('en-IN')}` : 'N/A'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Observed Change</div>
                  <div className="text-lg font-bold mt-0.5 flex items-center gap-1">
                    {data.priceDelta === null || data.priceDelta === 0 ? (
                      <span className="text-slate-600">Flat (₹0)</span>
                    ) : data.priceDelta < 0 ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <TrendingDown className="w-4 h-4" />
                        <span>-₹{Math.abs(data.priceDelta).toLocaleString('en-IN')}</span>
                        <span className="text-xs font-normal">({Math.abs(data.priceDeltaPercent || 0)}%)</span>
                      </span>
                    ) : (
                      <span className="text-rose-700 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        <span>+₹{data.priceDelta.toLocaleString('en-IN')}</span>
                        <span className="text-xs font-normal">(+{data.priceDeltaPercent}%)</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Snapshots</div>
                  <div className="text-lg font-bold text-blue-700 mt-0.5 flex items-center gap-1">
                    <Database className="w-4 h-4 text-blue-600" />
                    <span>{data.totalObservations}</span>
                  </div>
                </div>
              </div>

              {/* SVG Price History Chart */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl relative">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                  <span className="font-semibold text-slate-800">Actual Observed Fare over Calendar Time</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Y: Fare (₹ INR) • X: Observation Timestamp
                  </span>
                </div>

                {observations.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No authentic observations recorded yet for this flight on this departure date.
                  </div>
                ) : (
                  <div className="h-60 w-full relative">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                      {/* Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                        const y = padTop + (1 - ratio) * (height - padTop - padBottom);
                        const val = Math.round(paddedMin + ratio * fullFareSpan);
                        return (
                          <g key={ratio}>
                            <line
                              x1={padLeft}
                              y1={y}
                              x2={width - padRight}
                              y2={y}
                              stroke="#f1f5f9"
                              strokeDasharray="4 4"
                              strokeWidth="1"
                            />
                            <text
                              x={padLeft - 6}
                              y={y + 3.5}
                              textAnchor="end"
                              fontSize="9.5"
                              fill="#94a3b8"
                              fontFamily="monospace"
                            >
                              ₹{val.toLocaleString('en-IN')}
                            </text>
                          </g>
                        );
                      })}

                      {/* Connecting Line (Only connects observed real points) */}
                      {points.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                        />
                      )}

                      {/* Observed Data Points */}
                      {points.map((p, idx) => (
                        <g key={p.id || idx}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="5"
                            fill="#2563eb"
                            stroke="#ffffff"
                            strokeWidth="2"
                            className="cursor-pointer hover:r-7 transition-all"
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredPoint({
                                obs: p,
                                x: rect.left,
                                y: rect.top
                              });
                            }}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                        </g>
                      ))}

                      {/* X-Axis Labels */}
                      {points.length > 0 && (
                        <>
                          <text
                            x={padLeft}
                            y={height - 10}
                            fontSize="9"
                            fill="#64748b"
                            fontFamily="monospace"
                          >
                            {new Date(points[0].observedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </text>
                          {points.length > 1 && (
                            <text
                              x={width - padRight}
                              y={height - 10}
                              textAnchor="end"
                              fontSize="9"
                              fill="#64748b"
                              fontFamily="monospace"
                            >
                              {new Date(points[points.length - 1].observedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </text>
                          )}
                        </>
                      )}
                    </svg>

                    {/* Interactive Point Tooltip */}
                    {hoveredPoint && (
                      <div 
                        className="fixed z-50 pointer-events-none bg-slate-900 text-white rounded-lg p-2.5 text-xs shadow-xl border border-slate-700 w-60 transform -translate-x-1/2 -translate-y-full mb-2"
                        style={{ left: hoveredPoint.x, top: hoveredPoint.y - 8 }}
                      >
                        <div className="font-bold text-amber-400 flex items-center justify-between">
                          <span>₹{hoveredPoint.obs.fare.toLocaleString('en-IN')}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {hoveredPoint.obs.dataSource}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-1">
                          <div>Flight: {hoveredPoint.obs.flightNumber} ({hoveredPoint.obs.airline})</div>
                          <div>Departure: {hoveredPoint.obs.departureDate}</div>
                          <div>Observed: {new Date(hoveredPoint.obs.observedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</div>
                          <div className="text-slate-400 text-[10px] mt-0.5">Source: {hoveredPoint.obs.source}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chronological Table of Observed Fares */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Audit Trail of Recorded Fares</span>
                  <span className="text-[11px] text-slate-500 font-mono">{observations.length} Snapshots</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {observations.map((o) => (
                    <div key={o.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                      <div>
                        <div className="font-mono text-slate-700">
                          {new Date(o.observedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Source: {o.source} • ID: {o.id.slice(0, 18)}...
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900 text-sm">
                          ₹{o.fare.toLocaleString('en-IN')}
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                          o.dataSource === 'SUPABASE' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {o.dataSource}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
