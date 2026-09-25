import React, { useState, useEffect } from 'react';
import { RouteAnalyticsReport, InfographicBenchmarkData } from '../types/analytics';
import { 
  TrendingUp, 
  Clock, 
  Calendar, 
  Sun, 
  Plane, 
  X, 
  Sparkles, 
  AlertTriangle,
  Info,
  MapPin,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

interface FareAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeId: string;
}

export const FareAnalyticsModal: React.FC<FareAnalyticsModalProps> = ({
  isOpen,
  onClose,
  routeId,
}) => {
  const [report, setReport] = useState<RouteAnalyticsReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string>(routeId || 'PNQ-LKO');
  const [activeTab, setActiveTab] = useState<'infographic' | 'live_route'>('infographic');

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics(selectedRoute);
    }
  }, [isOpen, selectedRoute]);

  const fetchAnalytics = async (rId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/indices?routeId=${rId}`);
      if (!res.ok) throw new Error('Failed to fetch fare analytics report');
      const data: RouteAnalyticsReport = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err?.message || 'Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const info: InfographicBenchmarkData | undefined = report?.infographic;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-50 border border-slate-300 rounded-3xl w-full max-w-7xl max-h-[94vh] flex flex-col shadow-2xl text-slate-900 overflow-hidden">
        
        {/* Editorial Masthead Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white">
                TOI-DPA Index Model
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Pune (PNQ) ⇄ Lucknow (LKO) Aviation Corridor Intelligence
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mt-1 font-serif">
              Pune ⇄ Lucknow flight price tracker to help you plan trips better
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl mt-1 leading-snug">
              Is there a pattern to how airline ticket prices change between Pune and Lucknow? What factors make the key difference? 
              Is it the time of the day, the day of the week, or how far in advance you&apos;re booking? 
              This index models yield patterns, airline pricing, and booking timing exclusively for the Pune-Lucknow corridor.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {/* View Switcher: Infographic vs Live DB Route */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('infographic')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  activeTab === 'infographic'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Corridor Index Charts
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('live_route')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  activeTab === 'live_route'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Route DB Calibration
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Highlight Callouts Banner */}
        <div className="bg-gradient-to-r from-blue-50 via-amber-50 to-indigo-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded font-black text-rose-800 bg-rose-100 border border-rose-200 text-[10px] uppercase">
              Surge Alert
            </span>
            <span className="font-semibold text-slate-800">
              Return ticket price (Lucknow to Pune) has risen up to +59.5% during festive return rushes
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded font-black text-emerald-800 bg-emerald-100 border border-emerald-200 text-[10px] uppercase">
              Early Booking
            </span>
            <span className="font-semibold text-slate-800">
              Save nearly 48% on Pune-Lucknow flights when booking in the 30 to 90-day advance window
            </span>
          </div>
        </div>

        {/* Scrollable Main Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-slate-500">Loading TOI-DPA fare indexing intelligence...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-600" />
              <p className="font-bold">{error}</p>
            </div>
          ) : activeTab === 'infographic' && info ? (
            <>
              {/* 4 Pillars Grid Matching the Uploaded Newspaper Infographic */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* PILLAR 1: OVERALL INDEX */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* Header */}
                    <div className="bg-blue-600 text-white p-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                          <Plane className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-blue-200">Overall Index</div>
                          <div className="text-xs font-bold leading-tight">HOW PRICES HAVE MOVED SINCE APRIL-END</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-[11px] text-slate-600 leading-snug mb-3">
                        {info.overallIndex.description}
                      </p>

                      {/* All India Chart */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-400">ALL INDIA</span>
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                            +17.1% Overall
                          </span>
                        </div>

                        {/* Line Chart */}
                        <div className="h-32 w-full pt-4">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 240 100" preserveAspectRatio="none">
                            {/* Grid lines */}
                            <line x1="0" y1="80" x2="240" y2="80" stroke="#e2e8f0" strokeDasharray="3,3" />
                            <line x1="0" y1="40" x2="240" y2="40" stroke="#e2e8f0" strokeDasharray="3,3" />

                            {/* Base 100 label */}
                            <text x="5" y="83" fontSize="8" fill="#94a3b8" fontWeight="600">100</text>
                            <text x="5" y="43" fontSize="8" fill="#94a3b8" fontWeight="600">120</text>

                            {/* Area fill */}
                            <polygon
                              points="20,80 70,68 120,56 175,20 220,44 220,95 20,95"
                              fill="rgba(239, 68, 68, 0.1)"
                            />

                            {/* Main Red Line */}
                            <polyline
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points="20,80 70,68 120,56 175,20 220,44"
                            />

                            {/* Points & Labels */}
                            <circle cx="20" cy="80" r="3.5" fill="#ef4444" />
                            <text x="12" y="73" fontSize="8" fontWeight="bold" fill="#ef4444">100</text>

                            <circle cx="70" cy="68" r="3.5" fill="#ef4444" />
                            <text x="60" y="62" fontSize="7.5" fontWeight="bold" fill="#334155">105.8</text>

                            <circle cx="120" cy="56" r="3.5" fill="#ef4444" />
                            <text x="110" y="50" fontSize="7.5" fontWeight="bold" fill="#334155">111.3</text>

                            <circle cx="175" cy="20" r="3.5" fill="#ef4444" />
                            <text x="160" y="14" fontSize="8" fontWeight="bold" fill="#ef4444">128.9</text>

                            <circle cx="220" cy="44" r="4" fill="#b91c1c" />
                            <text x="200" y="38" fontSize="8.5" fontWeight="900" fill="#b91c1c">117.1</text>
                          </svg>
                        </div>

                        {/* X-axis date labels */}
                        <div className="flex justify-between text-[9px] text-slate-500 font-bold px-1 mt-1">
                          <span>Apr 28</span>
                          <span>Jun 16</span>
                          <span>Aug 4</span>
                          <span>Sep 10</span>
                          <span>Sep 21</span>
                        </div>
                        <div className="text-center text-[9px] text-slate-400 font-medium mt-1">
                          April 28 fares = 100
                        </div>
                      </div>

                      {/* Key Routes Grid */}
                      <div>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-2">KEY ROUTES</div>
                        <div className="grid grid-cols-2 gap-2">
                          {info.overallIndex.keyRoutes.map((kr) => (
                            <div key={kr.route} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                              <div className="text-[10px] font-bold text-slate-800 truncate">{kr.route}</div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[9px] text-slate-400">100</span>
                                <span className={`text-[10px] font-black ${
                                  kr.changeNote?.startsWith('+') ? 'text-rose-600' : 'text-emerald-600'
                                }`}>
                                  {kr.points[kr.points.length - 1].value.toFixed(1)}
                                </span>
                              </div>
                              <div className="h-6 w-full mt-1">
                                <svg className="w-full h-full" viewBox="0 0 60 20">
                                  <polyline
                                    fill="none"
                                    stroke={kr.changeNote?.startsWith('+') ? '#ef4444' : '#10b981'}
                                    strokeWidth="1.8"
                                    points={
                                      kr.changeNote?.startsWith('+')
                                        ? "5,16 20,13 40,8 55,3"
                                        : "5,4 20,7 40,11 55,16"
                                    }
                                  />
                                </svg>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footnote */}
                  <div className="bg-slate-50 border-t border-slate-200 p-3 text-[11px] text-slate-600 font-medium leading-snug">
                    {info.overallIndex.insight}
                  </div>
                </div>

                {/* PILLAR 2: WHEN BOOKING WAS DONE */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* Header */}
                    <div className="bg-amber-600 text-white p-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                          <Clock className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-amber-200">When Booking Was Done</div>
                          <div className="text-xs font-bold leading-tight">THE EFFECT OF EARLY BOOKING</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-[11px] text-slate-600 leading-snug mb-3">
                        {info.bookingWindow.description}
                      </p>

                      {/* All India Chart */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-400">ALL INDIA</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Sweet Spot: 30 Days
                          </span>
                        </div>

                        {/* Blue Line Chart */}
                        <div className="h-32 w-full pt-4">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 240 100" preserveAspectRatio="none">
                            <line x1="0" y1="30" x2="240" y2="30" stroke="#e2e8f0" strokeDasharray="3,3" />
                            <line x1="0" y1="70" x2="240" y2="70" stroke="#e2e8f0" strokeDasharray="3,3" />

                            <text x="5" y="33" fontSize="8" fill="#94a3b8" fontWeight="600">100</text>
                            <text x="5" y="73" fontSize="8" fill="#94a3b8" fontWeight="600">80</text>

                            {/* Polygon Area */}
                            <polygon
                              points="20,30 65,55 120,70 175,66 220,60 220,95 20,95"
                              fill="rgba(37, 99, 235, 0.08)"
                            />

                            {/* Polyline */}
                            <polyline
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points="20,30 65,55 120,70 175,66 220,60"
                            />

                            {/* Circles */}
                            <circle cx="20" cy="30" r="3.5" fill="#2563eb" />
                            <text x="12" y="24" fontSize="8" fontWeight="bold" fill="#2563eb">100</text>

                            <circle cx="65" cy="55" r="3.5" fill="#2563eb" />
                            <text x="55" y="49" fontSize="7.5" fontWeight="bold" fill="#334155">88.2</text>

                            <circle cx="120" cy="70" r="4.5" fill="#16a34a" />
                            <text x="110" y="85" fontSize="8" fontWeight="900" fill="#16a34a">80.8</text>

                            <circle cx="175" cy="66" r="3.5" fill="#2563eb" />
                            <text x="165" y="60" fontSize="7.5" fontWeight="bold" fill="#334155">82.7</text>

                            <circle cx="220" cy="60" r="3.5" fill="#2563eb" />
                            <text x="210" y="54" fontSize="7.5" fontWeight="bold" fill="#334155">86.0</text>
                          </svg>
                        </div>

                        <div className="flex justify-between text-[9px] text-slate-500 font-bold px-1 mt-1">
                          <span>1 day</span>
                          <span>3 days</span>
                          <span className="text-emerald-600">30 days</span>
                          <span>60 days</span>
                          <span>90 days</span>
                        </div>
                        <div className="text-center text-[9px] text-slate-400 font-medium mt-1">
                          Same day = 100
                        </div>
                      </div>

                      {/* Key Routes Grid */}
                      <div>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-2">KEY ROUTES</div>
                        <div className="grid grid-cols-2 gap-2">
                          {info.bookingWindow.keyRoutes.map((kr) => (
                            <div key={kr.route} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                              <div className="text-[10px] font-bold text-slate-800 truncate">{kr.route}</div>
                              <div className="flex items-center justify-between mt-1 text-[9px]">
                                <span className="text-slate-400">1d: 100</span>
                                <span className="font-bold text-blue-700">90d: {kr.points[kr.points.length - 1].value}</span>
                              </div>
                              <div className="text-[8px] text-slate-500 truncate mt-0.5 font-medium">
                                {kr.changeNote}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footnote */}
                  <div className="bg-slate-50 border-t border-slate-200 p-3 text-[11px] text-slate-600 font-medium leading-snug">
                    {info.bookingWindow.insight}
                  </div>
                </div>

                {/* PILLAR 3: BY DEPARTURE TIME */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* Header */}
                    <div className="bg-yellow-500 text-slate-950 p-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-white/40 rounded-lg">
                          <Sun className="w-4 h-4 text-slate-900" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-yellow-900">By Departure Time</div>
                          <div className="text-xs font-bold leading-tight">WHEN IN THE DAY DOES IT COST LEAST TO FLY?</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-[11px] text-slate-600 leading-snug mb-3">
                        {info.timeOfDay.description}
                      </p>

                      {/* All India 2-hour bands chart */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-400">ALL INDIA (2-HR BANDS)</span>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            Eve Peak 104
                          </span>
                        </div>

                        {/* Line Chart */}
                        <div className="h-32 w-full pt-4">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 240 100" preserveAspectRatio="none">
                            <line x1="0" y1="35" x2="240" y2="35" stroke="#e2e8f0" strokeDasharray="3,3" />
                            <line x1="0" y1="75" x2="240" y2="75" stroke="#e2e8f0" strokeDasharray="3,3" />

                            <text x="2" y="38" fontSize="7.5" fill="#94a3b8" fontWeight="600">100</text>
                            <text x="2" y="78" fontSize="7.5" fill="#94a3b8" fontWeight="600">85</text>

                            {/* Polyline through 12 bands: 83, 85, 88, 98, 100, 98, 96, 95, 97, 104, 97, 87 */}
                            <polyline
                              fill="none"
                              stroke="#0284c7"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points="
                                10,80 
                                30,75 
                                50,70 
                                70,40 
                                90,35 
                                110,40 
                                130,46 
                                150,48 
                                170,44 
                                190,26 
                                210,44 
                                230,72
                              "
                            />

                            {/* Morning Peak */}
                            <circle cx="90" cy="35" r="3.5" fill="#0284c7" />
                            <text x="82" y="28" fontSize="7.5" fontWeight="bold" fill="#0284c7">100</text>

                            {/* Evening Peak */}
                            <circle cx="190" cy="26" r="3.5" fill="#ea580c" />
                            <text x="180" y="20" fontSize="7.5" fontWeight="bold" fill="#ea580c">104</text>

                            {/* Night Drop */}
                            <circle cx="230" cy="72" r="3.5" fill="#16a34a" />
                            <text x="220" y="85" fontSize="7.5" fontWeight="bold" fill="#16a34a">87</text>
                          </svg>
                        </div>

                        <div className="flex justify-between text-[8px] text-slate-500 font-bold px-0.5 mt-1">
                          <span>0-2</span>
                          <span>4-6</span>
                          <span>8-10</span>
                          <span>12-14</span>
                          <span>16-18</span>
                          <span>20-22</span>
                          <span>22-24</span>
                        </div>
                        <div className="text-center text-[9px] text-slate-400 font-medium mt-1">
                          Morning peak = 100
                        </div>
                      </div>

                      {/* Key Routes Grid */}
                      <div>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-2">KEY ROUTES</div>
                        <div className="grid grid-cols-2 gap-2">
                          {info.timeOfDay.keyRoutes.map((kr) => (
                            <div key={kr.route} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                              <div className="text-[10px] font-bold text-slate-800 truncate">{kr.route}</div>
                              <div className="flex items-center justify-between mt-1 text-[9px] text-slate-500">
                                <span>0-2: {kr.points[0].value}</span>
                                <span>22-24: {kr.points[kr.points.length - 1].value}</span>
                              </div>
                              <div className="text-[8px] text-blue-700 font-semibold truncate mt-0.5">
                                {kr.changeNote}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footnote */}
                  <div className="bg-slate-50 border-t border-slate-200 p-3 text-[11px] text-slate-600 font-medium leading-snug">
                    {info.timeOfDay.insight}
                  </div>
                </div>

                {/* PILLAR 4: BY DAY OF WEEK */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* Header */}
                    <div className="bg-teal-600 text-white p-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                          <Calendar className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-teal-200">By Day Of Week</div>
                          <div className="text-xs font-bold leading-tight">ARE SOME DAYS CHEAPER TO FLY?</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="text-[11px] text-slate-600 leading-snug mb-3">
                        {info.dayOfWeek.description}
                      </p>

                      {/* All India Day-of-Week Chart */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-400">ALL INDIA (MON-SUN)</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Sat Low 89.9
                          </span>
                        </div>

                        {/* Line Chart */}
                        <div className="h-32 w-full pt-4">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 240 100" preserveAspectRatio="none">
                            <line x1="0" y1="40" x2="240" y2="40" stroke="#e2e8f0" strokeDasharray="3,3" />
                            <line x1="0" y1="75" x2="240" y2="75" stroke="#e2e8f0" strokeDasharray="3,3" />

                            <text x="5" y="43" fontSize="8" fill="#94a3b8" fontWeight="600">100</text>
                            <text x="5" y="78" fontSize="8" fill="#94a3b8" fontWeight="600">90</text>

                            {/* Polyline: Mon(100), Tue(90.7), Wed(93.9), Thu(95.6), Fri(102.7), Sat(89.9), Sun(100.9) */}
                            <polyline
                              fill="none"
                              stroke="#0d9488"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points="20,40 55,73 90,62 125,56 160,32 195,76 230,37"
                            />

                            {/* Circles */}
                            <circle cx="20" cy="40" r="3.5" fill="#0d9488" />
                            <text x="12" y="34" fontSize="7.5" fontWeight="bold" fill="#0d9488">100</text>

                            <circle cx="55" cy="73" r="3" fill="#0d9488" />
                            <text x="46" y="87" fontSize="7" fontWeight="bold" fill="#334155">90.7</text>

                            <circle cx="90" cy="62" r="3" fill="#0d9488" />
                            <circle cx="125" cy="56" r="3" fill="#0d9488" />

                            <circle cx="160" cy="32" r="3.5" fill="#e11d48" />
                            <text x="150" y="25" fontSize="7.5" fontWeight="bold" fill="#e11d48">102.7</text>

                            <circle cx="195" cy="76" r="4.5" fill="#16a34a" />
                            <text x="185" y="90" fontSize="8" fontWeight="900" fill="#16a34a">89.9</text>

                            <circle cx="230" cy="37" r="3.5" fill="#0d9488" />
                            <text x="215" y="30" fontSize="7.5" fontWeight="bold" fill="#334155">100.9</text>
                          </svg>
                        </div>

                        <div className="flex justify-between text-[9px] text-slate-500 font-bold px-1 mt-1">
                          <span>Mon</span>
                          <span>Tue</span>
                          <span>Wed</span>
                          <span>Thu</span>
                          <span className="text-rose-600">Fri</span>
                          <span className="text-emerald-600">Sat</span>
                          <span>Sun</span>
                        </div>
                        <div className="text-center text-[9px] text-slate-400 font-medium mt-1">
                          Monday = 100
                        </div>
                      </div>

                      {/* Key Routes Grid */}
                      <div>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-2">KEY ROUTES</div>
                        <div className="grid grid-cols-2 gap-2">
                          {info.dayOfWeek.keyRoutes.map((kr) => (
                            <div key={kr.route} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                              <div className="text-[10px] font-bold text-slate-800 truncate">{kr.route}</div>
                              <div className="text-[8px] text-slate-500 flex justify-between mt-1 font-mono">
                                <span>M: 100</span>
                                <span>F: {kr.points.find(p => p.label === 'F')?.value}</span>
                                <span>S: {kr.points.find(p => p.label === 'S')?.value}</span>
                              </div>
                              <div className="text-[8px] text-teal-700 font-semibold truncate mt-0.5">
                                {kr.changeNote}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footnote */}
                  <div className="bg-slate-50 border-t border-slate-200 p-3 text-[11px] text-slate-600 font-medium leading-snug">
                    {info.dayOfWeek.insight}
                  </div>
                </div>

              </div>

              {/* Bottom Editorial Methodology Banner Matching Infographic */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-xs leading-relaxed text-slate-600">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                    <span className="font-black text-slate-900 uppercase tracking-wide text-xs">
                      About The Pune ⇄ Lucknow TOI-DPA Fare Index
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    Calibrated from <strong>The Times of India</strong> &amp; <strong>Decimal Point Analytics</strong> pricing methodology
                  </div>
                </div>
                <p>
                  This index is calibrated specifically for the <strong>Pune (PNQ) ⇄ Lucknow (LKO)</strong> domestic aviation sector.
                  The index analyzes economy-class airfare data captured daily and hourly from Google Flights and airline reservation systems,
                  tracking fares across multiple booking windows (1, 3, 30, 60, and 90 days before departure), 
                  intraday departure slots, and day-of-week yield profiles across operating carriers (IndiGo, Air India Express, Akasa Air, SpiceJet).
                </p>
                <p className="mt-2 text-slate-500">
                  By tracking the Pune ⇄ Lucknow sector exclusively, the model filters out macro noise and reveals the exact optimal booking sweet spots, 
                  red-eye timing advantages, and holiday yield patterns for travelers flying between Maharashtra and Uttar Pradesh.
                </p>
              </div>
            </>
          ) : (
            /* Live Route DB Calibration Tab */
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Active Database Calibration for Pune ⇄ Lucknow</h3>
                  <p className="text-xs text-slate-500">Inspect real stored fare snapshots collected hourly for this specific sector.</p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-500">Select Direction:</span>
                  <select
                    value={selectedRoute}
                    onChange={(e) => setSelectedRoute(e.target.value)}
                    className="text-xs font-bold bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PNQ-LKO">Pune (PNQ) ➔ Lucknow (LKO) Outbound</option>
                    <option value="LKO-PNQ">Lucknow (LKO) ➔ Pune (PNQ) Inbound Return</option>
                  </select>
                </div>
              </div>

              {report && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Overall Route Index */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Route Historical Daily Baseline</h4>
                    <p className="text-xs text-slate-500 mb-3">{report.overallIndex.insight}</p>
                    <div className="h-40 flex items-end gap-1 pt-4 border-b border-slate-100 pb-2">
                      {report.overallIndex.points.slice(-14).map((pt, idx) => {
                        const heightPct = Math.min(100, Math.max(15, (pt.indexValue / 150) * 100));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                            <div
                              className="w-full rounded-t bg-blue-600 hover:bg-blue-500 transition-all"
                              style={{ height: `${heightPct}%` }}
                            ></div>
                            <div className="absolute -top-7 bg-slate-900 text-white text-[9px] px-2 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                              {pt.date}: ₹{pt.lowestFare.toLocaleString()} (Index {pt.indexValue})
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Route Advance Booking Windows */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Route Advance Booking Curve</h4>
                    <p className="text-xs text-slate-500 mb-3">{report.bookingWindowIndex.insight}</p>
                    <div className="h-40 flex items-end justify-around gap-2 pt-4 border-b border-slate-100 pb-2">
                      {report.bookingWindowIndex.points.map((pt, idx) => {
                        const heightPct = Math.min(100, Math.max(20, (pt.normalizedFareIndex / 140) * 100));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                            <span className="text-[10px] text-slate-500 mb-1">T-{pt.daysBeforeDeparture}d</span>
                            <div
                              className={`w-full rounded-t transition-all ${
                                pt.normalizedFareIndex <= 88 ? 'bg-emerald-500' : 'bg-blue-600'
                              }`}
                              style={{ height: `${heightPct}%` }}
                            ></div>
                            <span className="text-[10px] font-bold text-slate-800 mt-1">{pt.normalizedFareIndex}</span>
                            <div className="absolute -top-7 bg-slate-900 text-white text-[9px] px-2 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                              Avg ₹{pt.averageFare.toLocaleString()} (n={pt.dataPointsCount})
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
