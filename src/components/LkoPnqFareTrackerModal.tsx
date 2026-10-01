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

                  {/* Daily Minimum Fare Comparison Curve */}
                  <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Corridor Minimum Fare by Departure Date
                        </h3>
                        <p className="text-xs text-slate-500">
                          Lowest authentic fare observed on Google Flights for each departure date in 9–23 Nov 2026
                        </p>
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        LKO ➔ PNQ
                      </div>
                    </div>

                    <div className="h-56 flex items-end gap-1 sm:gap-2 pt-6 pb-2 px-1 sm:px-2 border-b border-slate-100">
                      {data.dateBreakdown.map(d => {
                        const validPrices = data.dateBreakdown.filter(x => x.minPrice !== null).map(x => x.minPrice as number);
                        const maxVal = (validPrices.length > 0 ? Math.max(...validPrices) : 10000) * 1.1;
                        const heightPct = d.minPrice !== null ? Math.max(15, Math.round((d.minPrice / maxVal) * 100)) : 4;
                        const isSelected = selectedDate === d.date;
                        return (
                          <div
                            key={d.date}
                            onClick={() => setSelectedDate(d.date)}
                            className="flex-1 flex flex-col items-center cursor-pointer group h-full justify-end"
                          >
                            <span className={`text-[9px] sm:text-[10px] font-bold mb-1 transition text-center whitespace-nowrap ${
                              isSelected
                                ? 'text-blue-700'
                                : d.minPrice !== null
                                  ? 'text-slate-700 group-hover:text-blue-600'
                                  : 'text-slate-400'
                            }`}>
                              {d.minPrice !== null ? (
                                <>
                                  <span className="hidden md:inline">₹{d.minPrice.toLocaleString('en-IN')}</span>
                                  <span className="md:hidden">₹{(d.minPrice / 1000).toFixed(1)}k</span>
                                </>
                              ) : (
                                '—'
                              )}
                            </span>
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full max-w-[40px] rounded-t-md transition-all ${
                                isSelected
                                  ? 'bg-blue-600 shadow-md'
                                  : d.minPrice !== null
                                    ? 'bg-blue-100 group-hover:bg-blue-400'
                                    : 'bg-slate-100 border border-dashed border-slate-200'
                              }`}
                            />
                            <span className={`text-[10px] font-medium mt-2 whitespace-nowrap ${
                              isSelected ? 'text-blue-700 font-bold' : 'text-slate-600'
                            }`}>
                              {d.date.slice(8)} Nov
                            </span>
                          </div>
                        );
                      })}
                    </div>
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
                    <div className="relative w-full h-64 border border-slate-100 rounded-lg bg-slate-50/50 overflow-hidden">
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
                          const height = 240;
                          const padX = 40;
                          const padY = 25;

                          return (
                            <svg
                              viewBox={`0 0 ${width} ${height}`}
                              className="w-full h-full"
                              preserveAspectRatio="none"
                            >
                              {/* Horizontal Grid lines */}
                              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                                const y = padY + (1 - ratio) * (height - 2 * padY);
                                const pVal = Math.round(minP + ratio * priceSpan);
                                return (
                                  <g key={ratio}>
                                    <line
                                      x1={padX}
                                      y1={y}
                                      x2={width - padX}
                                      y2={y}
                                      stroke="#e2e8f0"
                                      strokeDasharray="4 4"
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={padX - 6}
                                      y={y + 4}
                                      textAnchor="end"
                                      fontSize="10"
                                      fill="#94a3b8"
                                      fontFamily="monospace"
                                    >
                                      ₹{pVal.toLocaleString('en-IN')}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Data points */}
                              {obsList.map((obs, idx) => {
                                const t = new Date(obs.timestamp).getTime();
                                const x = padX + ((t - minTime) / timeSpan) * (width - 2 * padX);
                                const y = padY + (1 - (obs.price - minP) / priceSpan) * (height - 2 * padY);

                                const color = obs.airline === 'IndiGo'
                                  ? '#2563eb'
                                  : obs.airline === 'Air India'
                                  ? '#dc2626'
                                  : obs.airline === 'Air India Express'
                                  ? '#ea580c'
                                  : '#059669';

                                return (
                                  <circle
                                    key={obs.id || idx}
                                    cx={x}
                                    cy={y}
                                    r="4"
                                    fill={color}
                                    fillOpacity="0.8"
                                    stroke="#ffffff"
                                    strokeWidth="1.5"
                                    className="cursor-pointer hover:r-6 transition-all"
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setHoveredPoint({
                                        x: rect.left,
                                        y: rect.top,
                                        price: obs.price,
                                        timestamp: obs.timestamp,
                                        flightNumber: obs.flightNumber,
                                        airline: obs.airline,
                                        departureDate: obs.departureDate
                                      });
                                    }}
                                    onMouseLeave={() => setHoveredPoint(null)}
                                  />
                                );
                              })}
                            </svg>
                          );
                        })()
                      )}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-2 px-1">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                          <span>IndiGo</span>
                        </span>
                        <span className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                          <span>Air India</span>
                        </span>
                        <span className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block" />
                          <span>Air India Express</span>
                        </span>
                        <span className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                          <span>Akasa Air</span>
                        </span>
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
