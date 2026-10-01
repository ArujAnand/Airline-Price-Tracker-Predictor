import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  TrendingDown, 
  TrendingUp, 
  Plane, 
  RefreshCw, 
  ShieldCheck, 
  Download, 
  Search, 
  Filter, 
  Activity, 
  Clock, 
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { LkoPnqTrendSummary, FlightFareTrajectory, AuthenticFareObservation } from '../types/fareTracker';
import { BookingWindowCurveChart } from './BookingWindowCurveChart';
import { FlightFareHistoryChart } from './FlightFareHistoryChart';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LkoPnqFareTrackerModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<LkoPnqTrendSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [selectedAirline, setSelectedAirline] = useState<string>('ALL');
  const [flightSearch, setFlightSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'chart' | 'matrix' | 'raw'>('chart');
  const [selectedTrajectory, setSelectedTrajectory] = useState<FlightFareTrajectory | null>(null);
  const [sortField, setSortField] = useState<'departureDate' | 'minPrice' | 'lastPrice' | 'priceDelta' | 'observationsCount'>('departureDate');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    price: number;
    timestamp: string;
    flightNumber: string;
    airline: string;
    departureDate: string;
  } | null>(null);

  const fetchData = async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fare-tracker/lko-pnq${refresh ? '?refresh=true' : ''}`);
      if (!res.ok) throw new Error('Failed to load authentic fare tracker data');
      const json: LkoPnqTrendSummary = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Error loading authentic fare trends');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Filtered trajectories
  const filteredTrajectories = useMemo(() => {
    if (!data) return [];
    return data.trajectories.filter(t => {
      if (selectedDate !== 'ALL' && t.departureDate !== selectedDate) return false;
      if (selectedAirline !== 'ALL' && t.airline !== selectedAirline) return false;
      if (flightSearch.trim()) {
        const query = flightSearch.toLowerCase();
        return (
          t.flightNumber.toLowerCase().includes(query) ||
          t.airline.toLowerCase().includes(query)
        );
      }
      return true;
    }).sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [data, selectedDate, selectedAirline, flightSearch, sortField, sortAsc]);

  // Filtered raw observations
  const filteredObservations = useMemo(() => {
    if (!data) return [];
    return data.rawObservations.filter(o => {
      if (selectedDate !== 'ALL' && o.departureDate !== selectedDate) return false;
      if (selectedAirline !== 'ALL' && o.airline !== selectedAirline) return false;
      if (flightSearch.trim()) {
        const query = flightSearch.toLowerCase();
        return (
          o.flightNumber.toLowerCase().includes(query) ||
          o.airline.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [data, selectedDate, selectedAirline, flightSearch]);

  // Selected T-minus yield curve points (all 15 dates or single date)
  const currentTMinusPoints = useMemo(() => {
    if (!data) return [];
    if (selectedDate === 'ALL') {
      return data.corridorTMinusPoints || [];
    }
    const item = data.dateBreakdown.find((d) => d.date === selectedDate);
    return item?.tMinusPoints || [];
  }, [data, selectedDate]);

  const handleExportCSV = () => {
    if (!filteredObservations.length) return;
    const headers = ['Firestore_ID', 'DepartureDate', 'FlightNumber', 'Airline', 'ObservedPrice_INR', 'ObservedTimestamp_UTC', 'Source', 'Provenance'];
    const rows = filteredObservations.map(o => [
      o.id,
      o.departureDate,
      `"${o.flightNumber}"`,
      `"${o.airline}"`,
      o.price,
      o.timestamp,
      `"${o.source}"`,
      `"${o.provenance}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `LKO-PNQ_Authentic_Fares_${selectedDate}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-100 text-blue-800 text-xs font-semibold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                100% Authentic Google Flights Data
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Corridor: LKO ➔ PNQ
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
              <span>Lucknow (LKO)</span>
              <ArrowRight className="w-5 h-5 text-slate-400" />
              <span>Pune (PNQ) Fare Trend Tracker</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Empirical observed fare movement for departure dates: <strong>9 Nov 2026 – 23 Nov 2026</strong>. Zero synthetic data.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchData(true)}
              disabled={loading}
              title="Refresh authentic observations"
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              {error}
            </div>
          )}

          {loading && !data && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Aggregating authentic observed fares from Firestore...</p>
            </div>
          )}

          {data && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Authentic Observations</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{data.totalAuthenticObservations.toLocaleString()}</div>
                  <div className="text-xs text-slate-500 mt-1">Recorded via Google Flights</div>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-xs">
                  <div className="text-xs font-medium text-emerald-800 uppercase tracking-wider">Lowest Observed Fare</div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">₹{data.overallMinFare.price.toLocaleString('en-IN')}</div>
                  <div className="text-xs text-emerald-800 mt-1 truncate">
                    {data.overallMinFare.flightNumber} ({data.overallMinFare.airline}) on {data.overallMinFare.departureDate}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 shadow-xs">
                  <div className="text-xs font-medium text-rose-800 uppercase tracking-wider">Peak Observed Fare</div>
                  <div className="text-2xl font-bold text-rose-700 mt-1">₹{data.overallMaxFare.price.toLocaleString('en-IN')}</div>
                  <div className="text-xs text-rose-800 mt-1 truncate">
                    {data.overallMaxFare.flightNumber} on {data.overallMaxFare.departureDate}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Coverage Window</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{data.uniqueDepartureDates.length} Days</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {data.uniqueDepartureDates[0]?.slice(5)} to {data.uniqueDepartureDates[data.uniqueDepartureDates.length - 1]?.slice(5)}
                  </div>
                </div>
              </div>

              {/* Airline Statistics Row */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Carrier Breakdown (Authentic Observations)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {data.airlines.map(airline => (
                    <div key={airline.name} className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                      <div className="font-semibold text-slate-900 truncate">{airline.name}</div>
                      <div className="text-slate-500 mt-0.5">{airline.count} snapshots</div>
                      <div className="mt-1 flex items-baseline justify-between text-[11px]">
                        <span className="text-emerald-700 font-medium">Min: ₹{airline.minPrice.toLocaleString('en-IN')}</span>
                        <span className="text-slate-600">Avg: ₹{airline.avgPrice.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Controls & Filters */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-slate-100">
                {/* View Tabs */}
                <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-xl w-fit">
                  <button
                    onClick={() => setActiveTab('chart')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === 'chart' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📈 Fare Trend Curves
                  </button>
                  <button
                    onClick={() => setActiveTab('matrix')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === 'matrix' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📋 Flight Trajectories ({filteredTrajectories.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('raw')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      activeTab === 'raw' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🔍 Raw Observations ({filteredObservations.length})
                  </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Airline Filter */}
                  <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={selectedAirline}
                      onChange={(e) => setSelectedAirline(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ALL">All Airlines</option>
                      {data.airlines.map(a => (
                        <option key={a.name} value={a.name}>{a.name} ({a.count})</option>
                      ))}
                    </select>
                  </div>

                  {/* Flight Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search flight (e.g. 6E-118)..."
                      value={flightSearch}
                      onChange={(e) => setFlightSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 w-44 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Export CSV button */}
                  <button
                    onClick={handleExportCSV}
                    title="Export authentic observations to CSV"
                    className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Date Filter Pills */}
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
                  <span>Filter by Departure Date:</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Showing {selectedDate === 'ALL' ? 'all 9–23 Nov departures' : selectedDate}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedDate('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                      selectedDate === 'ALL'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    All Dates ({data.totalAuthenticObservations})
                  </button>
                  {data.dateBreakdown.map(d => {
                    const isSelected = selectedDate === d.date;
                    const dateObj = new Date(d.date);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const formatted = `${dayName} ${d.date.slice(8)} Nov`;
                    return (
                      <button
                        key={d.date}
                        onClick={() => setSelectedDate(d.date)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs transition border flex flex-col items-start ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-semibold">{formatted}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {d.minPrice !== null ? `From ₹${d.minPrice.toLocaleString('en-IN')}` : 'No data yet'} ({d.observationCount} obs)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab 1: Chart View */}
              {activeTab === 'chart' && (
                <div className="space-y-6">
                  {/* T-Minus Advance Booking Yield Curve */}
                  <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            T-Minus Fare Trajectory Curve
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 font-mono">
                            {selectedDate === 'ALL' ? 'Corridor (9–23 Nov)' : `${selectedDate.slice(8)} Nov 2026`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {selectedDate === 'ALL' 
                            ? 'Aggregates authentic Google Flights observations into canonical advance booking milestones (T-90d down to T-1d) across all 15 departure dates.'
                            : `Observed advance booking milestones for departure date ${selectedDate}. Missing milestones represent periods without scraping.`}
                        </p>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span>
                          <span>Observed Fares</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full border border-slate-400 border-dashed inline-block"></span>
                          <span className="text-slate-500">No Observation (Unavailable)</span>
                        </span>
                      </div>
                    </div>

                    <BookingWindowCurveChart
                      points={currentTMinusPoints}
                      title="AUTHENTIC ADVANCE BOOKING YIELD CURVE"
                      subtitle="T-90d → T-1d"
                      departureDateLabel={selectedDate === 'ALL' ? 'LKO ➔ PNQ Combined' : `Departure: ${selectedDate}`}
                    />

                    {/* Explanatory Data Purity Note */}
                    <div className="text-[10.5px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Derived strictly from authentic recorded fare snapshots. Missing milestones remain unavailable (never estimated or predicted).</span>
                      </span>
                      <span className="text-[10px] font-semibold text-slate-700">
                        Cadence: ~3h collection cycle
                      </span>
                    </div>
                  </div>

                  {/* Daily Fare Metrics (Max, Current, Min) Comparison Curve */}
                  <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <span>Corridor Fare Dynamics by Departure Date</span>
                          <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                            Min • Current • Max
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Authentic fare range showing all-time Minimum, all-time Maximum, and Current lowest fare for each date (9–23 Nov 2026)
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                          <span>Max</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shadow-sm" />
                          <span>Current</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                          <span>Min</span>
                        </span>
                      </div>
                    </div>

                    {/* Interactive 15-Date Range & Price Matrix */}
                    <div className="h-64 flex items-end gap-1 sm:gap-2 pt-8 pb-2 px-1 sm:px-2 border-b border-slate-100">
                      {data.dateBreakdown.map(d => {
                        const allMaxes = data.dateBreakdown.filter(x => x.maxPrice !== null).map(x => x.maxPrice as number);
                        const globalMax = (allMaxes.length > 0 ? Math.max(...allMaxes) : 35000) * 1.05;
                        const isSelected = selectedDate === d.date;
                        const hasData = d.minPrice !== null && d.maxPrice !== null;
                        
                        const minVal = d.minPrice || 0;
                        const maxVal = d.maxPrice || 0;
                        const curVal = d.currentPrice ?? d.minPrice ?? 0;

                        const minPct = hasData ? Math.max(6, Math.round((minVal / globalMax) * 100)) : 0;
                        const maxPct = hasData ? Math.max(minPct + 8, Math.round((maxVal / globalMax) * 100)) : 0;
                        const curPct = hasData ? Math.max(minPct, Math.min(maxPct, Math.round((curVal / globalMax) * 100))) : 0;
                        const barHeightPct = Math.max(10, maxPct - minPct);

                        return (
                          <div
                            key={d.date}
                            onClick={() => setSelectedDate(d.date)}
                            className={`flex-1 flex flex-col items-center cursor-pointer group h-full justify-end relative rounded-lg p-0.5 transition-all ${
                              isSelected ? 'bg-blue-50/70 ring-1 ring-blue-400' : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Max Fare Label */}
                            <span className="text-[8px] sm:text-[9px] font-semibold text-rose-600 mb-0.5 whitespace-nowrap text-center">
                              {hasData ? (
                                <>
                                  <span className="hidden lg:inline">₹{maxVal.toLocaleString('en-IN')}</span>
                                  <span className="lg:hidden">₹{(maxVal / 1000).toFixed(1)}k</span>
                                </>
                              ) : (
                                '—'
                              )}
                            </span>

                            {/* Range Bar & Current Indicator */}
                            <div className="w-full max-w-[34px] h-full flex flex-col justify-end relative my-1">
                              {hasData ? (
                                <div
                                  style={{
                                    height: `${barHeightPct}%`,
                                    marginBottom: `${minPct}%`
                                  }}
                                  className={`w-full rounded-md relative transition-all shadow-sm ${
                                    isSelected
                                      ? 'bg-gradient-to-t from-emerald-400 via-blue-500 to-rose-400'
                                      : 'bg-gradient-to-t from-emerald-200 via-blue-200 to-rose-200 group-hover:from-emerald-300 group-hover:to-rose-300'
                                  }`}
                                >
                                  {/* Current Price Marker Pin */}
                                  <div
                                    style={{
                                      bottom: `${barHeightPct > 0 ? Math.min(100, Math.max(0, ((curVal - minVal) / Math.max(1, maxVal - minVal)) * 100)) : 50}%`
                                    }}
                                    className="absolute left-1/2 transform -translate-x-1/2 translate-y-1/2 z-10 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-blue-600 border-2 border-white rounded-full shadow-md flex items-center justify-center"
                                    title={`Current: ₹${curVal.toLocaleString('en-IN')}`}
                                  />
                                </div>
                              ) : (
                                <div className="w-full h-8 rounded border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                                  <span className="text-[8px] text-slate-300">No data</span>
                                </div>
                              )}
                            </div>

                            {/* Current & Min Fare Combined Footers */}
                            <div className="flex flex-col items-center gap-0.5 mt-0.5">
                              {/* Current Price */}
                              <span className={`text-[8px] sm:text-[9.5px] font-bold whitespace-nowrap text-center ${
                                isSelected ? 'text-blue-700' : 'text-blue-600'
                              }`}>
                                {hasData ? (
                                  <>
                                    <span className="hidden lg:inline">₹{curVal.toLocaleString('en-IN')}</span>
                                    <span className="lg:hidden">₹{(curVal / 1000).toFixed(1)}k</span>
                                  </>
                                ) : (
                                  '—'
                                )}
                              </span>

                              {/* Min Price */}
                              <span className="text-[8px] sm:text-[9px] font-semibold text-emerald-600 whitespace-nowrap text-center">
                                {hasData ? (
                                  <>
                                    <span className="hidden lg:inline">₹{minVal.toLocaleString('en-IN')}</span>
                                    <span className="lg:hidden">₹{(minVal / 1000).toFixed(1)}k</span>
                                  </>
                                ) : (
                                  '—'
                                )}
                              </span>
                            </div>

                            {/* Date Label */}
                            <span className={`text-[10px] font-medium mt-1 whitespace-nowrap ${
                              isSelected ? 'text-blue-700 font-bold' : 'text-slate-600'
                            }`}>
                              {d.date.slice(8)} Nov
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Selected Date Metric Highlight Bar */}
                    {(() => {
                      const selectedItem = data.dateBreakdown.find(d => d.date === selectedDate);
                      if (!selectedItem || selectedItem.minPrice === null) return null;
                      const min = selectedItem.minPrice;
                      const max = selectedItem.maxPrice || min;
                      const cur = selectedItem.currentPrice ?? min;
                      const spread = max - min;
                      return (
                        <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">
                              {new Date(selectedItem.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              ({selectedItem.observationCount} observations across {selectedItem.flightCount} flights)
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-slate-400 text-[10px] block">MIN RECORDED</span>
                              <span className="font-bold text-emerald-600 font-mono">₹{min.toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">CURRENT LOWEST</span>
                              <span className="font-bold text-blue-600 font-mono">₹{cur.toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">MAX RECORDED</span>
                              <span className="font-bold text-rose-600 font-mono">₹{max.toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">HISTORICAL SPREAD</span>
                              <span className="font-bold text-slate-700 font-mono">₹{spread.toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Multi-Flight Trajectory Scatter / Time-Series */}
                  <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl relative">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Observed Fare Timeline (By Collection Timestamp)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Every point is an authentic fare observation captured from SerpApi / Google Flights
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {filteredObservations.length} observations plotted
                      </span>
                    </div>

                    {/* SVG Chart Container */}
                    <div className="relative w-full h-80 border border-slate-100 rounded-lg bg-slate-50/50 overflow-hidden">
                      {filteredObservations.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                          No observations matching filter criteria.
                        </div>
                      ) : (
                        (() => {
                          const obsList = filteredObservations;
                          const timestamps = obsList.map(o => new Date(o.timestamp).getTime());
                          const minTime = Math.min(...timestamps);
                          const maxTime = Math.max(...timestamps);
                          const timeSpan = Math.max(1, maxTime - minTime);

                          const prices = obsList.map(o => o.price);
                          const minP = Math.min(...prices) * 0.95;
                          const maxP = Math.max(...prices) * 1.05;
                          const priceSpan = Math.max(1, maxP - minP);

                          const width = 800;
                          const height = 290;
                          const padLeft = 65;
                          const padRight = 30;
                          const padTop = 20;
                          const padBottom = 45;
                          const chartW = width - padLeft - padRight;
                          const chartH = height - padTop - padBottom;

                          // Time intervals for X-axis ticks (4 ticks)
                          const timeTicks = [0, 0.33, 0.66, 1].map(ratio => {
                            const tVal = minTime + ratio * timeSpan;
                            const d = new Date(tVal);
                            const day = d.getDate().toString().padStart(2, '0');
                            const month = d.toLocaleString('en-IN', { month: 'short' });
                            const hours = d.getHours().toString().padStart(2, '0');
                            const mins = d.getMinutes().toString().padStart(2, '0');
                            return {
                              ratio,
                              x: padLeft + ratio * chartW,
                              label: `${day} ${month}`,
                              time: `${hours}:${mins}`
                            };
                          });

                          const AIRLINE_CONFIG: Record<string, { stroke: string; fill: string; bg: string; text: string }> = {
                            'IndiGo': { stroke: '#2563eb', fill: '#3b82f6', bg: 'bg-blue-600', text: 'text-blue-600' },
                            'Air India': { stroke: '#dc2626', fill: '#ef4444', bg: 'bg-red-600', text: 'text-red-600' },
                            'Air India Express': { stroke: '#ea580c', fill: '#f97316', bg: 'bg-orange-600', text: 'text-orange-600' },
                            'Akasa Air': { stroke: '#059669', fill: '#10b981', bg: 'bg-emerald-600', text: 'text-emerald-600' },
                            'SpiceJet': { stroke: '#d97706', fill: '#f59e0b', bg: 'bg-amber-600', text: 'text-amber-600' }
                          };

                          const distinctAirlines = Array.from(new Set(obsList.map(o => o.airline)));

                          const airlineSeries = distinctAirlines.map(airlineName => {
                            const points = obsList
                              .filter(o => o.airline === airlineName)
                              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                              .map((obs, idx) => {
                                const t = new Date(obs.timestamp).getTime();
                                const x = padLeft + (timeSpan > 0 ? ((t - minTime) / timeSpan) : 0.5) * chartW;
                                const y = padTop + (priceSpan > 0 ? (1 - (obs.price - minP) / priceSpan) : 0.5) * chartH;
                                return { x, y, obs, id: obs.id || `${airlineName}-${idx}` };
                              });

                            const pathD = points.length > 0
                              ? points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
                              : '';

                            const cfg = AIRLINE_CONFIG[airlineName] || { stroke: '#64748b', fill: '#94a3b8', bg: 'bg-slate-600', text: 'text-slate-600' };

                            return { airlineName, points, pathD, cfg };
                          });

                          return (
                            <>
                              <svg
                                viewBox={`0 0 ${width} ${height}`}
                                className="w-full h-full"
                                preserveAspectRatio="none"
                              >
                                <defs>
                                  {airlineSeries.map(s => (
                                    <linearGradient key={`grad-${s.airlineName}`} id={`grad-${s.airlineName.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor={s.cfg.stroke} stopOpacity="0.25" />
                                      <stop offset="100%" stopColor={s.cfg.stroke} stopOpacity="0.0" />
                                    </linearGradient>
                                  ))}
                                </defs>

                                {/* Vertical Time Grid lines & Date Labels */}
                                {timeTicks.map((tick, idx) => (
                                  <g key={idx}>
                                    <line
                                      x1={tick.x}
                                      y1={padTop}
                                      x2={tick.x}
                                      y2={padTop + chartH}
                                      stroke="#e2e8f0"
                                      strokeDasharray="3 3"
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={tick.x}
                                      y={padTop + chartH + 16}
                                      textAnchor="middle"
                                      fontSize="10"
                                      fontWeight="bold"
                                      fill="#475569"
                                    >
                                      {tick.label}
                                    </text>
                                    <text
                                      x={tick.x}
                                      y={padTop + chartH + 28}
                                      textAnchor="middle"
                                      fontSize="9"
                                      fill="#94a3b8"
                                      fontFamily="monospace"
                                    >
                                      {tick.time}
                                    </text>
                                  </g>
                                ))}

                                {/* Horizontal Fare Grid lines & Y-axis Labels */}
                                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                                  const y = padTop + (1 - ratio) * chartH;
                                  const pVal = Math.round(minP + ratio * priceSpan);
                                  return (
                                    <g key={ratio}>
                                      <line
                                        x1={padLeft}
                                        y1={y}
                                        x2={width - padRight}
                                        y2={y}
                                        stroke="#e2e8f0"
                                        strokeDasharray="4 4"
                                        strokeWidth="1"
                                      />
                                      <text
                                        x={padLeft - 8}
                                        y={y + 4}
                                        textAnchor="end"
                                        fontSize="10"
                                        fill="#64748b"
                                        fontWeight="500"
                                        fontFamily="monospace"
                                      >
                                        ₹{pVal.toLocaleString('en-IN')}
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Multi-Airline Connected Trajectory Lines */}
                                {airlineSeries.map(series => {
                                  if (!series.pathD) return null;
                                  return (
                                    <g key={`line-${series.airlineName}`}>
                                      <path
                                        d={series.pathD}
                                        fill="none"
                                        stroke={series.cfg.stroke}
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="transition-all opacity-85 hover:opacity-100"
                                      />
                                    </g>
                                  );
                                })}

                                {/* Observation Data point nodes */}
                                {airlineSeries.map(series =>
                                  series.points.map(pt => (
                                    <circle
                                      key={pt.id}
                                      cx={pt.x}
                                      cy={pt.y}
                                      r="4"
                                      fill={series.cfg.fill}
                                      stroke="#ffffff"
                                      strokeWidth="1.5"
                                      className="cursor-pointer hover:r-6 hover:stroke-2 transition-all shadow-sm"
                                      onMouseEnter={(e) => {
                                        const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect();
                                        const pointRect = e.currentTarget.getBoundingClientRect();
                                        setHoveredPoint({
                                          x: pointRect.left - rect.left + pointRect.width / 2,
                                          y: pointRect.top - rect.top,
                                          price: pt.obs.price,
                                          timestamp: pt.obs.timestamp,
                                          flightNumber: pt.obs.flightNumber,
                                          airline: pt.obs.airline,
                                          departureDate: pt.obs.departureDate
                                        });
                                      }}
                                      onClick={() => {
                                        setHoveredPoint({
                                          x: pt.x,
                                          y: pt.y,
                                          price: pt.obs.price,
                                          timestamp: pt.obs.timestamp,
                                          flightNumber: pt.obs.flightNumber,
                                          airline: pt.obs.airline,
                                          departureDate: pt.obs.departureDate
                                        });
                                      }}
                                      onMouseLeave={() => setHoveredPoint(null)}
                                    />
                                  ))
                                )}
                              </svg>

                              {/* Floating Tooltip displaying exact Date & Time of Observation */}
                              {hoveredPoint && (
                                <div
                                  style={{
                                    left: `${Math.min(80, Math.max(20, (hoveredPoint.x / (width || 800)) * 100))}%`,
                                    top: `${Math.max(10, Math.min(65, (hoveredPoint.y / (height || 290)) * 100))}%`
                                  }}
                                  className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 bg-slate-900/95 backdrop-blur text-white text-xs rounded-lg py-2 px-3 shadow-xl border border-slate-700 min-w-[200px]"
                                >
                                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-1.5">
                                    <span className="font-bold text-blue-400">{hoveredPoint.flightNumber}</span>
                                    <span className="text-[11px] text-slate-300">{hoveredPoint.airline}</span>
                                  </div>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Observed At:</span>
                                      <span className="font-semibold text-amber-300 font-mono">
                                        {new Date(hoveredPoint.timestamp).toLocaleString('en-IN', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: true
                                        })}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Departure:</span>
                                      <span className="text-slate-200 font-mono">{hoveredPoint.departureDate}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-slate-800">
                                      <span className="text-slate-400">Recorded Fare:</span>
                                      <span className="text-emerald-400 font-bold font-mono">₹{hoveredPoint.price.toLocaleString('en-IN')}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()
                      )}
                    </div>

                    {/* Interactive Airline Legend */}
                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 mt-3 px-1 gap-2 border-t border-slate-100 pt-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-400 mr-1">Airlines:</span>
                        <button
                          onClick={() => setSelectedAirline('ALL')}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition ${
                            selectedAirline === 'ALL'
                              ? 'bg-slate-800 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          All Airlines
                        </button>
                        {[
                          { name: 'IndiGo', bg: 'bg-blue-600', text: 'text-blue-700' },
                          { name: 'Air India', bg: 'bg-red-600', text: 'text-red-700' },
                          { name: 'Air India Express', bg: 'bg-orange-600', text: 'text-orange-700' },
                          { name: 'Akasa Air', bg: 'bg-emerald-600', text: 'text-emerald-700' }
                        ].map(airline => {
                          const isAct = selectedAirline === airline.name;
                          return (
                            <button
                              key={airline.name}
                              onClick={() => setSelectedAirline(isAct ? 'ALL' : airline.name)}
                              className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] transition ${
                                isAct
                                  ? 'bg-slate-900 text-white font-semibold shadow-xs'
                                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${airline.bg} inline-block`} />
                              <span>{airline.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Earliest: {data.earliestObservationTimestamp.slice(0, 10)} • Latest: {data.latestObservationTimestamp.slice(0, 10)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Trajectories Table */}
              {activeTab === 'matrix' && (
                <div className="space-y-4">
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-3 px-4">Flight / Airline</th>
                          <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortField('departureDate'); setSortAsc(!sortAsc); }}>
                            Departure Date {sortField === 'departureDate' && (sortAsc ? '▲' : '▼')}
                          </th>
                          <th className="py-3 px-4">Snapshots</th>
                          <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortField('minPrice'); setSortAsc(!sortAsc); }}>
                            Lowest Fare {sortField === 'minPrice' && (sortAsc ? '▲' : '▼')}
                          </th>
                          <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortField('lastPrice'); setSortAsc(!sortAsc); }}>
                            Latest Fare {sortField === 'lastPrice' && (sortAsc ? '▲' : '▼')}
                          </th>
                          <th className="py-3 px-4 cursor-pointer" onClick={() => { setSortField('priceDelta'); setSortAsc(!sortAsc); }}>
                            Price Movement {sortField === 'priceDelta' && (sortAsc ? '▲' : '▼')}
                          </th>
                          <th className="py-3 px-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTrajectories.map(t => {
                          const isPositive = t.priceDelta < 0; // drop is positive for traveler
                          const isFlat = t.priceDelta === 0;
                          return (
                            <tr key={`${t.flightNumber}_${t.departureDate}`} className="hover:bg-slate-50/70 transition">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">{t.flightNumber}</div>
                                <div className="text-slate-500 text-[11px]">{t.airline}</div>
                              </td>
                              <td className="py-3 px-4 font-mono">
                                {t.departureDate}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                  {t.observationsCount} obs
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold text-emerald-700">
                                ₹{t.minPrice.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                ₹{t.lastPrice.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-4">
                                {isFlat ? (
                                  <span className="text-slate-500 font-medium">Flat (No change)</span>
                                ) : isPositive ? (
                                  <span className="inline-flex items-center text-emerald-700 font-semibold gap-1">
                                    <TrendingDown className="w-3.5 h-3.5" />
                                    <span>-₹{Math.abs(t.priceDelta).toLocaleString('en-IN')} ({Math.abs(Math.round(t.priceDeltaPercent))}%)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-rose-700 font-semibold gap-1">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    <span>+₹{t.priceDelta.toLocaleString('en-IN')} (+{Math.round(t.priceDeltaPercent)}%)</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  onClick={() => setSelectedTrajectory(t)}
                                  className="text-blue-600 hover:text-blue-800 font-medium underline text-xs"
                                >
                                  View History
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Dedicated Observed Fare History Modal */}
                  {selectedTrajectory && (
                    <FlightFareHistoryChart
                      flightNumber={selectedTrajectory.flightNumber}
                      departureDate={selectedTrajectory.departureDate}
                      airline={selectedTrajectory.airline}
                      onClose={() => setSelectedTrajectory(null)}
                    />
                  )}
                </div>
              )}

              {/* Tab 3: Raw Observations Audit Log */}
              {activeTab === 'raw' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-600">
                      Audit log of authentic observations stored in Cloud Firestore for LKO ➔ PNQ. Zero synthetic records.
                    </p>
                    <span className="text-xs font-mono text-slate-500">
                      Showing {filteredObservations.length} of {data.totalAuthenticObservations}
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-96">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-100 border-b border-slate-200">
                        <tr className="text-slate-700 font-semibold">
                          <th className="py-2.5 px-3">Captured (IST)</th>
                          <th className="py-2.5 px-3">Dep Date</th>
                          <th className="py-2.5 px-3">Flight</th>
                          <th className="py-2.5 px-3">Airline</th>
                          <th className="py-2.5 px-3">Fare (INR)</th>
                          <th className="py-2.5 px-3">Source Provider</th>
                          <th className="py-2.5 px-3">Provenance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {filteredObservations.map((obs) => (
                          <tr key={obs.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-600">
                              {new Date(obs.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                            </td>
                            <td className="py-2 px-3 text-slate-800 font-bold">
                              {obs.departureDate}
                            </td>
                            <td className="py-2 px-3 text-slate-900">
                              {obs.flightNumber}
                            </td>
                            <td className="py-2 px-3 text-slate-700 font-sans">
                              {obs.airline}
                            </td>
                            <td className="py-2 px-3 font-bold text-emerald-700">
                              ₹{obs.price.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-sans">
                              {obs.source}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px]">
                                {obs.provenance}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Data Source: Authentic Google Flights Fare Observation Ledger • Strict Purity Guard Active
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
          >
            Close Tracker
          </button>
        </div>
      </div>
    </div>
  );
};
