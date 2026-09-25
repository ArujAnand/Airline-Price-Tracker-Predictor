import React, { useState, useEffect } from 'react';
import { AggregatorStatus, PriceSnapshot, Flight } from '../types';
import { 
  X, 
  Database, 
  RefreshCw, 
  Download, 
  ShieldCheck, 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Plane, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

interface FlightTemplate {
  flightNumber: string;
  airline: string;
  airlineCode: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  stopDetails?: string;
  basePrice: number;
  aircraft: string;
}

interface AggregatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  status: AggregatorStatus | null;
  snapshots: PriceSnapshot[];
  onSyncNow: () => void;
  isSyncing: boolean;
}

export const AggregatorDrawer: React.FC<AggregatorDrawerProps> = ({
  isOpen,
  onClose,
  status,
  snapshots,
  onSyncNow,
  isSyncing,
}) => {
  const [activeTab, setActiveTab] = useState<'snapshots' | 'inventory'>('snapshots');
  const [filterRoute, setFilterRoute] = useState<string>('PNQ-LKO');
  const [schedule, setSchedule] = useState<FlightTemplate[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Form for adding/updating flight
  const [showAddForm, setShowAddForm] = useState(false);
  const [flightNumber, setFlightNumber] = useState('');
  const [airline, setAirline] = useState('Air India Express');
  const [airlineCode, setAirlineCode] = useState('IX');
  const [departureTime, setDepartureTime] = useState('16:35');
  const [arrivalTime, setArrivalTime] = useState('18:50');
  const [duration, setDuration] = useState('2h 15m');
  const [stops, setStops] = useState<number>(0);
  const [basePrice, setBasePrice] = useState<number>(3880);
  const [aircraft, setAircraft] = useState('Boeing 737 MAX 8');

  // Load schedule when tab or route changes
  const loadSchedule = async (routeId: string) => {
    setLoadingSchedule(true);
    try {
      const res = await fetch(`/api/aggregator/schedule?routeId=${routeId}`);
      if (res.ok) {
        const data = await res.json();
        setSchedule(data);
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSchedule(filterRoute === 'ALL' ? 'PNQ-LKO' : filterRoute);
    }
  }, [isOpen, filterRoute]);

  if (!isOpen) return null;

  const filteredSnapshots = filterRoute === 'ALL'
    ? snapshots
    : snapshots.filter((s) => s.routeId.toUpperCase() === filterRoute.toUpperCase());

  // Export to CSV function
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Type', 'Route', 'Flight', 'Airline', 'Price (INR)', 'Source'];
    const rows = filteredSnapshots.map((s) => [
      s.timestamp,
      s.type,
      s.routeId,
      s.flightNumber,
      s.airline,
      s.price,
      s.source,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `google-flights-aggregator-${filterRoute}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add / Update flight
  const handleSaveFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flightNumber.trim()) return;

    try {
      const routeToUpdate = filterRoute === 'ALL' ? 'PNQ-LKO' : filterRoute;
      const res = await fetch('/api/aggregator/flights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId: routeToUpdate,
          flight: {
            flightNumber: flightNumber.trim().toUpperCase(),
            airline,
            airlineCode: airlineCode.trim().toUpperCase(),
            departureTime,
            arrivalTime,
            duration,
            stops: Number(stops),
            basePrice: Number(basePrice),
            aircraft,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStatusMsg(`✓ ${data.message}`);
        setShowAddForm(false);
        await loadSchedule(routeToUpdate);
        setTimeout(() => setStatusMsg(null), 4000);
      }
    } catch (err) {
      console.error('Save flight error:', err);
    }
  };

  // Delete flight
  const handleDeleteFlight = async (flNum: string) => {
    const routeToUpdate = filterRoute === 'ALL' ? 'PNQ-LKO' : filterRoute;
    try {
      const res = await fetch('/api/aggregator/flights', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId: routeToUpdate,
          flightNumber: flNum,
        }),
      });

      if (res.ok) {
        setStatusMsg(`✓ Removed flight ${flNum} from live schedule tracking.`);
        await loadSchedule(routeToUpdate);
        setTimeout(() => setStatusMsg(null), 4000);
      }
    } catch (err) {
      console.error('Delete flight error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Google Flights Price Aggregator</h2>
              <p className="text-xs text-slate-400">
                Automated multi-carrier tracking, dynamic inventory & live price logs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Engine Status Grid */}
        <div className="p-5 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Aggregator Engine</span>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Auto-Crawler Active
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Total Snapshots</span>
              <span className="text-sm font-bold text-slate-900 mt-1 block">
                {status?.totalSnapshotsCollected || snapshots.length}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Monitored Routes</span>
              <span className="text-xs font-bold text-blue-600 mt-1 block truncate">
                {status?.activeRoutesMonitored.join(', ') || 'PNQ-LKO, LKO-PNQ'}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium block">Autonomous Discovery</span>
              <span className="text-xs font-bold text-purple-700 flex items-center gap-1 mt-1 truncate">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span>Auto-indexing all carriers</span>
              </span>
            </div>
          </div>

          {/* Action Row & Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-600">Route:</span>
              <select
                value={filterRoute}
                onChange={(e) => setFilterRoute(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800"
              >
                <option value="PNQ-LKO">Pune (PNQ) → Lucknow (LKO)</option>
                <option value="LKO-PNQ">Lucknow (LKO) → Pune (PNQ)</option>
                <option value="ALL">All Logged Routes</option>
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <div className="bg-slate-200 p-0.5 rounded-lg flex text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('snapshots')}
                  className={`px-3 py-1 rounded-md transition ${
                    activeTab === 'snapshots'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Price Logs
                </button>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`px-3 py-1 rounded-md transition flex items-center space-x-1 ${
                    activeTab === 'inventory'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Flight Inventory</span>
                  <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.2 rounded-full">
                    {schedule.length}
                  </span>
                </button>
              </div>

              {activeTab === 'snapshots' && (
                <button
                  onClick={handleExportCSV}
                  className="flex items-center space-x-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1 rounded-lg transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>CSV</span>
                </button>
              )}
            </div>
          </div>

          {statusMsg && (
            <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-1.5">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Tab 1: Live Captured Snapshots */}
        {activeTab === 'snapshots' && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Recent Captured Price Snapshots ({filteredSnapshots.length})
              </h3>
              <button
                onClick={onSyncNow}
                disabled={isSyncing}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-bold"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync Now</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {filteredSnapshots.slice(0, 60).map((snap) => {
                const dateObj = new Date(snap.timestamp);
                const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                const formattedDate = formatDateDDMMYYYY(dateObj);

                return (
                  <div key={snap.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50 transition">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        snap.type === 'hourly'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {snap.type.toUpperCase()}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">
                          {snap.routeId} • {snap.airline} {snap.flightNumber}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formattedDate} at {formattedTime} • Source: {snap.source}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">
                        ₹{snap.price.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-medium">Logged</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Flight Inventory (Dynamic Add / Modify / Track new flights) */}
        {activeTab === 'inventory' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Active Monitored Flights ({filterRoute === 'ALL' ? 'PNQ-LKO' : filterRoute})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Autonomous GDS crawler tracks and discovers all new airline listings (e.g. Air India Express IX-1618, IndiGo, Akasa, SpiceJet) automatically without requiring manual user input.
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 border border-slate-300 transition"
              >
                <PlusCircle className="h-3.5 w-3.5 text-blue-600" />
                <span>{showAddForm ? 'Close Editor' : 'Manual Override / Add'}</span>
              </button>
            </div>

            {/* Form for new/updated flight */}
            {showAddForm && (
              <form onSubmit={handleSaveFlight} className="p-4 bg-slate-50 border border-blue-200 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <Plane className="h-4 w-4 text-blue-600" />
                  <span>Introduce New Flight Or Update Existing Flight</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Flight No. (e.g. IX-1618):</label>
                    <input
                      type="text"
                      required
                      value={flightNumber}
                      onChange={(e) => setFlightNumber(e.target.value)}
                      placeholder="IX-1618"
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Airline Name:</label>
                    <input
                      type="text"
                      required
                      value={airline}
                      onChange={(e) => setAirline(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Airline Code (2-letter):</label>
                    <input
                      type="text"
                      required
                      value={airlineCode}
                      onChange={(e) => setAirlineCode(e.target.value)}
                      placeholder="IX"
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 uppercase font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Departure Time:</label>
                    <input
                      type="text"
                      required
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      placeholder="16:35"
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Arrival Time:</label>
                    <input
                      type="text"
                      required
                      value={arrivalTime}
                      onChange={(e) => setArrivalTime(e.target.value)}
                      placeholder="18:50"
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Duration:</label>
                    <input
                      type="text"
                      required
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="2h 15m"
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Stops (0 = Direct):</label>
                    <select
                      value={stops}
                      onChange={(e) => setStops(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5"
                    >
                      <option value={0}>0 (Non-stop)</option>
                      <option value={1}>1 (Layover)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Base Rack Fare (INR):</label>
                    <input
                      type="number"
                      required
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Aircraft Model:</label>
                    <input
                      type="text"
                      value={aircraft}
                      onChange={(e) => setAircraft(e.target.value)}
                      placeholder="Boeing 737 MAX 8"
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs"
                  >
                    Save &amp; Track Flight
                  </button>
                </div>
              </form>
            )}

            {/* Flight list cards */}
            <div className="space-y-2">
              {schedule.map((fl) => (
                <div
                  key={fl.flightNumber}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between text-xs transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex flex-col items-center justify-center font-bold border border-slate-200">
                      <span className="text-xs text-slate-800">{fl.airlineCode}</span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 flex items-center space-x-2">
                        <span>{fl.airline} {fl.flightNumber}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                          {fl.stops === 0 ? 'Non-stop' : `${fl.stops} stop`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {fl.departureTime} → {fl.arrivalTime} ({fl.duration}) • {fl.aircraft}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900 block">
                        Base ₹{fl.basePrice.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium">Actively Scraped</span>
                    </div>
                    <button
                      onClick={() => {
                        setFlightNumber(fl.flightNumber);
                        setAirline(fl.airline);
                        setAirlineCode(fl.airlineCode);
                        setDepartureTime(fl.departureTime);
                        setArrivalTime(fl.arrivalTime);
                        setDuration(fl.duration);
                        setStops(fl.stops);
                        setBasePrice(fl.basePrice);
                        setAircraft(fl.aircraft);
                        setShowAddForm(true);
                      }}
                      title="Edit flight details"
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFlight(fl.flightNumber)}
                      title="Remove from tracking"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
