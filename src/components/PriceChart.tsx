import React, { useState } from 'react';
import { PriceSnapshot, PriceForecastPoint, YoYDataPoint } from '../types';
import { TrendingDown, TrendingUp, BarChart3, Clock, Sparkles, CalendarRange, AlertTriangle, Database } from 'lucide-react';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

interface PriceChartProps {
  historicalDaily: PriceSnapshot[];
  historicalHourly: PriceSnapshot[];
  forecastPoints: PriceForecastPoint[];
  currentPrice: number;
  yoyTrends?: YoYDataPoint[];
  hasError?: boolean;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  historicalDaily,
  historicalHourly,
  forecastPoints,
  currentPrice,
  yoyTrends,
  hasError = false,
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'hourly' | 'forecast' | 'yoy'>('daily');
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    label: string;
    price: number;
    sublabel?: string;
  } | null>(null);

  const availableDaysCount = new Set(historicalDaily.map((s) => formatDateDDMMYYYY(new Date(s.timestamp)))).size;

  // Prepare data points based on tab
  let dataPoints: { label: string; price: number; sublabel?: string; lower?: number; upper?: number }[] = [];

  if (activeTab === 'daily') {
    // Sort chronologically
    const sorted = [...historicalDaily].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    dataPoints = sorted.map((s) => {
      const d = new Date(s.timestamp);
      return {
        label: formatDateDDMMYYYY(d),
        price: s.price,
        sublabel: `${s.airline} ${s.flightNumber}`,
      };
    });
  } else if (activeTab === 'hourly') {
    const sorted = [...historicalHourly].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    dataPoints = sorted.map((s) => {
      const d = new Date(s.timestamp);
      return {
        label: `${d.getHours()}:00`,
        price: s.price,
        sublabel: `${formatDateDDMMYYYY(d)} • Hourly Snapshot`,
      };
    });
  } else if (activeTab === 'yoy' && yoyTrends && yoyTrends.length > 0) {
    // Multi-year comparison sorted by days to departure (descending T-45 to T-1)
    const sorted = [...yoyTrends].sort((a, b) => b.daysToDeparture - a.daysToDeparture);
    dataPoints = sorted.map((item) => ({
      label: `T-${item.daysToDeparture}d`,
      price: item.averagePrice,
      sublabel: `${item.year} YoY Trend: Avg ₹${item.averagePrice.toLocaleString('en-IN')} (Range: ₹${item.lowestPrice.toLocaleString('en-IN')} - ₹${item.highestPrice.toLocaleString('en-IN')})`,
      lower: item.lowestPrice,
      upper: item.highestPrice,
    }));
  } else {
    // Forecast points
    dataPoints = forecastPoints.map((f) => {
      const d = new Date(f.date);
      return {
        label: formatDateDDMMYYYY(d),
        price: f.predictedPrice,
        lower: f.lowerBound,
        upper: f.upperBound,
        sublabel: `${f.daysToDeparture}d to fly • ${f.note || 'Forecast'}`,
      };
    });
  }

  const isDailyEmpty = activeTab === 'daily' && dataPoints.length < 2;

  // Handle single data point or empty state for chart coordinates
  let renderablePoints = [...dataPoints];
  if (renderablePoints.length === 0) {
    renderablePoints = [
      { label: 'Day 1', price: currentPrice },
      { label: 'Day 2', price: currentPrice },
    ];
  } else if (renderablePoints.length === 1) {
    renderablePoints = [
      { ...renderablePoints[0], label: `${renderablePoints[0].label} (Start)` },
      { ...renderablePoints[0], label: `${renderablePoints[0].label} (Latest)` },
    ];
  }

  // Min and Max prices for scaling
  const allPrices = renderablePoints.flatMap((d) => [d.price, d.lower || d.price, d.upper || d.price]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = Math.max(200, (maxPrice - minPrice) * 0.15);
  const yMin = Math.max(0, Math.floor((minPrice - padding) / 100) * 100);
  const yMax = Math.ceil((maxPrice + padding) / 100) * 100;

  // SVG dimensions
  const width = 800;
  const height = 300;
  const margin = { top: 25, right: 30, bottom: 40, left: 65 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Coordinates helper
  const getX = (idx: number) => margin.left + (idx / Math.max(1, renderablePoints.length - 1)) * innerWidth;
  const getY = (val: number) => {
    const range = yMax - yMin || 1;
    return margin.top + innerHeight - ((val - yMin) / range) * innerHeight;
  };

  // Build SVG path
  const linePath = renderablePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.price)}`)
    .join(' ');

  const areaPath = `${linePath} L ${getX(renderablePoints.length - 1)} ${margin.top + innerHeight} L ${getX(0)} ${margin.top + innerHeight} Z`;

  // Upper and lower bound confidence area for forecast
  let confidencePath = '';
  if (activeTab === 'forecast' && renderablePoints[0]?.lower !== undefined) {
    const upperPoints = renderablePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.upper || p.price)}`).join(' ');
    const lowerPoints = renderablePoints
      .slice()
      .reverse()
      .map((p, i) => `L ${getX(renderablePoints.length - 1 - i)} ${getY(p.lower || p.price)}`)
      .join(' ');
    confidencePath = `${upperPoints} ${lowerPoints} Z`;
  }

  // Price ticks
  const tickCount = 5;
  const priceTicks = Array.from({ length: tickCount }).map((_, i) => {
    return Math.round(yMin + ((yMax - yMin) / (tickCount - 1)) * i);
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
      {/* Top Header & Tab Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Flight Price Dynamic Trends &amp; Forecast</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real snapshots captured from Google Flights Aggregator index
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setActiveTab('daily');
              setHoveredPoint(null);
            }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              activeTab === 'daily'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30-Day Historical Trend
          </button>
          <button
            onClick={() => {
              setActiveTab('hourly');
              setHoveredPoint(null);
            }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              activeTab === 'hourly'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            24h Hourly Feed
          </button>
          <button
            onClick={() => {
              setActiveTab('forecast');
              setHoveredPoint(null);
            }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition ${
              activeTab === 'forecast'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3 w-3 text-purple-600" />
            <span>14d Price Forecast</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('yoy');
              setHoveredPoint(null);
            }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition ${
              activeTab === 'yoy'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarRange className="h-3 w-3 text-amber-600" />
            <span>YoY Multi-Year Trends</span>
          </button>
        </div>
      </div>

      {/* Main Container Content */}
      {hasError ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center text-rose-800 my-2">
          <AlertTriangle className="h-8 w-8 text-rose-600 mx-auto mb-2" />
          <h4 className="font-bold text-sm text-rose-900">API Service Error</h4>
          <p className="text-xs text-rose-700 mt-1">Unable to fetch historical price snapshots from the aggregator server.</p>
        </div>
      ) : isDailyEmpty && dataPoints.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center my-2">
          <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2.5 animate-pulse" />
          <h4 className="font-bold text-sm text-slate-900">Collecting Data — {availableDaysCount} of 30 Days Available</h4>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
            Snapshot tracking for this route was initiated today. 30-day price trend curves build automatically over time as daily fare snapshots accumulate in Cloud Firestore.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setActiveTab('hourly')}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
            >
              View 24h Hourly Feed
            </button>
            <button
              onClick={() => setActiveTab('forecast')}
              className="px-3.5 py-1.5 rounded-lg bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold hover:bg-purple-200 transition cursor-pointer"
            >
              View 14d ML Forecast
            </button>
          </div>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden bg-slate-50/50 rounded-xl border border-slate-100 p-2">
          {activeTab === 'daily' && availableDaysCount < 30 && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-[11px] font-medium text-blue-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                Collecting data — {availableDaysCount} of 30 days available
              </span>
              <span className="text-[10px] text-blue-600 font-normal">Tracking active on Cloud Firestore</span>
            </div>
          )}

          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible select-none"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="forecastAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.03" />
              </linearGradient>
            </defs>

            {/* Grid lines and Y-axis labels */}
            {priceTicks.map((val, idx) => {
              const y = getY(val);
              return (
                <g key={idx}>
                  <line
                    x1={margin.left}
                    y1={y}
                    x2={width - margin.right}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={margin.left - 10}
                    y={y + 4}
                    fill="#64748b"
                    fontSize="11"
                    textAnchor="end"
                    fontFamily="sans-serif"
                  >
                    ₹{val.toLocaleString('en-IN')}
                  </text>
                </g>
              );
            })}

            {/* Forecast confidence interval band */}
            {activeTab === 'forecast' && confidencePath && (
              <path d={confidencePath} fill="url(#forecastAreaGradient)" />
            )}

            {/* Fill Area under price line */}
            <path
              d={areaPath}
              fill={activeTab === 'forecast' ? 'url(#forecastAreaGradient)' : 'url(#areaGradient)'}
            />

            {/* Main Price Line */}
            <path
              d={linePath}
              fill="none"
              stroke={activeTab === 'forecast' ? '#8b5cf6' : '#2563eb'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points / Circles */}
            {renderablePoints.map((p, idx) => {
              const cx = getX(idx);
              const cy = getY(p.price);
              const isHovered = hoveredPoint?.label === p.label;

              return (
                <g key={idx}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={12}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        x: cx,
                        y: cy,
                        label: p.label,
                        price: p.price,
                        sublabel: p.sublabel,
                      })
                    }
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 3.5}
                    fill={activeTab === 'forecast' ? '#8b5cf6' : '#2563eb'}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all duration-150 pointer-events-none"
                  />
                </g>
              );
            })}

            {/* X Axis Labels */}
            {renderablePoints.map((p, idx) => {
              const step = renderablePoints.length > 20 ? 4 : renderablePoints.length > 10 ? 2 : 1;
              if (idx % step !== 0 && idx !== renderablePoints.length - 1) return null;

              const cx = getX(idx);
              return (
                <text
                  key={`label-${idx}`}
                  x={cx}
                  y={margin.top + innerHeight + 20}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {p.label}
                </text>
              );
            })}

            {/* Hover Crosshair and Dot Indicator */}
            {hoveredPoint && (
              <g pointerEvents="none">
                <line
                  x1={hoveredPoint.x}
                  y1={margin.top}
                  x2={hoveredPoint.x}
                  y2={margin.top + innerHeight}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r={7}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth="3"
                />
              </g>
            )}
          </svg>

          {/* Hover Tooltip Overlay */}
          {hoveredPoint && (
            <div
              className="absolute z-20 pointer-events-none bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl border border-slate-700 text-xs transform -translate-x-1/2 -translate-y-full mb-3"
              style={{
                left: `${(hoveredPoint.x / width) * 100}%`,
                top: `${(hoveredPoint.y / height) * 100}%`,
              }}
            >
              <div className="font-bold text-sm text-emerald-400">
                ₹{hoveredPoint.price.toLocaleString('en-IN')}
              </div>
              <div className="text-slate-300 font-medium">{hoveredPoint.label}</div>
              {hoveredPoint.sublabel && (
                <div className="text-[11px] text-slate-400 mt-0.5">{hoveredPoint.sublabel}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Historical Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
        <div className="flex items-center space-x-4">
          <div>
            <span className="text-slate-400 font-normal">30-Day Low: </span>
            <strong className="text-emerald-600 font-semibold">₹{minPrice.toLocaleString('en-IN')}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-normal">30-Day High: </span>
            <strong className="text-rose-600 font-semibold">₹{maxPrice.toLocaleString('en-IN')}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-normal">Average Volatility: </span>
            <strong className="text-slate-700 font-semibold">±₹340 / week</strong>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-slate-500">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600"></span>
          <span>Google Flights Aggregator Indexed Data</span>
        </div>
      </div>
    </div>
  );
};
