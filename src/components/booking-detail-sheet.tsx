import { Sheet, SheetContent } from './ui/sheet';
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
  Link as LinkIcon,
  Timer,
  Lock,
  MessageSquare
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
  const { cancelBooking, checkIn, checkOut, updateBooking, rooms, updateRoomStatus, bookings, guests } = useBookings();
  
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

  // Reset internal navigation when the primary booking prop changes
  useEffect(() => {
    setActiveBookingId(null);
    setShowBalanceSettle(false);
    setShowPaymentSelection(false);
    setShowFinancialBreakdown(false);
  }, [booking?._id]);
  // ─── Hooks (Must be above early return) ───────────────────────────────────
  const currentBooking = activeBookingId ? bookings.find(b => b._id === activeBookingId) : booking;
  const isGroupBooking = !!currentBooking?.groupId;
  const [now, setNow] = useState(Date.now());

  // Live countdown update
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
  // Only expired if it's STILL an enquiry type — converted bookings keep the expiresAt field but should NOT show as expired
  const isEnquiryExpired = isEnquiry && expiryTime ? isBefore(expiryTime, now) : false;

  const priceStats = useMemo(() => {
    if (!currentBooking) return { taxAmount: 0, totalAmount: 0, balance: 0, subtotal: 0, nights: 0, roomPrice: 0, baseSubtotal: 0, extraAdults: 0, extraPersonCharge: 0 };
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

  const { taxAmount, totalAmount, balance, nights, roomPrice, baseSubtotal, extraAdults, extraPersonCharge } = priceStats;

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

  const displaySpecialRequests = useMemo(() => {
    if (!currentBooking?.specialRequests) return null;
    let text = currentBooking.specialRequests;
    text = text.replace(/GROUP:[^.]*\.\s*/g, '');
    text = text.replace(/Room Guest:[^.]*\.\s*/g, '');
    return text.trim() || null;
  }, [currentBooking?.specialRequests]);

  const getEffectiveStatus = () => {
    const type = currentBooking?.reservationType || currentBooking?.bookingType;
    if (type === 'enquiry') return 'enquiry';
    if (type === 'block') return 'block';
    return currentBooking?.status || 'reserved';
  };

  const statusConfig: Record<string, { color: string; bgColor: string; icon: React.ElementType; label: string }> = {
    'enquiry':     { color: 'text-amber-600', bgColor: 'bg-amber-500/10', icon: Timer, label: 'Enquiry' },
    'block':       { color: 'text-slate-600', bgColor: 'bg-slate-500/10', icon: Lock, label: 'Room Block' },
    'reserved':    { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', icon: Clock, label: 'Reserved' },
    'checked-in':  { color: 'text-blue-600', bgColor: 'bg-blue-500/10', icon: ShieldCheck, label: 'Checked In' },
    'checked-out': { color: 'text-orange-600', bgColor: 'bg-orange-500/10', icon: CheckCircle2, label: 'Checked Out' },
    'cancelled':   { color: 'text-red-600', bgColor: 'bg-red-500/10', icon: Trash2, label: 'Cancelled' },
  };

  const config = statusConfig[getEffectiveStatus()] || statusConfig.reserved;

  const handleConvertEnquiry = async () => {
    if (!currentBooking || isEnquiryExpired) return;
    setIsActioning(true);
    try {
      await updateBooking(currentBooking._id, { 
        reservationType: 'booking',
        status: 'reserved'
      });
      onClose();
    } catch (err) {
      console.error('Conversion failed:', err);
    } finally {
      setIsActioning(false);
    }
  };

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
    } catch (err: unknown) {
      console.error(err);
    }
    setIsActioning(false);
    setIsSettled(false);
  };

  const bookingData = currentBooking;

  if (!bookingData) return null;

  const handleBulkAction = async (action: (id: string) => Promise<void>, targetBookings: Booking[]) => {
    setGroupActionLoading(true);
    try {
      await Promise.all(targetBookings.map(b => action(b._id)));
      onClose();
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setGroupActionLoading(false);
    }
  };

  const handleGroupSettle = async (method: string) => {
    setGroupActionLoading(true);
    try {
      const payments = [];
      for (const b of sortedGroupRooms) {
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
         const bal = total - (b.advancePayment || 0);
         
         if (bal > 0) {
           payments.push(updateBooking(b._id, { advancePayment: (b.advancePayment || 0) + bal, paymentMethod: method as 'cash' | 'card' | 'upi' }));
         }
      }
      await Promise.all(payments);
      setIsSettled(true);
      await new Promise(r => setTimeout(r, 1500));
      setIsSettled(false);
      setShowBalanceSettle(false);
    } catch (e) {
      console.error(e);
    }
    setGroupActionLoading(false);
  };

  const handleInitialCheckIn = () => {
    if (room?.status === 'dirty') {
      setShowDirtyRoomPrompt(true);
    } else {
      handleAction(checkIn);
    }
  };

  const handleCheckInWithCleanup = async () => {
    if (!currentBooking) return;
    setShowDirtyRoomPrompt(false);
    setIsActioning(true);
    try {
      if (room?._id) await updateRoomStatus(room._id, 'clean');
      await checkIn(bookingData._id);
      onClose();
    } catch (err: unknown) {
      console.error(err);
    }
    setIsActioning(false);
  };

  const formatCountdownStr = (expiresAt: string): string => {
    const ms = new Date(expiresAt).getTime() - now;
    if (ms <= 0) return 'Expired';
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const taxConfig = hotel?.settings?.taxConfig;

  const handleGroupManagementAction = async (type: 'check-in' | 'check-out' | 'settle-checkout', method?: string) => {
    setGroupActionLoading(true);
    try {
      if (type === 'check-in') {
        const toCheckIn = sortedGroupRooms.filter(b => b.status === 'reserved');
        await Promise.all(toCheckIn.map(b => updateBooking(b._id, { status: 'checked-in' })));
      } else if (type === 'check-out') {
        const toCheckOut = sortedGroupRooms.filter(b => b.status === 'checked-in');
        await Promise.all(toCheckOut.map(b => updateBooking(b._id, { status: 'checked-out' })));
      } else if (type === 'settle-checkout') {
        const payments = [];
        for (const b of sortedGroupRooms) {
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
           const bal = total - (b.advancePayment || 0);
           
           payments.push(updateBooking(b._id, { 
              advancePayment: (b.advancePayment || 0) + Math.max(0, bal), 
              paymentMethod: method as 'cash' | 'card' | 'upi',
              status: 'checked-out'
           }));
        }
        await Promise.all(payments);
      }
      
      setShowGroupActionConfirm(null);
      if (type === 'settle-checkout') {
         setIsSettled(true);
         await new Promise(r => setTimeout(r, 1500));
         setIsSettled(false);
         setShowPaymentSelection(false);
      }
      onClose();
    } catch (e) {
      console.error(e);
    }
    setGroupActionLoading(false);
  };

  return (
    <Sheet open={!!booking} onOpenChange={() => { onClose(); setActiveBookingId(null); }}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-4xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white focus:outline-none">
        <div className="flex-1 overflow-y-auto scrollbar-hide print:hidden bg-slate-50/10">
          <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            {/* Left Panel: Primary Details (3/5 width) */}
            <div className="lg:col-span-3 p-5 sm:p-6 space-y-6">
              
              {/* Header Info */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none text-[10px] font-black uppercase tracking-widest px-2.5 h-6">
                         #{bookingData._id?.slice(-6).toUpperCase()}
                      </Badge>
                      {isGroupBooking && (
                        <Badge className="bg-indigo-600 text-white border-none text-[9px] font-black uppercase h-6 px-2.5 shadow-sm shadow-indigo-200">Group</Badge>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
                      {isBlock ? 'Room Block' : isEnquiry ? 'Enquiry Hold' : 'Booking Details'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    <div className={cn(
                      "px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm border h-8",
                      config.color, config.bgColor, "border-white/20"
                    )}>
                      <config.icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline-block">{config.label}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Group Room Switcher */}
                {isGroupBooking && (
                  <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Users className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Group: <span className="text-slate-900 ml-1">{bookingData.groupName}</span></p>
                      </div>
                      <Button 
                        size="sm" variant="ghost" className="h-6 text-[9px] font-black text-indigo-600 hover:bg-indigo-50 px-2 rounded-lg"
                        onClick={() => { setIsEditingGroup(true); setShowEditModal(true); }}
                      >
                        <Pencil className="h-2.5 w-2.5 mr-1" /> Edit Group
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sortedGroupRooms.map(gb => {
                        const rNum = typeof gb.roomId === 'object' ? gb.roomId.roomNumber : rooms.find(r => r._id === gb.roomId)?.roomNumber;
                        const isActive = (activeBookingId === gb._id) || (!activeBookingId && gb._id === booking?._id);
                        return (
                          <button
                            key={gb._id}
                            onClick={() => setActiveBookingId(gb._id)}
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border-2",
                              isActive
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                                : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                            )}
                          >
                            #{rNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Main Stay Detail Card */}
                <div className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-5 shadow-sm space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 z-0" />
                  
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-900 font-black text-xs">
                        {room?.roomNumber}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 leading-none mb-1">{room?.roomType}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected Unit</span>
                          {!isBlock && (
                            <div className="h-1 w-1 rounded-full bg-slate-200" />
                          )}
                          {!isBlock && (
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-1.5 rounded">{bookingData.planType} Plan</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                    <div className="flex-1 bg-slate-50 p-3.5 rounded-2xl space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Check-in</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-black text-slate-900">{format(new Date(bookingData.checkin), 'dd MMM')}</p>
                        <p className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{bookingData.checkinTime}</p>
                      </div>
                    </div>
                    <div className="flex-1 bg-slate-50 p-3.5 rounded-2xl space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Check-out</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-black text-slate-900">{format(new Date(bookingData.checkout), 'dd MMM')}</p>
                        <p className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{bookingData.checkoutTime}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-50 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                         <Timer className="h-3.5 w-3.5 text-slate-400" />
                         <span className="text-xs font-black text-slate-700">{nights} {nights === 1 ? 'Night' : 'Nights'}</span>
                      </div>
                      {!isBlock && (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                           <Users className="h-3.5 w-3.5 text-slate-400" />
                           <span className="text-xs font-black text-slate-700">{bookingData.adults}A + {bookingData.children}C</span>
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-auto">
                       <Clock className="h-3.5 w-3.5" />
                       <span className="whitespace-nowrap">Updated {bookingData.updatedAt ? format(new Date(bookingData.updatedAt), 'HH:mm') : '-'}</span>
                    </div>
                  </div>
                </div>

                {isEnquiry && (
                  <div className={cn(
                    "p-4 rounded-[20px] border flex items-center justify-between",
                    isEnquiryExpired ? "bg-red-50 border-red-100 text-red-600" : "bg-amber-50 border-amber-100 text-amber-600"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center",
                        isEnquiryExpired ? "bg-red-100" : "bg-amber-100"
                      )}>
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest">{isEnquiryExpired ? 'Expired' : 'Expires In'}</p>
                        <p className="text-xs font-black">{isEnquiryExpired ? 'Registration Closed' : formatCountdownStr(bookingData.enquiryExpiresAt!)}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("border-current text-[8px] font-black")}>
                      HOLD
                    </Badge>
                  </div>
                )}

                {isBlock && (
                  <div className="p-4 rounded-[20px] bg-slate-900 text-white shadow-xl shadow-slate-200 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                       <Lock className="h-5 w-5 text-white/60" />
                    </div>
                    <div className="flex-1">
                       <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-0.5">Maintenance Context</p>
                       <p className="text-sm font-black text-white">{bookingData.blockReason || 'General Maintenance'}</p>
                    </div>
                  </div>
                )}

                {/* Traveler Card */}
                {!isBlock && (
                  <div className="space-y-2.5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Primary Traveler</h3>
                    <button 
                      onClick={() => { if (guest?._id && onOpenGuest) onOpenGuest(guest._id); }}
                      className="w-full p-3.5 rounded-2xl bg-white border border-slate-100 group transition-all hover:border-primary/30 hover:shadow-md flex items-center gap-3.5 text-left"
                    >
                      <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-all">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 text-sm sm:text-base tracking-tight truncate">{guest?.name || 'Guest Details Missing'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                           <p className="text-[11px] text-slate-400 font-bold tracking-tight">{guest?.phone || 'No phone'}</p>
                           {guest?.email && <div className="h-1 w-1 rounded-full bg-slate-200" />}
                           {guest?.email && <p className="text-[11px] text-slate-400 font-bold tracking-tight truncate max-w-[120px]">{guest.email}</p>}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                    </button>
                  </div>
                )}
                
                {displaySpecialRequests && (
                  <div className="p-4 rounded-[20px] bg-amber-50/50 border border-transparent text-amber-800 space-y-1 relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-amber-200" />
                     <p className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px] opacity-70">
                       <MessageSquare className="h-3.5 w-3.5" /> Note
                     </p>
                     <p className="text-sm font-bold italic leading-relaxed">"{displaySpecialRequests}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Financials & Actions (2/5 width) */}
            <div className="lg:col-span-2 p-5 sm:p-6 space-y-6 flex flex-col lg:h-full lg:overflow-y-auto bg-white border-l border-slate-50 shadow-[inset_1px_0_0_rgba(0,0,0,0.02)]">
              {!isBlock && (
                <div className="space-y-4 flex-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">
                    {isGroupBooking ? `Group Financials (${sortedGroupRooms.length} Units)` : 'Settlement Details'}
                  </h3>
                  <div className="rounded-[22px] bg-white border border-slate-100 shadow-xl shadow-slate-100/50 p-4.5 space-y-4">
                      {/* Main Due Display - Refined for Space */}
                      <div className="flex flex-col gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] flex items-center gap-1.5">
                            <IndianRupee className="h-3 w-3" /> Net Balance Due
                          </p>
                          <div className="flex items-baseline gap-2">
                             <span className={cn(
                               "text-2xl sm:text-3xl font-black tracking-tighter tabular-nums leading-none",
                               activeStats.balance <= 0 ? 'text-emerald-500' : 'text-slate-900'
                             )}>
                               ₹{activeStats.balance.toLocaleString('en-IN')}
                             </span>
                             {activeStats.balance > 0 && (
                               <Badge variant="outline" className="text-[9px] font-black text-amber-600 border-amber-200 bg-amber-50 rounded-lg py-0">PENDING</Badge>
                             )}
                          </div>
                        </div>

                        {!isEnquiryExpired && bookingData.status !== 'cancelled' && activeStats.balance > 0 && (
                          <div className="w-full">
                            {!showBalanceSettle ? (
                              <Button 
                                size="lg" 
                                variant="default"
                                onClick={() => setShowBalanceSettle(true)}
                                className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-[0.1em] transition-all shadow-md shadow-emerald-500/10 active:scale-95 group border-none"
                              >
                                Settle Balance
                                <ChevronRight className="ml-1.5 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                              </Button>
                            ) : (
                               <div className="flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-200">
                                 <div className="flex items-center justify-between px-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Method</p>
                                    <button onClick={() => setShowBalanceSettle(false)} className="text-slate-300 hover:text-slate-500 transition-colors"><X className="h-3 w-3" /></button>
                                 </div>
                                 <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-50 border border-slate-100">
                                   {['cash', 'card', 'upi'].map((m) => (
                                    <button
                                      key={m}
                                      disabled={isActioning}
                                      onClick={() => {
                                        if(isGroupBooking) handleGroupSettle(m);
                                        else handleAction((id) => updateBooking(id, { advancePayment: (bookingData!.advancePayment || 0) + activeStats.balance, paymentMethod: m as any }), true);
                                      }}
                                      className="flex-1 h-7 text-[9px] font-black uppercase rounded-lg bg-white text-slate-600 border border-slate-100 shadow-sm hover:translate-y-[-1px] hover:text-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                                    >
                                      {isActioning ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : m}
                                    </button>
                                  ))}
                                </div>
                               </div>
                            )}
                          </div>
                        )}
                      {activeStats.balance <= 0 && (
                        <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl flex items-center gap-2">
                           <CheckCircle2 className="h-4 w-4" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Paid In Full</span>
                        </div>
                      )}
                    </div>

                    <Separator className="bg-slate-50" />

                    {/* Expandable Breakdown */}
                    <div className="space-y-3">
                       <button 
                         onClick={() => setShowFinancialBreakdown(!showFinancialBreakdown)}
                         className="flex items-center justify-between w-full group py-1"
                       >
                         <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 group-hover:text-primary transition-colors">Cost Breakdown</span>
                         {showFinancialBreakdown ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
                       </button>

                       {showFinancialBreakdown && (
                         <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                           <div className="flex justify-between text-[11px] font-bold text-slate-600 uppercase tracking-widest bg-slate-50/50 p-2.5 rounded-xl">
                             <span>Base Accomodation</span>
                             <span>₹{activeStats.baseSubtotal.toLocaleString('en-IN')}</span>
                           </div>
                           {activeStats.extraPersonCharge > 0 && (
                             <div className="flex justify-between text-[11px] font-bold text-slate-600 uppercase tracking-widest px-2.5">
                               <span>Extra Pax Surcharge</span>
                               <span>+ ₹{activeStats.extraPersonCharge.toLocaleString('en-IN')}</span>
                             </div>
                           )}
                           {taxConfig?.enabled && (
                             <div className="flex justify-between text-[11px] font-bold text-orange-500/80 uppercase tracking-widest px-2.5">
                               <span>GST ({taxConfig.cgst + taxConfig.sgst}%)</span>
                               <span>+ ₹{activeStats.taxAmount.toLocaleString('en-IN')}</span>
                             </div>
                           )}
                           <div className="h-[1px] bg-slate-50 mx-2" />
                           <div className="flex justify-between text-[11px] font-black text-slate-900 uppercase tracking-widest px-2.5">
                             <span>Gross Total</span>
                             <span>₹{(activeStats.totalAmount || 0).toLocaleString('en-IN')}</span>
                           </div>
                           {(activeStats.advancePayment || 0) > 0 && (
                             <div className="flex justify-between text-[11px] font-black text-emerald-600 uppercase tracking-widest px-2.5">
                               <span>Initial Advance</span>
                               <span>- ₹{(activeStats.advancePayment || 0).toLocaleString('en-IN')}</span>
                             </div>
                           )}
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              )}

                {/* Internal History / Audit */}
                <div className="space-y-3 pt-4 border-t border-slate-50">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Internal Reference</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 border border-slate-100 transition-colors hover:bg-slate-50">
                         <div className="h-7 w-7 shrink-0 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
                            <Clock className="h-3 w-3" />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5 whitespace-nowrap">Created On</p>
                            <p className="text-[10px] font-bold text-slate-700 truncate">{bookingData.createdAt ? format(new Date(bookingData.createdAt!), 'dd MMM yyyy, HH:mm') : 'System Entry'}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-100 transition-colors hover:bg-slate-50">
                         <div className="h-7 w-7 shrink-0 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-primary shadow-sm">
                            <ShieldCheck className="h-3 w-3" />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5 whitespace-nowrap">Authorised By</p>
                            <p className="text-[10px] font-black text-slate-800 tracking-tight truncate">{typeof bookingData!.createdBy === 'object' ? (bookingData!.createdBy as any).name : 'System Manager'}</p>
                         </div>
                      </div>
                    </div>
                 </div>

               {/* Quick Metadata */}
               <div className="mt-auto pt-6 flex items-center gap-2 opacity-10 justify-center group grayscale hover:grayscale-0 transition-all text-slate-900/50">
                  <Lock className="h-3 w-3" />
                  <span className="text-[9px] font-black uppercase tracking-[0.4em]">Encrypted Data Store</span>
               </div>
              </div>
            </div>
          </div>



        {!isEnquiryExpired && (
          <div className="p-3 bg-white border-t flex flex-col gap-2 relative z-10 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
            <div className="flex items-stretch gap-2 w-full h-10">
              {(bookingData!.status === 'reserved' || bookingData!.status === 'checked-in' || ((bookingData!.reservationType === 'block' || bookingData!.bookingType === 'block') && bookingData!.status !== 'cancelled')) && (
                <Button
                  variant="outline"
                  className="w-10 h-10 p-0 rounded-xl border-2 text-slate-400 border-slate-50 hover:border-indigo-100 hover:bg-indigo-50/50 hover:text-indigo-600 transition-all active:scale-95 shrink-0 shadow-sm"
                  onClick={() => setShowEditModal(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}

              {bookingData!.status === 'reserved' && (bookingData!.reservationType === 'booking' || bookingData!.bookingType === 'booking' || (!bookingData!.reservationType && !bookingData!.bookingType)) && (
                <Button
                  className="flex-1 h-full rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] uppercase tracking-[0.1em] shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2 border-none"
                  onClick={() => {
                     if(isGroupBooking) setShowGroupActionConfirm('check-in');
                     else handleInitialCheckIn();
                  }}
                  disabled={isActioning || groupActionLoading}
                >
                  {isActioning || groupActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Check-in {isGroupBooking ? 'Group' : 'Guest'}
                </Button>
              )}

              {(bookingData!.reservationType === 'enquiry' || bookingData!.bookingType === 'enquiry') && (
                <Button
                  className="flex-1 h-full rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-[0.1em] shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 border-none"
                  onClick={handleConvertEnquiry}
                  disabled={isActioning}
                >
                  {isActioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Confirm & Convert
                </Button>
              )}

              {bookingData!.status === 'checked-in' && (
                <div className="flex-1 flex gap-2 min-w-0">
                  {!showPaymentSelection ? (
                      <Button
                        disabled={isActioning}
                        className={cn(
                          "flex-1 h-full rounded-xl font-black text-[10px] uppercase tracking-[0.1em] truncate shadow-md transition-all active:scale-95 border-none",
                          activeStats.balance <= 0
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                            : "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200"
                        )}
                        onClick={() => {
                          if (activeStats.balance <= 0) {
                            if (isGroupBooking) setShowGroupActionConfirm('check-out');
                            else handleAction((id) => checkOut(id), true);
                          } else {
                            setShowPaymentSelection(true);
                          }
                        }}
                      >
                         {isActioning ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                         ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                              {activeStats.balance <= 0 ? (isGroupBooking ? 'Checkout Group' : 'Checkout Now') : (isGroupBooking ? 'Settle & Checkout Group' : 'Settle & Checkout')}
                            </>
                         )}
                      </Button>
                  ) : (
                    <div className={cn(
                      "flex-1 flex items-center p-1 rounded-xl animate-in fade-in zoom-in-95 duration-200 h-10 border shadow-sm",
                      isSettled ? "bg-emerald-500 text-white justify-center border-none" : "bg-white border-slate-100"
                    )}>
                      {isSettled ? (
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle2 className="h-4 w-4" /> Account Settled
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 w-full">
                          {['cash', 'card', 'upi'].map((m) => (
                            <button
                              key={m}
                              disabled={isActioning}
                              onClick={() => {
                                if (isGroupBooking) {
                                   handleGroupManagementAction('settle-checkout', m);
                                } else {
                                   handleAction((id) => updateBooking(id, { 
                                     status: 'checked-out', 
                                     advancePayment: (bookingData!.advancePayment || 0) + activeStats.balance, 
                                     paymentMethod: m as 'cash' | 'card' | 'upi'
                                   }), true);
                                }
                              }}
                              className="flex-1 h-8 text-[9px] font-black uppercase rounded-lg transition-all active:scale-95 bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-orange-600 flex items-center justify-center gap-1.5"
                            >
                              {isActioning ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : m}
                            </button>
                          ))}
                          <button onClick={() => setShowPaymentSelection(false)} className="px-2 text-slate-300 hover:text-slate-500 transition-colors"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {bookingData!.status !== 'cancelled' && bookingData!.status !== 'checked-out' && !showPaymentSelection && (
                <Button 
                  disabled={isActioning}
                  variant="outline" 
                  className="w-10 h-10 p-0 rounded-xl border-2 border-slate-50 text-red-400 hover:bg-red-50 hover:text-red-500 hover:border-red-100 shrink-0 transition-all active:scale-95 shadow-sm"
                  onClick={() => setShowCancelConfirm(true)}
                  title={(bookingData!.reservationType === 'block' || bookingData!.bookingType === 'block') ? 'Release Block' : 'Cancel'}
                >
                  {isActioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </div>
        )}

        <BookingModal 
          isOpen={showEditModal} 
          onClose={() => {
            setShowEditModal(false);
            setIsEditingGroup(false);
          }} 
          initialBooking={bookingData || undefined}
          isEditingGroup={isEditingGroup}
        />

        {/* Dialogs */}
        <Dialog open={showCancelConfirm} onOpenChange={(v) => { setShowCancelConfirm(v); if(!v) setCancelWholeGroup(false); }}>
          <DialogContent className="sm:max-w-[360px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-black">Cancel {cancelWholeGroup ? 'Entire Group' : 'Booking'}?</DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
            </DialogHeader>
            {(bookingData!.isGroup || bookingData!.groupId) && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <input 
                  type="checkbox" 
                  id="cancelGroup" 
                  checked={cancelWholeGroup} 
                  onChange={(e) => setCancelWholeGroup(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <label htmlFor="cancelGroup" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Cancel all rooms in "{bookingData!.groupName}"
                </label>
              </div>
            )}
            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" className="rounded-xl font-bold" onClick={() => setShowCancelConfirm(false)}>Keep It</Button>
              <Button 
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black" 
                onClick={() => { 
                  setShowCancelConfirm(false); 
                  if (cancelWholeGroup && bookingData!.groupId) {
                    handleBulkAction(cancelBooking, bookings.filter(b => b.groupId === bookingData!.groupId));
                  } else {
                    handleAction(cancelBooking);
                  }
                }}
              >
                Yes, Cancel {cancelWholeGroup ? 'All' : ''}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDirtyRoomPrompt} onOpenChange={setShowDirtyRoomPrompt}>
          <DialogContent className="sm:max-w-[360px] rounded-[28px] p-0 overflow-hidden border-none shadow-2xl">
            <div className="p-8 space-y-6 text-center">
              <div className="h-16 w-16 rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto border-4 border-white shadow-xl rotate-3">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black tracking-tight text-slate-900">Room is Dirty</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter leading-relaxed px-4">
                  Arrival ready check failed. Would you like to <span className="text-emerald-500">Auto-Clean</span> and proceed with check-in?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="rounded-xl font-bold border-slate-100 text-slate-400 h-11 hover:bg-slate-50 uppercase text-[9px] tracking-widest transition-all"
                  onClick={() => setShowDirtyRoomPrompt(false)}
                >
                  Hold On
                </Button>
                <Button 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black h-11 shadow-lg shadow-emerald-500/10 border-none transition-all active:scale-95 uppercase text-[9px] tracking-widest" 
                  onClick={handleCheckInWithCleanup}
                >
                  Mark Clean
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showGroupActionConfirm} onOpenChange={(v) => { if(!v) setShowGroupActionConfirm(null); }}>
          <DialogContent className="sm:max-w-[400px] rounded-[28px] p-0 overflow-hidden border-none shadow-2xl bg-white">
            <div className="p-8 space-y-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={cn(
                  "h-16 w-16 rounded-3xl flex items-center justify-center border-4 border-white shadow-xl -rotate-3 transition-transform hover:rotate-0 duration-300",
                  showGroupActionConfirm === 'check-in' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                )}>
                   <Users className="h-8 w-8" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">
                     {showGroupActionConfirm === 'check-in' ? 'Group Check-in' : 'Group Checkout'}
                  </h2>
                  <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.05em] px-4 leading-relaxed">
                     You are about to {showGroupActionConfirm === 'check-in' ? 'check-in' : 'check-out'} <span className={cn("font-black", showGroupActionConfirm === 'check-in' ? "text-indigo-500" : "text-emerald-500")}>ALL {bookings.filter(b => b.groupId === bookingData!.groupId).length} eligible rooms</span> in "{bookingData!.groupName}".
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button 
                  className={cn(
                    "w-full rounded-2xl font-black text-white h-12 shadow-xl transition-all active:scale-95 text-[11px] uppercase tracking-widest border-none", 
                    showGroupActionConfirm === 'check-in' ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                  )}
                  onClick={() => {
                     if (showGroupActionConfirm) handleGroupManagementAction(showGroupActionConfirm);
                  }}
                >
                  Proceed With Entire Group
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full rounded-2xl font-bold border-slate-100 hover:bg-slate-50 text-slate-500 h-10 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
                  onClick={() => {
                     setShowGroupActionConfirm(null);
                     if (showGroupActionConfirm === 'check-in') handleInitialCheckIn();
                     if (showGroupActionConfirm === 'check-out') handleAction((id) => updateBooking(id, { status: 'checked-out' }), true);
                  }}
                >
                  Just This Room
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
