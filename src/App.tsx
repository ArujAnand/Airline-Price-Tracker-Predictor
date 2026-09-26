import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RouteSearch } from './components/RouteSearch';
import { PredictionHero } from './components/PredictionHero';
import { PriceChart } from './components/PriceChart';
import { FlightList } from './components/FlightList';
import { AggregatorDrawer } from './components/AggregatorDrawer';
import { AlertsModal } from './components/AlertsModal';
import { FestivalCalendarModal } from './components/FestivalCalendarModal';
import { NotificationsModal } from './components/NotificationsModal';
import { ModelCompareModal } from './components/ModelCompareModal';
import { SmartDateFinderModal } from './components/SmartDateFinderModal';
import { PredictionAuditModal } from './components/PredictionAuditModal';
import { FareAnalyticsModal } from './components/FareAnalyticsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  Flight, 
  PriceSnapshot, 
  PredictionAnalysis, 
  AggregatorStatus, 
  TrackedTripAlert, 
  AppNotification, 
  FestivalEvent 
} from './types';
import { sendBrowserPushNotification } from './utils/notifications';
import { Plane, AlertTriangle, RefreshCw, Sparkles, Database } from 'lucide-react';

// Module-scoped cache for main route searches across session
const mainRouteDataCache = new Map<string, { flights: Flight[]; prediction: PredictionAnalysis | null; snapshots: PriceSnapshot[] }>();

export default function App() {
  // Route selection state - start empty with no pre-selected values as requested
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [departureDate, setDepartureDate] = useState<string>('');
  const [hasForecastRun, setHasForecastRun] = useState<boolean>(false);

  // Data states
  const [airports, setAirports] = useState<Record<string, { city: string; name: string }>>({
    PNQ: { city: 'Pune', name: 'Pune Lohegaon Airport' },
    LKO: { city: 'Lucknow', name: 'Chaudhary Charan Singh International Airport' },
  });

  const [flights, setFlights] = useState<Flight[]>([]);
  const [prediction, setPrediction] = useState<PredictionAnalysis | null>(null);
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [aggregatorStatus, setAggregatorStatus] = useState<AggregatorStatus | null>(null);
  const [alerts, setAlerts] = useState<TrackedTripAlert[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [festivals, setFestivals] = useState<FestivalEvent[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modal drawers
  const [isAggregatorOpen, setIsAggregatorOpen] = useState<boolean>(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [isFestivalsOpen, setIsFestivalsOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isSmartDatesOpen, setIsSmartDatesOpen] = useState<boolean>(false);
  const [isModelCompareOpen, setIsModelCompareOpen] = useState<boolean>(false);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [isFareAnalyticsOpen, setIsFareAnalyticsOpen] = useState<boolean>(false);

  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);

  const handleGenerateAIAdvisory = async () => {
    if (!origin || !destination || !departureDate) return;
    setIsGeneratingAI(true);
    try {
      const res = await fetch(`/api/predict?origin=${origin}&destination=${destination}&date=${departureDate}&includeAI=true`);
      if (res.ok) {
        const updatedPred: PredictionAnalysis = await res.json();
        setPrediction(updatedPred);
      }
    } catch (err) {
      console.error('Failed to generate AI analysis:', err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Fetch static lookups on initial load
  const fetchMetadata = async () => {
    try {
      const [airportsRes, festivalsRes, alertsRes, notifsRes, statusRes] = await Promise.all([
        fetch('/api/airports'),
        fetch('/api/festivals'),
        fetch('/api/alerts'),
        fetch('/api/notifications'),
        fetch('/api/aggregator/status'),
      ]);

      if (airportsRes.ok) setAirports(await airportsRes.json());
      if (festivalsRes.ok) setFestivals(await festivalsRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (notifsRes.ok) setNotifications(await notifsRes.json());
      if (statusRes.ok) setAggregatorStatus(await statusRes.json());
    } catch (err) {
      console.warn('Metadata fetch warning:', err);
    }
  };

  // Load route flights, predictions, and snapshots
  const loadRouteData = useCallback(async (orig = origin, dest = destination, date = departureDate, isBackground = false, forceRefresh = false) => {
    if (!orig || !dest || !date || orig === dest) return;

    const cacheKey = `${orig.toUpperCase()}-${dest.toUpperCase()}-${date}`;
    if (!forceRefresh && mainRouteDataCache.has(cacheKey)) {
      const cached = mainRouteDataCache.get(cacheKey)!;
      setFlights(cached.flights);
      if (cached.prediction) setPrediction(cached.prediction);
      setSnapshots(cached.snapshots);
      setIsLoading(false);
      return;
    }

    if (!isBackground) {
      setIsLoading(true);
    }
    setError(null);
    const routeId = `${orig}-${dest}`;

    try {
      const [flightsRes, predictRes, snapsRes] = await Promise.all([
        fetch(`/api/flights?origin=${orig}&destination=${dest}&date=${date}`),
        fetch(`/api/predict?origin=${orig}&destination=${dest}&date=${date}`),
        fetch(`/api/aggregator/snapshots?routeId=${routeId}&limit=100`),
      ]);

      if (!flightsRes.ok) throw new Error('Failed to retrieve flight schedules');

      const flightData: Flight[] = await flightsRes.json();
      setFlights(flightData);

      let predData: PredictionAnalysis | null = null;
      if (predictRes.ok) {
        predData = await predictRes.json();
        setPrediction(predData);
      }

      let snapData: PriceSnapshot[] = [];
      if (snapsRes.ok) {
        snapData = await snapsRes.json();
        setSnapshots(snapData);
      }

      // Update in-memory session cache
      mainRouteDataCache.set(cacheKey, { flights: flightData, prediction: predData, snapshots: snapData });
    } catch (err: any) {
      console.error('Error loading route data:', err);
      if (!isBackground) {
        setError(err?.message || 'Unable to connect to flight aggregator service.');
      }
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  }, [origin, destination, departureDate]);

  // Load lookup metadata once on mount (NO auto-forecast)
  useEffect(() => {
    fetchMetadata();
  }, []);

  // Trigger Forecast execution strictly on user click
  const handleForecastClick = () => {
    if (!origin || !destination || !departureDate) {
      setError('Please select an origin, destination, and departure date first.');
      return;
    }
    if (origin === destination) {
      setError('Origin and destination cannot be the same airport.');
      return;
    }
    setHasForecastRun(true);
    loadRouteData(origin, destination, departureDate, false);
  };

  // Background polling every 15 minutes ONLY if user has executed a forecast
  useEffect(() => {
    if (!hasForecastRun || !origin || !destination || !departureDate) return;

    const autoSyncInterval = setInterval(() => {
      loadRouteData(origin, destination, departureDate, true);
      fetch('/api/notifications')
        .then((res) => res.ok && res.json())
        .then((data) => data && setNotifications(data))
        .catch(() => {});
      fetch('/api/aggregator/status')
        .then((res) => res.ok && res.json())
        .then((data) => data && setAggregatorStatus(data))
        .catch(() => {});
    }, 15 * 60 * 1000);

    const handleWindowFocus = () => {
      loadRouteData(origin, destination, departureDate, true);
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(autoSyncInterval);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [hasForecastRun, origin, destination, departureDate, loadRouteData]);

  // Swap origin and destination
  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  // Manual trigger for aggregator collection
  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/aggregator/sync', { method: 'POST' });
      const data = await res.json();
      if (data.status) {
        setAggregatorStatus(data.status);
      }
      // Reload current route
      await loadRouteData();
      // Reload notifications
      const notifsRes = await fetch('/api/notifications');
      if (notifsRes.ok) setNotifications(await notifsRes.json());
    } catch (err) {
      console.error('Manual sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Set alert
  const handleSaveAlert = async (alertData: {
    origin: string;
    destination: string;
    departureDate: string;
    targetPrice: number;
    alertOnOptimalBuy: boolean;
    alertOnPriceDrop: boolean;
  }) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData),
      });
      if (res.ok) {
        const newAlert = await res.json();
        setAlerts((prev) => [newAlert, ...prev]);

        sendBrowserPushNotification(`🎯 Price Tracking Set: ${alertData.origin} → ${alertData.destination}`, {
          body: `Target set at ₹${alertData.targetPrice.toLocaleString('en-IN')}. We'll notify you as soon as optimal booking time arrives.`,
        });

        const notifsRes = await fetch('/api/notifications');
        if (notifsRes.ok) setNotifications(await notifsRes.json());
      }
    } catch (err) {
      console.error('Create alert error:', err);
    }
  };

  // Delete alert
  const handleDeleteAlert = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Delete alert error:', err);
    }
  };

  // Track specific flight from the list
  const handleTrackFlight = (flight: Flight) => {
    handleSaveAlert({
      origin: flight.origin,
      destination: flight.destination,
      departureDate,
      targetPrice: Math.round(flight.currentPrice * 0.92),
      alertOnOptimalBuy: true,
      alertOnPriceDrop: true,
    });
  };

  // Trigger test alert
  const handleTriggerTestAlert = async () => {
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination }),
      });
      if (res.ok) {
        const notif: AppNotification = await res.json();
        setNotifications((prev) => [notif, ...prev]);

        // Trigger real browser push notification
        sendBrowserPushNotification(notif.title, {
          body: notif.body,
          isOptimalBuy: true,
        });
      }
    } catch (err) {
      console.error('Trigger test alert error:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllNotificationsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  // Separate daily vs hourly snapshots for chart
  const historicalDaily = snapshots.filter((s) => s.type === 'daily');
  const historicalHourly = snapshots.filter((s) => s.type === 'hourly');
  const currentLowestPrice = flights.length > 0 ? Math.min(...flights.map((f) => f.currentPrice)) : 4750;

  const currentRouteKey = `${origin}-${destination}`;
  const isCurrentRouteAlertActive = alerts.some(
    (a) => a.routeId.toUpperCase() === currentRouteKey.toUpperCase() && a.departureDate === departureDate
  );

  const trackedFlightIds = alerts
    .filter((a) => a.routeId.toUpperCase() === currentRouteKey.toUpperCase())
    .map((a) => `${a.routeId}-${a.flightNumber}-${a.departureDate}`);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Header
        aggregatorStatus={aggregatorStatus}
        isSyncing={isSyncing}
        onSyncNow={handleSyncNow}
        notifications={notifications}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenAggregator={() => setIsAggregatorOpen(true)}
        onOpenFestivals={() => setIsFestivalsOpen(true)}
        onOpenFareAnalytics={() => setIsFareAnalyticsOpen(true)}
        onTriggerTestAlert={handleTriggerTestAlert}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error notification if any */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadRouteData()}
              className="font-bold underline hover:text-rose-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Route Selector & Minimum Fare Calendar */}
        <RouteSearch
          origin={origin}
          destination={destination}
          departureDate={departureDate}
          airports={airports}
          onOriginChange={setOrigin}
          onDestinationChange={setDestination}
          onDateChange={setDepartureDate}
          onSwap={handleSwap}
          onSearch={handleForecastClick}
          isLoading={isLoading}
          onOpenSmartDates={() => setIsSmartDatesOpen(true)}
          onOpenFareAnalytics={() => setIsFareAnalyticsOpen(true)}
        />

        {/* When forecast has not been run yet, show clean welcome & guide state */}
        {!hasForecastRun ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-sm text-center max-w-4xl mx-auto my-8">
            <div className="inline-flex p-3 rounded-2xl bg-blue-50 text-blue-600 mb-4 border border-blue-100">
              <Plane className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              A Flight Price Tracker That Helps You Plan Trips Better
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl mx-auto mt-2 leading-relaxed">
              Select your origin, destination, and departure date above, then click <strong>Forecast</strong> to analyze live fares, 
              yield curves, advance booking sweet spots, and quantile confidence bands.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 text-left">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-1">Step 1</div>
                <div className="font-semibold text-slate-800 text-sm">Choose Your Route</div>
                <div className="text-xs text-slate-500 mt-1">
                  Connect major Indian metro hubs (Pune, Lucknow, Delhi, Mumbai, Bengaluru, etc.).
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Step 2</div>
                <div className="font-semibold text-slate-800 text-sm">Check Fare Calendar</div>
                <div className="text-xs text-slate-500 mt-1">
                  Open the calendar to see the lowest fares recorded in the DB across all dates.
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-purple-600 font-bold text-xs uppercase tracking-wider mb-1">Step 3</div>
                <div className="font-semibold text-slate-800 text-sm">Click Forecast</div>
                <div className="text-xs text-slate-500 mt-1">
                  Evaluate P10/P50/P90 confidence bounds, buy signals, and optimal booking windows.
                </div>
              </div>
            </div>

            {/* Quick feature links */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsFareAnalyticsOpen(true)}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
              >
                📊 Open TOI-DPA Fare Analytics Index
              </button>
              <button
                type="button"
                onClick={() => setIsSmartDatesOpen(true)}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition"
              >
                ✨ AI Smart Date & Festival Finder
              </button>
              <button
                type="button"
                onClick={() => setIsAuditOpen(true)}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                🎯 Ground-Truth Accuracy Audit
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Prediction Verdict Hero Card */}
            {prediction && (
              <PredictionHero
                prediction={prediction}
                onSetAlert={() => setIsAlertsOpen(true)}
                isAlertActive={isCurrentRouteAlertActive}
                onOpenSmartDates={() => setIsSmartDatesOpen(true)}
                onOpenModelCompare={() => setIsModelCompareOpen(true)}
                onOpenAudit={() => setIsAuditOpen(true)}
                onGenerateAI={handleGenerateAIAdvisory}
                isGeneratingAI={isGeneratingAI}
              />
            )}

            {/* Interactive Price Trend & Forecast Chart */}
            <PriceChart
              historicalDaily={historicalDaily}
              historicalHourly={historicalHourly}
              forecastPoints={prediction?.forecastPoints || []}
              currentPrice={currentLowestPrice}
              yoyTrends={prediction?.yoyTrends}
              hasError={!!error}
            />

            {/* Live Flights List */}
            <FlightList
              flights={flights}
              onTrackFlight={handleTrackFlight}
              trackedFlightIds={trackedFlightIds}
              departureDate={departureDate}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Plane className="h-4 w-4 text-blue-600" />
            <span className="font-semibold text-slate-800">SkyCast Flight Price Predictor</span>
            <span>• Built for Pune ⇄ Lucknow &amp; Indian Domestic Aviation Corridors</span>
          </div>
          <div>
            Aggregating Google Flights fares daily &amp; hourly • Quantile Regression Forest &amp; Yield Models + Gemini 3.8 Flash
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <AggregatorDrawer
        isOpen={isAggregatorOpen}
        onClose={() => setIsAggregatorOpen(false)}
        status={aggregatorStatus}
        snapshots={snapshots}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
      />

      <AlertsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alerts={alerts}
        currentRoute={{ origin, destination, departureDate }}
        currentPrice={currentLowestPrice}
        onSaveAlert={handleSaveAlert}
        onDeleteAlert={handleDeleteAlert}
        onTriggerTestAlert={handleTriggerTestAlert}
      />

      <FestivalCalendarModal
        isOpen={isFestivalsOpen}
        onClose={() => setIsFestivalsOpen(false)}
        festivals={festivals}
        selectedDate={departureDate}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
        onTriggerTestAlert={handleTriggerTestAlert}
      />

      {/* New Feature Modals */}
      <SmartDateFinderModal
        isOpen={isSmartDatesOpen}
        onClose={() => setIsSmartDatesOpen(false)}
        origin={origin}
        destination={destination}
        onSelectDatePair={(outboundDate) => {
          setDepartureDate(outboundDate);
          loadRouteData(origin, destination, outboundDate);
        }}
      />

      <ModelCompareModal
        isOpen={isModelCompareOpen}
        onClose={() => setIsModelCompareOpen(false)}
        mlComparison={prediction?.mlComparison}
      />

      <ErrorBoundary fallbackTitle="Decision Audit Modal Error">
        <PredictionAuditModal
          isOpen={isAuditOpen}
          onClose={() => setIsAuditOpen(false)}
        />
      </ErrorBoundary>

      <FareAnalyticsModal
        isOpen={isFareAnalyticsOpen}
        onClose={() => setIsFareAnalyticsOpen(false)}
        routeId={`${origin}-${destination}`}
      />
    </div>
  );
}
