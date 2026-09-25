import React, { useState } from 'react';
import { Plane, RefreshCw, Bell, BellRing, Database, Calendar, CheckCircle2, AlertCircle, BarChart3 } from 'lucide-react';
import { AggregatorStatus, AppNotification } from '../types';
import { requestNotificationPermission, getNotificationPermission, sendBrowserPushNotification } from '../utils/notifications';

interface HeaderProps {
  aggregatorStatus: AggregatorStatus | null;
  isSyncing: boolean;
  onSyncNow: () => void;
  notifications: AppNotification[];
  onOpenNotifications: () => void;
  onOpenAggregator: () => void;
  onOpenFestivals: () => void;
  onOpenFareAnalytics: () => void;
  onTriggerTestAlert: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  aggregatorStatus,
  isSyncing,
  onSyncNow,
  notifications,
  onOpenNotifications,
  onOpenAggregator,
  onOpenFestivals,
  onOpenFareAnalytics,
  onTriggerTestAlert,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>(getNotificationPermission());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleEnablePush = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      sendBrowserPushNotification('🔔 SkyCast Push Alerts Activated', {
        body: 'You will receive immediate notifications when flight prices drop or enter the optimal buy window.',
        isOptimalBuy: true,
      });
      showToast('Push Notifications enabled successfully!');
    } else {
      showToast('Notifications blocked in browser settings. In-app alerts remain active.');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleTestAlertClick = () => {
    onTriggerTestAlert();
    showToast('Sent test flight price alert!');
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Subtitle */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Plane className="h-6 w-6 text-white transform -rotate-45" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-white">SkyCast Fares</h1>
                <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-medium">
                  Hourly Aggregator + AI Predictor
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Tracking Google Flights &amp; Airline yields to predict price drops &amp; optimal booking dates
              </p>
            </div>
          </div>

          {/* Controls & Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Aggregator Status Pill */}
            <div
              onClick={onOpenAggregator}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-750 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 text-xs cursor-pointer transition"
              title="Click to view full aggregator snapshots feed"
            >
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <span>
                <strong className="text-white">Hourly Aggregator:</strong> {aggregatorStatus ? `${aggregatorStatus.totalSnapshotsCollected} Fares Logged` : 'Active'}
              </span>
              <Database className="h-3.5 w-3.5 text-slate-400 ml-1" />
            </div>

            {/* Sync Now Button */}
            <button
              id="sync-now-btn"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-medium transition disabled:opacity-50"
              title="Run hourly aggregator data collection pass now"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Collecting...' : 'Sync Now'}</span>
            </button>

            {/* Indian Festival Calendar Button */}
            <button
              id="festivals-btn"
              onClick={onOpenFestivals}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-500/30 text-xs font-medium transition"
              title="View Indian Festival calendar (Diwali, Dussehra, Chhath Puja) impact factors"
            >
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden md:inline">Festivals</span>
            </button>

            {/* Fare Indexing Analytics Layer Button */}
            <button
              id="fare-analytics-btn"
              onClick={onOpenFareAnalytics}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 px-3 py-1.5 rounded-lg border border-blue-500/30 text-xs font-medium transition"
              title="View fare-indexing analytics layer, overall index, booking window, time-of-day & day-of-week indices"
            >
              <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden lg:inline">Fare Analytics</span>
            </button>

            {/* Push Notification Toggle */}
            {permission === 'granted' ? (
              <button
                id="test-push-btn"
                onClick={handleTestAlertClick}
                className="flex items-center space-x-1.5 bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                title="Browser notifications active. Click to test optimal price alert."
              >
                <BellRing className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                <span>Test Alert</span>
              </button>
            ) : (
              <button
                id="enable-push-btn"
                onClick={handleEnablePush}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Enable Push Alerts</span>
              </button>
            )}

            {/* Notifications Bell */}
            <button
              id="notifications-bell-btn"
              onClick={onOpenNotifications}
              className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Notifications Center"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Ephemeral Toast Alert */}
      {toastMessage && (
        <div className="bg-blue-600 text-white text-xs px-4 py-2 flex items-center justify-between transition-all">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-blue-200 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}
    </header>
  );
};
