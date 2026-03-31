import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, Bed, Wallet, Calendar, ArrowUpRight, ArrowDownRight,
  RefreshCcw, Download, Info, Utensils, Coffee, Clock, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, IndianRupee
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { subDays } from 'date-fns';
import { toast } from 'sonner';

export function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [showMoreInsights, setShowMoreInsights] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const end = new Date();
      const start = subDays(end, timeRange === '30d' ? 30 : 7);
      
      const [dash, rev] = await Promise.all([
        api.get(`/analytics/dashboard`),
        api.get(`/analytics/revenue?startDate=${start.toISOString()}&endDate=${end.toISOString()}`)
      ]);

      setDashboardData(dash);
      setRevenueData(rev);
    } catch (err: any) {
      toast.error('Failed to load analytics: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCcw className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  const kpis = dashboardData?.kpis || {};
  const money = dashboardData?.money || {};
  const operations = dashboardData?.operations || {};
  const alerts = dashboardData?.alerts || {};
  const insights = dashboardData?.insights || {};

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* 1. Simplify Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Hotel Performance</h2>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">Real-time room & revenue tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-500" onClick={fetchAnalytics}>
            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Sync
          </Button>
          <Button variant="outline" size="sm" className="h-8 rounded-lg border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
        </div>
      </div>

      {/* 2. Quick Insights Box (Very Important) */}
      <Card className="border-none bg-indigo-50/50 shadow-sm overflow-hidden">
        <CardContent className="p-4">
           <div className="flex items-center gap-2 mb-3">
             <div className="h-6 w-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
               <Info className="h-3.5 w-3.5" />
             </div>
             <h3 className="text-xs font-black uppercase tracking-widest text-indigo-900">Today's Quick Insights</h3>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <div className={cn("h-2 w-2 rounded-full", kpis.revenueChange >= 0 ? "bg-emerald-500" : "bg-rose-500")} />
                {kpis.revenueChange >= 0 ? '↑' : '↓'} Revenue {kpis.revenueChange >= 0 ? 'up' : 'down'} {Math.abs(Math.round(kpis.revenueChange))}%
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                {alerts.dirtyRooms} rooms need cleaning
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <IndianRupee className="h-3.5 w-3.5 text-amber-600" />
                ₹{money.pendingPayments?.amount?.toLocaleString()} pending
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                {alerts.checkoutsSoon} guests leaving within 1h
              </div>
           </div>
        </CardContent>
      </Card>

      {/* Row 1: Primary Decisive Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Today's Revenue" value={`₹${kpis.todayRevenue?.toLocaleString()}`} trend={kpis.revenueChange} icon={Wallet} />
          
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Occupancy %</p>
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div>
                <span className="text-xl font-black text-slate-900">{kpis.occupancyPercent}%</span>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">{kpis.occupiedRooms} Occupied</p>
              </div>
            </CardContent>
          </Card>

          <StatCard label="Rooms Available" value={kpis.availableRooms} icon={CheckCircle2} color="emerald" />
          <StatCard label="Arrivals Today" value={kpis.todayCheckins} subValue={`Next 24h: ${kpis.tomorrowCheckins}`} icon={ArrowUpRight} color="blue" />
          <StatCard label="Departures Today" value={kpis.todayCheckouts} icon={ArrowDownRight} color="slate" />
      </div>

      {/* Row 2: Money Matters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="md:col-span-1 border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-3">Today's Cash in Hand</p>
              <div className="space-y-2">
                 <div className="flex justify-between items-center text-xs">
                   <span className="font-bold text-slate-600">Cash</span>
                   <span className="font-black text-slate-900">₹{money.cashInHand?.cash?.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                   <span className="font-bold text-slate-600">UPI</span>
                   <span className="font-black text-slate-900">₹{money.cashInHand?.upi?.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                   <span className="font-bold text-slate-600">Card</span>
                   <span className="font-black text-slate-900">₹{money.cashInHand?.card?.toLocaleString()}</span>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-rose-50/50 overflow-hidden">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <p className="text-[10px] font-bold uppercase text-rose-500 tracking-widest">Pending Payments</p>
              <div className="mt-2">
                <span className="text-xl font-black text-slate-900">₹{money.pendingPayments?.amount?.toLocaleString()}</span>
                <p className="text-[9px] font-bold text-rose-500 uppercase mt-0.5">{money.pendingPayments?.count} Unpaid Rooms</p>
              </div>
            </CardContent>
          </Card>

          <StatCard label="Expected Revenue Today" value={`₹${money.expectedRevenueToday?.toLocaleString()}`} icon={IndianRupee} color="amber" desc="Based on arrivals" />
          <StatCard label="ADR (Daily Rate)" value={`₹${Math.round(kpis.adr)?.toLocaleString()}`} icon={TrendingUp} color="indigo" desc="Revenue per Sold Room" />
          <StatCard label="RevPAR" value={`₹${Math.round(kpis.revPar)?.toLocaleString()}`} icon={TrendingUp} color="violet" desc="Revenue per Total Room" />
      </div>

      {/* Row 3: Operations & Staff Alerts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rooms to Clean</p>
                <p className="text-xl font-black text-slate-900">{operations.roomsToClean}</p>
              </div>
            </div>
          </Card>
          <Card className="border-none shadow-sm bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                <Bed className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Maintenance</p>
                <p className="text-xl font-black text-slate-900">{operations.maintenanceRooms}</p>
              </div>
            </div>
          </Card>
          <Card className="border-none shadow-sm bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Restaurant Rev</p>
                <p className="text-xl font-black text-slate-900">₹14.2k</p>
              </div>
            </div>
          </Card>
          <Card className="border-none shadow-sm bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <Coffee className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Orders</p>
                <p className="text-xl font-black text-slate-900">4</p>
              </div>
            </div>
          </Card>
      </div>

      {/* Row 4: Single Revenue Chart */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Revenue Performance</CardTitle>
          <CardDescription className="text-[10px]">Daily gross revenue trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData?.trend || []}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Row 5: More Insights (Expandable) */}
      <div className="space-y-4">
         <Button 
            variant="ghost" 
            className="w-full h-12 rounded-2xl border border-dashed border-slate-300 bg-white/50 text-slate-500 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50"
            onClick={() => setShowMoreInsights(!showMoreInsights)}
         >
           {showMoreInsights ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
           {showMoreInsights ? "Show Less" : "More Insights (Market & Detailed Stats)"}
         </Button>

         {showMoreInsights && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
             {/* Recommended Metrics */}
             <Card className="border-none shadow-sm bg-white p-5">
               <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Market Stats</CardTitle>
               <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Most Booked Room Type</p>
                    <p className="text-sm font-black text-slate-800">{insights.topRoomType}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Average Stay Duration</p>
                    <p className="text-sm font-black text-slate-800">{insights.avgStayDuration} Days</p>
                  </div>
                  <div className="pt-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Booking Distribution</p>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                       <div className="h-full bg-indigo-500" style={{ width: `${insights.sourceDist?.walkin}%` }} />
                       <div className="h-full bg-emerald-400" style={{ width: `${insights.sourceDist?.online}%` }} />
                    </div>
                    <div className="flex justify-between mt-2 text-[9px] font-bold uppercase tracking-wider">
                      <span className="text-indigo-600">Walk-in: {insights.sourceDist?.walkin}%</span>
                      <span className="text-emerald-600">Online: {insights.sourceDist?.online}%</span>
                    </div>
                  </div>
               </div>
             </Card>

             {/* Revenue By Room Type Chart */}
             <Card className="border-none shadow-sm bg-white overflow-hidden p-5">
               <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Revenue by Category</CardTitle>
               <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={revenueData?.byRoomType || []}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="roomType" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} width={80} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
               </div>
             </Card>

             {/* Payment Methods */}
             <Card className="border-none shadow-sm bg-white p-5">
               <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Payment Breakdown</CardTitle>
               <div className="space-y-2">
                  {Object.entries(revenueData?.byPaymentMethod || {}).map(([method, amount]: [any, any], i) => (
                    <div key={method} className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-500 capitalize">{method}</span>
                      <span className="font-black text-slate-900">₹{amount.toLocaleString()}</span>
                    </div>
                  ))}
               </div>
             </Card>
           </div>
         )}
      </div>
    </div>
  );
}

function StatCard({ label, value, trend, icon: Icon, color = 'slate', subValue, desc }: any) {
  const colors: any = {
    slate: "bg-slate-50 text-slate-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    indigo: "bg-indigo-50 text-indigo-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-2">
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">{label}</p>
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110", colors[color])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">{value}</span>
            {trend !== undefined && (
              <span className={cn("text-[9px] font-black", trend >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {trend >= 0 ? '↑' : '↓'}{Math.abs(Math.round(trend))}%
              </span>
            )}
          </div>
          {subValue && <p className="text-[9px] font-bold text-blue-500 uppercase mt-0.5">{subValue}</p>}
          {desc && <p className="text-[8px] font-bold text-slate-400 uppercase italic mt-0.5">{desc}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

