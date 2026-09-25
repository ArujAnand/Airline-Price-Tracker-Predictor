import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Calendar, 
  ArrowRight, 
  Check, 
  TrendingDown, 
  Briefcase, 
  Clock, 
  Loader2,
  ChevronRight,
  Plane,
  Filter,
  Search,
  Tag
} from 'lucide-react';
import { SmartDateRecommendation, SmartDateFinderResponse } from '../types';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

interface SmartDateFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  origin: string;
  destination: string;
  onSelectDatePair: (outboundDate: string, returnDate?: string) => void;
}

export const SmartDateFinderModal: React.FC<SmartDateFinderModalProps> = ({
  isOpen,
  onClose,
  origin,
  destination,
  onSelectDatePair,
}) => {
  const [naturalQuery, setNaturalQuery] = useState('');
  const [selectedFestival, setSelectedFestival] = useState('Diwali');
  const [tripLength, setTripLength] = useState<'short' | 'standard' | 'extended' | 'any'>('standard');
  const [selectedAirline, setSelectedAirline] = useState<string>('all');
  const [priority, setPriority] = useState<'cheapest' | 'minimal_leaves' | 'weekend_only' | 'avoid_peak'>('cheapest');
  const [loading, setLoading] = useState(false);
  const [smartResult, setSmartResult] = useState<SmartDateFinderResponse | null>(null);

  const festivalPresets = [
    { name: 'Diwali', label: 'Diwali 2026', date: 'Oct 18' },
    { name: 'Dussehra', label: 'Dussehra', date: 'Oct 9' },
    { name: 'Chhath', label: 'Chhath Puja', date: 'Oct 25' },
    { name: 'Christmas', label: 'Year-End / New Year', date: 'Dec 25 - Jan 1' },
  ];

  const quickVagueExamples = [
    '5 days trip mid-October under 15k across any airline',
    '3 days weekend trip requiring minimum office leaves',
    'Best Air India Express or IndiGo round-trip avoid Friday peak',
    'Cheapest week-long trip in late October for Diwali & Chhath',
  ];

  const fetchSmartDates = async (
    queryText?: string,
    fest?: string,
    length?: 'short' | 'standard' | 'extended' | 'any',
    airline?: string,
    prio?: 'cheapest' | 'minimal_leaves' | 'weekend_only' | 'avoid_peak'
  ) => {
    setLoading(true);
    try {
      const q = queryText || fest || selectedFestival;
      const l = length || tripLength;
      const a = airline || selectedAirline;
      const p = prio || priority;

      const res = await fetch(
        `/api/smart-dates?origin=${origin}&destination=${destination}&query=${encodeURIComponent(
          q
        )}&tripLength=${l}&airline=${encodeURIComponent(a)}&priority=${p}`
      );
      if (res.ok) {
        const data: SmartDateFinderResponse = await res.json();
        setSmartResult(data);
      }
    } catch (err) {
      console.error('Failed to fetch smart dates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSmartDates(naturalQuery || selectedFestival, selectedFestival, tripLength, selectedAirline, priority);
    }
  }, [isOpen, selectedFestival, tripLength, selectedAirline, priority, origin, destination]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (naturalQuery.trim()) {
      fetchSmartDates(naturalQuery, undefined, tripLength, selectedAirline, priority);
    }
  };

  const getAirlineColor = (code: string) => {
    switch (code) {
      case 'IX':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case '6E':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'QP':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'SG':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Smart Round-Trip Itinerary Finder</h2>
              <p className="text-sm text-slate-500">
                Find optimal dates & cheaper multi-airline pairings for {origin} ⇄ {destination}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Natural Language / Vague Condition Search Box */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
            <form onSubmit={handleSearchSubmit} className="space-y-2.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-blue-600" />
                Describe Your Trip In Plain English (Vague Or Specific):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={naturalQuery}
                  onChange={(e) => setNaturalQuery(e.target.value)}
                  placeholder="e.g. 4-5 days trip mid October with minimal leaves across all airlines under 15k"
                  className="flex-1 bg-white border border-slate-300 text-slate-900 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs font-medium"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-98 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1.5 shrink-0"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Find Flights</span>}
                </button>
              </div>

              {/* Vague condition examples pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                <span className="text-slate-400 font-medium">Quick vague prompts:</span>
                {quickVagueExamples.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setNaturalQuery(ex);
                      fetchSmartDates(ex, undefined, tripLength, selectedAirline, priority);
                    }}
                    className="text-slate-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-2.5 py-1 rounded-lg transition text-left"
                  >
                    "{ex}"
                  </button>
                ))}
              </div>
            </form>
          </div>

          {/* Festival Presets */}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
              Or Select Target Festival / Season:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {festivalPresets.map((preset) => {
                const isSelected = selectedFestival.toLowerCase() === preset.name.toLowerCase() && !naturalQuery;
                return (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setSelectedFestival(preset.name);
                      setNaturalQuery('');
                      fetchSmartDates(preset.name, preset.name, tripLength, selectedAirline, priority);
                    }}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">{preset.label}</div>
                    <div className="text-[11px] text-amber-700 font-medium mt-0.5">{preset.date}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Filters: Duration, Airline Tracking & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Trip Duration Filter */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Trip Duration:
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'short', label: '3-4 Days' },
                  { id: 'standard', label: '5-7 Days' },
                  { id: 'extended', label: '8-10 Days' },
                ].map((len) => (
                  <button
                    key={len.id}
                    onClick={() => setTripLength(len.id as any)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                      tripLength === len.id
                        ? 'bg-white shadow-xs text-slate-900 border border-slate-200 font-bold'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {len.label}
                  </button>
                ))}
              </div>
            </div>

            {/* All-Airlines Tracking Filter */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Airline Scope:
              </label>
              <select
                value={selectedAirline}
                onChange={(e) => setSelectedAirline(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">⚡ All Airlines (Cheapest Mix)</option>
                <option value="IX">Air India Express (IX)</option>
                <option value="6E">IndiGo (6E)</option>
                <option value="QP">Akasa Air (QP)</option>
                <option value="SG">SpiceJet (SG)</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Optimization Goal:
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-white border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
              >
                <option value="cheapest">💰 Lowest Total Cost</option>
                <option value="minimal_leaves">💼 Minimal Work Leaves (PTO)</option>
                <option value="avoid_peak">🛡️ Avoid Surge / Peak Congestion</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
              <p className="text-sm font-medium text-slate-600">
                Evaluating candidate round-trip date combinations & multi-airline fares...
              </p>
            </div>
          ) : smartResult ? (
            <div className="space-y-4">
              {/* Executive Summary Rationale */}
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-sm text-amber-900 leading-relaxed">
                <span className="font-bold flex items-center space-x-1 text-amber-800 mb-1">
                  <Sparkles className="h-4 w-4 mr-1 text-amber-600 inline" />
                  AI Round-Trip Itinerary Recommendation:
                </span>
                {smartResult.summaryAnalysis}
              </div>

              {/* Recommended Date Windows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Ranked Round-Trip Date Windows ({origin} ⇄ {destination}):
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Cross-checking Air India Express, IndiGo, Akasa & SpiceJet
                  </span>
                </div>

                {smartResult.recommendations.map((rec) => {
                  const isTopChoice = rec.verdict === 'HIGHLY_RECOMMENDED';
                  return (
                    <div
                      key={rec.id}
                      className={`p-5 rounded-xl border transition-all ${
                        isTopChoice
                          ? 'border-emerald-300 bg-emerald-50/30 shadow-xs ring-1 ring-emerald-200'
                          : rec.verdict === 'EXPENSIVE_PEAK'
                          ? 'border-rose-200 bg-rose-50/30'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Tags and Title */}
                        <div>
                          <div className="flex items-center space-x-2">
                            {rec.tag && (
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  rec.tag === 'Best Value'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : rec.tag === 'Lowest Fare'
                                    ? 'bg-teal-100 text-teal-800'
                                    : rec.tag === 'Minimal Leaves'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {rec.tag}
                              </span>
                            )}
                            <span className="text-xs text-slate-500 font-medium">
                              {rec.tripDurationDays} Days Trip
                            </span>
                            <span className="text-xs text-slate-500 flex items-center font-medium">
                              <Briefcase className="h-3 w-3 mr-1 text-slate-400" />
                              {rec.workDaysOffNeeded} workdays leave
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-slate-900 mt-1">{rec.title}</h4>
                        </div>

                        {/* Price & Savings */}
                        <div className="text-right shrink-0">
                          <div className="text-xl font-black text-slate-900">
                            ₹{rec.totalRoundTripPrice.toLocaleString('en-IN')}
                          </div>
                          <div className="text-xs font-semibold text-emerald-600">
                            {rec.totalSavingsINR > 0 ? (
                              <span>Save ₹{rec.totalSavingsINR.toLocaleString('en-IN')} vs Peak</span>
                            ) : (
                              <span className="text-rose-600">Peak Surge Pricing</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Flight Dates & Specific Airline Pairings */}
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-white rounded-lg border border-slate-200/80">
                        {/* Outbound Leg */}
                        <div className="text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">
                              Outbound ({origin} → {destination}):
                            </span>
                            <span className="font-bold text-slate-800">
                              {formatDateDDMMYYYY(rec.outboundDate)} ({rec.outboundDayOfWeek})
                            </span>
                          </div>
                          {rec.bestOutboundFlight && (
                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded font-bold border text-[10px] ${getAirlineColor(rec.bestOutboundFlight.airlineCode)}`}>
                                  {rec.bestOutboundFlight.airlineCode}
                                </span>
                                <span className="font-semibold text-slate-700">{rec.bestOutboundFlight.airline} {rec.bestOutboundFlight.flightNumber}</span>
                                <span className="text-slate-400 font-mono">({rec.bestOutboundFlight.departureTime} → {rec.bestOutboundFlight.arrivalTime})</span>
                              </div>
                              <span className="font-bold text-slate-900">₹{rec.bestOutboundFlight.price.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                        </div>

                        {/* Return Leg */}
                        <div className="text-xs space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200/60 pt-2 sm:pt-0 sm:pl-3">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 font-medium">
                              Return ({destination} → {origin}):
                            </span>
                            <span className="font-bold text-slate-800">
                              {formatDateDDMMYYYY(rec.returnDate)} ({rec.returnDayOfWeek})
                            </span>
                          </div>
                          {rec.bestReturnFlight && (
                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded font-bold border text-[10px] ${getAirlineColor(rec.bestReturnFlight.airlineCode)}`}>
                                  {rec.bestReturnFlight.airlineCode}
                                </span>
                                <span className="font-semibold text-slate-700">{rec.bestReturnFlight.airline} {rec.bestReturnFlight.flightNumber}</span>
                                <span className="text-slate-400 font-mono">({rec.bestReturnFlight.departureTime} → {rec.bestReturnFlight.arrivalTime})</span>
                              </div>
                              <span className="font-bold text-slate-900">₹{rec.bestReturnFlight.price.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rationale & Action */}
                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <p className="text-xs text-slate-600 leading-relaxed max-w-lg">
                          {rec.rationale}
                        </p>
                        <button
                          onClick={() => {
                            onSelectDatePair(rec.outboundDate, rec.returnDate);
                            onClose();
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shrink-0 ${
                            isTopChoice
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          <span>Analyze This Window</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
