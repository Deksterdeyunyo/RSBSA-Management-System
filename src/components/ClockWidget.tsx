import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function ClockWidget() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white shadow rounded-lg p-6 flex flex-col items-center justify-center space-y-4">
      <div className="flex items-center space-x-2 text-emerald-600 w-full justify-start border-b border-gray-100 pb-2">
        <Clock className="w-5 h-5" />
        <h3 className="text-lg font-medium text-gray-900">Current Time</h3>
      </div>
      <div className="text-4xl font-bold text-gray-900 tracking-tight tabular-nums">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-sm text-gray-500 font-medium">
        {time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}
