import React from 'react';
import { FestivalEvent } from '../types';
import { X, Calendar, Zap, AlertCircle, MapPin, Sparkles } from 'lucide-react';
import { formatDateDDMMYYYY } from '../utils/dateFormatter';

interface FestivalCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  festivals: FestivalEvent[];
  selectedDate: string;
}

export const FestivalCalendarModal: React.FC<FestivalCalendarModalProps> = ({
  isOpen,
  onClose,
  festivals,
  selectedDate,
}) => {
  if (!isOpen) return null;

  const selectedTime = new Date(selectedDate).getTime();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-600 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-700/80 rounded-lg">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Indian Festival Demand Calendar</h2>
              <p className="text-xs text-amber-100">
                Surge models affecting Pune ⇄ Lucknow &amp; domestic Indian corridors
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-amber-100 hover:text-white rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl mb-4 text-xs text-amber-900 leading-relaxed">
            <strong>Why Pune ⇄ Lucknow has high festival sensitivity:</strong> Pune is home to a massive IT and educational workforce from Uttar Pradesh. During Dussehra, Diwali, and Chhath Puja, flight seats deplete 3-4x faster than typical routes, causing yield management algorithms to lock top fare buckets.
          </div>

          <div className="space-y-3">
            {festivals.map((fest) => {
              const start = new Date(fest.startDate).getTime();
              const end = new Date(fest.endDate).getTime();
              const isMatch = selectedTime >= start && selectedTime <= end;
              const daysDiff = Math.round((start - selectedTime) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={fest.id}
                  className={`p-4 rounded-xl border transition ${
                    isMatch
                      ? 'border-amber-400 bg-amber-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Zap className={`h-4 w-4 ${isMatch ? 'text-amber-600' : 'text-slate-400'}`} />
                      <span className="text-sm font-bold text-slate-900">{fest.name}</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {fest.demandSurgeFactor}x Demand Multiplier
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 mt-1">
                    Dates: <strong className="text-slate-700">{formatDateDDMMYYYY(fest.startDate)}</strong> to <strong className="text-slate-700">{formatDateDDMMYYYY(fest.endDate)}</strong>
                    {daysDiff > 0 && daysDiff <= 60 && (
                      <span className="ml-2 text-blue-600 font-semibold">({daysDiff} days from your selected date)</span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mt-1.5 leading-normal">
                    {fest.description}
                  </p>

                  <div className="flex items-center space-x-1.5 mt-2 text-[11px] text-slate-400">
                    <MapPin className="h-3 w-3" />
                    <span>Peak impact corridors: {fest.affectedRegions.join(', ')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
          >
            Close Calendar
          </button>
        </div>
      </div>
    </div>
  );
};
