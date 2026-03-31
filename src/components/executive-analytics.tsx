import { useMemo, useState } from 'react';
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
  Target,
  History as HistoryIcon,
  ChevronRight,
  Activity,
  CalendarCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { useBookings, type Booking } from '../context/booking-context';
import { differenceInDays, format, startOfToday, subDays } from 'date-fns';
import { cn } from '../lib/utils';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']; // Indigo, Emerald, Amber, Violet, Pink

export function ExecutiveAnalytics() {
  const { bookings, rooms, guests } = useBookings();

  const stats = useMemo(() => {
    // Basic Counts
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const cleanRooms = rooms.filter(r => r.status === 'clean' || !r.status).length;
    const dirtyRooms = rooms.filter(r => r.status === 'dirty').length;
    const maintenanceRooms = rooms.filter(r => r.status === 'under-maintenance' || r.status === 'maintenance').length;
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
      totalRooms,
      occupiedRooms,
      cleanRooms,
      dirtyRooms,
      maintenanceRooms,
      guests: guests.length,
      revPar: Math.round(revPar),
      trend: last7Days,
      roomTypes: occupancyByRoomType,
      outstanding: bookings.filter(b => b.status === 'checked-in').slice(0, 5) // Show top 5 instead of 3 for better visibility
    };
  }, [bookings, rooms, guests]);

  const [showOccupancyDetails, setShowOccupancyDetails] = useState(false);

  const kpiData = [
    { title: 'Total Revenue', value: `₹${(stats.revenue / 1000).toFixed(1)}K`, desc: 'Gross earnings to date', icon: IndianRupee, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', gradient: 'from-indigo-50/50 to-white' },
    { 
      title: 'Current Occupancy', 
      value: `${stats.occupiedRooms} / ${stats.totalRooms}`, 
      desc: 'Click for detailed status breakdown', 
      icon: Activity, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-100', 
      gradient: 'from-emerald-50/50 to-white',
      onClick: () => setShowOccupancyDetails(true)
    },
    { title: 'Total Guests', value: stats.guests.toString(), desc: 'Registered guest profiles', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', gradient: 'from-amber-50/50 to-white' },
    { title: 'Revenue Per Room', value: `₹${stats.revPar.toLocaleString('en-IN')}`, desc: 'Average earnings per room', icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', gradient: 'from-violet-50/50 to-white' },
  ];

  return (
    <div className="space-y-6 pb-12 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      
      {/* Overview Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Hotel Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">A simple overview of your property's performance and current status.</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-700">
          <CalendarCheck className="h-4 w-4 text-slate-400" />
          <span>Report for {format(new Date(), 'MMMM d, yyyy')}</span>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi, i) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5, ease: 'easeOut' }}
          >
            <Card 
              onClick={kpi.onClick}
              className={cn(
                "rounded-2xl border bg-gradient-to-br shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300", 
                kpi.onClick && "cursor-pointer hover:border-emerald-300",
                kpi.border, 
                kpi.gradient
              )}>
              <CardContent className="p-6 relative">
                <div className="flex justify-between items-start mb-4">
                  <div className={cn("p-3 rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110", kpi.bg, kpi.color)}>
                    <kpi.icon className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">{kpi.value}</h3>
                  <p className="text-sm font-semibold text-slate-700">{kpi.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{kpi.desc}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="p-6 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Revenue (Last 7 Days)</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Daily income based on check-ins over the past week.</p>
            </div>
          </CardHeader>
          <CardContent className="h-[320px] p-6 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.7} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value >= 1000 ? (value/1000) + 'k' : value}`} />
                <Tooltip 
                  cursor={{ stroke: '#4f46e5', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: '14px' }}
                  labelStyle={{ color: '#64748b', fontWeight: '600', fontSize: '12px', marginBottom: '4px' }}
                  formatter={(value: any) => [`₹${(typeof value === 'number' ? value : 0).toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Room Types Pie Chart */}
        <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col">
          <CardHeader className="p-6 border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-900">Room Categories</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Breakdown of your property's room types.</p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-6 relative">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.roomTypes}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={6}
                  >
                    {stats.roomTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: '13px' }}
                    formatter={(value: any) => [`${value || 0}%`, 'Share of Total']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Custom Legend for clearer reading */}
            <div className="w-full mt-4 space-y-2">
               {stats.roomTypes.map((type, index) => (
                 <div key={type.name} className="flex items-center justify-between text-sm">
                   <div className="flex items-center gap-2">
                     <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                     <span className="font-medium text-slate-700">{type.name}</span>
                   </div>
                   <span className="font-bold text-slate-900">{type.value}%</span>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Simplified In-House Guests List */}
        <Card className="lg:col-span-2 rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Currently In-House</CardTitle>
              <p className="text-sm text-slate-500 mt-1">Guests currently staying at the property.</p>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 font-semibold">
              {stats.outstanding.length} Displayed
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {stats.outstanding.length === 0 ? (
                <div className="p-10 text-center">
                  <Users className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                  <p className="text-base font-semibold text-slate-600">No active check-ins</p>
                  <p className="text-sm text-slate-400 mt-1">There are no guests currently staying at the hotel.</p>
                </div>
              ) : (
                stats.outstanding.map((item: Booking) => {
                  const guest = typeof item.guestId === 'object' ? item.guestId : guests.find(g => g._id === item.guestId);
                  const room = typeof item.roomId === 'object' ? item.roomId : rooms.find(r => r._id === item.roomId);
                  return (
                    <div key={item._id} className="flex items-center justify-between p-4 sm:p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-lg text-slate-600">
                          {guest?.name?.[0] || 'G'}
                        </div>
                        <div>
                          <p className="font-bold text-base text-slate-900">{guest?.name || 'In-House Guest'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              Room {room?.roomNumber || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-base text-slate-900">₹{room?.price?.toLocaleString('en-IN') || '0'}<span className="text-xs font-normal text-slate-500">/night</span></p>
                        <p className="text-xs font-medium text-slate-500 mt-1">{item.bookingSource || 'Direct'}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {stats.outstanding.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-center">
                <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center justify-center w-full gap-1">
                  View All Guests <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clear Summary Performance Widget */}
        <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col">
          <CardHeader className="p-6 border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-900">Performance Summary</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Quick look at your hotel's overall health today.</p>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col">
            <div className="space-y-6 flex-1">
              
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-slate-700">Daily Occupancy Goal</span>
                  <span className="text-sm font-bold text-slate-900">{stats.occupancy}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }} 
                     animate={{ width: `${stats.occupancy}%` }} 
                     transition={{ duration: 0.8, ease: "easeOut" }}
                     className={cn(
                       "h-full rounded-full",
                       stats.occupancy > 75 ? "bg-emerald-500" : stats.occupancy > 40 ? "bg-amber-500" : "bg-rose-500"
                     )}
                   />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                   {stats.occupancy > 75 ? 'Excellent occupancy today!' : stats.occupancy > 40 ? 'Moderate occupancy. Room to grow.' : 'Low occupancy. Time for a promotion?'}
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <HistoryIcon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Recent Activity</p>
                  <p className="text-sm text-slate-500 mt-1 leading-snug">
                    Revenue is looking stable. Your most popular room type right now is <span className="font-semibold text-slate-700">{stats.roomTypes[0]?.name || 'N/A'}</span>.
                  </p>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>

      {/* Occupancy Details Dialog */}
      <Dialog open={showOccupancyDetails} onOpenChange={setShowOccupancyDetails}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Room Occupancy Details</DialogTitle>
            <DialogDescription>
              Detailed breakdown of your property's room statuses right now.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
             <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center flex flex-col items-center justify-center">
               <span className="text-3xl font-black text-slate-900">{stats.occupiedRooms}</span>
               <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">Occupied</span>
             </div>
             <div className="p-4 rounded-xl border border-slate-200 bg-emerald-50 text-center flex flex-col items-center justify-center">
               <span className="text-3xl font-black text-emerald-600">{stats.cleanRooms}</span>
               <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 mt-1">Clean</span>
             </div>
             <div className="p-4 rounded-xl border border-slate-200 bg-amber-50 text-center flex flex-col items-center justify-center">
               <span className="text-3xl font-black text-amber-600">{stats.dirtyRooms}</span>
               <span className="text-xs font-bold uppercase tracking-widest text-amber-600 mt-1">Dirty</span>
             </div>
             <div className="p-4 rounded-xl border border-slate-200 bg-rose-50 text-center flex flex-col items-center justify-center">
               <span className="text-3xl font-black text-rose-600">{stats.maintenanceRooms}</span>
               <span className="text-xs font-bold uppercase tracking-widest text-rose-600 mt-1">Maintenance</span>
             </div>
          </div>
          <div className="mt-4 p-4 rounded-xl bg-slate-100 border border-slate-200 flex justify-between items-center">
             <span className="text-sm font-bold text-slate-700">Total Bookable Inventory</span>
             <span className="text-lg font-black text-slate-900">{stats.totalRooms} Rooms</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
