import { TrackedTripAlert, AppNotification } from '../src/types';
import { flightAggregator, AIRPORTS } from './aggregator';
import { firestoreDB } from './firestoreService';
import { runPricePrediction } from './prediction';

class AlertsManager {
  private alerts: TrackedTripAlert[] = [];
  private notifications: AppNotification[] = [];

  constructor() {
    this.seedInitialAlert();
    this.hydrateFromFirestore();
  }

  private async hydrateFromFirestore() {
    try {
      const [persistedAlerts, persistedNotifs] = await Promise.all([
        firestoreDB.getAlerts(),
        firestoreDB.getNotifications(),
      ]);

      if (persistedAlerts.length > 0) {
        const existingIds = new Set(this.alerts.map((a) => a.id));
        for (const a of persistedAlerts) {
          if (!existingIds.has(a.id)) {
            this.alerts.push(a);
            existingIds.add(a.id);
          }
        }
      }

      if (persistedNotifs.length > 0) {
        const existingIds = new Set(this.notifications.map((n) => n.id));
        for (const n of persistedNotifs) {
          if (!existingIds.has(n.id)) {
            this.notifications.push(n);
            existingIds.add(n.id);
          }
        }
      }
    } catch (err) {
      console.warn('[Firestore DB] Hydration warning for alerts/notifications:', err);
    }
  }

  private seedInitialAlert() {
    // Seed test alert for Pune to Lucknow as requested by user
    const defaultDepartureDate = '2026-10-18';
    this.alerts.push({
      id: 'alert-pnq-lko-sample',
      routeId: 'PNQ-LKO',
      origin: 'PNQ',
      originCity: AIRPORTS.PNQ.city,
      destination: 'LKO',
      destinationCity: AIRPORTS.LKO.city,
      departureDate: defaultDepartureDate,
      flightNumber: '6E-656',
      targetPrice: 4600,
      currentLowestPrice: 4750,
      alertOnOptimalBuy: true,
      alertOnPriceDrop: true,
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      lastCheckedAt: new Date().toISOString(),
      history: [
        {
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          price: 4890,
          status: 'MONITORING',
        },
        {
          timestamp: new Date().toISOString(),
          price: 4750,
          status: 'PRICE_DROPPED_140',
        },
      ],
    });

    this.notifications.push({
      id: 'notif-welcome',
      title: '✈️ Aggregator Active: PNQ ⇄ LKO Monitored',
      body: 'Google Flights hourly aggregator is actively indexing Pune to Lucknow & Lucknow to Pune fares. Historical price baseline established.',
      type: 'SYSTEM_INFO',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      read: false,
      routeId: 'PNQ-LKO',
    });

    this.notifications.push({
      id: 'notif-initial-drop',
      title: '🎯 Optimal Price Movement Detected',
      body: 'IndiGo 6E-656 (Pune → Lucknow) dipped by ₹140 today. Booking advisory: Approaching optimal advance window.',
      type: 'PRICE_DROP',
      timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      read: false,
      routeId: 'PNQ-LKO',
      priceDelta: -140,
    });
  }

  public getAlerts(): TrackedTripAlert[] {
    return this.alerts;
  }

  public getNotifications(): AppNotification[] {
    return this.notifications.slice(-30).reverse();
  }

  public markNotificationAsRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) notif.read = true;
  }

  public markAllAsRead() {
    this.notifications.forEach((n) => (n.read = true));
  }

  public async createAlert(params: {
    origin: string;
    destination: string;
    departureDate: string;
    targetPrice: number;
    flightNumber?: string;
    alertOnOptimalBuy?: boolean;
    alertOnPriceDrop?: boolean;
  }): Promise<TrackedTripAlert> {
    const routeId = `${params.origin.toUpperCase()}-${params.destination.toUpperCase()}`;
    const originInfo = AIRPORTS[params.origin.toUpperCase()] || { city: params.origin, name: params.origin };
    const destInfo = AIRPORTS[params.destination.toUpperCase()] || { city: params.destination, name: params.destination };

    const flights = await flightAggregator.getFlightsAsync(params.origin, params.destination, params.departureDate);
    const lowest = flights && flights.length > 0 ? Math.min(...flights.map((f) => f.currentPrice)) : params.targetPrice;

    // Add route to aggregator monitoring if not already there
    flightAggregator.addMonitoredRoute(routeId);

    const newAlert: TrackedTripAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      routeId,
      origin: params.origin.toUpperCase(),
      originCity: originInfo.city,
      destination: params.destination.toUpperCase(),
      destinationCity: destInfo.city,
      departureDate: params.departureDate,
      flightNumber: params.flightNumber || '',
      targetPrice: params.targetPrice,
      currentLowestPrice: lowest,
      alertOnOptimalBuy: params.alertOnOptimalBuy ?? true,
      alertOnPriceDrop: params.alertOnPriceDrop ?? true,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      history: [
        {
          timestamp: new Date().toISOString(),
          price: lowest,
          status: 'ALERT_CREATED',
        },
      ],
    };

    this.alerts.unshift(newAlert);
    firestoreDB.saveAlert(newAlert).catch(() => {});

    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      title: `🔔 Tracking Started: ${originInfo.city} to ${destInfo.city}`,
      body: `Alert configured for target ₹${params.targetPrice.toLocaleString('en-IN')}. Our hourly aggregator will notify you the instant price reaches the optimal point.`,
      type: 'SYSTEM_INFO',
      timestamp: new Date().toISOString(),
      read: false,
      routeId,
    };
    this.notifications.push(newNotif);
    firestoreDB.saveNotification(newNotif).catch(() => {});

    return newAlert;
  }

  public deleteAlert(id: string): boolean {
    const initialLen = this.alerts.length;
    this.alerts = this.alerts.filter((a) => a.id !== id);
    if (this.alerts.length < initialLen) {
      firestoreDB.deleteAlert(id).catch(() => {});
      return true;
    }
    return false;
  }

  // Model-Driven Alert Evaluation Engine
  public async evaluateActiveAlerts(): Promise<{ evaluatedCount: number; firedAlerts: TrackedTripAlert[] }> {
    const firedAlerts: TrackedTripAlert[] = [];
    const activeAlerts = this.alerts.filter((a) => a.status === 'ACTIVE' || a.status === 'TRIGGERED');

    for (const alert of activeAlerts) {
      try {
        alert.lastCheckedAt = new Date().toISOString();

        // 1. Get current live flights for route + date
        const flights = await flightAggregator.getFlightsAsync(alert.origin, alert.destination, alert.departureDate);
        if (!flights || flights.length === 0) continue;

        const currentLivePrice = Math.min(...flights.map((f) => f.currentPrice));
        const previousLowestPrice = alert.currentLowestPrice || currentLivePrice;

        // 2. Re-run ML Prediction Model for route + date
        const prediction = await runPricePrediction(alert.origin, alert.destination, alert.departureDate, false);
        const { predictedPriceRange, recommendation, dropProbabilityPercent } = prediction;

        // Explicit definition of "optimal" buy signal:
        // Condition A: currentLivePrice <= predictedPriceRange.min (P10 floor price)
        // Condition B: recommendation === 'BUY_NOW' && dropProbabilityPercent < 20%
        const isP10FloorHit = currentLivePrice <= predictedPriceRange.min;
        const isLowDropBuyNow = recommendation === 'BUY_NOW' && dropProbabilityPercent < 20;
        const isOptimalSignal = isP10FloorHit || isLowDropBuyNow;

        // Check 24-hour cooldown for optimal buy alert firing
        const nowMs = Date.now();
        const lastFiredMs = alert.lastFiredAt ? new Date(alert.lastFiredAt).getTime() : 0;
        const isInOptimalCooldown = nowMs - lastFiredMs < 24 * 60 * 60 * 1000;

        if (isOptimalSignal && alert.alertOnOptimalBuy && !isInOptimalCooldown) {
          const conditionFired = isP10FloorHit ? 'PRICE_AT_P10_FLOOR' : 'BUY_NOW_LOW_DROP_PROB';
          let reasonText = '';

          if (isP10FloorHit) {
            reasonText = `Current fare ₹${currentLivePrice.toLocaleString('en-IN')} matches or beats predicted floor ₹${predictedPriceRange.min.toLocaleString('en-IN')} (P10) — model estimates minimal further downside risk (P50: ₹${predictedPriceRange.expected.toLocaleString('en-IN')}, P90: ₹${predictedPriceRange.max.toLocaleString('en-IN')}).`;
          } else {
            reasonText = `Model recommendation flipped to BUY_NOW with only ${dropProbabilityPercent}% drop probability (P50: ₹${predictedPriceRange.expected.toLocaleString('en-IN')}) — model predicts impending price surge.`;
          }

          // Mark alert as FIRED (and set 24h cooldown)
          alert.status = 'FIRED';
          alert.lastFiredAt = new Date().toISOString();
          alert.conditionFired = conditionFired;
          alert.currentLowestPrice = currentLivePrice;
          alert.history.push({
            timestamp: new Date().toISOString(),
            price: currentLivePrice,
            status: `FIRED_${conditionFired}`,
          });

          // Create push notification with exact model reasoning
          const notif: AppNotification = {
            id: `notif-opt-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            title: `🎯 Model Optimal Buy Signal: ${alert.originCity} → ${alert.destinationCity}`,
            body: reasonText,
            type: 'OPTIMAL_BUY',
            timestamp: new Date().toISOString(),
            read: false,
            routeId: alert.routeId,
            priceDelta: currentLivePrice - alert.targetPrice,
          };

          this.notifications.push(notif);
          firedAlerts.push(alert);

          // Persist state asynchronously to Firestore
          firestoreDB.saveAlert(alert).catch(() => {});
          firestoreDB.saveNotification(notif).catch(() => {});

          console.log(`[Alert Engine] FIRED OPTIMAL BUY ALERT for ${alert.routeId} (${alert.departureDate}) — Condition: ${conditionFired}`);
        } else if (alert.alertOnPriceDrop && currentLivePrice < previousLowestPrice * 0.95) {
          // Secondary Signal: Sudden Price Drop (> 5% drop)
          const lastDropMs = alert.lastDropNotifAt ? new Date(alert.lastDropNotifAt).getTime() : 0;
          const isInDropCooldown = nowMs - lastDropMs < 12 * 60 * 60 * 1000;

          if (!isInDropCooldown) {
            const dropAmount = previousLowestPrice - currentLivePrice;
            const pct = Math.round((dropAmount / previousLowestPrice) * 100);

            const notif: AppNotification = {
              id: `notif-drop-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              title: `📉 Sudden Price Drop: ${alert.originCity} → ${alert.destinationCity}`,
              body: `Fare dropped by ₹${dropAmount.toLocaleString('en-IN')} (-${pct}%) to ₹${currentLivePrice.toLocaleString('en-IN')}. Model recommendation: ${recommendation.replace(/_/g, ' ')} (${dropProbabilityPercent}% drop chance).`,
              type: 'PRICE_DROP',
              timestamp: new Date().toISOString(),
              read: false,
              routeId: alert.routeId,
              priceDelta: -dropAmount,
            };

            this.notifications.push(notif);
            alert.lastDropNotifAt = new Date().toISOString();
            alert.currentLowestPrice = currentLivePrice;
            alert.history.push({
              timestamp: new Date().toISOString(),
              price: currentLivePrice,
              status: `SUDDEN_PRICE_DROP_-${dropAmount}`,
            });

            firestoreDB.saveAlert(alert).catch(() => {});
            firestoreDB.saveNotification(notif).catch(() => {});

            console.log(`[Alert Engine] FIRED SUDDEN PRICE DROP ALERT for ${alert.routeId} (${alert.departureDate}) — Dropped ₹${dropAmount}`);
          }
        } else {
          // Simply update current lowest price in alert object
          alert.currentLowestPrice = currentLivePrice;
          firestoreDB.saveAlert(alert).catch(() => {});
        }
      } catch (err) {
        console.warn(`[Alert Engine] Error evaluating alert ${alert.id}:`, err);
      }
    }

    return { evaluatedCount: activeAlerts.length, firedAlerts };
  }

  // Trigger test notification
  public createTestNotification(origin: string = 'PNQ', destination: string = 'LKO'): AppNotification {
    const originCity = AIRPORTS[origin]?.city || origin;
    const destCity = AIRPORTS[destination]?.city || destination;
    
    const notif: AppNotification = {
      id: `test-${Date.now()}`,
      title: `✈️ Optimal Booking Time: ${originCity} → ${destCity}!`,
      body: `Test Alert: Fare dropped by ₹450 to ₹4,320 on IndiGo 6E-656. Predicted to rise in 48h. Time to book!`,
      type: 'OPTIMAL_BUY',
      timestamp: new Date().toISOString(),
      read: false,
      routeId: `${origin}-${destination}`,
      priceDelta: -450,
    };

    this.notifications.push(notif);
    return notif;
  }
}

export const alertsManager = new AlertsManager();
