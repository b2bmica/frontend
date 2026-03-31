import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { format, differenceInDays, isBefore, parseISO, startOfDay, addDays } from 'date-fns';
import { calculateBookingPrice } from '../lib/pricing';
import { isExpiredBooking, formatTime } from '../lib/utils';

const PLAN_LABELS = {
  EP: 'Room Only',
  CP: 'Continental Plan',
  MAP: 'Modified American Plan',
  AP: 'American Plan'
};

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
  FileDown,
  Save,
  Undo2,
  ArrowLeft,
  Calendar,
  BedDouble,
  Info
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
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editPlanCustomText, setEditPlanCustomText] = useState('');

  useEffect(() => {
    setActiveBookingId(null);
    setShowBalanceSettle(false);
    setShowPaymentSelection(false);
    setShowFinancialBreakdown(false);
    setShowCancelConfirm(false);
    setShowDirtyRoomPrompt(false);
    setIsSettled(false);
    setCancelWholeGroup(false);
    setIsEditingGroup(false);
    setShowGroupActionConfirm(null);
    setError(null);
  }, [booking?._id]);
  const currentBooking = useMemo(() => {
    const targetId = activeBookingId || booking?._id;
    if (!targetId) return booking;
    return bookings.find(b => b._id === targetId) || booking;
  }, [activeBookingId, booking, bookings]);
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
    if (!currentBooking?.groupId) return [];
    return bookings
      .filter(b => b.groupId === currentBooking.groupId && b.status !== 'cancelled' && b.status !== 'expired')
      .sort((a, b) => {
        const rA = typeof a.roomId === 'object' ? a.roomId.roomNumber : rooms.find(r => r._id === a.roomId)?.roomNumber || '';
        const rB = typeof b.roomId === 'object' ? b.roomId.roomNumber : rooms.find(r => r._id === b.roomId)?.roomNumber || '';
        return rA.localeCompare(rB, undefined, { numeric: true });
      });
  }, [currentBooking, bookings, rooms]);

  const isBlock = currentBooking?.reservationType === 'block' || currentBooking?.bookingType === 'block';
  const isEnquiry = currentBooking?.reservationType === 'enquiry' || currentBooking?.bookingType === 'enquiry';
  const expiryTime = currentBooking?.enquiryExpiresAt ? new Date(currentBooking.enquiryExpiresAt) : null;
  const isEnquiryExpired = currentBooking ? isExpiredBooking(currentBooking) : false;
  const isDayUse = currentBooking?.checkin === currentBooking?.checkout;
  const isEditable = currentBooking && 
                   currentBooking.status !== 'checked-out' && 
                   currentBooking.status !== 'cancelled' && 
                   !isEnquiryExpired;

  const priceStats = useMemo(() => {
    if (!currentBooking) return { taxAmount: 0, totalAmount: 0, balance: 0, subtotal: 0, nights: 0, baseSubtotal: 0, extraAdults: 0, extraPersonCharge: 0, mealCharge: 0, advancePayment: 0 };
    
    const p = calculateBookingPrice({
      roomPrice: currentBooking.roomPrice || room?.price || 0,
      checkin: currentBooking.checkin,
      checkout: currentBooking.checkout,
      adults: currentBooking.adults || 2,
      baseOccupancy: currentBooking.baseOccupancy || 2,
      extraPersonRate: currentBooking.extraPersonPrice || 0,
      planType: currentBooking.planType as any || 'EP',
      mealRates: hotel?.settings?.mealRates || {},
      gstRates: hotel?.settings?.taxConfig as any,
      isDayUse: currentBooking.checkin === currentBooking.checkout
    });

    return { 
      taxAmount: p.taxAmount, 
      totalAmount: p.grandTotal, 
      balance: p.grandTotal - (currentBooking.advancePayment || 0), 
      subtotal: p.subtotal,
      nights: p.nights,
      baseSubtotal: p.baseSubtotal,
      extraAdults: p.extraAdults,
      extraPersonCharge: p.extraCharge,
      mealCharge: p.mealCharge,
      discountAmount: p.discountAmount,
      advancePayment: currentBooking.advancePayment || 0
    };
  }, [currentBooking, room, hotel?.settings?.taxConfig, hotel?.settings?.mealRates]);

  const groupPriceStats = useMemo(() => {
    if (!isGroupBooking) return null;
    let groupBase = 0, groupExtra = 0, groupMeal = 0, groupAdvance = 0, groupTotal = 0, groupTax = 0;
    
    sortedGroupRooms.forEach(b => {
      const p = calculateBookingPrice({
        roomPrice: b.roomPrice || rooms.find(r => r._id === (typeof b.roomId === 'object' ? b.roomId._id : b.roomId))?.price || 0,
        checkin: b.checkin,
        checkout: b.checkout,
        adults: b.adults || 2,
        baseOccupancy: b.baseOccupancy || 2,
        extraPersonRate: b.extraPersonPrice || 0,
        planType: b.planType as any || 'EP',
        mealRates: hotel?.settings?.mealRates || {},
        gstRates: hotel?.settings?.taxConfig as any,
        isDayUse: b.checkin === b.checkout
      });

      groupBase += p.baseSubtotal;
      groupExtra += p.extraCharge;
      groupMeal += p.mealCharge;
      groupAdvance += (b.advancePayment || 0);
      groupTax += p.taxAmount;
      groupTotal += p.grandTotal;
    });

    return {
      baseSubtotal: groupBase,
      extraPersonCharge: groupExtra,
      mealCharge: groupMeal,
      discountAmount: sortedGroupRooms.reduce((acc: number, b) => {
        const p = calculateBookingPrice({
          roomPrice: b.roomPrice || rooms.find(r => r._id === (typeof b.roomId === 'object' ? b.roomId._id : b.roomId))?.price || 0,
          checkin: b.checkin,
          checkout: b.checkout,
          adults: b.adults || 2,
          baseOccupancy: b.baseOccupancy || 2,
          extraPersonRate: b.extraPersonPrice || 0,
          planType: b.planType as any || 'EP',
          mealRates: hotel?.settings?.mealRates || {},
          gstRates: hotel?.settings?.taxConfig as any,
          isDayUse: b.checkin === b.checkout
        });
        return acc + p.discountAmount;
      }, 0),
      taxAmount: groupTax,
      totalAmount: groupTotal,
      advancePayment: groupAdvance,
      balance: groupTotal - groupAdvance
    };
  }, [isGroupBooking, sortedGroupRooms, rooms, hotel?.settings?.taxConfig, hotel?.settings?.mealRates]);

  const activeStats = groupPriceStats || priceStats;
  const bookingData = currentBooking;

  if (!bookingData) return null;

  const handleAction = async (action: (id: string, data?: any) => Promise<any>, isSettlement?: boolean) => {
    setIsActioning(true);
    try {
      await action(bookingData._id);
      if (isSettlement) setIsSettled(true);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsActioning(false);
    }
  };



  const handleInitialCheckIn = () => {
    if (room?.status === 'dirty') setShowDirtyRoomPrompt(true);
    else {
      const updateData: any = { status: 'checked-in' };
      handleAction((id) => updateBooking(id, updateData));
    }
  };

  const handleCheckInWithCleanup = async () => {
    setShowDirtyRoomPrompt(false);
    setIsActioning(true);
    try {
      if (room?._id) await updateRoomStatus(room._id, 'clean');
      const updateData: any = { status: 'checked-in' };
      await updateBooking(bookingData._id, updateData);
      onClose();
    } catch (err) { console.error(err); }
    finally { setIsActioning(false); }
  };

  const handleGroupManagementAction = async (type: 'check-in' | 'check-out' | 'settle-checkout', method?: string) => {
    setGroupActionLoading(true);
    try {
      if (type === 'check-in') {
        await Promise.all(sortedGroupRooms.filter(b => b.status === 'reserved').map(b => {
           const updateData: any = { status: 'checked-in' };
           return updateBooking(b._id, updateData);
        }));
      } else if (type === 'check-out') {
        await Promise.all(sortedGroupRooms.filter(b => b.status === 'checked-in').map(b => updateBooking(b._id, { status: 'checked-out' })));
      }
      onClose();
    } catch (e) { console.error(e); }
    finally { setGroupActionLoading(false); }
  };

  const config = (({
    enquiry: { color: 'text-amber-600', bgColor: 'bg-amber-50', icon: Timer, label: 'Enquiry' },
    block: { color: 'text-slate-600', bgColor: 'bg-slate-50', icon: Lock, label: 'Blocked' },
    reserved: { color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: Clock, label: 'Reserved' },
    'checked-in': { color: 'text-blue-600', bgColor: 'bg-blue-50', icon: ShieldCheck, label: 'Checked-in' },
    'checked-out': { color: 'text-orange-600', bgColor: 'bg-orange-50', icon: CheckCircle2, label: 'Checked-out' },
    cancelled: { color: 'text-red-600', bgColor: 'bg-red-50', icon: Trash2, label: 'Cancelled' },
    blocked: { color: 'text-slate-600', bgColor: 'bg-slate-50', icon: Lock, label: 'Blocked' },
    expired: { color: 'text-amber-700', bgColor: 'bg-amber-50', icon: Timer, label: 'Expired' }
  }) as Record<string, any>)[isEnquiry ? 'enquiry' : isBlock ? 'block' : (bookingData.status as any)] || { color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: Clock, label: 'Reserved' };

  return (
    <Sheet open={!!booking} onOpenChange={() => { onClose(); setActiveBookingId(null); }}>
      <>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-4xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white">
          <div className="flex-1 overflow-y-auto bg-slate-50/10">
          <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 h-full">
            
            {/* Left Panel */}
            <div className={cn("p-5 sm:p-6 space-y-6", isBlock ? "lg:col-span-5" : "lg:col-span-3")}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest px-2 h-6">#{bookingData._id?.slice(-6).toUpperCase()}</Badge>
                    {isGroupBooking && <Badge className="bg-indigo-600 text-white text-[9px] h-6 px-2">Group</Badge>}
                  </div>
                  <h2 className="text-xl font-black text-slate-900">{isBlock ? 'Block' : isEnquiry ? 'Enquiry' : 'Booking'} Details</h2>
                </div>
                <div className={cn("px-2.5 py-1 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 border h-8", config.color, config.bgColor)}>
                  <config.icon className="h-3.5 w-3.5" />
                  <span>{config.label}</span>
                </div>
              </div>

              {isGroupBooking && (
                <div className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                  <p className="text-[10px] font-black uppercase text-slate-400">Group: <span className="text-slate-900">{bookingData.groupName}</span></p>
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
                    <h3 className="text-base font-black text-slate-900 leading-tight">{room?.roomType}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                        {bookingData.planType === 'custom' 
                          ? (bookingData.planCustomText || 'Custom Plan')
                          : (hotel?.settings?.stayPlans?.find((p: any) => (p.key || p) === bookingData.planType)?.label || bookingData.planType + ' Plan')}
                      </span>
                      {!isBlock && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-slate-200" />
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <Users className="h-3 w-3 opacity-50" />
                            <span>{bookingData.adults}A, {bookingData.children || 0}C</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {isBlock && bookingData.blockReason && (
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason for block</p>
                     <p className="text-sm font-bold text-slate-600 italic">"{bookingData.blockReason}"</p>
                   </div>
                )}
                
                <div className="flex gap-3">
                  <div className="flex-1 bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase">
                      {isBlock ? 'From' : `Check-in · ${format(new Date(bookingData.checkin), 'dd MMM')}`}
                    </p>
                    <p className="text-sm font-black tabular-nums uppercase">{formatTime(bookingData.checkinTime || '14:00')}</p>
                  </div>
                  <div className="flex-1 bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase">
                      {isBlock ? 'To' : `Check-out · ${format(new Date(bookingData.checkout), 'dd MMM')}`}
                    </p>
                    <p className="text-sm font-black tabular-nums uppercase">{formatTime(bookingData.checkoutTime || '11:00')}</p>
                  </div>
                </div>
              </div>

              {!isBlock && guest && (
                <div className="space-y-2.5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Primary Guest</h3>
                  <button onClick={() => guest._id && onOpenGuest && onOpenGuest(guest._id)} className="w-full p-4 rounded-2xl bg-white border border-slate-100 flex items-center gap-4 text-left transition-all hover:border-primary/20">
                    <div className="h-11 w-11 rounded-xl bg-primary/5 text-primary flex items-center justify-center"><User className="h-5 w-5" /></div>
                    <div>
                      <p className="font-black text-slate-900 text-sm">{guest.name}</p>
                      <div className="flex flex-col">
                        <p className="text-[11px] text-slate-400 font-bold">{guest.phone}</p>
                        {guest.email && <p className="text-[10px] text-primary/60 font-medium lowercase italic">{guest.email}</p>}
                      </div>
                    </div>
                    <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
                  </button>
                </div>
              )}
            </div>

            {/* Right Panel */}
            {!isBlock && (
              <div className="lg:col-span-2 p-5 sm:p-6 space-y-6 bg-white flex flex-col">
                <div className="space-y-6 flex-1">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Actionable Billing</h3>
                    <div className="rounded-[22px] bg-white border border-slate-100 shadow-xl p-5 space-y-5">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] flex items-center gap-1.5"><IndianRupee className="h-3 w-3" /> {isGroupBooking ? 'Group Balance Due' : 'Net Balance Due'}</p>
                        <div className="flex items-baseline gap-2">
                          <span className={cn("text-3xl font-black tabular-nums", activeStats.balance <= 0 ? 'text-emerald-500' : 'text-slate-900')}>₹{activeStats.balance.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="mt-4 space-y-1.5">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                            <span>Paid: ₹{(activeStats.advancePayment || 0).toLocaleString('en-IN')}</span>
                            <span>Total: ₹{activeStats.totalAmount.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, ((activeStats.advancePayment || 0) / (activeStats.totalAmount || 1)) * 100)}%` }} />
                          </div>
                        </div>
                      </div>

                      {bookingData.status !== 'cancelled' && bookingData.status !== 'checked-out' && activeStats.balance > 0 && (
                        <div className="space-y-2">
                          {!showBalanceSettle ? (
                            <Button className="w-full h-10 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest" onClick={() => setShowBalanceSettle(true)}>{isGroupBooking ? 'Settle Group Balance' : 'Settle Balance'}</Button>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {['Cash', 'Card', 'UPI'].map(m => (
                                <Button key={m} size="sm" variant="outline" className="text-[8px] font-black h-8 px-1" onClick={() => handleAction(id => updateBooking(id, { advancePayment: (bookingData.advancePayment || 0) + activeStats.balance, paymentMethod: m.toLowerCase() as any }), true)}>{m}</Button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {activeStats.balance <= 0 && (
                        <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /><span className="text-[10px] font-black uppercase">Settled</span></div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button onClick={() => setShowFinancialBreakdown(!showFinancialBreakdown)} className="flex items-center justify-between w-full text-[11px] font-black uppercase text-slate-500 group">
                      <span>{isGroupBooking ? 'Group Detailed Breakdown' : 'Detailed Breakdown'}</span>
                      {showFinancialBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {showFinancialBreakdown && (
                      <div className="space-y-3 pt-4 border-t border-slate-50 animate-in fade-in slide-in-from-top-1 duration-200">
                        {isGroupBooking ? (
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>Occupancy (Group)</span>
                            <span className="text-slate-900">{sortedGroupRooms.reduce((sum, b) => sum + (b.adults || 2), 0)} Adults</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>Occupancy</span>
                            <span className="text-slate-900">{bookingData.adults} Adults, {bookingData.children || 0} Children</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[11px] font-bold text-slate-500">
                          <span>Room Charges ({priceStats.nights} Night{priceStats.nights > 1 ? 's' : ''}{isGroupBooking ? `, ${sortedGroupRooms.length} Rooms` : ''})</span>
                          <span className="text-slate-900">₹{activeStats.baseSubtotal.toLocaleString('en-IN')}</span>
                        </div>
                        {activeStats.extraPersonCharge > 0 && (
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>Extra Guest Charges</span>
                            <span className="text-slate-900">₹{activeStats.extraPersonCharge.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        {activeStats.mealCharge > 0 && (
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>
                              {isGroupBooking ? 'Group Meal Plans' : (
                                bookingData.planType === 'custom' 
                                  ? (bookingData.planCustomText || 'Custom Plan')
                                  : (PLAN_LABELS[bookingData.planType as keyof typeof PLAN_LABELS] || bookingData.planType + ' Plan')
                              )}
                            </span>
                            <span className="text-slate-900">₹{activeStats.mealCharge.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        {(activeStats.discountAmount || 0) > 0 && (
                          <div className="flex justify-between text-[11px] font-bold text-rose-500 bg-rose-50/50 px-1 py-0.5 rounded">
                            <span>Discount / Promotion</span>
                            <span>- ₹{(activeStats.discountAmount || 0).toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        {activeStats.taxAmount > 0 && (
                          <div className="flex justify-between text-[11px] font-bold text-slate-500">
                            <span>Taxes (GST)</span>
                            <span className="text-slate-900">₹{activeStats.taxAmount.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[11px] font-black text-slate-900 border-t pt-3 mt-1">
                          <span>{isGroupBooking ? 'Total Group Amount' : 'Total Amount Payable'}</span>
                          <span className="text-indigo-600">₹{activeStats.totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-white border-t flex items-center justify-between gap-3 shadow-2xl">
          <div className="flex-1 flex gap-2">
            {bookingData.status === 'reserved' && !isEnquiry && (
              <Button className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-black uppercase text-[11px] tracking-widest shadow-lg shadow-indigo-100" onClick={handleInitialCheckIn} disabled={isActioning}>Secure Check-in</Button>
            )}
            {bookingData.status === 'checked-in' && (
              <div className="flex-1 flex gap-2">
                {!showBalanceSettle && activeStats.balance > 0 ? (
                  <Button 
                    className="flex-1 h-11 rounded-xl bg-orange-600 text-white font-black uppercase text-[11px] tracking-widest shadow-lg shadow-orange-100" 
                    onClick={() => setShowBalanceSettle(true)} 
                    disabled={isActioning}
                  >
                    Proceed Checkout (Settlement)
                  </Button>
                ) : (showBalanceSettle && activeStats.balance > 0) ? (
                  <div className="flex-1 flex gap-1.5 p-1 bg-slate-100 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                    {['Cash', 'Card', 'UPI'].map(m => (
                      <Button 
                        key={m} 
                        className="flex-1 h-9 rounded-lg bg-white text-slate-900 border-none shadow-sm hover:bg-orange-50 hover:text-orange-600 font-bold text-[10px] uppercase tracking-wider"
                        onClick={() => handleAction(id => updateBooking(id, { 
                          advancePayment: (bookingData.advancePayment || 0) + activeStats.balance, 
                          paymentMethod: m.toLowerCase() as any,
                          status: 'checked-out' 
                        }), true)}
                      >
                        {m}
                      </Button>
                    ))}
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => setShowBalanceSettle(false)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <Button 
                    className="flex-1 h-11 rounded-xl bg-orange-600 text-white font-black uppercase text-[11px] tracking-widest shadow-lg shadow-orange-100" 
                    onClick={() => handleAction(id => updateBooking(id, { status: 'checked-out' }), true)} 
                    disabled={isActioning}
                  >
                    Proceed Checkout
                  </Button>
                )}
              </div>
            )}
            {isEnquiry && !isEnquiryExpired && (
                <Button className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-black uppercase text-[11px] shadow-lg shadow-emerald-100" onClick={() => handleAction(id => updateBooking(id, { reservationType: 'booking', bookingType: 'booking', status: 'reserved' }))} disabled={isActioning}>Confirm Booking</Button>
            )}
          </div>
          {isEditable && (
            <div className="flex gap-2">
               {isGroupBooking && (
                 <Button variant="ghost" className="h-11 px-4 rounded-xl text-indigo-600 bg-indigo-50 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-100" onClick={() => { setIsEditingGroup(true); setShowEditModal(true); }}>
                   <Users className="h-4 w-4 mr-2" />
                   Edit Group
                 </Button>
               )}
               <Button variant="ghost" className="h-11 w-11 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => { setIsEditingGroup(false); setShowEditModal(true); }}><Pencil className="h-5 w-5" /></Button>
               <Button variant="ghost" className="h-11 w-11 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => setShowCancelConfirm(true)}><Trash2 className="h-5 w-5" /></Button>
            </div>
          )}
        </div>
      </SheetContent>


      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader><DialogTitle className="font-black text-xl">Cancel Booking?</DialogTitle><DialogDescription>This action will release the room and cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter className="gap-3 pt-4">
            <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setShowCancelConfirm(false)}>No, Keep</Button>
            <Button variant="destructive" className="flex-1 rounded-xl font-black uppercase text-[10px]" onClick={() => handleAction(cancelBooking)}>Yes, Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDirtyRoomPrompt} onOpenChange={setShowDirtyRoomPrompt}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader><DialogTitle className="font-black text-xl">Room Not Clean</DialogTitle><DialogDescription>Room #{room?.roomNumber} is currently marked as DIRTY.</DialogDescription></DialogHeader>
          <div className="py-4"><div className="bg-orange-50 text-orange-700 p-4 rounded-2xl flex items-center gap-3"><AlertCircle className="h-5 w-5" /><p className="text-xs font-bold font-mono">Marking it clean will satisfy system requirements for check-in.</p></div></div>
          <DialogFooter className="gap-3">
            <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setShowDirtyRoomPrompt(false)}>Wait</Button>
            <Button className="flex-1 rounded-xl bg-slate-900 text-white font-black uppercase text-[10px]" onClick={handleCheckInWithCleanup}>Clean & Check-in</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {currentBooking && (
        <BookingModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          initialBooking={currentBooking}
          isEditingGroup={isEditingGroup}
          asSheet={true}
        />
      )}
    </>
  </Sheet>
  );
}
