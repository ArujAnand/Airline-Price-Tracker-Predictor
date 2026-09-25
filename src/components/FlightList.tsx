import React, { useState } from 'react';
import { Flight } from '../types';
import { Plane, Clock, Bell, Check, ShieldAlert, ArrowRight, Sparkles, Filter, Calendar, ExternalLink, Radio } from 'lucide-react';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

interface FlightListProps {
  flights: Flight[];
  onTrackFlight: (flight: Flight) => void;
  trackedFlightIds: string[];
  departureDate?: string;
}

export const FlightList: React.FC<FlightListProps> = ({
  flights,
  onTrackFlight,
  trackedFlightIds,
  departureDate,
}) => {
  const [sortBy, setSortBy] = useState<'price' | 'duration' | 'departure'>('price');
  const [filterNonStopOnly, setFilterNonStopOnly] = useState<boolean>(false);
  const [filterAirline, setFilterAirline] = useState<string>('all');

  // Filter
  let filtered = flights.filter((f) => {
    if (filterNonStopOnly && f.stops > 0) return false;
    if (filterAirline !== 'all' && f.airlineCode !== filterAirline) return false;
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    if (sortBy === 'price') return a.currentPrice - b.currentPrice;
    if (sortBy === 'departure') return a.departureTime.localeCompare(b.departureTime);
    if (sortBy === 'duration') return a.duration.localeCompare(b.duration);
    return 0;
  });

  // Extract airlines present in the list
  const availableAirlines = Array.from(new Set(flights.map((f) => f.airlineCode)));

  // Get airline color badge
  const getAirlineColor = (code: string) => {
    switch (code) {
      case '6E':
        return 'bg-blue-50 text-blue-700 border-blue-200'; // IndiGo
      case 'IX':
        return 'bg-orange-50 text-orange-700 border-orange-200'; // Air India Express
      case 'QP':
        return 'bg-amber-50 text-amber-700 border-amber-200'; // Akasa Air
      case 'SG':
        return 'bg-red-50 text-red-700 border-red-200'; // SpiceJet
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Available Flights on this Route ({filtered.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time fares from Google Flights aggregator feed
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Airline filter pills */}
          <div className="flex items-center space-x-1 text-xs">
            <button
              onClick={() => setFilterAirline('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                filterAirline === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Airlines
            </button>
            {availableAirlines.map((code) => {
              const count = flights.filter((f) => f.airlineCode === code).length;
              const name = code === 'IX' ? 'Air India Express' : code === '6E' ? 'IndiGo' : code === 'QP' ? 'Akasa' : code === 'SG' ? 'SpiceJet' : code;
              return (
                <button
                  key={code}
                  onClick={() => setFilterAirline(filterAirline === code ? 'all' : code)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                    filterAirline === code
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{name}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Non-stop filter */}
          <label className="flex items-center space-x-1.5 text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
            <input
              type="checkbox"
              checked={filterNonStopOnly}
              onChange={(e) => setFilterNonStopOnly(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span className="font-medium">Direct Only</span>
          </label>

          {/* Sort dropdown */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="price">Cheapest First</option>
              <option value="duration">Fastest Duration</option>
              <option value="departure">Earliest Departure</option>
            </select>
          </div>
        </div>
      </div>

      {/* Flight Cards List */}
      <div className="space-y-3">
        {filtered.map((flight, idx) => {
          const isTracked = trackedFlightIds.includes(flight.id);
          const isAtHistoricalLow = flight.currentPrice <= flight.historicalLow30d * 1.04;
          const cardKey = flight.id ? `${flight.id}-${idx}` : `flight-${flight.flightNumber}-${flight.departureTime}-${idx}`;

          return (
            <div
              key={cardKey}
              className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                isTracked
                  ? 'border-blue-300 bg-blue-50/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: Airline & Times */}
                <div className="flex items-start sm:items-center space-x-4">
                  {/* Airline Badge */}
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center p-1.5 border border-slate-200 shrink-0">
                    <span className="text-xs font-bold text-slate-800">{flight.airlineCode}</span>
                    <span className="text-[9px] text-slate-500 truncate max-w-full">{flight.flightNumber.split('-')[1]}</span>
                  </div>

                  {/* Flight Info & Times */}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-900">{flight.airline}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${getAirlineColor(flight.airlineCode)}`}>
                        {flight.flightNumber}
                      </span>
                      {flight.isLiveScraped ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Live Google Flights
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1" title="Estimated fare from route yield model when live scraper is rate-limited">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                          Simulated Yield Model
                        </span>
                      )}
                      {isAtHistoricalLow && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-emerald-600" />
                          30d Floor Price
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-3 mt-1.5 text-slate-700">
                      <span className="text-lg font-bold text-slate-900">{flight.departureTime}</span>
                      <div className="flex flex-col items-center px-1">
                        <span className="text-[10px] text-slate-400 font-medium">{flight.duration}</span>
                        <div className="w-16 h-0.5 bg-slate-300 relative my-0.5">
                          <Plane className="h-2.5 w-2.5 text-blue-600 absolute -top-1 right-1/2 transform translate-x-1/2 -rotate-45" />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {flight.stops === 0 ? 'Non-stop' : flight.stopDetails || '1 Stop'}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-slate-900">{flight.arrivalTime}</span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
                      <span>{flight.originCity} ({flight.origin}) → {flight.destinationCity} ({flight.destination})</span>
                      <span>•</span>
                      <span className="font-medium text-slate-600">Date: {formatDateDDMMYYYY(flight.departureDate || departureDate)}</span>
                      <span>•</span>
                      <span>{flight.aircraft}</span>
                      {flight.bookingUrl && (
                        <>
                          <span>•</span>
                          <a
                            href={flight.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5 inline-flex"
                          >
                            <span>Google Flights</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Price & Tracking Alert Button */}
                <div className="flex items-center justify-between md:justify-end space-x-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <div className="text-xl sm:text-2xl font-bold text-slate-900">
                      ₹{flight.currentPrice.toLocaleString('en-IN')}
                    </div>
                    
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      {flight.priceTrend24h < 0 ? (
                        <span className="text-xs font-semibold text-emerald-600">
                          ↓ {flight.priceTrend24h}% in 24h
                        </span>
                      ) : flight.priceTrend24h > 0 ? (
                        <span className="text-xs font-semibold text-rose-600">
                          ↑ +{flight.priceTrend24h}% in 24h
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Steady</span>
                      )}

                      {flight.seatsRemaining <= 5 && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                          Only {flight.seatsRemaining} seats left
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Track Alert Button */}
                  <button
                    id={`track-flight-${flight.flightNumber}`}
                    onClick={() => onTrackFlight(flight)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95 ${
                      isTracked
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-900 hover:bg-blue-600 text-white shadow-sm'
                    }`}
                  >
                    {isTracked ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700" />
                        <span>Tracking Active</span>
                      </>
                    ) : (
                      <>
                        <Bell className="h-3.5 w-3.5" />
                        <span>Track Fare</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
