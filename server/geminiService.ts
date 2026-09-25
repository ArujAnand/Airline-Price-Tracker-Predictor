import { GoogleGenAI, Type } from '@google/genai';

interface AIKeyRecord {
  key: string;
  label: string;
  client: GoogleGenAI;
  rateLimitedUntil: number;
  lastUsed: number;
  failureCount: number;
}

export interface CorridorInputData {
  route: string;
  trackingDays: number;
  isPreliminary: boolean;
  totalSnapshots: number;
  earliestDate: string;
  latestDate: string;
  overallPoints: { date: string; minPrice: number; indexValue: number; percentChange: number }[];
  bookingWindows: { window: string; avg: number; count: number; distinctDates: number; status: string }[];
  timeSlots: { slot: string; avg: number; count: number; distinctDates: number; status: string }[];
  dayOfWeek: { day: string; avg: number; count: number; distinctDates: number; status: string }[];
  unobservedDays: string[];
}

export interface CorridorAIAnalysis {
  overallIndexInsight: string;
  bookingWindowInsight: string;
  timeOfDayInsight: string;
  dayOfWeekInsight: string;
  corridorSummary: string;
  keyTakeaways: string[];
  modelUsed: string;
  keyLabel: string;
  generatedAt: string;
}

class GeminiService {
  private keyStore = new Map<string, AIKeyRecord>();
  private cache = new Map<string, { data: any; timestamp: number }>();
  private CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  private getPool(): AIKeyRecord[] {
    const rawSources = [
      { source: 'GEMINI_API_KEY', val: process.env.GEMINI_API_KEY },
      { source: 'GEMINI_API_KEY_SECONDARY', val: process.env.GEMINI_API_KEY_SECONDARY },
      { source: 'GEMINI_API_KEY_2', val: process.env.GEMINI_API_KEY_2 },
    ];

    const foundKeys: { key: string; label: string }[] = [];
    const seen = new Set<string>();

    for (const src of rawSources) {
      if (!src.val) continue;
      const parts = src.val.split(/[\n,;]+/).map((k) => k.trim()).filter((k) => k.length > 5);
      for (const k of parts) {
        if (!seen.has(k)) {
          seen.add(k);
          const label = foundKeys.length === 0 ? 'Primary Key' : `Secondary Key #${foundKeys.length}`;
          foundKeys.push({ key: k, label });
        }
      }
    }

    for (const item of foundKeys) {
      if (!this.keyStore.has(item.key)) {
        this.keyStore.set(item.key, {
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
        this.keyStore.get(item.key)!.label = item.label;
      }
    }

    for (const existingKey of Array.from(this.keyStore.keys())) {
      if (!seen.has(existingKey)) {
        this.keyStore.delete(existingKey);
      }
    }

    const pool = Array.from(this.keyStore.values());
    const now = Date.now();
    // Prioritize keys not in cooldown, then least-recently used (round-robin alternating)
    pool.sort((a, b) => {
      const aCooldown = a.rateLimitedUntil > now ? 1 : 0;
      const bCooldown = b.rateLimitedUntil > now ? 1 : 0;
      if (aCooldown !== bCooldown) return aCooldown - bCooldown;
      return a.lastUsed - b.lastUsed;
    });

    return pool;
  }

  public getPoolStatus() {
    const pool = this.getPool();
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

  /**
   * Generates corridor index analytical insights strictly using Gemini analysis over Firestore data
   */
  public async generateCorridorAnalysis(input: CorridorInputData): Promise<CorridorAIAnalysis> {
    const cacheKey = `corridor-${input.route}-${input.totalSnapshots}-${input.latestDate}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const pool = this.getPool();
    if (pool.length === 0) {
      throw new Error('No Gemini API keys configured in environment.');
    }

    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];

    const prompt = `You are a chief airline pricing econometrician analyzing real domestic corridor pricing data for Pune (PNQ) ⇄ Lucknow (LKO) Aviation Corridor.
Every number provided below comes directly from authentic stored price snapshots in Cloud Firestore.
No synthetic or generic template content is permitted.

INPUT EMPIRICAL DATA:
${JSON.stringify(input, null, 2)}

TASK:
Generate concise, mathematically accurate analytical insight sentences for the 4 dashboard pillars plus an overarching summary and 3 key takeaways.

STRICT GENERATION RULES:
1. Ground every statement directly in the exact provided numbers. State actual snapshot counts (n) and distinct departure dates.
2. Prefix each pillar insight with "Preliminary (${input.trackingDays} tracking days) — " if input.isPreliminary is true.
3. For Booking Window: compare the T-1d average vs T-14d or T-30d averages, citing exact rupee values and percentage differences. If T-1d has 0 or insufficient data, state that T-1d is gathering data. Clarify that snapshot count (n) reflects periodic scraping of scheduled flights rather than independent calendar dates.
4. For Time of Day: compare the lowest departure slot against the peak slot with exact rupee averages and percentage spread.
5. For Day of Week: explicitly state unobserved weekdays (e.g., "${input.unobservedDays.join(', ')}: no departures tracked yet"). Explicitly note which days are observed and clarify that high snapshot count (like Sunday n=408) is repeated monitoring of a single festival date.
6. Provide an overarching "corridorSummary" (2-3 sentences) evaluating current price dynamics on ${input.route}.
7. Provide 3 sharp bullet points in "keyTakeaways".

Return structured JSON matching the schema.`;

    const now = Date.now();
    for (const keyRecord of pool) {
      if (keyRecord.rateLimitedUntil > now && pool.some((k) => k.rateLimitedUntil <= now)) {
        continue;
      }

      for (const modelName of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            keyRecord.lastUsed = Date.now();
            const response = await keyRecord.client.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    overallIndexInsight: { type: Type.STRING },
                    bookingWindowInsight: { type: Type.STRING },
                    timeOfDayInsight: { type: Type.STRING },
                    dayOfWeekInsight: { type: Type.STRING },
                    corridorSummary: { type: Type.STRING },
                    keyTakeaways: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: [
                    'overallIndexInsight',
                    'bookingWindowInsight',
                    'timeOfDayInsight',
                    'dayOfWeekInsight',
                    'corridorSummary',
                    'keyTakeaways',
                  ],
                },
              },
            });

            if (response.text) {
              const parsed = JSON.parse(response.text);
              const result: CorridorAIAnalysis = {
                overallIndexInsight: parsed.overallIndexInsight,
                bookingWindowInsight: parsed.bookingWindowInsight,
                timeOfDayInsight: parsed.timeOfDayInsight,
                dayOfWeekInsight: parsed.dayOfWeekInsight,
                corridorSummary: parsed.corridorSummary,
                keyTakeaways: parsed.keyTakeaways || [],
                modelUsed: modelName,
                keyLabel: keyRecord.label,
                generatedAt: new Date().toISOString(),
              };

              this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
              console.log(`[Gemini Intelligence] Corridor analysis generated via ${keyRecord.label} (${modelName})`);
              return result;
            }
          } catch (err: any) {
            const statusStr = String(err?.status || '');
            const msgStr = String(err?.message || '');
            const is429 = statusStr === '429' || msgStr.includes('429') || msgStr.toLowerCase().includes('resource has been exhausted');
            const is503 = statusStr === '503' || msgStr.includes('503') || msgStr.toLowerCase().includes('unavailable') || msgStr.toLowerCase().includes('high demand');

            if (is429) {
              console.warn(`[Gemini] ${keyRecord.label} hit rate limit (429). Failing over to alternative key.`);
              keyRecord.rateLimitedUntil = Date.now() + 45 * 1000;
              break; // break to next keyRecord
            }

            if (is503 && attempt === 0) {
              await new Promise((r) => setTimeout(r, 400));
              continue;
            }
            break; // next model
          }
        }
      }
    }

    throw new Error('All Gemini keys in pool encountered rate limits or service unavailability.');
  }

  /**
   * Generates AI revenue management prediction advisory for flight price prediction
   */
  public async generatePredictionAdvisory(prompt: string): Promise<{ text: string; model: string; keyLabel: string }> {
    const pool = this.getPool();
    if (pool.length === 0) {
      throw new Error('No Gemini API keys configured.');
    }

    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];

    const now = Date.now();
    for (const keyRecord of pool) {
      if (keyRecord.rateLimitedUntil > now && pool.some((k) => k.rateLimitedUntil <= now)) {
        continue;
      }

      for (const modelName of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            keyRecord.lastUsed = Date.now();
            const response = await keyRecord.client.models.generateContent({
              model: modelName,
              contents: prompt,
            });

            if (response.text) {
              return {
                text: response.text.trim(),
                model: modelName,
                keyLabel: keyRecord.label,
              };
            }
          } catch (err: any) {
            const statusStr = String(err?.status || '');
            const msgStr = String(err?.message || '');
            if (statusStr === '429' || msgStr.includes('429')) {
              keyRecord.rateLimitedUntil = Date.now() + 45 * 1000;
              break;
            }
            if ((statusStr === '503' || msgStr.includes('503')) && attempt === 0) {
              await new Promise((r) => setTimeout(r, 400));
              continue;
            }
            break;
          }
        }
      }
    }

    throw new Error('Failed to generate prediction advisory across all Gemini keys.');
  }
}

export const geminiService = new GeminiService();
