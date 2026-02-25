import React, { useState, useMemo, useEffect } from 'react';
import { 
  Receipt, 
  CreditCard, 
  Download, 
  IndianRupee, 
  Utensils, 
  WashingMachine, 
  BedDouble,
  CheckCircle2,
  Search,
  ChevronRight,
  Printer,
  ArrowRight,
  Banknote,
  Smartphone,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { useBookings } from '../context/booking-context';
import { useAuth } from '../context/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';

export function FolioView({ bookingId: initialBookingId }: { bookingId?: string }) {
  const { bookings, rooms, guests, updateBooking } = useBookings();
  const { hotel } = useAuth();
  const [activeTab, setActiveTab] = useState<'folio' | 'payments'>('folio');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(initialBookingId || bookings[0]?._id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState(0);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const guest = typeof b.guestId === 'object' ? b.guestId : guests.find(g => g._id === b.guestId);
      const room = typeof b.roomId === 'object' ? b.roomId : rooms.find(r => r._id === b.roomId);
      const searchStr = `${guest?.name} ${room?.roomNumber} ${b.status}`.toLowerCase();
      return searchStr.includes(searchQuery.toLowerCase());
    }).slice(0, 10);
  }, [bookings, guests, rooms, searchQuery]);

  const booking = useMemo(() => bookings.find(b => b._id === selectedBookingId), [bookings, selectedBookingId]);

  const financials = useMemo(() => {
    if (!booking) return { charges: [], payments: [], subtotal: 0, tax: 0, total: 0, paid: 0, balance: 0 };

    const room = typeof booking.roomId === 'object' ? booking.roomId : rooms.find(r => r._id === booking.roomId);
    const checkin = new Date(booking.checkin);
    const checkout = new Date(booking.checkout);
    const nights = Math.max(1, Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Prioritize roomPrice from booking record, fallback to current room price
    const rate = booking.roomPrice || room?.price || 0;
    const roomCharge = rate * nights;
    
    const charges = [
      { id: 'room-1', type: 'room', description: `Stay Charge: Room ${room?.roomNumber || '???'} (${nights}N)`, amount: roomCharge, date: booking.checkin }
    ];

    const payments = [
      { id: 'pre-1', method: booking.bookingSource || 'Advance', amount: booking.advancePayment || 0, date: booking.checkin, status: 'completed' }
    ];

    const subtotal = roomCharge;
    const taxConfig = hotel?.settings?.taxConfig;
    let tax = 0;
    
    if (taxConfig?.enabled) {
      const cgst = (subtotal * (taxConfig.cgst || 0)) / 100;
      const sgst = (subtotal * (taxConfig.sgst || 0)) / 100;
      tax = cgst + sgst;
    }

    const total = subtotal + tax;
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = total - paid;

    return { charges, payments, subtotal, tax, total, paid, balance, nights, guestName: (typeof booking.guestId === 'object' ? booking.guestId.name : guests.find(g => g._id === booking.guestId)?.name) || 'Guest' };
  }, [booking, hotel, rooms, guests]);

  useEffect(() => {
    if (isSettleModalOpen && financials.balance > 0) {
      setSettleAmount(financials.balance);
    }
  }, [isSettleModalOpen, financials.balance]);

  const handleSettlePayments = async () => {
     if (!booking) return;
     const finalAmount = settleAmount || financials.balance;
     if (finalAmount <= 0) return;
     
     try {
        await updateBooking(booking._id, { 
          advancePayment: (booking.advancePayment || 0) + finalAmount 
        });
        setIsSettleModalOpen(false);
        setSettleAmount(0);
     } catch (err) {
        console.error(err);
     }
  }

  const handlePrint = () => { window.print(); };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'room': return <BedDouble className="h-4 w-4" />;
      case 'restaurant': return <Utensils className="h-4 w-4" />;
      case 'laundry': return <WashingMachine className="h-4 w-4" />;
      default: return <Receipt className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Guest Directory Sidebar - Responsive: Top on mobile, Left on large */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
             <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-1">Guest Directory</h4>
             <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input 
                  placeholder="Search..." 
                  className="h-9 rounded-xl bg-slate-50 border-none pl-9 text-xs font-medium"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
             </div>
             <div className="space-y-1 max-h-[300px] lg:max-h-[500px] overflow-y-auto pr-1">
               {filteredBookings.map(b => {
                 const g = typeof b.guestId === 'object' ? b.guestId : guests.find(g => g._id === b.guestId);
                 const r = typeof b.roomId === 'object' ? b.roomId : rooms.find(r => r._id === b.roomId);
                 const isActive = selectedBookingId === b._id;
                 return (
                   <button
                     key={b._id}
                     onClick={() => setSelectedBookingId(b._id)}
                     className={cn(
                       "w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between group",
                       isActive 
                         ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10" 
                         : "bg-white border-transparent hover:bg-slate-50 text-slate-900"
                     )}
                   >
                     <div className="min-w-0">
                       <p className="text-xs font-bold truncate">{g?.name || 'Guest'}</p>
                       <p className={cn("text-[10px] uppercase font-medium mt-0.5 opacity-60", isActive ? "text-slate-300" : "text-slate-500")}>
                         Room {r?.roomNumber || '??'}
                       </p>
                     </div>
                     <ChevronRight className={cn("h-3 w-3", isActive ? "text-white" : "text-slate-300")} />
                   </button>
                 );
               })}
             </div>
          </div>
        </div>

        {/* Statement View */}
        <div className="lg:col-span-3">
          {!booking ? (
            <div className="h-[400px] flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8">
               <Receipt className="h-10 w-10 text-slate-200 mb-4" />
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Select a Guest</h3>
               <p className="text-xs text-slate-300 mt-2 max-w-[240px]">Select a reservation to view the financial statement.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              <div className="xl:col-span-2 space-y-4">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  {/* Header */}
                  <div className="p-4 md:p-8 border-b border-slate-100 bg-slate-50/50">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
                             <CreditCard className="h-6 w-6 text-white" />
                          </div>
                          <div>
                             <h2 className="text-lg md:text-xl font-bold text-slate-900">{financials.guestName}</h2>
                             <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">#{booking._id.toUpperCase().slice(-8)}</p>
                               <Separator orientation="vertical" className="hidden sm:block h-2" />
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{financials.nights} Nights Stay</p>
                             </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="rounded-lg h-7 text-[10px] font-bold uppercase tracking-wider">
                               {booking.status}
                           </Badge>
                           <Button variant="outline" size="icon" onClick={handlePrint} className="h-8 w-8 rounded-lg cursor-pointer">
                              <Printer className="h-4 w-4" />
                           </Button>
                        </div>
                     </div>
                  </div>

                  <CardContent className="p-4 md:p-8">
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
                       {[
                         { id: 'folio', label: 'Ledger' },
                         { id: 'payments', label: 'Payments' }
                       ].map(t => (
                         <button 
                           key={t.id}
                           onClick={() => setActiveTab(t.id as any)}
                           className={cn(
                             "px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                             activeTab === t.id 
                               ? "bg-slate-900 text-white" 
                               : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                           )}
                         >
                            {t.label}
                         </button>
                       ))}
                    </div>

                    <div className="space-y-3">
                       {activeTab === 'folio' ? (
                          <>
                            {/* Desktop Table Header (Implicit via layout) */}
                            <div className="hidden md:block">
                               {financials.charges.map(c => (
                                 <div key={c.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 transition-all mb-3">
                                    <div className="flex items-center gap-4">
                                       <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                          {getTypeIcon(c.type)}
                                       </div>
                                       <div>
                                          <p className="text-sm font-bold text-slate-900">{c.description}</p>
                                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">{new Date(c.date).toLocaleDateString()}</p>
                                       </div>
                                    </div>
                                    <p className="font-bold text-sm text-slate-900">₹{c.amount.toLocaleString()}</p>
                                 </div>
                               ))}
                            </div>

                            {/* Mobile Card-style Ledger */}
                            <div className="md:hidden space-y-3">
                               {financials.charges.map(c => (
                                 <div key={c.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-transparent">
                                    <div className="flex items-center gap-3">
                                       <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-slate-400 border border-slate-100">
                                          {getTypeIcon(c.type)}
                                       </div>
                                       <div>
                                          <p className="text-[11px] font-bold text-slate-800 leading-tight">{c.description}</p>
                                          <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-0.5">{format(new Date(c.date), 'dd MMM')}</p>
                                       </div>
                                    </div>
                                    <p className="font-bold text-xs text-slate-900 ml-2 whitespace-nowrap">₹{c.amount.toLocaleString()}</p>
                                 </div>
                               ))}
                            </div>
                            
                            {financials.tax > 0 && (
                              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-dashed border-slate-200">
                                 <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">Service Tax (GST)</p>
                                 <p className="text-[10px] md:text-xs font-bold text-slate-500 italic">₹{financials.tax.toLocaleString()}</p>
                              </div>
                            )}
                          </>
                       ) : (
                          <>
                            <div className="hidden md:block">
                               {financials.payments.map(p => (
                                 <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:border-emerald-200 transition-all mb-3">
                                     <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                           <CheckCircle2 className="h-5 w-5" />
                                        </div>
                                        <div>
                                           <p className="text-sm font-bold text-slate-900">{p.method}</p>
                                           <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-widest mt-0.5">{new Date(p.date).toLocaleDateString()}</p>
                                        </div>
                                     </div>
                                     <p className="font-bold text-sm text-emerald-600">₹{p.amount.toLocaleString()}</p>
                                 </div>
                               ))}
                            </div>

                            <div className="md:hidden space-y-3">
                               {financials.payments.map(p => (
                                 <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                                     <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center text-emerald-600 border border-emerald-100">
                                           <CheckCircle2 className="h-4 w-4" />
                                        </div>
                                        <div>
                                           <p className="text-[11px] font-bold text-slate-800 leading-tight">{p.method}</p>
                                           <p className="text-[9px] font-medium text-emerald-600 uppercase tracking-widest mt-0.5">{format(new Date(p.date), 'dd MMM')}</p>
                                        </div>
                                     </div>
                                     <p className="font-bold text-xs text-emerald-600 ml-2 whitespace-nowrap">₹{p.amount.toLocaleString()}</p>
                                 </div>
                               ))}
                            </div>

                            {financials.payments.length === 0 && (
                              <div className="py-12 text-center text-slate-300">
                                 <p className="text-xs font-bold uppercase tracking-widest">No payments recorded</p>
                              </div>
                            )}
                          </>
                       )}
                    </div>
                  </CardContent>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white space-y-8 shadow-xl">
                 <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Balance Due</p>
                    <h3 className="text-3xl font-bold">₹{financials.balance.toLocaleString()}</h3>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-medium text-white/40 uppercase tracking-widest">Revenue</span>
                       <span className="font-bold">₹{financials.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="font-medium text-white/40 uppercase tracking-widest">Tax</span>
                       <span className="font-bold">₹{financials.tax.toLocaleString()}</span>
                    </div>
                    <Separator className="bg-white/10" />
                    <div className="flex justify-between items-center text-xs text-emerald-400">
                       <span className="font-bold uppercase tracking-widest">Paid</span>
                       <span className="font-bold">- ₹{financials.paid.toLocaleString()}</span>
                    </div>
                 </div>

                 <div className="space-y-2 pt-4">
                    {financials.balance > 0 ? (
                      <Button 
                        onClick={() => setIsSettleModalOpen(true)} 
                        className="w-full h-12 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold uppercase tracking-widest text-xs cursor-pointer shadow-none"
                      >
                         Settle Account
                      </Button>
                    ) : (
                      <div className="w-full h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center gap-2 border border-emerald-500/30">
                         <CheckCircle2 className="h-4 w-4" />
                         <span className="text-[10px] font-bold uppercase tracking-widest">Cleared</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                       <Button variant="outline" onClick={handlePrint} className="h-10 rounded-xl border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 font-bold uppercase tracking-widest text-[10px] cursor-pointer">
                          <Printer className="mr-2 h-3 w-3" /> Print
                       </Button>
                       <Button variant="outline" className="h-10 rounded-xl border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 font-bold uppercase tracking-widest text-[10px] cursor-pointer">
                          <Download className="mr-2 h-3 w-3" /> PDF
                       </Button>
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={isSettleModalOpen} onOpenChange={setIsSettleModalOpen}>
        <DialogContent className="sm:max-w-[360px] rounded-3xl p-0 border-none shadow-2xl overflow-hidden">
          <div className="bg-slate-900 p-6 text-white">
             <DialogHeader>
                <DialogTitle className="text-lg font-bold uppercase tracking-wider">Record Payment</DialogTitle>
                <DialogDescription className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Collecting for {financials.guestName}</DialogDescription>
             </DialogHeader>
          </div>
          <div className="p-6 space-y-4 bg-white">
             <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Amount (INR)</label>
                <div className="relative">
                   <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                   <Input 
                      type="number" 
                      className="h-12 rounded-xl bg-slate-50 border-none pl-10 text-base font-bold" 
                      value={settleAmount || ''} 
                      onChange={e => setSettleAmount(Number(e.target.value))}
                   />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-2">
                <button className="h-12 rounded-xl border border-slate-100 hover:bg-slate-50 flex flex-col items-center justify-center transition-all">
                   <Banknote className="h-4 w-4 text-slate-400" />
                   <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mt-1">Cash</span>
                </button>
                <button className="h-12 rounded-xl border border-slate-100 hover:bg-slate-50 flex flex-col items-center justify-center transition-all">
                   <Smartphone className="h-4 w-4 text-slate-400" />
                   <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mt-1">UPI</span>
                </button>
             </div>

             <DialogFooter className="pt-2">
                <Button onClick={handleSettlePayments} className="w-full h-12 rounded-xl bg-primary text-white font-bold uppercase tracking-widest text-xs">
                   Confirm Settle <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
             </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden Print Receipt */}
      {booking && (
        <div className="hidden print:block absolute inset-0 bg-white p-8 text-black font-sans text-sm">
          <div className="flex justify-between items-end border-b pb-6 mb-6">
            <div>
              <h1 className="text-2xl font-bold uppercase">{hotel?.name}</h1>
              <p className="text-[10px] opacity-60">TAX INVOICE</p>
            </div>
            <div className="text-right">
              <p className="font-bold">#INV-{booking._id.slice(-6).toUpperCase()}</p>
              <p className="text-xs opacity-60">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Bill To</p>
              <p className="font-bold">{financials.guestName}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ref</p>
              <p className="font-bold">ROOM {(typeof booking.roomId === 'object' ? booking.roomId : rooms.find(r => r._id === booking.roomId))?.roomNumber}</p>
            </div>
          </div>
          <table className="w-full mb-8">
            <thead className="border-b">
              <tr className="text-[8px] font-bold uppercase text-slate-400">
                <th className="text-left py-2">Service</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {financials.charges.map((c: any) => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="py-2 font-medium">{c.description}</td>
                  <td className="py-2 text-right font-bold">₹{c.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto w-48 space-y-2">
            <div className="flex justify-between text-xs opacity-60">
              <span>Subtotal</span>
              <span>₹{financials.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs opacity-60">
              <span>GST</span>
              <span>₹{financials.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-2">
              <span>Total</span>
              <span>₹{financials.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Paid</span>
              <span>- ₹{financials.paid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2 border-slate-900">
              <span>Balance</span>
              <span>₹{financials.balance.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
