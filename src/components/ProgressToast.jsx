import React from 'react';
import { CloudUpload } from 'lucide-react';

export const renderProgressToast = (t, message, percentage) => (
  <div
    className={`${
      t.visible ? 'animate-enter' : 'animate-leave'
    } max-w-sm w-full bg-white dark:bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex flex-col ring-1 ring-black/5 dark:ring-white/10 overflow-hidden backdrop-blur-xl bg-opacity-90 dark:bg-opacity-90 transition-all duration-300`}
  >
    <div className="p-4 flex items-center gap-4">
      {/* Cool animated circular progress */}
      <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          {/* Background Circle */}
          <path
            className="text-slate-100 dark:text-slate-800"
            strokeWidth="3"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          {/* Progress Circle */}
          <path
            className="text-indigo-500 dark:text-indigo-400 transition-all duration-300 ease-out"
            strokeWidth="3"
            strokeDasharray={`${percentage}, 100`}
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-indigo-500 dark:text-indigo-400 animate-pulse">
          <CloudUpload className="w-5 h-5" />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center min-w-0">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
          {message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {percentage}%
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {percentage === 100 ? 'Finalizing...' : 'Syncing data...'}
          </span>
        </div>
      </div>
    </div>
    
    {/* Bottom animated progress bar */}
    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
      <div 
        className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out rounded-r-full" 
        style={{ width: `${percentage}%` }}
      >
        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
      </div>
    </div>
  </div>
);
