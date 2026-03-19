import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from 'date-fns';

export default function CalendarWidget() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "d";
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      const isCurrentMonth = isSameMonth(day, monthStart);
      const isToday = isSameDay(day, new Date());
      
      days.push(
        <div
          key={day.toString()}
          className={`p-1 flex justify-center items-center text-sm`}
        >
          <span className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors
            ${!isCurrentMonth ? "text-gray-300" : "text-gray-700"}
            ${isToday ? "bg-emerald-600 text-white font-bold shadow-sm" : "hover:bg-emerald-50 cursor-pointer"}
          `}>
            {formattedDate}
          </span>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="grid grid-cols-7 gap-1" key={day.toString()}>
        {days}
      </div>
    );
    days = [];
  }

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="bg-white shadow rounded-lg p-5">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
        <div className="flex items-center space-x-2 text-emerald-600">
          <CalendarIcon className="w-5 h-5" />
          <h3 className="text-lg font-medium text-gray-900">
            {format(currentDate, "MMMM yyyy")}
          </h3>
        </div>
        <div className="flex space-x-1">
          <button onClick={prevMonth} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
      
      <div className="space-y-1">
        {rows}
      </div>
    </div>
  );
}
