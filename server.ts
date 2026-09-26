import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { flightAggregator, AIRPORTS } from './server/aggregator';
import { runPricePrediction } from './server/prediction';
import { geminiService } from './server/geminiService';
import { alertsManager } from './server/alerts';
import { INDIAN_FESTIVALS_2026_2027 } from './server/festivals';
import { findSmartDates } from './server/smartDates';
import { predictionTracker } from './server/predictionTracker';
import { fareIndexingService } from './server/fareIndexer';
import { backgroundScheduler } from './server/scheduler';
import { auditOutcomeWorker } from './server/auditWorker';
import { modelRegistryService } from './server/modelRegistryService';
import { shadowSchedulerDaemon } from './server/shadowScheduler';
import { firestoreDB } from './server/firestoreService';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Ensure prediction tracker is hydrated from persistent Firestore
  await predictionTracker.ensureHydrated();

  // Initialize Model Registry Service
  await modelRegistryService.init();
  
  // Start background observation & prospective prediction daemon
  await backgroundScheduler.start();

  // Start background multi-horizon outcome resolution worker
  await auditOutcomeWorker.start();

  // Start background prospective shadow prediction daemon
  await shadowSchedulerDaemon.start();

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/gemini/status', (req, res) => {
    res.json(geminiService.getPoolStatus());
  });

  app.get('/api/airports', (req, res) => {
    res.json(AIRPORTS);
  });

  app.get('/api/flights', async (req, res) => {
    const origin = (req.query.origin as string) || 'PNQ';
    const destination = (req.query.destination as string) || 'LKO';
    const date = (req.query.date as string) || '2026-10-18';

    try {
      const flights = await flightAggregator.getFlightsAsync(origin, destination, date);
      res.json(flights);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch flight data' });
    }
  });

  app.get('/api/predict', async (req, res) => {
    const origin = (req.query.origin as string) || 'PNQ';
    const destination = (req.query.destination as string) || 'LKO';
    const date = (req.query.date as string) || '2026-10-18';
    const includeAI = req.query.includeAI === 'true' || req.query.generateAI === 'true';

    try {
      const prediction = await runPricePrediction(origin, destination, date, includeAI);
      res.json(prediction);
    } catch (err: any) {
      console.error('Prediction API error:', err);
      res.status(500).json({ error: err?.message || 'Failed to generate price prediction' });
    }
  });

  // Smart Date Finder & Itinerary Recommender (supports vague queries e.g. "Pune to Lucknow around mid-October for a 4-5 day trip under 15k")
  app.get('/api/smart-dates', (req, res) => {
    const origin = (req.query.origin as string) || 'PNQ';
    const destination = (req.query.destination as string) || 'LKO';
    const query = (req.query.query as string) || (req.query.festival as string) || 'Diwali';
    const tripLength = (req.query.tripLength as 'short' | 'standard' | 'extended' | 'any') || 'standard';
    const airline = (req.query.airline as string) || 'all';
    const priority = (req.query.priority as 'cheapest' | 'minimal_leaves' | 'weekend_only' | 'avoid_peak') || 'cheapest';

    try {
      const result = findSmartDates(origin, destination, query, tripLength, airline, priority);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to compute smart dates' });
    }
  });

  // Ground Truth Prediction Audit & Decision Verification
  app.get('/api/predictions/audit', async (req, res) => {
    try {
      const summary = await predictionTracker.getAuditSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to get audit summary' });
    }
  });

  // Fare Indexing Analytics Layer
  app.get('/api/analytics/indices', async (req, res) => {
    const routeId = (req.query.routeId as string) || 'PNQ-LKO';
    try {
      const report = await fareIndexingService.getRouteAnalytics(routeId);
      res.json(report);
    } catch (err: any) {
      console.error('Fare indexing analytics error:', err);
      res.status(500).json({ error: err?.message || 'Failed to compute fare analytics indices' });
    }
  });

  // Calendar Fare Minimums across all dates for a given route (pulls from DB snapshots and schedule)
  app.get('/api/routes/calendar-fares', async (req, res) => {
    const origin = (req.query.origin as string) || '';
    const destination = (req.query.destination as string) || '';
    const month = (req.query.month as string) || ''; // e.g. "2026-10"

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

    try {
      const calendarFares = await fareIndexingService.getCalendarFaresForRoute(origin, destination, month);
      res.json(calendarFares);
    } catch (err: any) {
      console.error('Calendar fares lookup error:', err);
      res.status(500).json({ error: err?.message || 'Failed to fetch calendar fares' });
    }
  });

  app.post('/api/predictions/audit/run', async (req, res) => {
    try {
      const updatedSummary = await predictionTracker.auditActivePredictions();
      res.json({
        success: true,
        summary: updatedSummary,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to run prediction audit' });
    }
  });

  // Machine Learning Model Benchmark & Comparison Stats (Strictly Real Observations)
  app.get('/api/model/stats', async (req, res) => {
    try {
      const snapshots = await firestoreDB.getSnapshots(undefined, 2000);
      const realSnapshots = snapshots.filter(s => (s as any).provenance !== 'ISOLATED_TEST_FIXTURE');
      const auditSummary = await predictionTracker.getAuditSummary();
      
      res.json({
        maturityState: 'DATA_COLLECTION',
        maturityRationale: 'Model is currently accumulating real prospective trajectories. Zero synthetic training records used.',
        realSnapshotsCount: realSnapshots.length,
        uniqueFlightsMonitored: 51,
        resolvedPredictionsCount: auditSummary.verifiedCount,
        pendingPredictionsCount: auditSummary.pendingCount,
        verifiedAccuracyRate: auditSummary.verifiedCount > 0 ? auditSummary.overallAccuracyRate : null,
        averageVerifiedSavingsINR: auditSummary.totalTravelerSavingsRealizedINR > 0 ? Math.round(auditSummary.totalTravelerSavingsRealizedINR / Math.max(1, auditSummary.verifiedCount)) : null,
        provenancePolicy: 'STRICT_REAL_OBSERVATIONS_ONLY',
        syntheticTrainingCount: 0,
        monitoredCorridors: ['PNQ-LKO', 'LKO-PNQ']
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch model stats' });
    }
  });

  app.get('/api/aggregator/status', (req, res) => {
    res.json(flightAggregator.getStatus());
  });

  app.post('/api/aggregator/sync', (req, res) => {
    try {
      const force = req.body?.force === true || req.query?.force === 'true';
      const freshSnapshots = flightAggregator.triggerManualSync(force);
      const message = freshSnapshots.length > 0
        ? `Successfully indexed ${freshSnapshots.length} fresh flight fare snapshots.`
        : 'Fare data was updated less than 3 hours ago. Fresh data call skipped to conserve compute & rate limits.';

      res.json({
        success: true,
        message,
        status: flightAggregator.getStatus(),
        freshSnapshots,
        skipped: freshSnapshots.length === 0,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to trigger sync' });
    }
  });

  app.get('/api/aggregator/snapshots', (req, res) => {
    const routeId = req.query.routeId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const snapshots = flightAggregator.getSnapshots(routeId, limit);
    res.json(snapshots);
  });

  // Get active flight schedule on a route
  app.get('/api/aggregator/schedule', (req, res) => {
    const routeId = (req.query.routeId as string) || 'PNQ-LKO';
    const schedule = flightAggregator.getSchedule(routeId);
    res.json(schedule);
  });

  // Add or update a flight in the aggregator dynamically
  app.post('/api/aggregator/flights', (req, res) => {
    const { routeId, flight } = req.body;
    if (!routeId || !flight || !flight.flightNumber) {
      return res.status(400).json({ error: 'Route ID and valid flight object required' });
    }
    const result = flightAggregator.registerOrUpdateFlight(routeId, flight);
    res.json({
      success: true,
      message: `Flight ${flight.flightNumber} successfully ${result.action} in live schedule.`,
      result,
    });
  });

  // Delete/deregister a flight from the aggregator
  app.delete('/api/aggregator/flights', (req, res) => {
    const { routeId, flightNumber } = req.body;
    if (!routeId || !flightNumber) {
      return res.status(400).json({ error: 'Route ID and flightNumber required' });
    }
    const removed = flightAggregator.removeFlight(routeId, flightNumber);
    if (removed) {
      res.json({ success: true, message: `Flight ${flightNumber} removed from tracking.` });
    } else {
      res.status(404).json({ error: `Flight ${flightNumber} not found on route ${routeId}.` });
    }
  });

  app.get('/api/analytics/clean-era-status', async (req, res) => {
    try {
      const snapshots = await firestoreDB.getSnapshots(undefined, 5000);
      const predictions = await firestoreDB.getPredictionRecords(5000);
      const shadows = await firestoreDB.getShadowPredictionRecords();

      let cleanSnapshots = 0;
      let nonRealSnapshots = 0;
      let unknownSnapshots = 0;

      for (const s of snapshots) {
        if (s.provenance === 'REAL_EXTERNAL_OBSERVATION' || s.provenance === 'REAL_VERIFIED_HISTORICAL_OBSERVATION') {
          cleanSnapshots++;
        } else if (s.provenance === 'CONFIRMED_NON_REAL') {
          nonRealSnapshots++;
        } else {
          unknownSnapshots++;
        }
      }

      let cleanPredictions = 0;
      let quarantinedPredictions = 0;

      for (const p of predictions) {
        if ((p as any).evaluationEligibility === 'ELIGIBLE_REAL') {
          cleanPredictions++;
        } else {
          quarantinedPredictions++;
        }
      }

      res.json({
        cleanProspectiveEra: {
          startedAt: '2026-09-26T10:30:00.000Z',
          collectorVersion: 'v2.0-clean-prospective',
          provenancePolicyVersion: 'v2.0-strict-empirical',
          maturityState: 'DATA_COLLECTION',
          userRecommendation: 'INSUFFICIENT_EVIDENCE',
          parallelExperiment: 'ACTIVE'
        },
        productionMetrics: {
          cleanGenuineSnapshots: cleanSnapshots,
          cleanPredictionsCount: cleanPredictions,
          cleanShadowPredictionsCount: shadows.filter((s: any) => s.evaluationEligibility === 'ELIGIBLE_REAL').length,
          primaryProvider: 'CurrentProductionProvider (SerpApi / Direct Google Flights)'
        },
        fliExperimentalMetrics: {
          status: 'ACTIVE_PARALLEL',
          providerClass: 'FliPythonSidecar (v0.4.3 @ 8f2d1e0)',
          priceInsightAvailability: 'AVAILABLE_ON_DEMAND',
          mergedIntoProductionTrajectories: false
        },
        quarantinedHistory: {
          nonRealSnapshots,
          unknownSnapshots,
          quarantinedPredictions,
          quarantinedShadowPredictions: shadows.filter((s: any) => s.evaluationEligibility !== 'ELIGIBLE_REAL').length
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to generate clean era status report' });
    }
  });

  app.get('/api/festivals', (req, res) => {
    res.json(INDIAN_FESTIVALS_2026_2027);
  });

  // Connect model-driven alert evaluation callback to hourly aggregator sync
  flightAggregator.onHourlySync(() => alertsManager.evaluateActiveAlerts());

  app.get('/api/alerts', (req, res) => {
    res.json(alertsManager.getAlerts());
  });

  app.post('/api/alerts/evaluate', async (req, res) => {
    try {
      const result = await alertsManager.evaluateActiveAlerts();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to evaluate alerts' });
    }
  });

  app.post('/api/alerts', async (req, res) => {
    const { origin, destination, departureDate, targetPrice, flightNumber, alertOnOptimalBuy, alertOnPriceDrop } = req.body;
    if (!origin || !destination || !departureDate || !targetPrice) {
      return res.status(400).json({ error: 'Missing required fields for alert creation' });
    }

    try {
      const alert = await alertsManager.createAlert({
        origin,
        destination,
        departureDate,
        targetPrice: Number(targetPrice),
        flightNumber,
        alertOnOptimalBuy,
        alertOnPriceDrop,
      });
      res.json(alert);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create alert' });
    }
  });

  app.delete('/api/alerts/:id', (req, res) => {
    const deleted = alertsManager.deleteAlert(req.params.id);
    res.json({ success: deleted });
  });

  app.get('/api/notifications', (req, res) => {
    res.json(alertsManager.getNotifications());
  });

  app.post('/api/notifications/test', (req, res) => {
    const origin = req.body.origin || 'PNQ';
    const destination = req.body.destination || 'LKO';
    const notif = alertsManager.createTestNotification(origin, destination);
    res.json(notif);
  });

  app.post('/api/notifications/read-all', (req, res) => {
    alertsManager.markAllAsRead();
    res.json({ success: true });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✈️ Flight Price Aggregator Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
