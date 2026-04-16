import React, { useState, useRef } from 'react';
import { Calendar } from 'lucide-react';

type TimePeriod = 'all' | 'day' | 'week' | 'month' | 'year' | 'custom';

export interface TimeFilterValue {
  period: TimePeriod;
  startDate?: string;
  endDate?: string;
}

interface TimeRangeFilterProps {
  onFilterChange: (filter: TimeFilterValue) => void;
}

const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({ onFilterChange }) => {
  const [activeFilter, setActiveFilter] = useState<TimePeriod>('week');
  const [showCustom, setShowCustom] = useState(false);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  const handleFilterClick = (period: TimePeriod) => {
    setActiveFilter(period);
    if (period === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onFilterChange({ period });
    }
  };

  const handleApplyCustom = () => {
    const startDate = startDateRef.current?.value;
    const endDate = endDateRef.current?.value;
    if (startDate && endDate) {
      onFilterChange({ period: 'custom', startDate, endDate });
    }
  };

  const buttonClass = (period: TimePeriod) => {
    return `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
      activeFilter === period
        ? 'bg-primary-600 text-white shadow-sm'
        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
    }`;
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => handleFilterClick('day')} className={buttonClass('day')}>
          Bugun
        </button>
        <button onClick={() => handleFilterClick('week')} className={buttonClass('week')}>
          Bu Hafta
        </button>
        <button onClick={() => handleFilterClick('month')} className={buttonClass('month')}>
          Bu Ay
        </button>
        <button onClick={() => handleFilterClick('year')} className={buttonClass('year')}>
          Bu Yil
        </button>
        <button onClick={() => handleFilterClick('all')} className={buttonClass('all')}>
          Tum Zamanlar
        </button>
        <button onClick={() => handleFilterClick('custom')} className={buttonClass('custom')}>
          <Calendar className="w-4 h-4 mr-1.5 inline-block" />
          Ozel
        </button>
      </div>
      {showCustom && (
        <div className="mt-4 p-4 bg-white rounded-lg border animate-fadeIn">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label htmlFor="startDate" className="text-sm font-medium text-slate-600 block mb-1">Baslangic</label>
              <input type="date" id="startDate" ref={startDateRef} className="border-slate-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>
            <div>
              <label htmlFor="endDate" className="text-sm font-medium text-slate-600 block mb-1">Bitis</label>
              <input type="date" id="endDate" ref={endDateRef} className="border-slate-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>
            <div className="self-end">
              <button onClick={handleApplyCustom} className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition">
                Uygula
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRangeFilter;
