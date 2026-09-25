import React from 'react';
import { 
  TrendingDown, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Sparkles, 
  CheckCircle, 
  Bell, 
  ShieldCheck, 
  Zap,
  Info,
  GitCompare,
  Percent,
  CalendarDays,
  Target
} from 'lucide-react';
import { PredictionAnalysis } from '../types';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

interface PredictionHeroProps {
  prediction: PredictionAnalysis;
  onSetAlert: () => void;
  isAlertActive?: boolean;
  onOpenSmartDates?: () => void;
  onOpenModelCompare?: () => void;
  onOpenAudit?: () => void;
  onGenerateAI?: () => void;
  isGeneratingAI?: boolean;
}

export const PredictionHero: React.FC<PredictionHeroProps> = ({
  prediction,
  onSetAlert,
  isAlertActive = false,
  onOpenSmartDates,
  onOpenModelCompare,
  onOpenAudit,
  onGenerateAI,
  isGeneratingAI = false,
}) => {
  const [geminiStatus, setGeminiStatus] = React.useState<{
    totalKeysConfigured: number;
    failoverEnabled: boolean;
    keys: { label: string; configured: boolean; preview: string }[];
  } | null>(null);

  React.useEffect(() => {
    fetch('/api/gemini/status')
      .then((res) => res.json())
      .then((data) => setGeminiStatus(data))
      .catch((err) => console.warn('Failed to fetch gemini status:', err));
  }, []);

  const {
    recommendation,
    confidenceScore,
    currentLowestPrice,
    historicalMedianPrice,
    predictedPriceRange,
    expectedPriceChange,
    optimalBookingWindow,
    factors,
    aiAnalysisText,
    dropProbabilityPercent = 74,
    surgeProbabilityPercent = 26,
    optimalBookingTiming,
    mlComparison,
  } = prediction;

  // Visual styling based on recommendation
  const getBadgeConfig = () => {
    switch (recommendation) {
      case 'BUY_NOW':
        return {
          title: 'BUY NOW — LOWEST EXPECTED FARE',
          subtitle: 'Fares are at a statistical low or about to surge sharply. Waiting carries high price risk.',
          bg: 'bg-emerald-500',
          badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
          icon: <CheckCircle className="h-6 w-6 text-emerald-600" />,
          color: 'text-emerald-700',
        };
      case 'WAIT_AND_WATCH':
        return {
          title: 'WAIT & MONITOR — PRICE DROP EXPECTED',
          subtitle: 'High probability of fare discounts when tactical sales open in the 25-40 day window.',
          bg: 'bg-blue-600',
          badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
          gradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
          icon: <TrendingDown className="h-6 w-6 text-blue-600" />,
          color: 'text-blue-700',
        };
      case 'DROP_IMMINENT':
        return {
          title: 'PRICE DROP IMMINENT — MIDWEEK DIP',
          subtitle: 'Algorithmic midweek seat adjustments active. Watch for short-term discounts in next 48h.',
          bg: 'bg-teal-600',
          badgeBg: 'bg-teal-100 text-teal-800 border-teal-300',
          gradient: 'from-teal-500/10 via-teal-500/5 to-transparent',
          icon: <TrendingDown className="h-6 w-6 text-teal-600" />,
          color: 'text-teal-700',
        };
      case 'PRICE_RISING':
      default:
        return {
          title: 'PRICES RISING RAPIDLY — BOOK SOON',
          subtitle: 'Lead time entered the critical 14-day surge curve. Fare buckets are elevating daily.',
          bg: 'bg-amber-600',
          badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
          gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
          icon: <TrendingUp className="h-6 w-6 text-amber-600" />,
          color: 'text-amber-700',
        };
    }
  };

  const badgeConfig = getBadgeConfig();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      {/* Top Prediction Verdict Banner */}
      <div className={`p-6 bg-gradient-to-r ${badgeConfig.gradient} border-b border-slate-100`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="mt-1 p-2 bg-white rounded-xl shadow-sm border border-slate-200">
              {badgeConfig.icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`text-xs uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border ${badgeConfig.badgeBg}`}>
                  {badgeConfig.title}
                </span>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  {confidenceScore}% Prediction Confidence
                </span>
                {mlComparison && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                    <GitCompare className="h-3 w-3 text-indigo-600" />
                    Ensemble ML Active
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {recommendation === 'BUY_NOW' ? 'Book now to lock lowest price' : 'Hold off: Price drop likely before surge'}
              </h2>
              <p className="text-sm text-slate-600 mt-0.5 max-w-2xl">
                {badgeConfig.subtitle}
              </p>
            </div>
          </div>

          {/* Quick Action & Price Delta Pill */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-xl p-3 text-right">
              <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                Expected Price Movement
              </span>
              <div className="flex items-center justify-end space-x-1.5 mt-0.5">
                {expectedPriceChange.direction === 'decrease' ? (
                  <>
                    <TrendingDown className="h-4 w-4 text-emerald-600" />
                    <span className="text-base font-bold text-emerald-600">
                      -₹{expectedPriceChange.amount.toLocaleString('en-IN')} (-{expectedPriceChange.percentage}%)
                    </span>
                  </>
                ) : expectedPriceChange.direction === 'increase' ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-rose-600" />
                    <span className="text-base font-bold text-rose-600">
                      +₹{expectedPriceChange.amount.toLocaleString('en-IN')} (+{expectedPriceChange.percentage}%)
                    </span>
                  </>
                ) : (
                  <span className="text-base font-bold text-slate-700">Stable (±2%)</span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">{expectedPriceChange.timeframe}</span>
            </div>

            {/* Set Alert Button */}
            <button
              id="hero-track-alert-btn"
              onClick={onSetAlert}
              className={`px-4 py-3 rounded-xl font-semibold text-sm flex items-center space-x-2 shadow-sm transition active:scale-95 ${
                isAlertActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
              }`}
            >
              <Bell className={`h-4 w-4 ${isAlertActive ? 'text-emerald-600' : 'text-white'}`} />
              <span>{isAlertActive ? 'Trip Alert Active' : 'Alert on Optimal Time'}</span>
            </button>
          </div>
        </div>

        {/* 3 Core Predictive Metrics Grid */}
        <div className="mt-5 pt-4 border-t border-slate-200/70 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Core 1: Probability of Price Drop */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Percent className="h-4 w-4 text-emerald-600" />
                Probability of Price Drop
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                dropProbabilityPercent >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {dropProbabilityPercent}% Drop Chance
              </span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${dropProbabilityPercent}%` }}
                />
                <div
                  className="bg-rose-400 h-full transition-all duration-500"
                  style={{ width: `${surgeProbabilityPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>{dropProbabilityPercent}% Drop before flight</span>
                <span>{surgeProbabilityPercent}% Surge risk</span>
              </div>
            </div>
          </div>

          {/* Core 2: Absolute Price Forecast Range (P10 - P50 - P90) */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-blue-600" />
                Absolute Price Range Forecast
              </span>
              <span className="text-xs font-bold text-slate-900 bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                Median: ₹{predictedPriceRange.expected.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Lowest Floor (P10)</span>
                <span className="text-sm font-bold text-emerald-600">₹{predictedPriceRange.min.toLocaleString('en-IN')}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Expected (P50)</span>
                <span className="text-base font-extrabold text-slate-900">₹{predictedPriceRange.expected.toLocaleString('en-IN')}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Peak Ceiling (P90)</span>
                <span className="text-sm font-bold text-rose-600">₹{predictedPriceRange.max.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Core 3: Optimal Booking Timing */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-purple-600" />
                Optimal Booking Day & Time
              </span>
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                {optimalBookingTiming?.bestDayOfWeek || 'Tuesday'}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-sm font-bold text-slate-900">
                {optimalBookingTiming?.bestBookingHour || '01:00 AM - 05:30 AM IST'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                Target date: <strong>{formatDateDDMMYYYY(optimalBookingTiming?.bestCalendarDate || optimalBookingWindow.start)}</strong> (overnight unfreeze)
              </div>
            </div>
          </div>
        </div>

        {/* Feature Actions Toolbar */}
        <div className="mt-4 pt-3 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-600 font-medium">
            AI Engine: Multi-Variable Random Forest + Google Flights Yield Analyzer
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenSmartDates && (
              <button
                onClick={onOpenSmartDates}
                className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-2xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                <span>Smart Date Finder (e.g. Diwali)</span>
              </button>
            )}
            {onOpenModelCompare && (
              <button
                onClick={onOpenModelCompare}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-2xs"
              >
                <GitCompare className="h-3.5 w-3.5 text-indigo-600" />
                <span>Compare ML vs Heuristic</span>
              </button>
            )}
            {onOpenAudit && (
              <button
                onClick={onOpenAudit}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-2xs"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Decision Audit (Ground Truth)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row: Current vs Historical vs Predicted */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100 bg-slate-50/50 border-b border-slate-100 text-center">
        <div className="p-4">
          <span className="text-xs text-slate-500 font-medium block">Current Best Price</span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block">
            ₹{currentLowestPrice.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Live aggregator quote</span>
        </div>

        <div className="p-4">
          <span className="text-xs text-slate-500 font-medium block">Historical 30d Average</span>
          <span className="text-xl sm:text-2xl font-bold text-slate-700 mt-1 block">
            ₹{historicalMedianPrice.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-400">Based on past Google Flights trends</span>
        </div>

        <div className="p-4">
          <span className="text-xs text-slate-500 font-medium block">Predicted Floor / Ceiling</span>
          <span className="text-lg sm:text-xl font-bold text-slate-800 mt-1 block">
            ₹{predictedPriceRange.min.toLocaleString('en-IN')} - ₹{predictedPriceRange.max.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-blue-600 font-medium">Forecast range</span>
        </div>

        <div className="p-4">
          <span className="text-xs text-slate-500 font-medium block">Optimal Booking Window</span>
          <span className="text-sm sm:text-base font-bold text-slate-900 mt-1 block">
            {formatDateDDMMYYYY(optimalBookingWindow.start)} to {formatDateDDMMYYYY(optimalBookingWindow.end)}
          </span>
          <span className="text-[11px] text-purple-600 font-medium">25-38 days prior sweet spot</span>
        </div>
      </div>

      {/* AI Revenue Commentary & Strategic Analysis */}
      {/* AI Revenue Advisory Section with On-Demand Trigger */}
      <div className="p-5 border-b border-slate-100 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-purple-50 text-purple-600 rounded-md">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              AI Flight Revenue Analyst Advisory (Gemini AI)
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            {geminiStatus && (
              <div className="flex items-center space-x-1.5 text-[11px]">
                {prediction.aiSource && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                    prediction.aiSource.source === 'live_gemini'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : prediction.aiSource.source === 'cache'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      prediction.aiSource.source === 'live_gemini'
                        ? 'bg-emerald-500 animate-pulse'
                        : prediction.aiSource.source === 'cache'
                        ? 'bg-blue-500'
                        : 'bg-amber-500'
                    }`}></span>
                    <span>
                      {prediction.aiSource.source === 'live_gemini'
                        ? `Live API (${prediction.aiSource.model || 'Gemini'})`
                        : prediction.aiSource.source === 'cache'
                        ? `Cached (${prediction.aiSource.model || 'Gemini'})`
                        : 'Algorithmic Yield Model'}
                    </span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                  <span>
                    {geminiStatus.failoverEnabled
                      ? 'Dual-Key Active'
                      : geminiStatus.totalKeysConfigured === 1
                      ? '1 Key Active'
                      : 'Awaiting Key in Secrets'}
                  </span>
                </span>
              </div>
            )}

            {onGenerateAI && (
              <button
                onClick={onGenerateAI}
                disabled={isGeneratingAI}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs active:scale-95"
              >
                <Sparkles className={`h-3.5 w-3.5 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                <span>{isGeneratingAI ? 'Running AI Engine...' : 'Run Live AI Advisory'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
          <p className="text-sm text-slate-700 leading-relaxed font-normal">
            {aiAnalysisText || (
              <span className="text-slate-500 italic">
                Algorithmic consensus active. Click &quot;Run Live AI Advisory&quot; to trigger a fresh Gemini deep forecast report.
              </span>
            )}
          </p>
          <div className="mt-2.5 pt-2 border-t border-purple-100/80 flex items-center gap-1.5 text-[11px] text-slate-500 italic">
            <Sparkles className="h-3 w-3 text-purple-500 shrink-0" />
            <span>AI commentary explains the model&apos;s estimate — it is not an independent forecast.</span>
          </div>
        </div>
      </div>

      {/* 4 Factor Cards: Lead Time, Festival, Day of Week, Hourly */}
      <div className="p-5 bg-white">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Price Prediction Factor Breakdown
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Factor 1: Lead Time */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-slate-50 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-600" />
                Days to Departure
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {factors.daysToDeparture.days} Days Left
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-normal">
              {factors.daysToDeparture.impactDescription}
            </p>
          </div>

          {/* Factor 2: Festivals */}
          <div className={`p-3.5 rounded-xl border transition ${
            factors.festivalImpact.nearFestival
              ? 'border-amber-200 bg-amber-50/50'
              : 'border-slate-200/90 bg-slate-50/60'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-600" />
                Festival Multiplier
              </span>
              {factors.festivalImpact.nearFestival ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {factors.festivalImpact.demandMultiplier}x Demand
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-slate-400">Regular</span>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-normal">
              {factors.festivalImpact.impactDescription}
            </p>
          </div>

          {/* Factor 3: Day of Week */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-slate-50 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-indigo-600" />
                Day of Week Pattern
              </span>
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                {factors.dayOfWeekImpact.departureDay}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-normal">
              {factors.dayOfWeekImpact.impactDescription}
            </p>
          </div>

          {/* Factor 4: Hourly Volatility */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-slate-50 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-emerald-600" />
                Best Intraday Hour
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Night Drop
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-normal">
              <strong>{factors.hourlyVolatility.bestBookingHour}:</strong> {factors.hourlyVolatility.trendSummary}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
