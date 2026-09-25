import { TrackedPredictionRecord, PredictionAuditSummary } from '../src/types';
import { flightAggregator } from './aggregator';
import { mlForest } from './mlEngine';
import { firestoreDB } from './firestoreService';

function calculateDaysToDeparture(departureDateStr: string, creationDateStr: string): number {
  const dep = new Date(departureDateStr);
  const created = new Date(creationDateStr);
  const depUtc = Date.UTC(dep.getUTCFullYear(), dep.getUTCMonth(), dep.getUTCDate());
  const createdUtc = Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate());
  return Math.max(0, Math.round((depUtc - createdUtc) / (1000 * 60 * 60 * 24)));
}

class PredictionTracker {
  private records: TrackedPredictionRecord[] = [];
  private isHydrated = false;

  constructor() {
    // Rely strictly on genuine hydrated predictions from Firestore
    this.ensureHydrated().catch(() => {});
  }

  public async ensureHydrated(): Promise<void> {
    if (this.isHydrated) return;
    try {
      await firestoreDB.init();
      await this.hydrateFromFirestore();
    } catch (err) {
      console.warn('[PredictionTracker] ensureHydrated error:', err);
    }
  }

  private async hydrateFromFirestore() {
    try {
      const persisted = await firestoreDB.getPredictionRecords();
      if (persisted.length > 0) {
        const existingMap = new Map<string, TrackedPredictionRecord>();
        for (const p of persisted) {
          // Normalize flightGroupId and daysToDeparture if missing
          const routeUpper = p.routeId ? p.routeId.toUpperCase() : 'PNQ-LKO';
          const flightGroupId = p.flightGroupId || `${routeUpper}-${p.departureDate}`;
          const daysToDeparture = p.daysToDeparture ?? calculateDaysToDeparture(p.departureDate, p.createdAt || new Date().toISOString());
          existingMap.set(p.id, {
            ...p,
            routeId: routeUpper,
            flightGroupId,
            daysToDeparture,
          });
        }
        this.records = Array.from(existingMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.isHydrated = true;
        console.log(`[Firestore DB] Hydrated ${this.records.length} genuine prediction audit records.`);
      }
    } catch (err) {
      console.warn('[Firestore DB] Hydration warning for prediction records:', err);
    }
  }

  public recordPrediction(data: Omit<TrackedPredictionRecord, 'id' | 'createdAt' | 'status'>): TrackedPredictionRecord {
    const routeIdUpper = data.routeId.toUpperCase();
    const modelVer = data.modelVersion || 'v1.2.0-quantile-forest';
    const nowIso = new Date().toISOString();
    const flightGroupId = `${routeIdUpper}-${data.departureDate}`;
    const daysToDeparture = calculateDaysToDeparture(data.departureDate, nowIso);
    const recordId = `pred-${routeIdUpper}-${data.departureDate}-${daysToDeparture}d`;

    // Deduplication check: see if a record already exists for this exact flightGroupId and daysToDeparture
    const existing = this.records.find(
      (r) => r.id === recordId || (r.flightGroupId === flightGroupId && r.daysToDeparture === daysToDeparture)
    );

    if (existing) {
      existing.initialPriceAtPrediction = data.initialPriceAtPrediction;
      existing.predictedMin = data.predictedMin;
      existing.predictedMax = data.predictedMax;
      existing.predictedP50 = data.predictedP50;
      existing.dropProbability = data.dropProbability;
      existing.recommendationGiven = data.recommendationGiven;
      existing.confidenceScore = data.confidenceScore;
      existing.modelUsed = data.modelUsed;
      existing.modelVersion = modelVer;
      existing.flightGroupId = flightGroupId;
      existing.daysToDeparture = daysToDeparture;

      firestoreDB.savePredictionRecord(existing).catch(() => {});
      return existing;
    }

    const newRecord: TrackedPredictionRecord = {
      ...data,
      id: recordId,
      flightGroupId,
      daysToDeparture,
      routeId: routeIdUpper,
      modelVersion: modelVer,
      createdAt: nowIso,
      status: 'PENDING_VERIFICATION',
      actualLowestPriceObserved: data.initialPriceAtPrediction,
      actualLowestDateObserved: nowIso.split('T')[0],
    };

    this.records.unshift(newRecord);
    if (this.records.length > 300) {
      this.records.pop();
    }

    firestoreDB.savePredictionRecord(newRecord).catch(() => {});

    return newRecord;
  }

  public async auditActivePredictions(): Promise<PredictionAuditSummary> {
    await this.ensureHydrated();
    
    // Combine in-memory snapshots with persistent Firestore snapshots across both corridors
    const memorySnapshots = flightAggregator.getSnapshots();
    let firestoreSnaps: any[] = [];
    try {
      const [p1, p2] = await Promise.all([
        firestoreDB.getSnapshots('PNQ-LKO', 1000),
        firestoreDB.getSnapshots('LKO-PNQ', 1000),
      ]);
      firestoreSnaps = [...p1, ...p2];
    } catch (err) {
      console.warn('[PredictionTracker] Firestore snapshot fetch note:', err);
    }

    const allSnapshots = [...firestoreSnaps, ...memorySnapshots];
    const todayStr = new Date().toISOString().split('T')[0];

    for (const record of this.records) {
      if (record.status !== 'PENDING_VERIFICATION') continue;

      // Find observed price snapshots for this route & departure date
      const matchingSnapshots = allSnapshots.filter(
        (s) => s.routeId?.toUpperCase() === record.routeId.toUpperCase() && s.departureDate === record.departureDate
      );

      if (matchingSnapshots.length > 0) {
        const lowestSnapshot = matchingSnapshots.reduce(
          (min, s) => (s.price < min.price ? s : min),
          matchingSnapshots[0]
        );

        if (lowestSnapshot.price < (record.actualLowestPriceObserved || Infinity)) {
          record.actualLowestPriceObserved = lowestSnapshot.price;
          record.actualLowestDateObserved = lowestSnapshot.timestamp?.split('T')[0] || todayStr;
        }
      }

      const depDateStr = record.departureDate;
      const isPastOrToday = depDateStr <= todayStr;
      const departureTime = new Date(depDateStr).getTime();
      const now = Date.now();
      const daysRemaining = (departureTime - now) / (1000 * 60 * 60 * 24);

      // If departed (daysRemaining <= 0 or past date), resolve the audit
      if (isPastOrToday || daysRemaining <= 0) {
        const finalPrice = matchingSnapshots.length > 0
          ? matchingSnapshots[matchingSnapshots.length - 1]?.price || record.initialPriceAtPrediction
          : record.initialPriceAtPrediction;
        record.finalPriceAtDeparture = finalPrice;

        if (record.recommendationGiven === 'BUY_NOW') {
          // Did price rise or stay at floor?
          if (finalPrice >= record.initialPriceAtPrediction) {
            record.status = 'VERIFIED_CORRECT';
            record.wasAccurate = true;
            record.actualSavingsOrLossINR = Math.max(0, finalPrice - record.initialPriceAtPrediction);
            record.auditNotes = `Accurate BUY NOW recommendation: Fare locked in at ₹${record.initialPriceAtPrediction.toLocaleString()} before closing at ₹${finalPrice.toLocaleString()} at departure.`;
          } else {
            record.status = 'DIVERGED';
            record.wasAccurate = false;
            record.actualSavingsOrLossINR = finalPrice - record.initialPriceAtPrediction;
            record.auditNotes = `Diverged: Price dipped by ₹${Math.abs(record.actualSavingsOrLossINR)} before departure.`;
          }
        } else if (record.recommendationGiven === 'WAIT_AND_WATCH' || record.recommendationGiven === 'DROP_IMMINENT') {
          // Did price drop below initial price?
          if ((record.actualLowestPriceObserved || record.initialPriceAtPrediction) < record.initialPriceAtPrediction) {
            record.status = 'VERIFIED_CORRECT';
            record.wasAccurate = true;
            record.actualSavingsOrLossINR = record.initialPriceAtPrediction - (record.actualLowestPriceObserved || 0);
            record.auditNotes = `Accurate WAIT recommendation: Captured dip to ₹${(record.actualLowestPriceObserved || 0).toLocaleString()} (saved ₹${record.actualSavingsOrLossINR}).`;
          } else {
            record.status = 'DIVERGED';
            record.wasAccurate = false;
            record.actualSavingsOrLossINR = 0;
            record.auditNotes = 'Price stayed flat without further dip prior to departure.';
          }
        }

        firestoreDB.savePredictionRecord(record).catch(() => {});
      }
    }

    // Continuous Dynamic Retraining: Convert verified ground truth records into updated training data (Real Data Only)
    const verified = this.records.filter((r) => r.status === 'VERIFIED_CORRECT' && r.actualLowestPriceObserved);
    if (verified.length > 0) {
      const liveFeedbackRecords = verified.map((v) => {
        const depDate = new Date(v.departureDate);
        return {
          routeId: v.routeId,
          leadTimeDays: Math.max(1, Math.round((new Date(v.departureDate).getTime() - new Date(v.createdAt).getTime()) / (1000 * 60 * 60 * 24))),
          dayOfWeek: depDate.getDay(),
          month: depDate.getMonth() + 1,
          isSaturday: depDate.getDay() === 6,
          isSunday: depDate.getDay() === 0,
          departureHour: 6,
          actualFinalPrice: v.finalPriceAtDeparture || v.initialPriceAtPrediction,
          lowestObservedPrice: v.actualLowestPriceObserved || v.initialPriceAtPrediction,
          provenance: 'REAL_OBSERVATION' as const,
        };
      });

      mlForest.train(liveFeedbackRecords);
      console.log(`[ML Engine Recalibrated] Quantile Decision Forest retrained with ${liveFeedbackRecords.length} genuine real-world feedback records.`);
    }

    return this.getAuditSummaryInternal();
  }

  private getAuditSummaryInternal(): PredictionAuditSummary {
    const verified = this.records.filter((r) => r.status === 'VERIFIED_CORRECT');
    const totalClosed = this.records.filter((r) => r.status !== 'PENDING_VERIFICATION');
    
    // Derived strictly from the records array to prevent state drift
    const accuracyRate = totalClosed.length > 0
      ? Math.round((verified.length / totalClosed.length) * 1000) / 10
      : 100.0;

    const totalSavings = verified.reduce((acc, r) => acc + (r.actualSavingsOrLossINR || 0), 0);

    return {
      totalPredictionsLogged: this.records.length,
      verifiedCount: verified.length,
      pendingCount: this.records.filter((r) => r.status === 'PENDING_VERIFICATION').length,
      overallAccuracyRate: accuracyRate,
      totalTravelerSavingsRealizedINR: totalSavings,
      recentRecords: this.records.slice(0, 100),
    };
  }

  public async getAuditSummary(): Promise<PredictionAuditSummary> {
    await this.ensureHydrated();
    return this.auditActivePredictions();
  }
}

export const predictionTracker = new PredictionTracker();
