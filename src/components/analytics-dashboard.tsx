import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, Bed, Wallet, Calendar, ArrowUpRight, ArrowDownRight,
  Filter, RefreshCcw, Download, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

const COLORS = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'];

export function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [occupancyData, setOccupancyData] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const end = new Date();
      const start = subDays(end, timeRange === '30d' ? 30 : 7);
      
      const [dash, rev, occ, forc] = await Promise.all([
        api.get(`/analytics/dashboard`),
        api.get(`/analytics/revenue?startDate=${start.toISOString()}&endDate=${end.toISOString()}`),
        api.get(`/analytics/occupancy?startDate=${start.toISOString()}&endDate=${end.toISOString()}`),
        api.get(`/analytics/forecast`)
      ]);

      setDashboardData(dash);
      setRevenueData(rev);
      setOccupancyData(occ);
      setForecastData(forc);
    } catch (err: any) {
      toast.error('Failed to load analytics: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpis = dashboardData?.kpis || {};
  const operations = dashboardData?.operations || {};

  return (
    <div className="space-y-6 pb-20">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">Advanced Analytics</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Real-time performance & financial insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={timeRange} onValueChange={setTimeRange} className="w-[180px]">
            <TabsList className="grid grid-cols-2 h-9 rounded-xl bg-slate-100 p-1">
              <TabsTrigger value="7d" className="text-[10px] uppercase font-black tracking-widest rounded-lg">7 Days</TabsTrigger>
              <TabsTrigger value="30d" className="text-[10px] uppercase font-black tracking-widest rounded-lg">30 Days</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" className="rounded-xl" onClick={fetchAnalytics}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="rounded-xl border-slate-200 text-xs font-bold text-slate-600">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue", value: `₹${Math.round(kpis.todayRevenue || 0).toLocaleString()}`, icon: Wallet, change: kpis.revenueChange, prefix: 'gross' },
          { label: "Current Occupancy", value: `${Math.round(kpis.currentOccupancy || 0)}%`, icon: Users, suffix: 'of total' },
          { label: "Check-ins (Today)", value: kpis.todayCheckins, icon: Calendar, suffix: 'rooms' },
          { label: "Check-outs (Today)", value: kpis.todayCheckouts, icon: Bed, suffix: 'rooms' },
        ].map((kpi, i) => (
          <Card key={i} className="border-none shadow-sm overflow-hidden group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                <kpi.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{kpi.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-slate-900">{kpi.value}</span>
                  {kpi.change !== undefined && (
                    <span className={cn(
                      "text-[10px] font-bold flex items-center",
                      kpi.change >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {kpi.change >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                      {Math.abs(Math.round(kpi.change))}%
                    </span>
                  )}
                </div>
                <p className="text-[8px] font-bold text-slate-400 uppercase italic opacity-60">
                  {kpi.prefix && `${kpi.prefix} · `} {kpi.suffix}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <Card className="lg:col-span-2 border-none shadow-md overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Revenue Performance</CardTitle>
                <CardDescription className="text-[10px]">Daily gross revenue distribution across nights</CardDescription>
              </div>
              <div className="p-1.5 bg-white border border-slate-100 rounded-lg shadow-sm">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData?.trend || []}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    labelStyle={{ fontSize: '10px', fontWeight: 900, marginBottom: '4px', textTransform: 'uppercase' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0f172a" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Room Type Revenue */}
        <Card className="border-none shadow-md overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">By Room Type</CardTitle>
            <CardDescription className="text-[10px]">Revenue contribution per category</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={revenueData?.byRoomType || []}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="roomType" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#475569' }} width={80} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="revenue" fill="#0f172a" radius={[0, 8, 8, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Occupancy Chart */}
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Occupancy Trend</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={occupancyData?.trend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="step" dataKey="occupancy" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3, fill: '#0ea5e9' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Payment Distribution</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(revenueData?.byPaymentMethod || {}).map(([name, value]) => ({ name, value }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                 {Object.keys(revenueData?.byPaymentMethod || {}).map((method, i) => (
                   <div key={method} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">{method}</span>
                   </div>
                 ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operations Overview */}
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Operations Feed</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
             <div className="space-y-4">
               <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Room Status Distribution</p>
                  <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 mb-4">
                       {Object.entries(operations.roomStatusDistribution || {}).map(([key, val]: [any, any], i) => (
                         <div 
                          key={key} 
                          style={{ width: `${(val / (Object.values(operations.roomStatusDistribution || {}).reduce((s: number, c: any) => s + c, 0) || 1)) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} 
                         />
                       ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {Object.entries(operations.roomStatusDistribution || {}).map(([key, val]: [any, any], i) => (
                        <div key={key} className="flex justify-between items-center text-[10px] font-bold">
                           <div className="flex items-center gap-1.5">
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                             <span className="capitalize">{key}</span>
                           </div>
                           <span className="text-slate-400">{val}</span>
                        </div>
                      ))}
                  </div>
               </div>

               <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Housekeeping Load</p>
                      <p className="text-sm font-black text-slate-800">{operations.housekeepingLoad} Units Dirty</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase text-primary">Details</Button>
               </div>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Section */}
      <Card className="border-none shadow-lg overflow-hidden bg-slate-900 text-white">
         <CardHeader className="border-b border-white/5 bg-white/5">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-white/90">7-Day Demand Forecast</CardTitle>
                <CardDescription className="text-white/40 text-[10px]">Predicted occupancy and revenue based on confirmed holdings</CardDescription>
              </div>
              <div className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-400/20">
                Predictive Active
              </div>
            </div>
         </CardHeader>
         <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-white/5">
               {forecastData?.map((day: any, i: number) => (
                 <div key={day.date} className={cn("p-6 text-center border-r border-white/5 last:border-0", i === 0 && "bg-white/5")}>
                    <p className="text-[9px] font-black uppercase text-white/40 tracking-widest mb-3">{day.date}</p>
                    <div className="relative inline-flex items-center justify-center mb-3">
                       <svg className="w-14 h-14">
                         <circle className="text-white/5" strokeWidth="4" stroke="currentColor" fill="transparent" r="24" cx="28" cy="28"/>
                         <circle className="text-emerald-400" strokeWidth="4" strokeDasharray={150} strokeDashoffset={150 - (150 * day.expectedOccupancy / 100)} strokeLinecap="round" stroke="currentColor" fill="transparent" r="24" cx="28" cy="28"/>
                       </svg>
                       <span className="absolute text-[10px] font-black">{Math.round(day.expectedOccupancy)}%</span>
                    </div>
                    <p className="text-xs font-black">{day.expectedRoomsSold} <span className="text-[9px] font-bold text-white/30 uppercase">Sold</span></p>
                 </div>
               ))}
            </div>
         </CardContent>
      </Card>
    </div>
  );
}

