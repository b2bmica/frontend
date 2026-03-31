import { useMemo, useState, useEffect } from 'react';
import { useBookings } from '../context/booking-context';
import { differenceInDays, format, startOfToday, startOfDay } from 'date-fns';
import { 
  CreditCard,
  AlertCircle,
  TrendingUp,
  Search,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Printer,
  History,
  Smartphone,
  FileDown,
  Plus,
  RefreshCcw,
  CheckCircle,
  MessageSquare,
  IndianRupee,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { api } from '../lib/api';
import { calculateBookingPrice } from '../lib/pricing';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

export function FinanceDashboard() {
  const { bookings, rooms, guests } = useBookings();
  const { hotel } = useAuth();
  const token = api.getToken();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [financeData, setFinanceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchFinanceSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/finance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setFinanceData(data);
    } catch (err) {
      console.error('Finance fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchFinanceSummary();
  }, [token]);

  // Frontend filtering logic
  const activeBookings = bookings.filter(b => 
    !['cancelled', 'expired'].includes(b.status) &&
    b.reservationType !== 'block'
  );

  const billingData = useMemo(() => {
    const billList = activeBookings.map(b => {
      const room = typeof b.roomId === 'object' ? b.roomId : rooms.find(r => r._id === b.roomId);
      const guest = typeof b.guestId === 'object' ? b.guestId : guests.find(g => g._id === b.guestId);
      const totalPaid = b.paymentLogs?.reduce((sum, log) => sum + log.amount, 0) || b.advancePayment || 0;
      
      const p = calculateBookingPrice({
        roomPrice: b.roomPrice || (room as any)?.price || 0,
        checkin: b.checkin,
        checkout: b.checkout,
        adults: b.adults || 2,
        baseOccupancy: b.baseOccupancy || 2,
        extraPersonRate: b.extraPersonPrice || 0,
        planType: b.planType as any || 'EP',
        mealRates: (hotel?.settings?.mealRates as any) || {},
        gstRates: hotel?.settings?.taxConfig as any,
        isDayUse: b.checkin === b.checkout
      });

      const totalAmount = p.grandTotal;
      const balance = Math.max(0, totalAmount - totalPaid);

      return {
        ...b,
        room,
        guest,
        totalAmount,
        totalPaid,
        unpaidBalance: balance
      };
    }).sort((a, b) => new Date(a.checkin).getTime() - new Date(b.checkin).getTime());

    return { billList };
  }, [activeBookings, rooms, guests, hotel?.settings?.taxConfig]);

  const filteredData = billingData.billList.filter(b => {
    const nameStr = b.guest?.name || '';
    const roomStr = b.room?.roomNumber || '';
    const matchesSearch = 
      nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roomStr.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (statusFilter === 'dues') return b.unpaidBalance > 0;
    if (statusFilter === 'paid') return b.unpaidBalance === 0;
    if (statusFilter === 'in-house') return b.status === 'checked-in';
    
    return true;
  });

  const [isActioning, setIsActioning] = useState(false);
  const [showOpeningCashDialog, setShowOpeningCashDialog] = useState(false);
  const [tempOpeningCash, setTempOpeningCash] = useState('');

  const handleUpdateOpeningCash = async () => {
    try {
      setIsActioning(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/opening-cash`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: Number(tempOpeningCash) })
      });
      if (!res.ok) throw new Error('Update failed');
      await fetchFinanceSummary();
      setShowOpeningCashDialog(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsActioning(false);
    }
  };

  const handleFinalizeFinance = async () => {
    if (!window.confirm('Are you sure you want to finalize the financial records for today? This will lock the cash closing balance.')) return;
    try {
      setIsActioning(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/analytics/finalize-finance`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ summary: financeData })
      });
      if (!res.ok) throw new Error('Finalize failed');
      await fetchFinanceSummary();
      alert('Day finalized successfully!');
    } catch (err) {
      console.error(err);
    } finally {
      setIsActioning(false);
    }
  };

  const stats = financeData?.row1 || { outstandingAmount: 0, todayCollection: { total: 0, cash: 0, upi: 0, card: 0 }, advanceCollected: 0 };
  const row2 = financeData?.row2 || { unpaidCheckoutsToday: { count: 0, amount: 0 }, overdueBills: { count: 0, amount: 0 }, partialPaidGuests: { count: 0, amount: 0 } };
  const cashClosing = financeData?.cashClosing || { openingCash: 0, collectedToday: 0, refunds: 0, closingCash: 0 };
  const isFinalized = financeData?.isFinalized || false;

  return (
    <div className="space-y-6 pb-20 w-full max-w-7xl mx-auto px-4 md:px-8 mt-6">
      
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">Guest Bills</h2>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Manage all payments and dues from one place</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="rounded-2xl border-slate-200 font-bold h-11 px-6 shadow-sm hover:bg-slate-50">
            <Printer className="h-4 w-4 mr-2" /> Print Invoice
          </Button>
          <Button className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 shadow-indigo-100 shadow-lg" onClick={() => setShowOpeningCashDialog(true)}>
            <Wallet className="h-4 w-4 mr-2" /> Set Opening Cash
          </Button>
          <Button variant="ghost" className="h-11 w-11 p-0 rounded-2xl hover:bg-slate-100" onClick={fetchFinanceSummary}>
             <RefreshCcw className={cn("h-5 w-5 text-slate-400", (loading || isActioning) && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Outstanding Amount" value={`₹${stats.outstandingAmount.toLocaleString('en-IN')}`} icon={AlertCircle} color="rose" />
        <StatCard 
          title="Today's Collection" 
          value={`₹${stats.todayCollection.total.toLocaleString('en-IN')}`} 
          icon={TrendingUp} 
          color="emerald" 
          subValue={`Cash: ₹${stats.todayCollection.cash} • UPI: ₹${stats.todayCollection.upi} • Card: ₹${stats.todayCollection.card}`}
        />
        <StatCard title="Advance Collected" value={`₹${stats.advanceCollected.toLocaleString('en-IN')}`} icon={CreditCard} color="blue" />
      </div>

      {/* Row 2: Operational Stats & Cash Closing */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-4 grid-cols-1 sm:grid-cols-2">
           <AlertMetric title="Unpaid Checkouts Today" count={row2.unpaidCheckoutsToday.count} amount={row2.unpaidCheckoutsToday.amount} color="rose" />
           <AlertMetric title="Overdue Bills" count={row2.overdueBills.count} amount={row2.overdueBills.amount} color="rose" />
           <AlertMetric title="Partial Paid Guests" count={row2.partialPaidGuests.count} amount={row2.partialPaidGuests.amount} color="amber" />
        </div>

        <Card className="rounded-[32px] border-none shadow-xl bg-slate-900 text-white overflow-hidden relative group h-full">
           <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-slate-900 to-emerald-500/10 opacity-80 pointer-events-none" />
           <CardHeader className="p-6 pb-2 relative z-10 border-none">
             <div className="flex justify-between items-center">
               <CardTitle className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                 <Wallet className="h-5 w-5 text-emerald-400" />
                 Cash Closing
               </CardTitle>
               <Badge className={cn(
                 "border-none text-[9px] uppercase font-black px-2.5 h-6 backdrop-blur-md",
                 isFinalized ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-amber-400"
               )}>
                 {isFinalized ? 'Finalized' : 'Live'}
               </Badge>
             </div>
           </CardHeader>
           <CardContent className="p-6 relative z-10 space-y-5">
              <div className="grid grid-cols-2 gap-y-6">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-white/40 tracking-widest leading-none">Opening</p>
                    <p className="text-xl font-bold">₹{cashClosing.openingCash.toLocaleString('en-IN')}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest leading-none">Collected</p>
                    <p className="text-xl font-bold text-emerald-400">+ ₹{cashClosing.collectedToday.toLocaleString('en-IN')}</p>
                 </div>
                 <div className="space-y-1 border-t border-white/5 pt-3">
                    <p className="text-[10px] font-black uppercase text-rose-400 tracking-widest leading-none">Refunds</p>
                    <p className="text-xl font-bold text-rose-400">- ₹{cashClosing.refunds.toLocaleString('en-IN')}</p>
                 </div>
                 <div className="space-y-1 border-t border-white/5 pt-3">
                    <p className="text-[10px] font-black uppercase text-white/40 tracking-widest leading-none">Closing</p>
                    <p className="text-xl font-bold text-white">₹{cashClosing.closingCash.toLocaleString('en-IN')}</p>
                 </div>
              </div>
              <Button 
                className={cn(
                  "w-full h-11 rounded-2xl font-bold text-[11px] uppercase tracking-widest transition-all",
                  isFinalized ? "bg-emerald-500/10 text-emerald-500 cursor-default" : "bg-white text-slate-900 hover:bg-emerald-50 hover:text-emerald-700"
                )}
                disabled={isFinalized || isActioning}
                onClick={handleFinalizeFinance}
              >
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : isFinalized ? 'Finalized for Day' : 'Finalise Cash for Day'}
              </Button>
           </CardContent>
        </Card>
      </div>

      {/* Main Table: Guest Bills */}
      <Card className="rounded-[32px] border border-slate-200/60 shadow-sm bg-white overflow-hidden">
        <CardHeader className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
           <div>
             <CardTitle className="text-2xl font-black tracking-tighter text-slate-900">Guest Bills Ledger</CardTitle>
           </div>
           
           <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative flex-1 md:w-80">
               <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <Input 
                 className="pl-10 h-11 rounded-2xl border-slate-200 bg-white shadow-sm focus:ring-4 focus:ring-indigo-100 font-bold transition-all"
                 placeholder="Search guest or room..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
             </div>
             <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-11 rounded-2xl font-bold bg-white shadow-sm border-slate-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 shadow-xl font-bold">
                  <SelectItem value="all">All Bills</SelectItem>
                  <SelectItem value="dues">Dues Only</SelectItem>
                  <SelectItem value="paid">Fully Paid</SelectItem>
                  <SelectItem value="in-house">In-House</SelectItem>
                </SelectContent>
             </Select>
           </div>
        </CardHeader>
        
        <CardContent className="p-0 overflow-x-auto scrollbar-hide">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100/30 border-b border-slate-100">
                  <th className="px-8 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-slate-500">Guest Name</th>
                  <th className="px-8 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-slate-500">Room</th>
                  <th className="px-8 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-slate-500">Total Bill</th>
                  <th className="px-8 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-slate-500">Paid</th>
                  <th className="px-8 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-slate-500">Balance</th>
                  <th className="px-8 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-slate-500 text-center">Status</th>
                  <th className="px-8 py-4 font-black uppercase text-[10px] tracking-[0.2em] text-slate-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-16 text-center text-slate-400 font-black text-xs uppercase tracking-[0.3em]">
                        No records found
                    </td>
                  </tr>
                ) : (
                  filteredData.map(b => {
                    const isUnpaidCheckoutToday = b.status === 'checked-in' && startOfDay(new Date(b.checkout)).getTime() === startOfToday().getTime() && b.unpaidBalance > 0;
                    const isPartial = b.unpaidBalance > 0 && b.totalPaid > 0;
                    const isPaid = b.unpaidBalance === 0;

                    return (
                      <tr 
                        key={b._id} 
                        className={cn(
                          "transition-all group border-l-[4px] border-l-transparent",
                          isUnpaidCheckoutToday ? "bg-rose-50/70 hover:bg-rose-100/80 border-l-rose-500" : 
                          isPartial ? "bg-amber-50/50 hover:bg-amber-100/50 border-l-amber-500" : 
                          isPaid ? "bg-emerald-50/30 hover:bg-emerald-50/60 border-l-emerald-500" :
                          "hover:bg-slate-50"
                        )}
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition-transform">
                              {b.guest?.name?.[0] || 'G'}
                            </div>
                            <div>
                              <p className="font-black text-slate-900 text-sm tracking-tight">{b.guest?.name || 'Walk-in Guest'}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Stay from {format(new Date(b.checkin), 'MMM dd')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                           <Badge variant="outline" className="rounded-xl px-2.5 h-7 font-black text-[10px] bg-white border-slate-200 text-slate-600 shadow-sm">
                              #{b.room?.roomNumber || '?'}
                           </Badge>
                        </td>
                        <td className="px-8 py-5 font-black text-slate-900">
                           ₹{b.totalAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="px-8 py-5">
                           <p className="font-black text-emerald-600">₹{b.totalPaid.toLocaleString('en-IN')}</p>
                        </td>
                        <td className="px-8 py-5">
                           <p className={cn("font-black text-base tabular-nums", b.unpaidBalance > 0 ? "text-rose-600" : "text-emerald-500")}>
                             {b.unpaidBalance > 0 ? `₹${b.unpaidBalance.toLocaleString('en-IN')}` : '₹0'}
                           </p>
                        </td>
                        <td className="px-8 py-5 text-center">
                           <Badge className={cn(
                             "uppercase font-black text-[9px] tracking-[0.15em] px-3 py-1.5 rounded-xl border-none shadow-sm",
                             isPaid ? "bg-emerald-500 text-white" : 
                             isUnpaidCheckoutToday ? "bg-rose-600 text-white animate-pulse" :
                             isPartial ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"
                           )}>
                             {isPaid ? 'Paid' : isUnpaidCheckoutToday ? 'Unpaid Checkout' : isPartial ? 'Partial' : 'Pending'}
                           </Badge>
                        </td>
                        <td className="px-8 py-5 text-right">
                           <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-white hover:text-emerald-600 shadow-none border-slate-100 border">
                               <Smartphone className="h-4 w-4" />
                             </Button>
                             <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-white hover:text-indigo-600 shadow-none border-slate-100 border">
                               <Printer className="h-4 w-4" />
                             </Button>
                           </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
        </CardContent>
      </Card>

      {/* Opening Cash Dialog */}
      <Dialog open={showOpeningCashDialog} onOpenChange={setShowOpeningCashDialog}>
        <DialogContent className="sm:max-w-[400px] rounded-[32px]">
           <DialogHeader>
             <DialogTitle className="text-xl font-black">Set Opening Cash</DialogTitle>
             <DialogDescription>Enter the starting cash balance for today's shift.</DialogDescription>
           </DialogHeader>
           <div className="py-6">
             <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input 
                  type="number" 
                  className="pl-12 h-14 rounded-2xl border-slate-200 font-bold text-xl" 
                  placeholder="0.00"
                  value={tempOpeningCash}
                  onChange={(e) => setTempOpeningCash(e.target.value)}
                />
             </div>
           </div>
           <DialogFooter>
             <Button variant="ghost" onClick={() => setShowOpeningCashDialog(false)} className="rounded-xl font-bold">Cancel</Button>
             <Button onClick={handleUpdateOpeningCash} className="rounded-xl bg-slate-900 text-white font-bold" disabled={isActioning}>
               {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Balance'}
             </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subValue }: { title: string, value: string, icon: any, color: 'rose' | 'emerald' | 'blue' | 'slate', subValue?: string }) {
  const colorMap = {
    rose: "bg-rose-50 text-rose-600 border-rose-100 shadow-rose-50/30",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-50/30",
    blue: "bg-blue-50 text-blue-600 border-blue-100 shadow-blue-50/30",
    slate: "bg-slate-50 text-slate-600 border-slate-100 shadow-slate-50/30"
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
      <Card className="rounded-[40px] border border-slate-100 shadow-sm bg-white overflow-hidden group hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 p-1">
        <CardContent className="p-7">
          <div className={cn("p-4 rounded-3xl w-fit mb-7 transition-all duration-500 group-hover:scale-110 shadow-lg", colorMap[color])}>
            <Icon className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1 leading-none">{title}</h3>
            <p className="text-3xl font-black tracking-tighter text-slate-900 leading-tight">{value}</p>
            {subValue && (
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-50 italic">
                <p className="text-[10px] font-bold text-slate-400 truncate leading-none">{subValue}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AlertMetric({ title, count, amount, color }: { title: string, count: number, amount: number, color: 'rose' | 'blue' | 'amber' }) {
  const colorMap: any = {
    rose: "bg-white border-rose-100 text-rose-700 hover:bg-rose-50/50",
    blue: "bg-white border-blue-100 text-blue-700 hover:bg-blue-50/50",
    amber: "bg-white border-amber-100 text-amber-700 hover:bg-amber-50/50"
  };

  return (
    <div className={cn("p-6 rounded-[32px] border-2 flex items-center justify-between group cursor-default transition-all duration-300", colorMap[color])}>
      <div className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-widest opacity-60 leading-none">{title}</p>
        <div className="flex items-baseline gap-2">
           <span className="text-3xl font-black leading-none">{count}</span>
           <span className="text-xs font-bold opacity-60 uppercase tracking-widest">Guests</span>
        </div>
      </div>
      <div className="text-right flex flex-col items-end">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1 leading-none">Total Due</p>
        <div className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-black text-base shadow-sm group-hover:scale-105 transition-transform">
          ₹{amount.toLocaleString('en-IN')}
        </div>
      </div>
    </div>
  );
}

