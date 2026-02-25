import { useState, useMemo } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  TrendingUp, 
  Wallet, 
  Smartphone, 
  CreditCard as CardIcon, 
  Banknote,
  PieChart
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { useBookings } from '../context/booking-context';
import { format, isSameDay } from 'date-fns';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';

export function CashierReport() {
  const { bookings, guests, rooms } = useBookings();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const reportData = useMemo(() => {
    const dailyBookings = bookings.filter(b => isSameDay(new Date(b.checkin), selectedDate));
    
    const total = dailyBookings.reduce((sum, b) => sum + (b.advancePayment || 0), 0);
    
    const bySource = dailyBookings.reduce((acc, b) => {
      const source = b.bookingSource || 'direct';
      acc[source] = (acc[source] || 0) + (b.advancePayment || 0);
      return acc;
    }, {} as Record<string, number>);

    const transactions = dailyBookings.map(b => {
      const guest = typeof b.guestId === 'object' ? b.guestId : guests.find(g => g._id === b.guestId);
      return {
        id: b._id,
        booking: b._id.toUpperCase().slice(-8),
        guest: guest?.name || 'Guest',
        amount: b.advancePayment || 0,
        method: b.bookingSource || 'Direct',
        time: format(new Date(), 'hh:mm a') // Fallback as we don't store payment time
      };
    });

    return { total, bySource, transactions };
  }, [bookings, guests, selectedDate]);

  const getMethodIcon = (method: string) => {
    const m = method.toLowerCase();
    if (m === 'cash') return <Banknote className="h-4 w-4 text-green-500" />;
    if (m.includes('card')) return <CardIcon className="h-4 w-4 text-blue-500" />;
    return <Wallet className="h-4 w-4 text-purple-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">Daily Cashier Report</h2>
          <p className="text-muted-foreground text-xs md:text-sm font-medium">Review payments and transactions for today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => {
              const newDate = new Date(d);
              newDate.setDate(newDate.getDate() - 1);
              return newDate;
            })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-2 md:px-4 flex items-center gap-2 font-bold text-[10px] md:text-xs uppercase tracking-wider">
              <Calendar className="h-3 w-3 md:h-4 md:w-4 text-primary" />
              {format(selectedDate, 'MMM dd, yyyy')}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => {
              const newDate = new Date(d);
              newDate.setDate(newDate.getDate() + 1);
              return newDate;
            })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl font-bold uppercase text-[9px] md:text-[10px] tracking-widest px-3 md:px-4 h-10 flex-1 md:flex-none">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Total Collection', value: reportData.total, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Digital / OTA', value: Object.entries(reportData.bySource).filter(([s]) => s !== 'direct').reduce((s, [,v]) => s + v, 0), icon: Smartphone, color: 'text-purple-500', bg: 'bg-purple-100/50' },
          { label: 'Direct Entry', value: reportData.bySource.direct || 0, icon: Banknote, color: 'text-emerald-500', bg: 'bg-emerald-100/50' },
          { label: 'Avg per Trans', value: reportData.transactions.length > 0 ? reportData.total / reportData.transactions.length : 0, icon: Wallet, color: 'text-blue-500', bg: 'bg-blue-100/50' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-none shadow-sm bg-white overflow-hidden hover:shadow-md transition-all group h-full">
              <CardContent className="p-4 md:p-6">
                <div className="flex justify-between items-start">
                  <div className={cn("p-1.5 md:p-2.5 rounded-lg md:rounded-2xl", stat.bg)}>
                    <stat.icon className={cn("h-4 w-4 md:h-5 md:w-5", stat.color)} />
                  </div>
                </div>
                <div className="mt-3 md:mt-4">
                  <p className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">{stat.label}</p>
                  <p className="text-sm md:text-2xl font-black mt-1 tracking-tight">₹{Math.round(stat.value).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-base font-black tracking-tight flex items-center gap-2 font-mono">
              <div className="h-6 w-1 bg-primary rounded-full" />
              Transaction Ledger
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Entry of all payments received on {format(selectedDate, 'MMM dd')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Ref</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Traveler</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Source</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                         <p className="text-xs font-bold uppercase tracking-widest opacity-40">No transactions recorded for this date</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.transactions.map((tx) => (
                      <TableRow key={tx.id} className="cursor-pointer hover:bg-slate-50/50 transition-colors border-slate-50">
                        <TableCell className="font-mono text-[10px] font-black text-slate-400">#{tx.booking}</TableCell>
                        <TableCell className="font-bold text-xs">{tx.guest}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest py-0.5 border-slate-100 bg-white">
                              {tx.method}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-xs">₹{tx.amount.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile List View */}
            <div className="md:hidden divide-y divide-slate-50">
               {reportData.transactions.length === 0 ? (
                 <div className="py-12 text-center px-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">No transactions yet</p>
                 </div>
               ) : (
                 reportData.transactions.map((tx) => (
                   <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors">
                      <div className="space-y-1">
                         <div className="flex items-center gap-2">
                           <span className="text-[9px] font-black font-mono text-slate-300 uppercase tracking-tighter">#{tx.booking}</span>
                           <h4 className="text-xs font-bold text-slate-900">{tx.guest}</h4>
                         </div>
                         <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0 border-slate-100 bg-slate-50/50">
                           {tx.method}
                         </Badge>
                      </div>
                      <div className="text-right">
                         <p className="text-sm font-black text-slate-900">₹{tx.amount.toLocaleString()}</p>
                         <p className="text-[9px] font-medium text-slate-400">{tx.time}</p>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden relative">
          <CardHeader>
            <CardTitle className="text-base font-black tracking-tight flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Intelligence
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Source Distribution</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center min-h-[300px] pt-0">
             <div className="relative w-40 h-40 rounded-full border-[12px] border-slate-100 flex items-center justify-center shadow-inner">
                <div className="absolute inset-0 rounded-full border-[12px] border-primary border-t-transparent border-r-transparent rotate-45" />
                <div className="text-center">
                  <p className="text-2xl font-black tracking-tighter">₹{Math.round(reportData.total / 1000)}K</p>
                  <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">Revenue</p>
                </div>
             </div>
             <div className="space-y-3 mt-8 w-full">
                {Object.entries(reportData.bySource).map(([source, val]) => {
                  const pct = reportData.total > 0 ? Math.round((val / reportData.total) * 100) : 0;
                  return (
                    <div key={source} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                       <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-primary" />
                         <span className="text-slate-500">{source}</span>
                       </div>
                       <span className="text-primary">{pct}%</span>
                    </div>
                  );
                })}
                {reportData.transactions.length === 0 && <p className="text-center text-[9px] font-bold uppercase tracking-widest text-slate-300">Insufficient Data</p>}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
