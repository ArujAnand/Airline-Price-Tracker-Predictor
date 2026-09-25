import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Coins, 
  FileText 
} from 'lucide-react';
import { PredictionAuditSummary, TrackedPredictionRecord } from '../types';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

interface PredictionAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PredictionAuditModal: React.FC<PredictionAuditModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [auditSummary, setAuditSummary] = useState<PredictionAuditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/predictions/audit');
      if (res.ok) {
        const data: PredictionAuditSummary = await res.json();
        setAuditSummary(data);
      }
    } catch (err) {
      console.error('Failed to fetch audit data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAuditVerification = async () => {
    setRunningAudit(true);
    try {
      const res = await fetch('/api/predictions/audit/run', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          setAuditSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to run audit:', err);
    } finally {
      setRunningAudit(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAuditData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Decision Tracking & Ground Truth Audit</h2>
              <p className="text-sm text-slate-500">
                Comparing algorithmic price predictions against actual recorded flight fare outcomes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Summary KPIs */}
          {auditSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700">Verification Signal</span>
                  <Percent className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-lg font-black text-emerald-900 mt-1">
                  {auditSummary.verifiedCount < 20 ? `Early signal (n=${auditSummary.verifiedCount})` : `${auditSummary.overallAccuracyRate}%`}
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                  {auditSummary.verifiedCount < 20 ? `Need ${20 - auditSummary.verifiedCount} more verified outcomes (${auditSummary.pendingCount} currently tracking)` : `${auditSummary.verifiedCount} verified decisions`}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-700">Traveler Savings</span>
                  <Coins className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-blue-900 mt-1">
                  ₹{auditSummary.totalTravelerSavingsRealizedINR.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-blue-700 mt-0.5 font-medium">
                  Direct fare savings realized
                </div>
              </div>

              <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-700">Real Verified (n)</span>
                  <ShieldCheck className="h-4 w-4 text-purple-600" />
                </div>
                <div className="text-2xl font-black text-purple-900 mt-1">
                  n = {auditSummary.verifiedCount}
                </div>
                <div className="text-[11px] text-purple-700 mt-0.5 font-medium">
                  {auditSummary.verifiedCount >= 20 ? 'Statistically significant sample' : `Need ${20 - auditSummary.verifiedCount} more verified outcomes (${auditSummary.pendingCount} currently tracking, more needed)`}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Active Monitoring</span>
                  <Clock className="h-4 w-4 text-slate-500" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {auditSummary.pendingCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                  Pending departure dates
                </div>
              </div>
            </div>
          )}

          {/* Scientific Transparency: Real vs Synthetic sample size banner */}
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Real Ground-Truth Verification Notice (N-Count Tracking):</span>
                <p className="mt-0.5 text-amber-800 text-[11px] leading-relaxed">
                  Real verified predictions: <span className="font-bold">{auditSummary?.verifiedCount || 0}</span> ({(auditSummary?.verifiedCount || 0) >= 20 ? 'statistically significant sample size n >= 20' : `not yet significant — need ${20 - (auditSummary?.verifiedCount || 0)} more verified outcomes (${auditSummary?.pendingCount || 0} currently tracking, more will be needed as they resolve)`}). Synthetic testbed dataset size: <span className="font-bold">12,096 points</span>. Backtest metrics on synthetic data are flagged as benchmark references only and are not treated as true live operational accuracy until verified real flights accumulate.
                </p>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Continuous Self-Calibrating Feedback</h4>
              <p className="text-xs text-slate-500">
                Each flight recommendation is verified against actual prices collected hourly by the aggregator.
              </p>
            </div>
            <button
              onClick={handleRunAuditVerification}
              disabled={runningAudit}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${runningAudit ? 'animate-spin' : ''}`} />
              <span>{runningAudit ? 'Auditing Live Fares...' : 'Verify Ground Truth Now'}</span>
            </button>
          </div>

          {/* Table of Tracked Decisions */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
              Audited Decision Records & Actual Price Outcomes:
            </h4>

            {auditSummary?.recentRecords && auditSummary.recentRecords.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Route & Departure</th>
                        <th className="p-3">Lead Time</th>
                        <th className="p-3">Initial Fare</th>
                        <th className="p-3">Decision Given</th>
                        <th className="p-3">Actual Lowest Observed</th>
                        <th className="p-3">Outcome Status</th>
                        <th className="p-3">Realized Savings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {auditSummary.recentRecords.map((record) => {
                        const isVerified = record.status === 'VERIFIED_CORRECT';
                        const isPending = record.status === 'PENDING_VERIFICATION';

                        return (
                          <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{record.routeId}</div>
                              <div className="text-[11px] text-slate-500">{formatDateDDMMYYYY(record.departureDate)}</div>
                              {record.flightGroupId && (
                                <div className="text-[9px] font-mono text-slate-400 mt-0.5 truncate max-w-[130px]" title={record.flightGroupId}>
                                  {record.flightGroupId}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {record.daysToDeparture !== undefined ? `${record.daysToDeparture}d out` : 'Live'}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-slate-800">
                              ₹{record.initialPriceAtPrediction.toLocaleString('en-IN')}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  record.recommendationGiven === 'BUY_NOW'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {record.recommendationGiven.replace(/_/g, ' ')}
                              </span>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {record.dropProbability}% drop prob
                              </div>
                            </td>
                            <td className="p-3 font-bold text-slate-900">
                              {record.actualLowestPriceObserved ? (
                                <span>₹{record.actualLowestPriceObserved.toLocaleString('en-IN')}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              {isVerified ? (
                                <span className="inline-flex items-center text-emerald-700 font-bold space-x-1">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Verified Correct</span>
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center text-amber-700 font-medium space-x-1">
                                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                                  <span>Tracking Live</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-rose-700 font-medium space-x-1">
                                  <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                                  <span>Calibrated</span>
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {record.actualSavingsOrLossINR && record.actualSavingsOrLossINR > 0 ? (
                                <span className="font-bold text-emerald-600">
                                  +₹{record.actualSavingsOrLossINR.toLocaleString('en-IN')}
                                </span>
                              ) : isPending ? (
                                <span className="text-slate-400">Monitoring...</span>
                              ) : (
                                <span className="text-slate-500">Neutral</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                No prediction audit records logged yet. Predictions will automatically record here upon generation.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors"
          >
            Close Audit Log
          </button>
        </div>
      </div>
    </div>
  );
};
