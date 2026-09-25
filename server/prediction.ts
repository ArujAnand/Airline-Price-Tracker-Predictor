import { GoogleGenAI } from '@google/genai';
import { PredictionAnalysis, PriceForecastPoint } from '../src/types';
import { getFestivalImpact } from './festivals';
import { flightAggregator } from './aggregator';
import { predictFlightWithML, mlForest } from './mlEngine';
import { predictionTracker } from './predictionTracker';
import { getFactualYoYTrends } from './historicalData';

// Multi-key Gemini client pool setup with automatic failover, alternating load-balancing, and quota cooldown
interface AIKeyRecord {
  key: string;
  label: string;
  client: GoogleGenAI;
  rateLimitedUntil: number;
  lastUsed: number;
  failureCount: number;
}

const keyStore = new Map<string, AIKeyRecord>();

function getAIPool(): AIKeyRecord[] {
  // Dynamically inspect environment variables so runtime secret changes are immediately active
  const rawSources = [
    { source: 'GEMINI_API_KEY', val: process.env.GEMINI_API_KEY },
    { source: 'GEMINI_API_KEY_SECONDARY', val: process.env.GEMINI_API_KEY_SECONDARY },
    { source: 'GEMINI_API_KEY_2', val: process.env.GEMINI_API_KEY_2 },
    { source: 'GOOGLE_API_KEY', val: process.env.GOOGLE_API_KEY },
  ];

  const foundKeys: { key: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const src of rawSources) {
    if (!src.val) continue;
    // Support multiple keys passed in a single variable separated by commas, semicolons, or newlines
    const parts = src.val.split(/[\n,;]+/).map((k) => k.trim()).filter((k) => k.length > 5);
    for (const k of parts) {
      if (!seen.has(k)) {
        seen.add(k);
        const label = foundKeys.length === 0 ? 'Primary Key' : `Secondary Key #${foundKeys.length}`;
        foundKeys.push({ key: k, label });
      }
    }
  }

  // Update or register key records in keyStore
  for (const item of foundKeys) {
    if (!keyStore.has(item.key)) {
      keyStore.set(item.key, {
        key: item.key,
        label: item.label,
        client: new GoogleGenAI({
          apiKey: item.key,
          httpOptions: {
            headers: { 'User-Agent': 'aistudio-build' },
          },
        }),
        rateLimitedUntil: 0,
        lastUsed: 0,
        failureCount: 0,
      });
    } else {
      keyStore.get(item.key)!.label = item.label;
    }
  }

  // Remove keys no longer in environment
  for (const existingKey of Array.from(keyStore.keys())) {
    if (!seen.has(existingKey)) {
      keyStore.delete(existingKey);
    }
  }

  const pool = Array.from(keyStore.values());

  // Prioritize keys not currently in 429 cooldown, then balance requests across keys (least recently used)
  const now = Date.now();
  pool.sort((a, b) => {
    const aCooldown = a.rateLimitedUntil > now ? 1 : 0;
    const bCooldown = b.rateLimitedUntil > now ? 1 : 0;
    if (aCooldown !== bCooldown) return aCooldown - bCooldown;
    return a.lastUsed - b.lastUsed;
  });

  return pool;
}

export function getGeminiPoolStatus(): {
  totalKeysConfigured: number;
  keys: { label: string; configured: boolean; preview: string; inCooldown: boolean }[];
  failoverEnabled: boolean;
} {
  const pool = getAIPool();
  const now = Date.now();

  const maskKey = (k?: string) => {
    if (!k || k.length < 8) return 'Not configured';
    return `${k.slice(0, 4)}...${k.slice(-4)}`;
  };

  return {
    totalKeysConfigured: pool.length,
    keys: pool.map((k) => ({
      label: k.label,
      configured: true,
      preview: maskKey(k.key),
      inCooldown: k.rateLimitedUntil > now,
    })),
    failoverEnabled: pool.length > 1,
  };
}

// In-memory cache for AI analysis to avoid redundant API hits and mitigate rate limits / 503 spikes
const aiAnalysisCache = new Map<string, { text: string; timestamp: number; model?: string; keyLabel?: string }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export async function runPricePrediction(
  origin: string,
  destination: string,
  departureDateStr: string,
  includeAI = true
): Promise<PredictionAnalysis> {
  const routeId = `${origin.toUpperCase()}-${destination.toUpperCase()}`;
  const flights = await flightAggregator.getFlightsAsync(origin, destination, departureDateStr);
  const currentLowestPrice = flights.length > 0 ? Math.min(...flights.map((f) => f.currentPrice)) : 4600;

  const today = new Date();
  const departureDate = new Date(departureDateStr);
  const daysToDeparture = Math.max(0, Math.round((departureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const festivalInfo = getFestivalImpact(departureDateStr, origin, destination);

  const daysOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const departureDay = daysOfWeekNames[departureDate.getDay()];

  // Baseline median historical price
  const baseAvg = flights.length > 0 ? flights[0].basePrice : 4600;
  const historicalMedianPrice = Math.round(baseAvg * (festivalInfo.nearFestival ? 1.4 : 1.05));

  // Determine Recommendation & Confidence
  let recommendation: 'BUY_NOW' | 'WAIT_AND_WATCH' | 'DROP_IMMINENT' | 'PRICE_RISING' = 'WAIT_AND_WATCH';
  let confidenceScore = 84;
  let expectedDirection: 'decrease' | 'increase' | 'stable' = 'stable';
  let expectedDelta = 0;
  let expectedTimeframe = 'Next 3-5 days';
  let leadTimeCategory: 'LAST_MINUTE' | 'HIGH_SURGE' | 'OPTIMAL_SWEET_SPOT' | 'EARLY_STABLE' = 'EARLY_STABLE';
  let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  let leadTimeImpactDesc = '';

  if (daysToDeparture <= 7) {
    leadTimeCategory = 'LAST_MINUTE';
    riskLevel = 'Critical';
    recommendation = 'BUY_NOW';
    confidenceScore = 96;
    expectedDirection = 'increase';
    expectedDelta = Math.round(currentLowestPrice * 0.35);
    expectedTimeframe = 'Within 24-48 hours';
    leadTimeImpactDesc = `Critical: Only ${daysToDeparture} days remaining before departure. Last-minute yield management algorithms will steadily advance fare buckets. Fares will not drop.`;
  } else if (daysToDeparture <= 14) {
    leadTimeCategory = 'HIGH_SURGE';
    riskLevel = 'High';
    recommendation = 'BUY_NOW';
    confidenceScore = 92;
    expectedDirection = 'increase';
    expectedDelta = Math.round(currentLowestPrice * 0.22);
    expectedTimeframe = 'Next 2-4 days';
    leadTimeImpactDesc = `Urgent: You are inside the 14-day final pricing window. Seat inventory for ${origin} ⇄ ${destination} is tightening rapidly.`;
  } else if (daysToDeparture >= 21 && daysToDeparture <= 45) {
    leadTimeCategory = 'OPTIMAL_SWEET_SPOT';
    if (festivalInfo.nearFestival) {
      recommendation = 'BUY_NOW';
      confidenceScore = 88;
      riskLevel = 'High';
      expectedDirection = 'increase';
      expectedDelta = Math.round(currentLowestPrice * 0.18);
      expectedTimeframe = 'Over the next 1-2 weeks';
      leadTimeImpactDesc = `Optimal lead time (${daysToDeparture} days), but proximity to ${festivalInfo.festivalName || 'peak festival'} means seat blocks are selling fast. Booking now locks in the bottom price bucket.`;
    } else {
      recommendation = 'BUY_NOW';
      confidenceScore = 86;
      riskLevel = 'Low';
      expectedDirection = 'stable';
      expectedDelta = -Math.round(currentLowestPrice * 0.05);
      expectedTimeframe = 'Within 7 days';
      leadTimeImpactDesc = `Optimal booking window: Currently ${daysToDeparture} days out. This is historically the cheapest booking corridor for domestic Indian sectors.`;
    }
  } else if (daysToDeparture > 45) {
    leadTimeCategory = 'EARLY_STABLE';
    if (festivalInfo.nearFestival && festivalInfo.demandMultiplier > 1.5) {
      recommendation = 'BUY_NOW';
      confidenceScore = 85;
      riskLevel = 'Medium';
      expectedDirection = 'increase';
      expectedDelta = Math.round(currentLowestPrice * 0.25);
      leadTimeImpactDesc = `Far in advance (${daysToDeparture} days), but due to extreme ${festivalInfo.festivalName} festival rush, early fare tiers are already filling.`;
    } else {
      recommendation = 'WAIT_AND_WATCH';
      confidenceScore = 82;
      riskLevel = 'Low';
      expectedDirection = 'decrease';
      expectedDelta = -Math.round(currentLowestPrice * 0.12);
      expectedTimeframe = 'In 2-3 weeks (25-40 days out)';
      leadTimeImpactDesc = `Early stage: Flights are ${daysToDeparture} days away. Airlines rarely discount until 30-45 days prior. High probability of price drop when tactical sales open.`;
    }
  } else {
    // 15 to 20 days
    if (departureDate.getDay() === 2 || departureDate.getDay() === 3) {
      recommendation = 'DROP_IMMINENT';
      confidenceScore = 80;
      riskLevel = 'Medium';
      expectedDirection = 'decrease';
      expectedDelta = -Math.round(currentLowestPrice * 0.08);
      expectedTimeframe = 'Next 48 hours (Midweek dip)';
      leadTimeImpactDesc = `Midweek departure (${departureDay}) combined with 15-20 days lead time often triggers short-term algorithmic corrections.`;
    } else {
      recommendation = 'PRICE_RISING';
      confidenceScore = 87;
      riskLevel = 'High';
      expectedDirection = 'increase';
      expectedDelta = Math.round(currentLowestPrice * 0.15);
      expectedTimeframe = 'Over the next 3 days';
      leadTimeImpactDesc = `Approaching the 14-day cut-off with weekend departure. Fares expected to step up to tier 2 fare class.`;
    }
  }

  // Calculate Optimal Booking Window
  const optimalDaysOutMin = 25;
  const optimalDaysOutMax = 38;
  const optimalStart = new Date(departureDate.getTime() - optimalDaysOutMax * 24 * 60 * 60 * 1000);
  const optimalEnd = new Date(departureDate.getTime() - optimalDaysOutMin * 24 * 60 * 60 * 1000);

  // Forecast points for next 14 days using ML Quantile Forest & dynamic day-of-week oscillation
  const forecastPoints: PriceForecastPoint[] = [];
  for (let i = 0; i <= 14; i += 2) {
    const forecastDate = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const futureDaysToDeparture = Math.max(0, daysToDeparture - i);
    const forecastDOW = forecastDate.getDay(); // 0=Sun, 1=Mon, 2=Tue...

    // Extract feature vector for ML Forest prediction at t + i days
    const futureFestivalOffset = (festivalInfo.daysFromFestival === undefined || festivalInfo.daysFromFestival === 999)
      ? 999 
      : (festivalInfo.daysFromFestival - i);
    
    const mlPredictedQuantiles = mlForest.predictQuantiles([
      futureDaysToDeparture,
      festivalInfo.demandMultiplier,
      futureFestivalOffset === 999 ? 50 : Math.abs(futureFestivalOffset),
      forecastDOW === 0 || forecastDOW === 5 || forecastDOW === 6 ? 1 : 0,
      forecastDOW,
      Math.min(0.98, Math.max(0.45, 0.95 - (futureDaysToDeparture * 0.008))),
      0, // standard midday
    ], currentLowestPrice);

    // Dynamic midweek vs weekend booking rhythm with subtle rate limiting
    let dowRhythm = 1.0;
    if (forecastDOW === 2 || forecastDOW === 3) {
      dowRhythm = 0.97; // Midweek fare adjustments / hold releases
    } else if (forecastDOW === 5 || forecastDOW === 0) {
      dowRhythm = 1.03; // Weekend booking surges
    }

    // Blend ML median with current observed price anchor
    // If currentLowestPrice is an outlier (>2x or <0.5x training median of ~6000), weight current price much heavier
    const isPriceOutlier = currentLowestPrice > 12000 || currentLowestPrice < 3000;
    const baseAnchor = Math.max(0.35, 1 - (i / 16));
    const anchorWeight = isPriceOutlier ? Math.max(0.85, baseAnchor + 0.5) : baseAnchor;
    let rawBlended = (currentLowestPrice * anchorWeight + mlPredictedQuantiles.p50 * (1 - anchorWeight)) * dowRhythm;
    
    // Smooth transition: Clamp 2-day step change to max 7% to avoid unnatural jumps (except for extreme price outliers where spot quote governs)
    if (forecastPoints.length > 0 && !isPriceOutlier) {
      const prevPrice = forecastPoints[forecastPoints.length - 1].predictedPrice;
      const maxAllowed = prevPrice * 1.07;
      const minAllowed = prevPrice * 0.93;
      rawBlended = Math.min(maxAllowed, Math.max(minAllowed, rawBlended));
    }

    const blendedPrice = Math.round(rawBlended / 10) * 10;

    // Dynamic point-specific confidence interval (scales with lead time uncertainty without duplicate quantiles)
    const uncertaintySpan = Math.round(blendedPrice * (0.12 + (i / 14) * 0.08));
    const lower = Math.max(1800, blendedPrice - uncertaintySpan);
    const upper = Math.round(blendedPrice + uncertaintySpan * 1.15);

    forecastPoints.push({
      date: forecastDate.toISOString().split('T')[0],
      daysToDeparture: futureDaysToDeparture,
      predictedPrice: i === 0 ? currentLowestPrice : blendedPrice,
      lowerBound: i === 0 ? Math.round(currentLowestPrice * 0.96) : lower,
      upperBound: i === 0 ? Math.round(currentLowestPrice * 1.05) : upper,
      confidence: Math.max(65, Math.round(confidenceScore - i * 1.4)),
      note: i === 0 
        ? 'Current Price' 
        : (futureDaysToDeparture < 7 ? 'Late Surge Phase' : (futureDaysToDeparture <= 38 && futureDaysToDeparture >= 21 ? 'Optimal Booking Zone' : (forecastDOW === 2 || forecastDOW === 3 ? 'Midweek Dip' : 'Advance Phase'))),
    });
  }

  const minPredicted = Math.min(...forecastPoints.map((p) => p.lowerBound));
  const maxPredicted = Math.max(...forecastPoints.map((p) => p.upperBound));

  // Run Multi-Tree ML Decision Forest Regression Model FIRST so exact facts govern advisory
  const mlResult = predictFlightWithML(
    daysToDeparture,
    festivalInfo.demandMultiplier,
    festivalInfo.daysFromFestival ?? 999,
    departureDate.getDay(),
    currentLowestPrice,
    baseAvg,
    forecastPoints[Math.min(3, forecastPoints.length - 1)].predictedPrice,
    recommendation
  );

  // Compute 3 Core User Predictions:
  // 1. Drop Probability with Confidence %
  const dropProbabilityPercent = mlResult.dropProbabilityPercent;
  const surgeProbabilityPercent = mlResult.surgeProbabilityPercent;

  // Align expected price movement direction and amount with ML Decision Forest
  let unifiedExpectedDirection: 'increase' | 'decrease' | 'stable' = expectedDirection;
  let unifiedExpectedDelta = Math.abs(expectedDelta);

  if (mlResult.recommendation === 'BUY_NOW' || mlResult.recommendation === 'PRICE_RISING') {
    unifiedExpectedDirection = 'increase';
    unifiedExpectedDelta = Math.max(Math.round(currentLowestPrice * 0.12), Math.abs(mlResult.p50 - currentLowestPrice));
  } else if (mlResult.recommendation === 'WAIT_AND_WATCH' || mlResult.recommendation === 'DROP_IMMINENT') {
    unifiedExpectedDirection = 'decrease';
    unifiedExpectedDelta = Math.max(Math.round(currentLowestPrice * 0.08), Math.abs(currentLowestPrice - mlResult.p10));
  }

  // 2. Absolute Price Bounds from Quantile Forest:
  // P10 (lowest realistic floor), P50 (expected median), P90 (peak surge ceiling)
  const predictedPriceRange = {
    min: Math.min(minPredicted, mlResult.p10),
    expected: mlResult.p50,
    max: Math.max(maxPredicted, mlResult.p90),
  };

  // 3. Optimal Booking Timing (Day, Date, and Intraday Hour)
  const bestDayOfWeek = (departureDay === 'Tuesday' || departureDay === 'Wednesday') ? 'Tuesday' : 'Wednesday';
  const targetOptimalDate = daysToDeparture > 28
    ? optimalStart.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  
  const optimalBookingTiming = {
    bestDayOfWeek,
    bestCalendarDate: targetOptimalDate,
    bestBookingHour: '01:00 AM - 05:30 AM IST',
    reason: daysToDeparture > 25
      ? 'Airlines release unsold reservation blocks in the 25-38 day advance window, especially overnight.'
      : 'Seats are already in surge pricing. The earliest available 1:00-5:30 AM unfreeze cycle is the best remaining window.',
  };

  // Synthesize AI reasoning with Gemini models strictly constrained to explain computed numbers
  let aiAnalysisText = '';
  let aiSource: { source: 'live_gemini' | 'cache' | 'deterministic_fallback'; model?: string; keyLabel?: string } = {
    source: 'deterministic_fallback',
  };
  const cacheKey = `${routeId}-${departureDateStr}-${mlResult.recommendation}-${currentLowestPrice}-${dropProbabilityPercent}`;
  const cached = aiAnalysisCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    aiAnalysisText = cached.text;
    aiSource = {
      source: 'cache',
      model: cached.model,
      keyLabel: cached.keyLabel,
    };
    console.log(`[Gemini Cache] Serving cached forecast analysis for ${cacheKey}`);
  } else if (includeAI) {
    try {
      const pool = getAIPool();
      if (pool.length > 0) {
        const prompt = `You are an aviation revenue advisor explaining the output of our ML price prediction model.
Your task is to write a 2-3 sentence advisory explaining WHY these specific computed model outputs make sense given the flight's context.

FIXED COMPUTED MODEL OUTPUTS (DO NOT CHANGE OR ALTER THESE):
- Route: ${origin} (${routeId}) to ${destination}
- Departure Date: ${departureDateStr} (${departureDay}), Days to Departure: ${daysToDeparture}
- Current Price: ₹${currentLowestPrice.toLocaleString('en-IN')}
- Computed Model Recommendation: ${mlResult.recommendation}
- Computed Drop Probability: ${dropProbabilityPercent}% (Surge Probability: ${surgeProbabilityPercent}%)
- Predicted Price Target (P50): ₹${predictedPriceRange.expected.toLocaleString('en-IN')} (Floor P10: ₹${predictedPriceRange.min.toLocaleString('en-IN')}, Ceiling P90: ₹${predictedPriceRange.max.toLocaleString('en-IN')})
- Expected Price Change: ${unifiedExpectedDirection === 'decrease' ? '-' : '+'}₹${unifiedExpectedDelta.toLocaleString('en-IN')}
- Optimal Booking Window: ${optimalStart.toISOString().split('T')[0]} to ${optimalEnd.toISOString().split('T')[0]}
- Festival Context: ${festivalInfo.nearFestival ? `${festivalInfo.festivalName} (Demand factor ${festivalInfo.demandMultiplier}x)` : 'No major festival'}

STRICT CONSTRAINTS:
1. Explain WHY these exact numbers make sense based on advance booking window (${daysToDeparture} days out) and route factors.
2. State the exact ${dropProbabilityPercent}% drop probability and ${mlResult.recommendation} recommendation. Do NOT state a different probability percentage.
3. Do NOT contradict the recommendation (${mlResult.recommendation}).
4. Do NOT invent urgency language stronger or weaker than what the numbers support (for example, NEVER write "book immediately", "buy now", or "must book today" when recommendation is WAIT_AND_WATCH or DROP_IMMINENT).
5. If unsure how to phrase something, default to restating the numbers rather than interpreting them more strongly.`;

        // Candidate models prioritized by highest throughput and active quota
        const candidateModels = [
          'gemini-3.1-flash-lite',
          'gemini-flash-latest',
          'gemini-3.8-flash',
        ];

        let generationSuccess = false;
        const startTime = Date.now();
        const now = Date.now();

        for (const keyEntry of pool) {
          if (generationSuccess) break;

          if (keyEntry.rateLimitedUntil > now && pool.some((k) => k.rateLimitedUntil <= now)) {
            continue;
          }

          for (const candidateModel of candidateModels) {
            if (generationSuccess) break;

            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                keyEntry.lastUsed = Date.now();
                const response = await keyEntry.client.models.generateContent({
                  model: candidateModel,
                  contents: prompt,
                });

                if (response.text) {
                  aiAnalysisText = response.text;
                  generationSuccess = true;
                  aiSource = {
                    source: 'live_gemini',
                    model: candidateModel,
                    keyLabel: keyEntry.label,
                  };
                  keyEntry.rateLimitedUntil = 0;
                  const durationMs = Date.now() - startTime;
                  console.log(`[Gemini Success] Advisory generated in ${durationMs}ms using ${keyEntry.label} (${candidateModel})`);
                  break;
                }
              } catch (modelErr: any) {
                const statusStr = String(modelErr?.status || '');
                const msgStr = String(modelErr?.message || '');
                const is429 = statusStr === '429' || msgStr.includes('429') || msgStr.toLowerCase().includes('resource has been exhausted');
                const is503 = statusStr === '503' || msgStr.includes('503') || msgStr.toLowerCase().includes('unavailable') || msgStr.toLowerCase().includes('overloaded');

                if (is429) {
                  keyEntry.rateLimitedUntil = Date.now() + 45 * 1000;
                  break;
                }

                if (is503 && attempt === 0) {
                  await new Promise((r) => setTimeout(r, 350));
                  continue;
                }
                break;
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('Gemini prediction generation exception:', err?.message || err);
    }
  }

  // Post-generation lightweight contradiction & numerical sanity check
  if (aiAnalysisText) {
    const lowerText = aiAnalysisText.toLowerCase();
    let isContradictory = false;

    // Check 1: Urgent buy phrases when recommendation is WAIT_AND_WATCH or DROP_IMMINENT
    if (mlResult.recommendation === 'WAIT_AND_WATCH' || mlResult.recommendation === 'DROP_IMMINENT') {
      if (
        lowerText.includes('book immediately') ||
        lowerText.includes('buy immediately') ||
        lowerText.includes('book today') ||
        lowerText.includes('buy today') ||
        lowerText.includes('buy now') ||
        lowerText.includes('must book')
      ) {
        console.warn(`[Gemini Contradiction Flagged] Urgency language found in advisory for ${mlResult.recommendation}`);
        isContradictory = true;
      }
    } else if (mlResult.recommendation === 'BUY_NOW' || mlResult.recommendation === 'PRICE_RISING') {
      if (
        lowerText.includes('do not book') ||
        lowerText.includes('wait and watch') ||
        lowerText.includes('hold off')
      ) {
        console.warn(`[Gemini Contradiction Flagged] Delay language found in advisory for ${mlResult.recommendation}`);
        isContradictory = true;
      }
    }

    // Check 2: Conflicting percentage numbers
    const percentMatches = [...lowerText.matchAll(/(\d{1,2})\s*%/g)];
    for (const m of percentMatches) {
      const val = parseInt(m[1], 10);
      const diffFromDrop = Math.abs(val - dropProbabilityPercent);
      const diffFromSurge = Math.abs(val - surgeProbabilityPercent);
      if (diffFromDrop > 6 && diffFromSurge > 6) {
        console.warn(`[Gemini Contradiction Flagged] Mentioned ${val}% which differs from model drop ${dropProbabilityPercent}% / surge ${surgeProbabilityPercent}%`);
        isContradictory = true;
        break;
      }
    }

    if (isContradictory) {
      console.warn('[Gemini Guardrail] Discarded contradictory AI response, falling back to deterministic template.');
      aiAnalysisText = '';
    } else {
      // Store verified text in cache
      aiAnalysisCache.set(cacheKey, { text: aiAnalysisText, timestamp: Date.now(), model: aiSource.model, keyLabel: aiSource.keyLabel });
    }
  }

  // Fallback high-quality narrative built strictly from real numbers if Gemini is offline or guardrail flagged
  if (!aiAnalysisText) {
    const deltaSign = unifiedExpectedDirection === 'decrease' ? '-' : '+';
    aiAnalysisText = `The model calculates a ${dropProbabilityPercent}% probability of a price drop for ${origin} ⇄ ${destination} over the next 14 days, resulting in a ${mlResult.recommendation.replace(/_/g, ' ')} recommendation. Expected fare movement is ${deltaSign}₹${unifiedExpectedDelta.toLocaleString('en-IN')} toward the ₹${predictedPriceRange.expected.toLocaleString('en-IN')} target price window (${optimalStart.toISOString().split('T')[0]} to ${optimalEnd.toISOString().split('T')[0]}).`;
  }

  // Record this prediction into the Ground Truth Tracker for continuous audit and verification
  const trackedRecord = predictionTracker.recordPrediction({
    routeId,
    origin: origin.toUpperCase(),
    destination: destination.toUpperCase(),
    departureDate: departureDateStr,
    initialPriceAtPrediction: currentLowestPrice,
    predictedMin: predictedPriceRange.min,
    predictedMax: predictedPriceRange.max,
    predictedP50: predictedPriceRange.expected,
    dropProbability: dropProbabilityPercent,
    recommendationGiven: mlResult.recommendation,
    modelUsed: 'Quantile ML Forest',
    modelVersion: 'v1.2.0-quantile-forest',
    confidenceScore: mlResult.confidenceScore,
  });

  // Get Year-on-Year historical trend points strictly from real observed snapshots
  const snapshots = flightAggregator.getSnapshots(routeId, 500);
  const yoyTrends = getFactualYoYTrends(snapshots, routeId);

  return {
    routeId,
    origin: origin.toUpperCase(),
    destination: destination.toUpperCase(),
    departureDate: departureDateStr,
    currentLowestPrice,
    historicalMedianPrice,
    predictedPriceRange,
    recommendation: mlResult.recommendation,
    confidenceScore: mlResult.confidenceScore,
    dropProbabilityPercent,
    surgeProbabilityPercent,
    optimalBookingTiming,
    predictionTrackingId: trackedRecord.id,
    optimalBookingWindow: {
      start: optimalStart.toISOString().split('T')[0],
      end: optimalEnd.toISOString().split('T')[0],
      description: `Optimal 25-38 day advance booking window (${optimalStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${optimalEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
    },
    expectedPriceChange: {
      amount: unifiedExpectedDelta,
      percentage: Math.round((unifiedExpectedDelta / currentLowestPrice) * 100),
      direction: unifiedExpectedDirection,
      timeframe: expectedTimeframe,
    },
    factors: {
      daysToDeparture: {
        days: daysToDeparture,
        category: leadTimeCategory,
        impactDescription: leadTimeImpactDesc,
        riskLevel,
      },
      festivalImpact: {
        nearFestival: festivalInfo.nearFestival,
        festivalName: festivalInfo.festivalName,
        daysFromFestival: festivalInfo.daysFromFestival,
        demandMultiplier: festivalInfo.demandMultiplier,
        impactDescription: festivalInfo.impactDescription,
      },
      dayOfWeekImpact: {
        departureDay,
        impactDescription: (departureDay === 'Tuesday' || departureDay === 'Wednesday')
          ? `${departureDay} departures historically cost 8-12% less than weekend flights due to lower business/leisure overlap.`
          : `${departureDay} departures command a 12-20% weekend premium on the Pune-Lucknow sector.`,
      },
      hourlyVolatility: {
        bestBookingHour: '01:00 AM - 05:30 AM IST',
        currentVolatility: daysToDeparture < 10 ? 'High' : 'Moderate',
        trendSummary: 'Intraday tracking reveals airlines release unconfirmed hold inventory between 1 AM and 5 AM IST.',
      },
    },
    aiAnalysisText,
    aiSource,
    forecastPoints,
    mlComparison: mlResult.modelComparison,
    yoyTrends,
  };
}
