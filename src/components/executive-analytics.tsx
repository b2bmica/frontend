import { useMemo } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  IndianRupee, 
  ArrowUpRight, 
  Target,
  History,
  Info
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useBookings } from '../context/booking-context';
import { differenceInDays, format, startOfToday, subDays } from 'date-fns';
import { cn } from '../lib/utils';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];

export function ExecutiveAnalytics() {
  const { bookings, rooms, guests } = useBookings();

  const stats = useMemo(() => {
    // Basic Counts
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const occupancy = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // Revenue Calculation
    const totalRevenue = bookings.reduce((sum, b) => {
      const room = typeof b.roomId === 'object' ? b.roomId : rooms.find(r => r._id === b.roomId);
      const nights = Math.max(1, differenceInDays(new Date(b.checkout), new Date(b.checkin)));
      const rate = b.roomPrice || room?.price || 0;
      return sum + (rate * nights);
    }, 0);

    // RevPAR
    const revPar = totalRooms > 0 ? totalRevenue / totalRooms : 0;

    // Revenue Trend (Last 7 Days)
    const today = startOfToday();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i);
      const dayName = format(date, 'eee');
      const daySearch = format(date, 'yyyy-MM-dd');
      const dayTotal = bookings
        .filter(b => {
          const bDate = b.checkin ? format(new Date(b.checkin), 'yyyy-MM-dd') : '';
          return bDate === daySearch;
        })
        .reduce((sum, b) => {
          const room = typeof b.roomId === 'object' ? b.roomId : rooms.find(r => r._id === b.roomId);
          const nights = Math.max(1, differenceInDays(new Date(b.checkout), new Date(b.checkin)));
          const rate = b.roomPrice || room?.price || 0;
          return sum + (rate * nights);
        }, 0);
      return { name: dayName, total: dayTotal };
    });

    // Room Type Data
    const roomTypeMap = rooms.reduce((acc, r) => {
      acc[r.roomType] = (acc[r.roomType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const occupancyByRoomType = Object.entries(roomTypeMap).map(([name, value]) => ({
      name,
      value: Math.round((value / totalRooms) * 100)
    }));

    return {
      revenue: totalRevenue,
      occupancy: Math.round(occupancy),
      guests: guests.length,
      revPar: Math.round(revPar),
      trend: last7Days,
      roomTypes: occupancyByRoomType,
      outstanding: bookings.filter(b => b.status === 'checked-in').slice(0, 3)
    };
  }, [bookings, rooms, guests]);

  const kpiData = [
    { title: 'Total Revenue', value: `₹${(stats.revenue / 1000).toFixed(1)}K`, icon: IndianRupee, color: 'text-emerald-500' },
    { title: 'Live Occupancy', value: `${stats.occupancy}%`, icon: Target, color: 'text-blue-500' },
    { title: 'Traveler Base', value: stats.guests.toString(), icon: Users, color: 'text-purple-500' },
    { title: 'RevPAR', value: `₹${stats.revPar.toLocaleString()}`, icon: TrendingUp, color: 'text-orange-500' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi, i) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={cn("p-2.5 rounded-2xl bg-slate-50 transition-colors group-hover:bg-muted", kpi.color)}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{kpi.title}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-black tracking-tight">{kpi.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-black tracking-tight">Financial Performance</CardTitle>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">Revenue Trajectory (L7D)</p>
            </div>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888810" />
                <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip 
                  cursor={{ stroke: '#3b82f6', strokeWidth: 1 }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#000', fontWeight: '900', fontSize: '10px' }}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Room Type Distribution */}
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-black tracking-tight">Asset Concentration</CardTitle>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">Portfolio Diversity</p>
          </CardHeader>
          <CardContent className="h-[280px] flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.roomTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {stats.roomTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Diversification</span>
              <span className="text-3xl font-black tracking-tighter text-foreground">{stats.roomTypes.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Active Occupancy Summary */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
             <div className="space-y-0.5">
               <CardTitle className="text-base font-black tracking-tight flex items-center gap-2">
                 Real-time Operations
                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               </CardTitle>
               <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">In-House Guest Management</p>
             </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.outstanding.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed text-[10px] font-black uppercase text-slate-400">
                  No active check-ins
                </div>
              ) : (
                stats.outstanding.map((item: any) => {
                  const guest = typeof item.guestId === 'object' ? item.guestId : guests.find(g => g._id === item.guestId);
                  const room = typeof item.roomId === 'object' ? item.roomId : rooms.find(r => r._id === item.roomId);
                  return (
                    <div key={item._id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center font-black text-xs text-primary shadow-sm">
                          {guest?.name?.[0] || 'G'}
                        </div>
                        <div>
                          <p className="font-black text-xs">{guest?.name || 'In-House Guest'}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mt-0.5">Rm {room?.roomNumber || '???'} • {item.bookingSource}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-xs">₹{room?.price?.toLocaleString() || '0'}</p>
                        <Badge variant="outline" className="text-[7px] font-black uppercase tracking-tighter h-4 border-emerald-100 text-emerald-600 bg-white">IN-HOUSE</Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Score */}
        <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative">
          <CardHeader>
            <CardTitle className="text-white font-black tracking-tight text-base">Efficiency Intel</CardTitle>
            <p className="text-[9px] text-white/50 font-black uppercase tracking-widest">Yield Management</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-white/60">
                 <span>Occupancy Saturation</span>
                 <span>{stats.occupancy}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                 <motion.div initial={{ width: 0 }} animate={{ width: `${stats.occupancy}%` }} className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
              </div>
            </div>
            
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-4 mt-6">
               <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center"><History className="h-5 w-5" /></div>
               <div><p className="text-[8px] font-black uppercase text-white/50">Performance Rating</p><p className="text-xl font-black tracking-tight">Premium</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
