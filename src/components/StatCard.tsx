import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ title, value, icon, trend, trendUp }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        {trend && (
          <p className={`text-sm mt-2 font-medium ${trendUp ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trendUp ? 'â†‘' : 'â†“'} {trend}
          </p>
        )}
      </div>
      <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
        {icon}
      </div>
    </div>
  );
}
