import React, { useState, useEffect } from 'react';
import { RouteAnalyticsReport } from '../types/analytics';
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
  BrainCircuit
} from 'lucide-react';

interface FareAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeId: string;
}

export const FareAnalyticsModal: React.FC<FareAnalyticsModalProps> = ({
  isOpen,
  onClose,
  routeId,
}) => {
  const [report, setReport] = useState<RouteAnalyticsReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string>(routeId || 'PNQ-LKO');

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics(selectedRoute);
    }
  }, [isOpen, selectedRoute]);

  const fetchAnalytics = async (rId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/indices?routeId=${rId}`);
      if (!res.ok) throw new Error('Failed to fetch fare analytics report');
      const data: RouteAnalyticsReport = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err?.message || 'Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isPNQtoLKO = selectedRoute === 'PNQ-LKO';

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
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-slate-500">Querying real Firestore snapshots for {selectedRoute}...</p>
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
