import { useMemo } from 'react';
import { 
  IndianRupee, 
  TrendingUp, 
  Bed, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  Building2,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useBookings, type Booking } from '../context/booking-context';
import { useAuth } from '../context/auth-context';
import { format, isSameDay, startOfToday, differenceInDays } from 'date-fns';
import { cn } from '../lib/utils';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';

export function PerformanceReport() {
  const { bookings, rooms } = useBookings();
  const { hotel } = useAuth();
  const today = startOfToday();
  const taxConfig = hotel?.settings?.taxConfig;

  const reportData = useMemo(() => {
    const activeBookings = bookings.filter(b => b.status !== 'cancelled');
    const todayBookings = activeBookings.filter(b => isSameDay(new Date(b.checkin), today));
    const todayCheckouts = activeBookings.filter(b => isSameDay(new Date(b.checkout), today));
    const inHouse = activeBookings.filter(b => b.status === 'checked-in');
    
    // Revenue Calculation Helper
    const calculateTotalWithTax = (booking: Booking) => {
        const room = typeof booking.roomId === 'object' ? booking.roomId : rooms.find(r => r._id === booking.roomId);
        const nights = Math.max(1, differenceInDays(new Date(booking.checkout), new Date(booking.checkin)));
        const base = (booking.roomPrice || room?.price || 0) * nights;
        
        if (taxConfig?.enabled) {
            const taxRate = (taxConfig.cgst || 0) + (taxConfig.sgst || 0);
            return base + (base * taxRate / 100);
        }
        return base;
    }

    // Revenue Calculation
    const totalRevenue = activeBookings.reduce((sum, b) => sum + calculateTotalWithTax(b), 0);

    // Collection today
    const todayCollection = todayBookings.reduce((sum, b) => sum + calculateTotalWithTax(b), 0);
    
    // Pending Dues
    const pendingDues = inHouse.reduce((sum, b) => {
      const total = calculateTotalWithTax(b);
      const advance = b.advancePayment || 0;
      return sum + Math.max(0, total - advance);
    }, 0);

    const occupancyRate = rooms.length > 0 ? Math.round((inHouse.length / rooms.length) * 100) : 0;

    return {
      revenue: totalRevenue,
      collection: todayCollection,
      pending: pendingDues,
      occupancy: occupancyRate,
      arrivals: todayBookings.length,
      departures: todayCheckouts.length,
      inHouse: inHouse.length,
      recentTransactions: activeBookings.slice(0, 5)
    };
  }, [bookings, rooms, today]);

  return (
    <div className="space-y-8 pb-20">
      {/* Prime Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales', value: `₹${(reportData.revenue / 1000).toFixed(1)}K`, sub: 'Life-time', icon: IndianRupee, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Today Arrivals', value: reportData.arrivals.toString(), sub: 'New Check-ins', icon: CalendarDays, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'In-House Now', value: reportData.inHouse.toString(), sub: `${reportData.occupancy}% Occupancy`, icon: Bed, color: 'text-purple-500', bg: 'bg-purple-50' },
          { label: 'Pending Dues', value: `₹${reportData.pending.toLocaleString()}`, sub: 'From active guests', icon: Wallet, color: 'text-orange-500', bg: 'bg-orange-50' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-none shadow-md bg-white overflow-hidden rounded-[32px] group hover:shadow-xl transition-all">
              <CardContent className="p-6">
                <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", stat.bg)}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-2xl font-black tracking-tight text-slate-900 mt-1">{stat.value}</h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Operational Feed */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-[40px] overflow-hidden">
          <CardHeader className="p-8 border-b border-slate-50">
             <div className="flex items-center justify-between">
                <div>
                   <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                      Live Transaction Feed
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                   </CardTitle>
                   <CardDescription className="text-[10px] font-black uppercase tracking-widest mt-1">Audit trail of recent property activities</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl font-black text-[10px] uppercase tracking-widest h-9 border-slate-200">
                   <FileText className="h-3.5 w-3.5 mr-2" /> Full Ledger
                </Button>
             </div>
          </CardHeader>
          <CardContent className="p-0">
             <Table>
                <TableHeader className="bg-slate-50/50">
                   <TableRow className="border-none">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 px-8">Traveler</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-right px-8">Net Amount</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {reportData.recentTransactions.map((tx) => {
                      const guest = typeof tx.guestId === 'object' ? tx.guestId : null;
                      return (
                        <TableRow key={tx._id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                           <TableCell className="py-5 px-8">
                              <div className="flex items-center gap-4">
                                 <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-500">
                                    {guest?.name?.[0] || 'G'}
                                 </div>
                                 <div>
                                    <p className="font-bold text-sm text-slate-900">{guest?.name || 'Guest User'}</p>
                                    <p className="text-[10px] font-bold text-slate-400 font-mono uppercase">ID: #{tx._id.slice(-6)}</p>
                                 </div>
                              </div>
                           </TableCell>
                           <TableCell>
                              <Badge className={cn(
                                 "text-[8px] font-black uppercase tracking-tight py-0.5",
                                 tx.status === 'checked-in' ? "bg-blue-100 text-blue-600 border-none shadow-none" :
                                 tx.status === 'reserved' ? "bg-emerald-100 text-emerald-600 border-none shadow-none" :
                                 "bg-slate-100 text-slate-500 border-none shadow-none"
                              )}>
                                 {tx.status}
                              </Badge>
                           </TableCell>
                           <TableCell className="text-right px-8 font-black text-slate-900 italic">
                              ₹{((tx.roomPrice || (typeof tx.roomId === 'object' ? tx.roomId?.price : 0) || 0) * Math.max(1, differenceInDays(new Date(tx.checkout), new Date(tx.checkin)))).toLocaleString()}
                           </TableCell>
                        </TableRow>
                      );
                   })}
                </TableBody>
             </Table>
          </CardContent>
        </Card>

        {/* Quick Insights */}
        <div className="space-y-6">
           <Card className="border-none shadow-sm bg-slate-900 text-white rounded-[40px] overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10"><TrendingUp className="h-24 w-24" /></div>
              <CardHeader className="p-8 pb-4">
                 <CardTitle className="text-white font-black tracking-tight text-lg">Property Health</CardTitle>
                 <CardDescription className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Yield Optimization</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-8">
                 <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                       <span>Occupancy Saturation</span>
                       <span className="text-white">{reportData.occupancy}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                       <motion.div initial={{ width: 0 }} animate={{ width: `${reportData.occupancy}%` }} className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                    </div>
                 </div>

                 <div className="flex items-center gap-6">
                    <div className="flex-1 p-5 rounded-3xl bg-white/5 border border-white/5">
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Rooms</p>
                       <p className="text-2xl font-black">{rooms.length}</p>
                    </div>
                    <div className="flex-1 p-5 rounded-3xl bg-white/5 border border-white/5">
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Guests</p>
                       <p className="text-2xl font-black">{reportData.inHouse}</p>
                    </div>
                 </div>
              </CardContent>
           </Card>

           <Card className="border-none shadow-sm bg-white rounded-[40px] overflow-hidden border border-slate-100">
              <CardHeader className="p-8 pb-4 font-mono">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Daily To-Do</h4>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-4">
                 {[
                    { label: 'Pending Check-ins', value: reportData.arrivals, icon: ArrowUpRight, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Scheduled Departures', value: reportData.departures, icon: ArrowDownRight, color: 'text-orange-500', bg: 'bg-orange-50' },
                 ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-4 rounded-3xl bg-slate-50 hover:bg-white border border-transparent hover:border-slate-100 transition-all group">
                       <div className="flex items-center gap-4">
                          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", item.bg)}>
                             <item.icon className={cn("h-5 w-5", item.color)} />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{item.label}</span>
                       </div>
                       <span className="text-lg font-black font-mono">{item.value}</span>
                    </div>
                 ))}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
