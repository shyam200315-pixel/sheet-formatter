import React from 'react';
import { 
  Home, 
  Calculator, 
  TrendingUp, 
  ShoppingCart, 
  ListChecks, 
  BarChart2, 
  PackageCheck, 
  Tags, 
  FileText 
} from 'lucide-react';

const DOCK_ITEMS = [
  { id: 'home', label: 'Home', icon: Home, color: 'text-blue-500' },
  { id: 'validator', label: 'Daily Sales', icon: Calculator, color: 'text-sky-500' },
  { id: 'best-sellers', label: 'Best Sellers', icon: TrendingUp, color: 'text-fuchsia-500' },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, color: 'text-indigo-500' },
  { id: 'generator', label: 'Requirements', icon: ListChecks, color: 'text-emerald-500' },
  { id: 'stock', label: 'Stock', icon: BarChart2, color: 'text-violet-500' },
  { id: 'inward-tracker', label: 'Inward', icon: PackageCheck, color: 'text-cyan-500' },
  { id: 'mrp', label: 'MRP', icon: Tags, color: 'text-amber-500' },
  { id: 'quotation', label: 'Quotation', icon: FileText, color: 'text-rose-500' }
];

export default function MacDock({ activeTab, setActiveTab }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] sm:w-auto max-w-full px-2 sm:px-0">
      <div className="macos-dock flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-2xl rounded-2xl overflow-x-auto scrollbar-hide">
        {DOCK_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <div key={item.id} className="relative flex flex-col items-center group shrink-0">
              <button
                onClick={() => setActiveTab(item.id)}
                className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all duration-200 z-10 cursor-pointer
                  ${isActive 
                    ? 'bg-white dark:bg-slate-900 shadow-md ring-1 ring-slate-200/50 dark:ring-slate-600/50 scale-110' 
                    : 'bg-transparent hover:bg-white/50 dark:hover:bg-white/10 hover:scale-110'
                  }`}
              >
                <Icon size={20} className={`sm:w-6 sm:h-6 ${item.color}`} />
              </button>
              
              {/* Tooltip - hidden on mobile */}
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-1 px-2 rounded-md pointer-events-none whitespace-nowrap z-20 shadow-lg hidden sm:block">
                {item.label}
              </div>
              
              {/* Active Indicator (Pill) */}
              {isActive && (
                <div className="absolute -bottom-1 sm:-bottom-1.5 w-3 sm:w-4 h-0.5 sm:h-1 bg-slate-800 dark:bg-white rounded-full" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
