import React from 'react';
import { AppNotification } from '../types';
import { X, Bell, Check, TrendingDown, Sparkles, AlertCircle, Info } from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onTriggerTestAlert: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onTriggerTestAlert,
}) => {
  if (!isOpen) return null;

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'PRICE_DROP':
        return <TrendingDown className="h-4 w-4 text-emerald-600" />;
      case 'OPTIMAL_BUY':
        return <Sparkles className="h-4 w-4 text-purple-600" />;
      case 'SURGE_WARNING':
        return <AlertCircle className="h-4 w-4 text-rose-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-bold">Flight Alert Notification Center</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
          <button
            onClick={onTriggerTestAlert}
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            + Send Test Alert
          </button>
          <button
            onClick={onMarkAllAsRead}
            className="text-slate-500 hover:text-slate-700 flex items-center space-x-1"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Mark all read</span>
          </button>
        </div>

        {/* Notifications List */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No new alerts right now. Track a flight to receive price drop alerts.
            </div>
          ) : (
            notifications.map((n) => {
              const d = new Date(n.timestamp);
              const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

              return (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border transition ${
                    !n.read ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-white border border-slate-200 shadow-xs">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{n.title}</span>
                        <span className="text-[10px] text-slate-400">{dateStr} {timeStr}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-normal">{n.body}</p>
                      {n.priceDelta && (
                        <div className="text-[11px] font-bold text-emerald-600 mt-1">
                          Savings: ₹{Math.abs(n.priceDelta).toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
