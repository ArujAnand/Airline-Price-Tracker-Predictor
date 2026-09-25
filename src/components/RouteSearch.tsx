import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Calendar as CalendarIcon, MapPin, Search, ChevronLeft, ChevronRight, X, Sparkles, TrendingDown, AlertCircle } from 'lucide-react';
import { formatDateDDMMYYYY, formatDateWithDayDDMMYYYY } from '../utils/dateFormatter';
import { CalendarFaresResponse, DateFareInfo } from '../types/analytics';

interface RouteSearchProps {
  origin: string;
  destination: string;
  departureDate: string;
  airports: Record<string, { city: string; name: string }>;
  onOriginChange: (val: string) => void;
  onDestinationChange: (val: string) => void;
  onDateChange: (val: string) => void;
  onSwap: () => void;
  onSearch: () => void;
  isLoading: boolean;
  onOpenSmartDates?: () => void;
  onOpenFareAnalytics?: () => void;
}

export const RouteSearch: React.FC<RouteSearchProps> = ({
  origin,
  destination,
  departureDate,
  airports,
  onOriginChange,
  onDestinationChange,
  onDateChange,
  onSwap,
  onSearch,
  isLoading,
  onOpenSmartDates,
  onOpenFareAnalytics,
}) => {
  const airportKeys = Object.keys(airports);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [calendarFares, setCalendarFares] = useState<Record<string, DateFareInfo>>({});
  const [loadingFares, setLoadingFares] = useState<boolean>(false);

  // Month navigation for calendar popover (defaults to selected departure date month or current month)
  const [currentViewDate, setCurrentViewDate] = useState<Date>(() => {
    if (departureDate) {
      const d = new Date(departureDate);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthName = currentViewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Fetch minimum prices for route strictly for the month in focus whenever route, month or calendar opens
  useEffect(() => {
    if (!origin || !destination || origin === destination) {
      setCalendarFares({});
      return;
    }

    let isMounted = true;
    setLoadingFares(true);

    fetch(`/api/routes/calendar-fares?origin=${origin}&destination=${destination}&month=${monthStr}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load route calendar fares');
        return res.json();
      })
      .then((data: CalendarFaresResponse) => {
        if (isMounted && data?.fares) {
          setCalendarFares(data.fares);
        }
      })
      .catch((err) => {
        console.warn('Could not load calendar fares:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingFares(false);
      });

    return () => {
      isMounted = false;
    };
  }, [origin, destination, monthStr, showCalendar]);

  // Sync calendar view month when departureDate changes externally
  useEffect(() => {
    if (departureDate) {
      const d = new Date(departureDate);
      if (!isNaN(d.getTime())) {
        setCurrentViewDate(d);
      }
    }
  }, [departureDate]);

  const isValidRoute = Boolean(origin && destination && origin !== destination);
  const isFormValid = Boolean(isValidRoute && departureDate);

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentViewDate(new Date(year, month + 1, 1));
  };

  // Find selected date fare info
  const selectedDateFare = departureDate ? calendarFares[departureDate] : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 mb-6">
      {/* Top Bar with Status and Quick Analytics Link */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Flight Search</span>
          {isValidRoute ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {origin} ➔ {destination}
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              Select origin and destination to start
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {onOpenFareAnalytics && (
            <button
              type="button"
              onClick={onOpenFareAnalytics}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1 rounded-lg transition flex items-center space-x-1"
            >
              <TrendingDown className="h-3.5 w-3.5" />
              <span>TOI-DPA Fare Index Trends</span>
            </button>
          )}

          {onOpenSmartDates && (
            <button
              type="button"
              onClick={onOpenSmartDates}
              className="text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1 rounded-lg transition flex items-center space-x-1"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>Smart Date Finder</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Search Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        {/* Origin */}
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-blue-500" />
            Origin Airport
          </label>
          <select
            id="origin-select"
            value={origin}
            onChange={(e) => onOriginChange(e.target.value)}
            className={`w-full bg-slate-50 border text-sm rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition ${
              !origin ? 'border-slate-300 text-slate-400' : 'border-slate-300 text-slate-900'
            }`}
          >
            <option value="" disabled>
              Select origin airport
            </option>
            {airportKeys.map((code) => (
              <option key={code} value={code} disabled={code === destination}>
                {airports[code]?.city} ({code}) - {airports[code]?.name}
              </option>
            ))}
          </select>
        </div>

        {/* Swap Button */}
        <div className="md:col-span-1 flex justify-center py-1">
          <button
            id="swap-route-btn"
            type="button"
            onClick={onSwap}
            disabled={!origin && !destination}
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-600 hover:text-blue-600 transition shadow-sm disabled:opacity-40"
            title="Swap Origin and Destination"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>

        {/* Destination */}
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-rose-500" />
            Destination Airport
          </label>
          <select
            id="destination-select"
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            className={`w-full bg-slate-50 border text-sm rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition ${
              !destination ? 'border-slate-300 text-slate-400' : 'border-slate-300 text-slate-900'
            }`}
          >
            <option value="" disabled>
              Select destination airport
            </option>
            {airportKeys.map((code) => (
              <option key={code} value={code} disabled={code === origin}>
                {airports[code]?.city} ({code}) - {airports[code]?.name}
              </option>
            ))}
          </select>
        </div>

        {/* Departure Date with Fare Calendar Launcher */}
        <div className="md:col-span-3 relative">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5 text-blue-500" />
              Departure Date
            </label>
            {isValidRoute && (
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
              >
                <span>{showCalendar ? 'Close Calendar' : 'View Fare Calendar'}</span>
              </button>
            )}
          </div>

          <div className="relative">
            <input
              id="departure-date-input"
              type="date"
              value={departureDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition"
            />
          </div>

          {/* Interactive Date Calendar Modal / Popover with Minimum DB Prices */}
          {showCalendar && (
            <div className="absolute top-full left-0 mt-2 z-50 w-80 md:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-1.5">
                    <CalendarIcon className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-bold text-slate-900">{monthName}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    <span>24h Freshness &bull; Saved to Database</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                    title="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                    title="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCalendar(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition ml-1"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase mb-2">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty padding slots before 1st of month */}
                {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="h-14"></div>
                ))}

                {/* Day Cells */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const fareInfo = calendarFares[dateStr];
                  const isSelected = departureDate === dateStr;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => {
                        onDateChange(dateStr);
                        setShowCalendar(false);
                      }}
                      className={`h-14 rounded-xl flex flex-col items-center justify-between p-1.5 transition border text-left ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-400/40'
                          : 'bg-slate-50 hover:bg-blue-50 border-slate-100 hover:border-blue-200 text-slate-800'
                      }`}
                      title={
                        fareInfo
                          ? `${dateStr}: ₹${fareInfo.minPrice.toLocaleString()} (${fareInfo.airline}) • ${
                              fareInfo.isFresh ? 'Fresh (<24h) • Saved to DB' : 'Cached snapshot'
                            }`
                          : loadingFares
                          ? 'Loading fresh fare from Google Flights...'
                          : 'Select date'
                      }
                    >
                      <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                        {dayNum}
                      </span>

                      {/* Google Flights Shimmer Effect while loading fares for month in focus */}
                      {loadingFares ? (
                        <div className="w-9 h-2 rounded-full shimmer-google-flights my-auto shadow-inner"></div>
                      ) : fareInfo ? (
                        <div className="flex flex-col items-center w-full">
                          <span
                            className={`text-[9.5px] font-black px-1 rounded leading-tight transition-all ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : fareInfo.minPrice <= 4500
                                ? 'text-emerald-700 bg-emerald-100/90 font-bold'
                                : fareInfo.minPrice <= 6500
                                ? 'text-slate-800 bg-slate-200/70 font-semibold'
                                : 'text-amber-800 bg-amber-100/80 font-semibold'
                            }`}
                          >
                            ₹{fareInfo.minPrice >= 1000 ? `${Math.round(fareInfo.minPrice / 100) / 10}k` : fareInfo.minPrice}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[8px] text-slate-400">--</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend & Freshness Guarantee */}
              <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Sweet Spot (≤₹4.5k)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span> Standard
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> Peak/Surge
                  </span>
                </div>
                <div className="text-[9px] text-slate-400 text-center pt-1 border-t border-slate-50">
                  Google Flights month scan &bull; Updates and persists prices older than 24 hours to database
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Forecast Button */}
        <div className="md:col-span-2">
          <button
            id="analyze-fares-btn"
            type="button"
            onClick={onSearch}
            disabled={!isFormValid || isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-sm font-semibold rounded-xl px-4 py-2.5 flex items-center justify-center space-x-2 shadow-md shadow-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Forecast</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selected Date Minimum Fare Banner */}
      {selectedDateFare && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700">
              Lowest Fare for {formatDateDDMMYYYY(departureDate)}:
            </span>
            <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              ₹{selectedDateFare.minPrice.toLocaleString()} ({selectedDateFare.airline})
            </span>
            <span className="text-slate-400 text-[11px]">
              ({selectedDateFare.dataPoints} fare data points collected in DB)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowCalendar(true)}
            className="text-blue-600 hover:text-blue-800 font-medium text-[11px] underline"
          >
            Compare with other dates
          </button>
        </div>
      )}

      {/* Route Incomplete Helper Banner */}
      {!isValidRoute && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center space-x-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
          <span>Select an Origin and Destination airport to unlock the fare calendar and run the prediction model.</span>
        </div>
      )}
    </div>
  );
};

