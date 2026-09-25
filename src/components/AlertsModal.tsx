import React, { useState } from 'react';
import { TrackedTripAlert } from '../types';
import { X, Bell, Trash2, Plus, Sparkles, CheckCircle, BellRing, AlertCircle } from 'lucide-react';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

interface AlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: TrackedTripAlert[];
  currentRoute: { origin: string; destination: string; departureDate: string };
  currentPrice: number;
  onSaveAlert: (alertData: {
    origin: string;
    destination: string;
    departureDate: string;
    targetPrice: number;
    alertOnOptimalBuy: boolean;
    alertOnPriceDrop: boolean;
  }) => void;
  onDeleteAlert: (id: string) => void;
  onTriggerTestAlert: () => void;
}

export const AlertsModal: React.FC<AlertsModalProps> = ({
  isOpen,
  onClose,
  alerts,
  currentRoute,
  currentPrice,
  onSaveAlert,
  onDeleteAlert,
  onTriggerTestAlert,
}) => {
  const [targetPrice, setTargetPrice] = useState<number>(Math.round(currentPrice * 0.9));
  const [alertOnOptimalBuy, setAlertOnOptimalBuy] = useState<boolean>(true);
  const [alertOnPriceDrop, setAlertOnPriceDrop] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAlert({
      origin: currentRoute.origin,
      destination: currentRoute.destination,
      departureDate: currentRoute.departureDate,
      targetPrice,
      alertOnOptimalBuy,
      alertOnPriceDrop,
    });
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Tracked Trip Price Alerts</h2>
              <p className="text-xs text-slate-400">
                Automated push alerts when fares drop or optimal booking window opens
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Quick Test Alert Banner */}
          <div className="mb-4 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BellRing className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="text-xs text-blue-900">
                <strong>Test Push Notifications:</strong> Trigger a live simulated price drop alert.
              </div>
            </div>
            <button
              onClick={onTriggerTestAlert}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition shrink-0 ml-2"
            >
              Test Now
            </button>
          </div>

          {/* Add alert for current route card */}
          {!showAddForm ? (
            <div className="mb-5 p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Track {currentRoute.origin} → {currentRoute.destination}
                </span>
                <span className="text-xs text-slate-500">
                  Departure: {formatDateDDMMYYYY(currentRoute.departureDate)} • Current best: ₹{currentPrice.toLocaleString('en-IN')}
                </span>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-slate-900 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center space-x-1.5 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Set Alert</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mb-5 p-4 rounded-xl border border-blue-200 bg-blue-50/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-blue-900">
                  Configure Alert for {currentRoute.origin} → {currentRoute.destination} ({formatDateDDMMYYYY(currentRoute.departureDate)})
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Price (Alert if fare drops below)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(Number(e.target.value))}
                    step="50"
                    min="1000"
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                  />
                </div>
                <div className="flex items-center space-x-2 mt-1.5 text-[11px] text-slate-500">
                  <span>Suggested targets:</span>
                  <button
                    type="button"
                    onClick={() => setTargetPrice(Math.round(currentPrice * 0.95))}
                    className="text-blue-600 hover:underline"
                  >
                    -5% (₹{Math.round(currentPrice * 0.95)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetPrice(Math.round(currentPrice * 0.88))}
                    className="text-blue-600 hover:underline"
                  >
                    -12% (₹{Math.round(currentPrice * 0.88)})
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-3 text-xs text-slate-700">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertOnOptimalBuy}
                    onChange={(e) => setAlertOnOptimalBuy(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Alert when algorithm detects <strong>Optimal Buy Window</strong></span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertOnPriceDrop}
                    onChange={(e) => setAlertOnPriceDrop(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Alert on any sudden price drop (&gt; 5%)</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg shadow-sm transition"
              >
                Save &amp; Start Monitoring
              </button>
            </form>
          )}

          {/* Active Alerts List */}
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
            Active Monitored Trips ({alerts.length})
          </h3>

          {alerts.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              No active trip alerts. Track a flight above to receive real-time push alerts.
            </div>
          ) : (
            <div className="space-y-2.5">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-900">
                        {alert.origin} → {alert.destination}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        alert.status === 'FIRED'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : alert.status === 'TRIGGERED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {alert.status === 'FIRED' ? `FIRED (${alert.conditionFired || 'OPTIMAL_BUY'})` : alert.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1">
                      Depart: {formatDateDDMMYYYY(alert.departureDate)} • Target: <strong className="text-slate-800">₹{alert.targetPrice.toLocaleString('en-IN')}</strong> (Current: ₹{alert.currentLowestPrice.toLocaleString('en-IN')})
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteAlert(alert.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Remove alert"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
