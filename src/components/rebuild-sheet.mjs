import fs from 'fs';
const filepath = 'c:\\Users\\PRASAD\\OneDrive\\Desktop\\hotel\\frontend\\src\\components\\booking-detail-sheet.tsx';

const content = `import { Sheet, SheetContent } from './ui/sheet';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { format, differenceInDays, isBefore } from 'date-fns';
import { 
  User, 
  IndianRupee, 
  Clock, 
  ShieldCheck, 
  Users,
  Printer,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Pencil,
  Timer,
  Lock,
  MessageSquare,
  Smartphone,
  FileDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/auth-context';
import { useBookings, type Booking } from '../context/booking-context';
import { useState, useMemo, useEffect } from 'react';
import { BookingModal } from './booking-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';

interface BookingDetailSheetProps {
  booking: Booking | null;
  onClose: () => void;
  onOpenGuest?: (id: string) => void;
}

export function BookingDetailSheet({ booking, onClose, onOpenGuest }: BookingDetailSheetProps) {
  const { hotel } = useAuth();
  const { cancelBooking, checkIn, updateBooking, rooms, updateRoomStatus, bookings, guests } = useBookings();
  
  const [isActioning, setIsActioning] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [showBalanceSettle, setShowBalanceSettle] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [showDirtyRoomPrompt, setShowDirtyRoomPrompt] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [cancelWholeGroup, setCancelWholeGroup] = useState(false);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [showGroupActionConfirm, setShowGroupActionConfirm] = useState<'check-in' | 'check-out' | null>(null);
  const [showFinancialBreakdown, setShowFinancialBreakdown] = useState(false);

  useEffect(() => {
    setActiveBookingId(null);
    setShowBalanceSettle(false);
    setShowPaymentSelection(false);
    setShowFinancialBreakdown(false);
  }, [booking?._id]);

  const currentBooking = activeBookingId ? bookings.find(b => b._id === activeBookingId) : booking;
  const isGroupBooking = !!currentBooking?.groupId;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!currentBooking?.enquiryExpiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [currentBooking?.enquiryExpiresAt]);

  const bookingRoom = useMemo(() => {
    if (!currentBooking) return null;
    return typeof currentBooking.roomId === 'object' ? currentBooking.roomId : rooms.find(r => r._id === currentBooking.roomId);
  }, [currentBooking, rooms]);

  const liveRoom = useMemo(() => bookingRoom ? rooms.find(r => r._id === bookingRoom._id) : null, [bookingRoom, rooms]);
  const room = liveRoom || bookingRoom; 
  const guest = useMemo(() => {
    if (!currentBooking) return null;
    if (typeof currentBooking.guestId === 'object') return currentBooking.guestId;
    return guests.find(g => g._id === currentBooking.guestId) || null;
  }, [currentBooking, guests]);

  const sortedGroupRooms = useMemo(() => {
    if (!currentBooking?.isGroup || !currentBooking.groupId) return [];
    return bookings
      .filter(b => b.groupId === currentBooking.groupId && b.status !== 'cancelled' && b.status !== 'expired')
      .sort((a, b) => {
        const rA = typeof a.roomId === 'object' ? a.roomId.roomNumber : rooms.find(r => r._id === a.roomId)?.roomNumber || '';
        const rB = typeof b.roomId === 'object' ? b.roomId.roomNumber : rooms.find(r => r._id === b.roomId)?.roomNumber || '';
        return rA.localeCompare(rB, undefined, { numeric: true });
      });
  }, [currentBooking, bookings, rooms]);

  const expiryTime = currentBooking?.enquiryExpiresAt ? new Date(currentBooking.enquiryExpiresAt) : null;
  const isBlock = currentBooking?.reservationType === 'block' || currentBooking?.bookingType === 'block';
  const isEnquiry = currentBooking?.reservationType === 'enquiry' || currentBooking?.bookingType === 'enquiry';
  const isEnquiryExpired = isEnquiry && expiryTime ? isBefore(expiryTime, now) : false;

  const priceStats = useMemo(() => {
    if (!currentBooking) return { taxAmount: 0, totalAmount: 0, balance: 0, subtotal: 0, nights: 0, roomPrice: 0, baseSubtotal: 0, extraAdults: 0, extraPersonCharge: 0, advancePayment: 0 };
    const n = Math.max(1, differenceInDays(new Date(currentBooking.checkout), new Date(currentBooking.checkin)));
    const rp = currentBooking.roomPrice || room?.price || 0;
    const bs = rp * n;
    const ea = Math.max(0, (currentBooking.adults || 0) - (currentBooking.baseOccupancy || 2));
    const ep = ea * (currentBooking.extraPersonPrice || 0) * n;
    const sub = bs + ep;
    const tc = hotel?.settings?.taxConfig;
    let tax = 0;
    if (tc?.enabled && tc.cgst !== undefined && tc.sgst !== undefined && sub > 0) {
      tax = (sub * (tc.cgst || 0) / 100) + (sub * (tc.sgst || 0) / 100);
    }
    const total = sub + tax;
    return { 
      taxAmount: tax, 
      totalAmount: total, 
      balance: total - (currentBooking.advancePayment || 0), 
      subtotal: sub,
      nights: n,
      roomPrice: rp,
      baseSubtotal: bs,
      extraAdults: ea,
      extraPersonCharge: ep,
      advancePayment: currentBooking.advancePayment || 0
    };
  }, [currentBooking, room, hotel?.settings?.taxConfig]);

  const groupPriceStats = useMemo(() => {
    if (!isGroupBooking) return null;
    let groupBase = 0, groupExtra = 0, groupAdvance = 0, groupTotal = 0, groupTax = 0;
    
    sortedGroupRooms.forEach(b => {
      const n = Math.max(1, differenceInDays(new Date(b.checkout), new Date(b.checkin)));
      const rp = b.roomPrice || rooms.find(r => r._id === (typeof b.roomId === 'object' ? b.roomId._id : b.roomId))?.price || 0;
      const bs = rp * n;
      const ea = Math.max(0, (b.adults || 0) - (b.baseOccupancy || 2));
      const ep = ea * (b.extraPersonPrice || 0) * n;
      const sub = bs + ep;
      
      let tax = 0;
      const tc = hotel?.settings?.taxConfig;
      if (tc?.enabled && tc.cgst !== undefined && tc.sgst !== undefined && sub > 0) {
        tax = (sub * (tc.cgst || 0) / 100) + (sub * (tc.sgst || 0) / 100);
      }
      const total = sub + tax;
      
      groupBase += bs;
      groupExtra += ep;
      groupAdvance += (b.advancePayment || 0);
      groupTax += tax;
      groupTotal += total;
    });

    return {
      baseSubtotal: groupBase,
      extraPersonCharge: groupExtra,
      taxAmount: groupTax,
      totalAmount: groupTotal,
      advancePayment: groupAdvance,
      balance: groupTotal - groupAdvance
    };
  }, [isGroupBooking, sortedGroupRooms, rooms, hotel?.settings?.taxConfig]);

  const activeStats = groupPriceStats || priceStats;
  const bookingData = currentBooking;
  if (!bookingData) return null;

  const handleAction = async (action: (id: string) => Promise<void>, isSettlement?: boolean) => {
    if (!currentBooking) return;
    setIsActioning(true);
    try {
      await action(currentBooking._id);
      if (isSettlement) {
        setIsSettled(true);
        await new Promise(r => setTimeout(r, 1500));
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsActioning(false);
      setIsSettled(false);
    }
  };

  const handleInitialCheckIn = () => {
    if (room?.status === 'dirty') {
      setShowDirtyRoomPrompt(true);
    } else {
      const updateData: any = { status: 'checked-in' };
      if ((bookingData.securityDepositAmount || 0) > 0 && bookingData.securityDepositStatus === 'pending') {
        updateData.securityDepositStatus = 'held';
      }
      handleAction((id) => updateBooking(id, updateData));
    }
  };

  const handleCheckInWithCleanup = async () => {
    setShowDirtyRoomPrompt(false);
    setIsActioning(true);
    try {
      if (room?._id) await updateRoomStatus(room._id, 'clean');
      const updateData: any = { status: 'checked-in' };
      if ((bookingData.securityDepositAmount || 0) > 0 && bookingData.securityDepositStatus === 'pending') {
        updateData.securityDepositStatus = 'held';
      }
      await updateBooking(bookingData._id, updateData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsActioning(false);
    }
  };

  const handleGroupSettle = async (method: string) => {
    setGroupActionLoading(true);
    try {
      const payments = sortedGroupRooms.map(b => {
        const n = Math.max(1, differenceInDays(new Date(b.checkout), new Date(b.checkin)));
        const rp = b.roomPrice || rooms.find(r => r._id === (typeof b.roomId === 'object' ? b.roomId._id : b.roomId))?.price || 0;
        const sub = (rp * n) + (Math.max(0, (b.adults || 0) - (b.baseOccupancy || 2)) * (b.extraPersonPrice || 0) * n);
        let tax = 0;
        const tc = hotel?.settings?.taxConfig;
        if (tc?.enabled && sub > 0) tax = (sub * (tc.cgst || 0) / 100) + (sub * (tc.sgst || 0) / 100);
        const total = sub + tax;
        const bal = total - (b.advancePayment || 0);
        return bal > 0 ? updateBooking(b._id, { advancePayment: (b.advancePayment || 0) + bal, paymentMethod: method as any }) : Promise.resolve();
      });
      await Promise.all(payments);
      setIsSettled(true);
      await new Promise(r => setTimeout(r, 1500));
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setGroupActionLoading(false);
    }
  };

  const handleGroupManagementAction = async (type: 'check-in' | 'check-out' | 'settle-checkout', method?: string) => {
    setGroupActionLoading(true);
    try {
      if (type === 'check-in') {
        await Promise.all(sortedGroupRooms.filter(b => b.status === 'reserved').map(b => {
           const updateData: any = { status: 'checked-in' };
           if ((b.securityDepositAmount || 0) > 0 && b.securityDepositStatus === 'pending') updateData.securityDepositStatus = 'held';
           return updateBooking(b._id, updateData);
        }));
      } else if (type === 'check-out') {
        await Promise.all(sortedGroupRooms.filter(b => b.status === 'checked-in').map(b => updateBooking(b._id, { status: 'checked-out' })));
      } else if (type === 'settle-checkout') {
        await Promise.all(sortedGroupRooms.map(b => {
           const rp = b.roomPrice || rooms.find(r => r._id === (typeof b.roomId === 'object' ? b.roomId._id : b.roomId))?.price || 0;
           const sub = (rp * Math.max(1, differenceInDays(new Date(b.checkout), new Date(b.checkin)))) + (Math.max(0, (b.adults || 0) - (b.baseOccupancy || 2)) * (b.extraPersonPrice || 0));
           const total = sub + (hotel?.settings?.taxConfig?.enabled ? ((sub * (hotel.settings.taxConfig.cgst || 0) / 100) + (sub * (hotel.settings.taxConfig.sgst || 0) / 100)) : 0);
           return updateBooking(b._id, { status: 'checked-out', advancePayment: (b.advancePayment || 0) + Math.max(0, total - (b.advancePayment || 0)), paymentMethod: method as any });
        }));
      }
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setGroupActionLoading(false);
    }
  };

  const config = {
    'enquiry':     { color: 'text-amber-600', bgColor: 'bg-amber-500/10', icon: Timer, label: 'Enquiry' },
    'block':       { color: 'text-slate-600', bgColor: 'bg-slate-500/10', icon: Lock, label: 'Room Block' },
    'reserved':    { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', icon: Clock, label: 'Reserved' },
    'checked-in':  { color: 'text-blue-600', bgColor: 'bg-blue-500/10', icon: ShieldCheck, label: 'Checked In' },
    'checked-out': { color: 'text-orange-600', bgColor: 'bg-orange-500/10', icon: CheckCircle2, label: 'Checked Out' },
    'cancelled':   { color: 'text-red-600', bgColor: 'bg-red-500/10', icon: Trash2, label: 'Cancelled' },
  }[(!currentBooking ? 'reserved' : currentBooking.reservationType === 'enquiry' ? 'enquiry' : currentBooking.reservationType === 'block' ? 'block' : currentBooking.status)] || { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', icon: Clock, label: 'Reserved' };

  return (
    <Sheet open={!!booking} onOpenChange={() => { onClose(); setActiveBookingId(null); }}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-4xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
        <div className="flex-1 overflow-y-auto print:hidden bg-slate-50/10">
          <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            {/* Left Panel */}
            <div className="lg:col-span-3 p-5 sm:p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none text-[10px] font-black uppercase tracking-widest px-2.5 h-6">
                        #{bookingData._id?.slice(-6).toUpperCase()}
                      </Badge>
                      {isGroupBooking && <Badge className="bg-indigo-600 text-white border-none text-[9px] font-black uppercase h-6 px-2.5">Group</Badge>}
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900">{isBlock ? 'Room Block' : isEnquiry ? 'Enquiry Hold' : 'Booking Details'}</h2>
                  </div>
                  <div className={cn("px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm border h-8", config.color, config.bgColor)}>
                    <config.icon className="h-3.5 w-3.5" />
                    <span>{config.label}</span>
                  </div>
                </div>

                {isGroupBooking && (
                  <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Group: <span className="text-slate-900">{bookingData.groupName}</span></p>
                    <div className="flex flex-wrap gap-2">
                      {sortedGroupRooms.map(gb => (
                        <button key={gb._id} onClick={() => setActiveBookingId(gb._id)} className={cn("px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border-2", activeBookingId === gb._id ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-100 text-slate-400")}>
                          #{typeof gb.roomId === 'object' ? gb.roomId.roomNumber : rooms.find(r => r._id === gb.roomId)?.roomNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-3xl border border-slate-100 p-4 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-900 font-black text-xs">{room?.roomNumber}</div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">{room?.roomType}</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{bookingData.planType} Plan</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-slate-50 p-3 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Check-in</p>
                      <p className="text-sm font-black">{format(new Date(bookingData.checkin), 'dd MMM')}</p>
                    </div>
                    <div className="flex-1 bg-slate-50 p-3 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Check-out</p>
                      <p className="text-sm font-black">{format(new Date(bookingData.checkout), 'dd MMM')}</p>
                    </div>
                  </div>
                </div>

                {!isBlock && guest && (
                  <div className="space-y-2.5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Primary Traveler</h3>
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-100 flex items-center gap-3.5">
                      <div className="h-11 w-11 rounded-xl bg-primary/5 text-primary flex items-center justify-center"><User className="h-4 w-4" /></div>
                      <div>
                        <p className="font-black text-slate-900 text-sm truncate">{guest.name}</p>
                        <p className="text-[11px] text-slate-400 font-bold">{guest.phone}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel */}
            <div className="lg:col-span-2 p-5 sm:p-6 space-y-6 bg-white flex flex-col">
              {!isBlock && (
                <div className="space-y-4 flex-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Financial Summary</h3>
                  <div className="rounded-[22px] bg-white border border-slate-100 shadow-xl p-4.5 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] flex items-center gap-1.5"><IndianRupee className="h-3 w-3" /> Net Balance Due</p>
                      <div className="flex items-baseline gap-2">
                        <span className={cn("text-2xl font-black tabular-nums", activeStats.balance <= 0 ? 'text-emerald-500' : 'text-slate-900')}>₹{activeStats.balance.toLocaleString('en-IN')}</span>
                        {activeStats.balance > 0 && <Badge variant="outline" className="text-[8px] font-black uppercase text-rose-500 border-rose-100 bg-rose-50">Overdue</Badge>}
                      </div>
                      <div className="mt-4 space-y-1.5">
                        <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                          <span>Paid: ₹{(activeStats.advancePayment || 0).toLocaleString('en-IN')}</span>
                          <span>Total: ₹{activeStats.totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: \`\${Math.min(100, ((activeStats.advancePayment || 0) / (activeStats.totalAmount || 1)) * 100)}%\` }} />
                        </div>
                      </div>
                    </div>

                    {!isEnquiryExpired && bookingData.status !== 'cancelled' && activeStats.balance > 0 && (
                      <div className="w-full">
                        {!showBalanceSettle ? (
                          <Button size="lg" className="w-full h-9 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase" onClick={() => setShowBalanceSettle(true)}>Settle Balance</Button>
                        ) : (
                          <div className="space-y-2.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase">Select Method</p>
                            <div className="grid grid-cols-2 gap-2">
                              {['Cash', 'Card', 'UPI'].map(m => (
                                <Button key={m} size="sm" variant="outline" className="text-[9px] font-black uppercase" onClick={() => isGroupBooking ? handleGroupSettle(m.toLowerCase()) : handleAction(id => updateBooking(id, { advancePayment: (bookingData.advancePayment || 0) + activeStats.balance, paymentMethod: m.toLowerCase() as any }), true)}>{m}</Button>
                              ))}
                              <Button size="sm" variant="ghost" onClick={() => setShowBalanceSettle(false)} className="text-[9px] font-black uppercase">Cancel</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <button onClick={() => setShowFinancialBreakdown(!showFinancialBreakdown)} className="flex items-center justify-between w-full text-[11px] font-black uppercase text-slate-500">
                      <span>Cost Breakdown</span>
                      {showFinancialBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {showFinancialBreakdown && (
                      <div className="space-y-2 pt-1">
                        <div className="flex justify-between text-[11px] font-bold text-slate-600 px-2"><span>Room Charges</span><span>₹{activeStats.baseSubtotal.toLocaleString('en-IN')}</span></div>
                        <div className="flex justify-between text-[11px] font-black text-slate-900 px-2 pt-1 border-t"><span>Total Bill</span><span>₹{activeStats.totalAmount.toLocaleString('en-IN')}</span></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 bg-white border-t flex gap-2">
          {bookingData.status === 'reserved' && (
            <Button className="flex-1 rounded-xl bg-indigo-600 text-white font-black uppercase text-[10px]" onClick={handleInitialCheckIn} disabled={isActioning}>Check-in</Button>
          )}
          {bookingData.status === 'checked-in' && (
            <Button className="flex-1 rounded-xl bg-orange-500 text-white font-black uppercase text-[10px]" onClick={() => { if(activeStats.balance > 0) setShowPaymentSelection(true); else handleAction(id => updateBooking(id, { status: 'checked-out' }), true); }}>Checkout</Button>
          )}
          <Button variant="ghost" size="icon" className="text-red-400" onClick={() => setShowCancelConfirm(true)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </SheetContent>

      <BookingModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} initialBooking={bookingData} />
      
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Cancel Booking?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>No</Button>
            <Button variant="destructive" onClick={() => handleAction(cancelBooking)}>Yes, Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
\`;

fs.writeFileSync(filepath, content, 'utf8');
console.log('Successfully rebuilt BookingDetailSheet.tsx from ground up.');
