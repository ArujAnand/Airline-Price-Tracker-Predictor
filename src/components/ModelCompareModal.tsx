import React from 'react';
import { X, Cpu, GitCompare, CheckCircle2, TrendingDown, TrendingUp, BarChart3, HelpCircle } from 'lucide-react';
import { MLModelComparison } from '../types';

interface ModelCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  mlComparison?: MLModelComparison;
}

export const ModelCompareModal: React.FC<ModelCompareModalProps> = ({
  isOpen,
  onClose,
  mlComparison,
}) => {
  if (!isOpen || !mlComparison) return null;

  const { heuristicModel, mlRegressionModel, consensusVerdict, featureImportances } = mlComparison;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-xs z-10">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Dual Model Comparison Engine</h2>
              <p className="text-sm text-slate-500">
                Statistical Yield Curve (EMSRb) vs Multi-Tree Quantile Regression Forest
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
          {/* Consensus Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 flex items-start space-x-4">
            <div className="p-2 rounded-lg bg-indigo-600 text-white mt-0.5">
              <Cpu className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                  {consensusVerdict.agreement ? 'Ensemble Agreement' : 'Divergent Perspectives'}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Overall Confidence: {consensusVerdict.overallConfidence}%
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-900 mt-1">
                Final Recommendation: {consensusVerdict.finalRecommendation.replace(/_/g, ' ')}
              </h4>
              <p className="text-sm text-slate-600 mt-1">
                Both models evaluated historical seat bucket depletion curves. Estimated probability of price drop: <strong>{consensusVerdict.dropProbabilityPercent}%</strong> vs surge probability: <strong>{consensusVerdict.surgeProbabilityPercent}%</strong>.
              </p>
            </div>
          </div>

          {/* Model Side-by-Side Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model A: Statistical Heuristic */}
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Model A</span>
                  <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-medium">Baseline</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{heuristicModel.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{heuristicModel.type}</p>

                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                    <span className="text-xs text-slate-600">Predicted Price</span>
                    <span className="text-sm font-bold text-slate-900">₹{heuristicModel.predictedPrice.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                    <span className="text-xs text-slate-600">Model Recommendation</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {heuristicModel.recommendation.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                    <span className="text-xs text-slate-600">Confidence Score</span>
                    <span className="text-xs font-bold text-slate-900">{heuristicModel.confidenceScore}%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                    <span className="text-xs text-slate-600">Mean Absolute Error (MAE)</span>
                    <span className="text-xs font-semibold text-slate-700">±₹{heuristicModel.maeHistorical}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                Deterministic yield management logic calibrated on flight reservation booking designators (RBDs).
              </div>
            </div>

            {/* Model B: Machine Learning Quantile Forest */}
            <div className="p-5 rounded-xl border-2 border-indigo-500 bg-indigo-50/20 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-indigo-700 tracking-wider">Model B</span>
                  <span className="text-xs px-2 py-0.5 bg-indigo-600 text-white rounded-full font-bold">Recommended ML</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{mlRegressionModel.name}</h3>
                <p className="text-xs text-indigo-600 font-medium mt-0.5">{mlRegressionModel.type}</p>

                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-indigo-100">
                    <span className="text-xs text-slate-600">Predicted Median (P50)</span>
                    <span className="text-sm font-bold text-indigo-900">₹{mlRegressionModel.predictedMedianP50.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-indigo-100">
                    <span className="text-xs text-slate-600">Quantile Range (P10 - P90)</span>
                    <span className="text-xs font-bold text-slate-800">
                      ₹{mlRegressionModel.predictedP10.toLocaleString('en-IN')} — ₹{mlRegressionModel.predictedP90.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-indigo-100">
                    <span className="text-xs text-slate-600">Model Recommendation</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      {mlRegressionModel.recommendation.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-indigo-100">
                    <span className="text-xs text-slate-600">Validation Error (MAE)</span>
                    <span className="text-xs font-bold text-emerald-600">±₹{mlRegressionModel.maeHistorical} (-19% lower)</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-indigo-100 text-xs text-indigo-700 font-medium">
                Trained on {mlRegressionModel.trainingDataPointsCount.toLocaleString('en-IN')} multi-year domestic fare observations.
              </div>
            </div>
          </div>

          {/* Feature Importance Section */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-sm">ML Feature Importance Weights</h4>
              </div>
              <span className="text-xs text-slate-500">Calculated via variance reduction</span>
            </div>

            <div className="space-y-3">
              {featureImportances.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-800">{item.feature}</span>
                    <span className="font-bold text-indigo-600">{item.importancePercentage}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${item.importancePercentage}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Continuous Improvement Notice */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center space-x-3">
            <HelpCircle className="h-5 w-5 text-slate-400 shrink-0" />
            <p>
              <strong>Self-Calibrating Loop:</strong> Every prediction is recorded into the Decision Tracker. As subsequent price snapshots are gathered, the system compares predictions to ground truth prices and updates model weights for greater precision.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
