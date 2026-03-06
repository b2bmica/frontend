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
  CheckCircle2,
  ChevronRight,
  Loader2,
  X,
  Pencil,
  Link as LinkIcon,
  Timer
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
  const { cancelBooking, checkIn, checkOut, updateBooking, rooms, updateRoomStatus, bookings } = useBookings();
  
  const [isActioning, setIsActioning] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [showBalanceSettle, setShowBalanceSettle] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [showDirtyRoomPrompt, setShowDirtyRoomPrompt] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [groupActionLoading, setGroupActionLoading] = useState(false);

  // Allow internal navigation for groups
  // ─── Hooks (Must be above early return) ───────────────────────────────────
  const currentBooking = activeBookingId ? bookings.find(b => b._id === activeBookingId) : booking;
  const [now, setNow] = useState(Date.now());

  // Live countdown update
  useEffect(() => {
    if (!currentBooking?.enquiryExpiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 60000);
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
    return typeof currentBooking.guestId === 'object' ? currentBooking.guestId : null;
  }, [currentBooking]);

  const sortedGroupRooms = useMemo(() => {
    if (!currentBooking?.isGroup || !currentBooking.groupId) return [];
    return bookings
      .filter(b => b.groupId === currentBooking.groupId)
      .sort((a, b) => {
        const rA = typeof a.roomId === 'object' ? a.roomId.roomNumber : rooms.find(r => r._id === a.roomId)?.roomNumber || '';
        const rB = typeof b.roomId === 'object' ? b.roomId.roomNumber : rooms.find(r => r._id === b.roomId)?.roomNumber || '';
        return rA.localeCompare(rB, undefined, { numeric: true });
      });
  }, [currentBooking, bookings, rooms]);

  const expiryTime = currentBooking?.enquiryExpiresAt ? new Date(currentBooking.enquiryExpiresAt) : null;
  const isEnquiryExpired = expiryTime ? isBefore(expiryTime, now) : false;

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
      extraPersonCharge: ep
    };
  }, [currentBooking, room, hotel?.settings?.taxConfig]);

  const { taxAmount, totalAmount, balance, nights, roomPrice, baseSubtotal, extraAdults, extraPersonCharge } = priceStats;

  const statusConfig: Record<string, { color: string; bgColor: string; icon: React.ElementType; label: string }> = {
    'reserved':    { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', icon: Clock, label: 'Reserved' },
    'checked-in':  { color: 'text-blue-600', bgColor: 'bg-blue-500/10', icon: ShieldCheck, label: 'Checked In' },
    'checked-out': { color: 'text-orange-600', bgColor: 'bg-orange-500/10', icon: CheckCircle2, label: 'Checked Out' },
    'cancelled':   { color: 'text-red-600', bgColor: 'bg-red-500/10', icon: Trash2, label: 'Cancelled' },
  };

  const config = currentBooking ? (statusConfig[currentBooking.status] || statusConfig.reserved) : statusConfig.reserved;

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
    const totalMins = Math.floor(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const taxConfig = hotel?.settings?.taxConfig;

  return (
    <Sheet open={!!booking} onOpenChange={() => { onClose(); setActiveBookingId(null); }}>
      <SheetContent className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col border-none shadow-2xl">
        {/* Compact Header */}
        <div className="p-6 border-b bg-muted/20">
          {bookingData.isGroup && (
            <div className="mb-4 p-3 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Group Booking</span>
                </div>
                <div className="flex gap-1">
                   {/* Group Bulk Actions Trigger */}
                   {bookingData.status === 'reserved' && (
                     <Button size="icon" variant="ghost" disabled={groupActionLoading} className="h-6 w-6 rounded-md hover:bg-emerald-100 hover:text-emerald-700" title="Check-in All" onClick={() => handleBulkAction(checkIn, sortedGroupRooms.filter(b => b.status === 'reserved'))}>
                       {groupActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                     </Button>
                   )}
                   {bookingData.status === 'checked-in' && balance <= 0 && (
                     <Button size="icon" variant="ghost" disabled={groupActionLoading} className="h-6 w-6 rounded-md hover:bg-blue-100 hover:text-blue-700" title="Checkout All" onClick={() => handleBulkAction(checkOut, sortedGroupRooms.filter(b => b.status === 'checked-in'))}>
                       {groupActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                     </Button>
                   )}
                </div>
              </div>
              <h3 className="text-sm font-black text-slate-800 mb-2 truncate" title={bookingData.groupName}>{bookingData.groupName}</h3>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {sortedGroupRooms.map(gb => {
                  const rNum = typeof gb.roomId === 'object' ? gb.roomId.roomNumber : rooms.find(r => r._id === gb.roomId)?.roomNumber;
                  const isActive = (activeBookingId === gb._id) || (!activeBookingId && gb._id === booking?._id);
                  return (
                    <button
                      key={gb._id}
                      onClick={() => setActiveBookingId(gb._id)}
                      className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-black border-2 transition-all shrink-0",
                        isActive
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white text-slate-400 border-slate-100 hover:border-primary/30 hover:text-primary"
                      )}
                    >
                      Room {rNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {bookingData.bookingType === 'enquiry' && (
            <div className={cn("mb-4 p-3 rounded-2xl border flex items-center justify-between", isEnquiryExpired ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100")}>
              <div className="flex items-center gap-2">
                <Timer className={cn("h-4 w-4", isEnquiryExpired ? "text-red-500" : "text-amber-500")} />
                <div>
                  <p className={cn("text-[9px] font-black uppercase tracking-widest", isEnquiryExpired ? "text-red-600" : "text-amber-600")}>
                    {isEnquiryExpired ? 'Expired Hold' : 'Tentative Hold'}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500">
                    Auto-release in: <span className="text-slate-900">{formatCountdownStr(bookingData.enquiryExpiresAt!)}</span>
                  </p>
                </div>
              </div>
              {!isEnquiryExpired && (
                <Badge className="bg-amber-500 text-white font-black text-[9px] animate-pulse">LIVE</Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 border-primary/20 text-primary">
              Ref: #{bookingData._id?.slice(-6).toUpperCase()}
            </Badge>
            <div className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black capitalize tracking-tighter flex items-center gap-1.5", config.color, config.bgColor)}>
              <config.icon className="h-3 w-3" /> {config.label}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                 Room {room?.roomNumber || '[Deleted]'} <span className="text-muted-foreground font-normal">/</span> {room?.roomType || 'Asset Removed'}
              </h2>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-muted-foreground font-medium text-xs flex items-center gap-2">
                Stay Duration: {nights} Night{nights > 1 ? 's' : ''} • {format(new Date(bookingData.checkin), 'MMM dd')} - {format(new Date(bookingData.checkout), 'MMM dd')}
              </p>
                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-x-4 gap-y-1 flex-wrap mt-2 pt-2 border-t border-slate-100">
                  {bookingData.createdAt && (
                    <div className="flex items-center gap-1.5 opacity-80">
                      <Clock className="h-2.5 w-2.5" /> Booked: {format(new Date(bookingData.createdAt), 'dd MMM, HH:mm')}
                    </div>
                  )}
                  {bookingData.createdBy && (
                    <div className="flex items-center gap-1.5 text-slate-500 font-extrabold">
                      <ShieldCheck className="h-3 w-3 text-primary/60" /> 
                      Staff: <span className="text-slate-900">{typeof bookingData.createdBy === 'object' ? bookingData.createdBy.name : 'System'}</span>
                    </div>
                  )}
                </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide print:hidden">
          {/* Guest Information */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Traveler Details</h3>
            <button 
              onClick={() => { if (guest?._id && onOpenGuest) onOpenGuest(guest._id); }}
              className="w-full p-4 rounded-2xl bg-muted/30 border border-primary/5 group transition-all hover:bg-white hover:shadow-md hover:border-primary/20 flex items-center gap-4 text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-base tracking-tight group-hover:text-primary group-hover:underline underline-offset-4 transition-all">{guest?.name || 'Guest'}</p>
                <p className="text-[11px] text-muted-foreground font-bold tracking-tight">{guest?.phone} · {guest?.email || 'No email'}</p>
              </div>
              <div className="h-8 w-8 rounded-full group-hover:bg-muted flex items-center justify-center transition-colors">
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </button>
          </div>

          <Separator className="opacity-50" />

          {/* Billing Summary */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Financial Data</h3>
            <div className="rounded-2xl bg-card border shadow-sm p-5 space-y-4">
              <div className="space-y-2.5">
                <div className="flex justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Base Rate ({nights}N × ₹{roomPrice.toLocaleString()})</span>
                  <span className="text-foreground">₹{baseSubtotal.toLocaleString()}</span>
                </div>
                {extraAdults > 0 && (
                  <div className="flex justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span>Extra Person ({extraAdults} × ₹{bookingData.extraPersonPrice})</span>
                    <span className="text-foreground">+ ₹{extraPersonCharge.toLocaleString()}</span>
                  </div>
                )}
                {taxConfig?.enabled && (
                  <div className="flex justify-between text-[11px] font-bold text-orange-600 uppercase tracking-wider">
                    <span>GST (CGST {taxConfig.cgst}% + SGST {taxConfig.sgst}%)</span>
                    <span>+ ₹{taxAmount.toLocaleString()}</span>
                  </div>
                )}
                {bookingData.advancePayment > 0 && (
                  <div className="flex justify-between text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                    <span>Advance Payment</span>
                    <span>- ₹{bookingData.advancePayment.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Closing Balance</p>
                  <p className={cn("text-2xl font-black tracking-tighter", balance <= 0 ? 'text-emerald-600' : 'text-primary')}>
                    ₹{balance.toLocaleString()}
                  </p>
                </div>
                {balance > 0 ? (
                  <div className="flex items-center gap-2">
                    {!showBalanceSettle ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setShowBalanceSettle(true)}
                        className="text-[10px] font-black uppercase tracking-widest h-8 px-4 border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all shadow-sm"
                      >
                        Settle Balance
                      </Button>
                    ) : (
                      <div className={cn(
                        "flex items-center gap-1.5 p-1 rounded-xl animate-in fade-in slide-in-from-right-2 duration-300 min-h-10",
                        isSettled ? "bg-emerald-500 text-white px-4" : "bg-emerald-600"
                      )}>
                        {isSettled ? (
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest py-1">
                            <CheckCircle2 className="h-4 w-4" /> Account Settled
                          </div>
                        ) : isActioning ? (
                          <div className="flex items-center gap-3 px-3 py-1 text-white pr-4">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-80 whitespace-nowrap">Processing...</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex bg-white/20 rounded-lg p-0.5 gap-0.5 relative overflow-hidden">
                              {['cash', 'card', 'upi'].map((m) => (
                                <button
                                  key={m}
                                  onClick={() => {
                                    handleAction((id) => updateBooking(id, { 
                                      advancePayment: (bookingData.advancePayment || 0) + balance,
                                      paymentMethod: m as 'cash' | 'card' | 'upi'
                                    }), true);
                                  }}
                                  className="h-6 px-3 text-[8px] font-black uppercase rounded-md transition-all active:scale-95 bg-white text-emerald-600 shadow-sm hover:bg-white/90"
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                            <button 
                              onClick={() => setShowBalanceSettle(false)} 
                              className="p-1 text-white/60 hover:text-white ml-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tight h-7 px-3 border-emerald-200 text-emerald-700 bg-emerald-50/50">
                    Full Amount Settled
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-muted/30 border border-primary/5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-background text-primary"><Users className="h-4 w-4" /></div>
              <div><p className="text-[8px] font-black uppercase text-muted-foreground">Occupancy</p><p className="text-xs font-black">{bookingData.adults} Ad / {bookingData.children} Ch</p></div>
            </div>
            <div className="p-3 rounded-2xl bg-muted/30 border border-primary/5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-background text-primary"><IndianRupee className="h-4 w-4" /></div>
              <div><p className="text-[8px] font-black uppercase text-muted-foreground">Source</p><p className="text-xs font-black capitalize">{bookingData.bookingSource}</p></div>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="p-4 bg-white border-t flex flex-col gap-2 relative z-10 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
          <div className="flex items-stretch gap-2 w-full h-11">
            {(bookingData.status === 'reserved' || bookingData.status === 'checked-in') && (
              <Button 
                variant="outline"
                className="w-11 h-11 p-0 rounded-xl border-2 text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600 transition-all active:scale-95 shrink-0"
                onClick={() => setShowEditModal(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            
            {bookingData.status === 'reserved' && (
              <Button 
                className="flex-1 h-full rounded-xl font-black bg-blue-600 hover:bg-blue-700 text-[11px] uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                onClick={handleInitialCheckIn}
                disabled={isActioning}
              >
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Check-in Guest
              </Button>
            )}

            {bookingData.status === 'checked-in' && (
              <div className="flex-1 flex gap-2 min-w-0">
                {!showPaymentSelection ? (
                    <Button 
                      className={cn(
                        "flex-1 h-full rounded-xl font-black text-[11px] uppercase tracking-wider truncate shadow-lg transition-all active:scale-95",
                        balance <= 0 
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                          : "border-orange-200 text-orange-600 hover:bg-orange-600 hover:text-white"
                      )}
                      variant={balance <= 0 ? "default" : "outline"}
                      onClick={() => {
                        if (balance <= 0) {
                          handleAction((id) => updateBooking(id, { status: 'checked-out' }), true);
                        } else {
                          setShowPaymentSelection(true);
                        }
                      }}
                    >
                      {balance <= 0 ? 'Checkout Now' : 'Settle & Checkout'}
                    </Button>
                ) : (
                  <div className={cn(
                    "flex-1 flex items-center gap-2 rounded-xl animate-in slide-in-from-right-4 duration-300 overflow-hidden min-h-11",
                    isSettled ? "bg-emerald-500 text-white justify-center" : "bg-orange-600"
                  )}>
                    {isSettled ? (
                      <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest py-2">
                        <CheckCircle2 className="h-5 w-5" /> Account Settled
                      </div>
                    ) : isActioning ? (
                      <div className="flex items-center gap-3 px-4 py-2 text-white">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Processing...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex bg-white/20 rounded-lg p-0.5 gap-0.5 shrink-0 relative overflow-hidden ml-3">
                          {['cash', 'card', 'upi'].map((m) => (
                            <button
                              key={m}
                              onClick={() => {
                                handleAction((id) => updateBooking(id, { 
                                  status: 'checked-out', 
                                  advancePayment: totalAmount,
                                  paymentMethod: m as 'cash' | 'card' | 'upi'
                                }), true);
                              }}
                              className="h-7 px-3 text-[9px] font-black uppercase rounded-md transition-all active:scale-95 bg-white text-orange-600 shadow-sm hover:bg-white/90"
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setShowPaymentSelection(false)} className="text-white/60 hover:text-white ml-auto mr-3"><X className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button variant="outline" className="h-11 px-4 rounded-xl border-2 flex items-center justify-center gap-2 font-black active:scale-95" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
            </Button>

            {bookingData.status !== 'cancelled' && bookingData.status !== 'checked-out' && !showPaymentSelection && (
              <Button 
                variant="outline" 
                className="h-11 px-4 rounded-xl border-2 border-red-50 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shrink-0 transition-all active:scale-95 text-[10px] font-black uppercase"
                onClick={() => setShowCancelConfirm(true)}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        <BookingModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} initialBooking={bookingData || undefined} />

        {/* Dialogs */}
        <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <DialogContent className="sm:max-w-[360px] rounded-2xl">
            <DialogHeader><DialogTitle className="font-black">Cancel Booking?</DialogTitle><DialogDescription>This action cannot be undone.</DialogDescription></DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>Keep It</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setShowCancelConfirm(false); handleAction(cancelBooking); }}>Yes, Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDirtyRoomPrompt} onOpenChange={setShowDirtyRoomPrompt}>
          <DialogContent className="sm:max-w-[360px] rounded-2xl">
            <DialogHeader><DialogTitle className="font-black text-center">Room is Dirty</DialogTitle><DialogDescription className="text-center">Would you like to mark it as clean and proceed?</DialogDescription></DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setShowDirtyRoomPrompt(false)}>No</Button>
              <Button className="bg-emerald-600 text-white" onClick={handleCheckInWithCleanup}>Mark Clean & Check-in</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
