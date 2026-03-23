import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Users, ClipboardList, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ClockWidget from '../components/ClockWidget';
import CalendarWidget from '../components/CalendarWidget';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalInventory: 0,
    totalRecipients: 0,
    totalDistributions: 0,
    recentDistributions: [],
    chartData: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      try {
        const { count: inventoryCount } = await supabase.from('inventory').select('*', { count: 'exact', head: true });
        const { count: recipientsCount } = await supabase.from('recipients').select('*', { count: 'exact', head: true });
        const { count: distributionsCount } = await supabase.from('distributions').select('*', { count: 'exact', head: true });
        
        const { data: recentData } = await supabase
          .from('distributions')
          .select(`
            id,
            date_distributed,
            quantity,
            recipients (first_name, last_name),
            inventory (name)
          `)
          .order('date_distributed', { ascending: false })
          .limit(5);

        const { data: distData } = await supabase
          .from('distributions')
          .select(`
            date_distributed,
            inventory (category)
          `);

        const monthlyData: Record<string, any> = {};

        distData?.forEach((d: any) => {
          const date = new Date(d.date_distributed);
          const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const category = d.inventory?.category || 'UNKNOWN';

          if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = { 
              name: monthYear, 
              SEEDS: 0, 
              FERTILIZER_ORGANIC: 0, 
              FERTILIZER_INORGANIC: 0, 
              DEWORMING: 0, 
              ANTI_RABIES: 0, 
              PESTICIDES: 0, 
              UNKNOWN: 0 
            };
          }
          
          monthlyData[monthYear][category] += 1;
        });

        const chartData = Object.values(monthlyData).sort((a, b) => a.name.localeCompare(b.name)).map(d => {
          const [year, month] = d.name.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1);
          return {
            ...d,
            name: date.toLocaleDateString('default', { month: 'short', year: 'numeric' })
          };
        });
        
        if (inventoryCount !== null) {
          setStats({
            totalInventory: inventoryCount || 0,
            totalRecipients: recipientsCount || 0,
            totalDistributions: distributionsCount || 0,
            recentDistributions: (recentData || []).map((d: any) => ({
              id: d.id,
              date: new Date(d.date_distributed).toLocaleDateString(),
              recipient: `${d.recipients?.first_name || ''} ${d.recipients?.last_name || ''}`.trim(),
              item: d.inventory?.name || 'Unknown Item',
              qty: d.quantity
            })),
            chartData
          });
          return;
        }
      } catch (e) {
        console.error('Error fetching stats:', e);
      }
      
      setStats({
        totalInventory: 0,
        totalRecipients: 0,
        totalDistributions: 0,
        recentDistributions: [],
        chartData: []
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading dashboard...</div>;
  }

  const statCards = [
    { name: 'Total Inventory Items', value: stats.totalInventory, icon: Package, color: 'bg-blue-500' },
    { name: 'Registered Recipients', value: stats.totalRecipients, icon: Users, color: 'bg-emerald-500' },
    { name: 'Total Distributions', value: stats.totalDistributions, icon: ClipboardList, color: 'bg-purple-500' },
    { name: 'Active Programs', value: 4, icon: TrendingUp, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Overview of MAO RSBSA System</p>
        </div>
        <div>
          <ClockWidget />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((item) => (
          <div key={item.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`p-3 rounded-md ${item.color}`}>
                    <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{item.name}</dt>
                    <dd className="text-2xl font-semibold text-gray-900">{item.value}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Monthly Distributions by Category</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dx={-10} />
              <Tooltip 
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="SEEDS" name="Seeds" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="FERTILIZER_ORGANIC" name="Organic Fertilizer" stackId="a" fill="#8b5cf6" />
              <Bar dataKey="FERTILIZER_INORGANIC" name="Inorganic Fertilizer" stackId="a" fill="#3b82f6" />
              <Bar dataKey="DEWORMING" name="Deworming" stackId="a" fill="#f59e0b" />
              <Bar dataKey="ANTI_RABIES" name="Anti-Rabies" stackId="a" fill="#ef4444" />
              <Bar dataKey="PESTICIDES" name="Pesticides" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white shadow rounded-lg flex flex-col">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Distributions</h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recentDistributions.map((dist: any) => (
                  <tr key={dist.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dist.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dist.recipient}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dist.item}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dist.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <CalendarWidget />
        </div>
      </div>
    </div>
  );
}
