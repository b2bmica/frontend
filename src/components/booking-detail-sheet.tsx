import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { format, differenceInDays, isBefore, startOfDay } from 'date-fns';
import { 
  CalendarDays, 
  User, 
  MapPin, 
  IndianRupee, 
  Clock, 
  ShieldCheck, 
  Briefcase, 
  Users,
  CreditCard,
  Receipt,
  Printer,
  Trash2,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  X,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/auth-context';
import { useBookings } from '../context/booking-context';
import { useState } from 'react';
import { BookingModal } from './booking-modal';

interface BookingDetailSheetProps {
  booking: any;
  onClose: () => void;
  onOpenGuest?: (id: string) => void;
}

export function BookingDetailSheet({ booking, onClose, onOpenGuest }: BookingDetailSheetProps) {
  const { hotel } = useAuth();
  const { cancelBooking, checkIn, checkOut, updateBooking } = useBookings();
  const [isActioning, setIsActioning] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');

  if (!booking) return null;

  const room = typeof booking.roomId === 'object' ? booking.roomId : null;
  const guest = typeof booking.guestId === 'object' ? booking.guestId : null;
  const nights = Math.max(1, differenceInDays(new Date(booking.checkout), new Date(booking.checkin)));
  
  const roomPrice = booking.roomPrice || room?.price || 0;
  const baseSubtotal = roomPrice * nights;
  
  // Extra person calculation
  const extraAdults = Math.max(0, (booking.adults || 0) - (booking.baseOccupancy || 2));
  const extraPersonCharge = extraAdults * (booking.extraPersonPrice || 0) * nights;
  
  const subtotal = baseSubtotal + extraPersonCharge;

  // Tax Logic
  const taxConfig = hotel?.settings?.taxConfig;
  let taxAmount = 0;
  if (taxConfig?.enabled && subtotal > 0) {
    taxAmount = (subtotal * (taxConfig.cgst || 0) / 100) + (subtotal * (taxConfig.sgst || 0) / 100);
  }

  const totalAmount = subtotal + taxAmount;
  const balance = totalAmount - (booking.advancePayment || 0);

  const statusConfig: Record<string, { color: string; bgColor: string; icon: any; label: string }> = {
    'reserved':    { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', icon: Clock, label: 'Reserved' },
    'checked-in':  { color: 'text-blue-600', bgColor: 'bg-blue-500/10', icon: ShieldCheck, label: 'In-House' },
    'checked-out': { color: 'text-orange-600', bgColor: 'bg-orange-500/10', icon: CheckCircle2, label: 'Settled' },
    'cancelled':   { color: 'text-red-600', bgColor: 'bg-red-500/10', icon: Trash2, label: 'Cancelled' },
  };

  const config = statusConfig[booking.status] || statusConfig.reserved;

  const handleAction = async (action: (id: string) => Promise<void>) => {
    setIsActioning(true);
    try {
      await action(booking._id);
      onClose();
    } catch (err) {
      console.error(err);
    }
    setIsActioning(false);
  };

  return (
    <Sheet open={!!booking} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col border-none shadow-2xl">
        {/* Compact Header */}
        <div className="p-6 border-b bg-muted/20">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 border-primary/20 text-primary">
              Ref: #{booking._id?.slice(-6).toUpperCase()}
            </Badge>
            <div className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5", config.color, config.bgColor)}>
              <config.icon className="h-3 w-3" /> {config.label}
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
               Room {room?.roomNumber || '[Deleted]'} <span className="text-muted-foreground font-normal">/</span> {room?.roomType || 'Asset Removed'}
            </h2>
            <p className="text-muted-foreground font-medium text-xs flex items-center gap-2">
              Stay Duration: {nights} Night{nights > 1 ? 's' : ''} • {format(new Date(booking.checkin), 'MMM dd')} - {format(new Date(booking.checkout), 'MMM dd')}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {/* Guest Information */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Traveler Details</h3>
            <div className="p-4 rounded-2xl bg-muted/30 border border-primary/5 group transition-all hover:bg-muted/50 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-black text-base tracking-tight">{guest?.name || 'Guest'}</p>
                <p className="text-[11px] text-muted-foreground font-bold tracking-tight">{guest?.phone} · {guest?.email || 'No email'}</p>
              </div>
              <button 
                onClick={() => { if (guest?._id && onOpenGuest) onOpenGuest(guest._id); }}
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                title="View Guest Profile"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
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
                    <span>Extra Person ({extraAdults} × ₹{booking.extraPersonPrice})</span>
                    <span className="text-foreground">+ ₹{extraPersonCharge.toLocaleString()}</span>
                  </div>
                )}
                {taxConfig?.enabled && (
                  <div className="flex justify-between text-[11px] font-bold text-orange-600 uppercase tracking-wider">
                    <span>GST (CGST {taxConfig.cgst}% + SGST {taxConfig.sgst}%)</span>
                    <span>+ ₹{taxAmount.toLocaleString()}</span>
                  </div>
                )}
                {booking.advancePayment > 0 && (
                  <div className="flex justify-between text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                    <span>Advance Payment</span>
                    <span>- ₹{booking.advancePayment.toLocaleString()}</span>
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
                  <div className="flex items-center gap-3">
                    <div className="flex bg-muted/80 rounded-xl p-1 gap-1 border shadow-inner">
                      {['cash', 'card', 'upi'].map((m) => (
                        <button
                          key={m}
                          disabled={isActioning}
                          onClick={() => handleAction((id) => updateBooking(id, { 
                            advancePayment: (booking.advancePayment || 0) + balance,
                            paymentMethod: m
                          }))}
                          className={cn(
                            "h-7 px-2.5 text-[9px] font-black uppercase rounded-lg transition-all active:scale-95",
                            "bg-white border text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Select payment <br/>mode to settle</p>
                    </div>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tight h-7 px-3 border-emerald-200 text-emerald-700 bg-emerald-50/50">
                    Full Amount Settled
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-muted/30 border border-primary/5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-background text-primary"><Users className="h-4 w-4" /></div>
              <div><p className="text-[8px] font-black uppercase text-muted-foreground">Occupancy</p><p className="text-xs font-black">{booking.adults} Ad / {booking.children} Ch</p></div>
            </div>
            <div className="p-3 rounded-2xl bg-muted/30 border border-primary/5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-background text-primary"><IndianRupee className="h-4 w-4" /></div>
              <div><p className="text-[8px] font-black uppercase text-muted-foreground">Source</p><p className="text-xs font-black capitalize">{booking.bookingSource}</p></div>
            </div>
          </div>
        </div>

        {/* Action Panel - Optimized Layout */}
        <div className="p-4 bg-white border-t flex flex-col gap-2 relative z-10 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
          <div className="flex items-stretch gap-2 w-full h-11">
            {/* Edit Button */}
            {(booking.status === 'reserved' || booking.status === 'checked-in') && !showPaymentSelection && (
              <Button 
                variant="outline"
                className="flex-shrink-0 h-full rounded-xl font-black border-2 text-[10px] uppercase px-4 hover:bg-slate-50 text-slate-600 transition-all active:scale-95"
                onClick={() => setShowEditModal(true)}
              >
                Edit
              </Button>
            )}
            
            {/* Check-in Action */}
            {booking.status === 'reserved' && (
              <Button 
                className="flex-1 h-full rounded-xl font-black bg-blue-600 hover:bg-blue-700 text-[11px] uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                onClick={() => handleAction(checkIn)}
                disabled={isActioning || isBefore(new Date(), startOfDay(new Date(booking.checkin)))}
              >
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {isBefore(new Date(), startOfDay(new Date(booking.checkin))) ? 'Stay Locked' : 'Check-in Guest'}
              </Button>
            )}

            {/* Settle & Checkout Action */}
            {booking.status === 'checked-in' && (
              <div className="flex-1 flex gap-2 min-w-0">
                {!showPaymentSelection ? (
                  <Button 
                    variant="outline"
                    className="flex-1 h-full rounded-xl font-black border-orange-200 text-orange-600 hover:bg-orange-600 hover:text-white text-[11px] uppercase tracking-wider truncate shadow-sm transition-all active:scale-95"
                    onClick={() => setShowPaymentSelection(true)}
                  >
                    Settle & Checkout
                  </Button>
                ) : (
                  <div className="flex-1 flex items-center justify-between gap-2 px-2.5 bg-orange-600 rounded-xl animate-in slide-in-from-right-4 duration-300 overflow-hidden">
                    <span className="text-[10px] font-black text-white uppercase tracking-tighter whitespace-nowrap">Mode:</span>
                    <div className="flex bg-white/20 rounded-lg p-0.5 gap-0.5 shrink-0">
                      {['cash', 'card', 'upi'].map((m) => (
                        <button
                          key={m}
                          disabled={isActioning}
                          onClick={() => handleAction((id) => updateBooking(id, { 
                            status: 'checked-out', 
                            advancePayment: totalAmount,
                            paymentMethod: m 
                          }))}
                          className={cn(
                            "h-7 px-3 text-[9px] font-black uppercase rounded-md transition-all active:scale-90",
                            "bg-white text-orange-600 shadow-sm"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => setShowPaymentSelection(false)} 
                      className="text-white/60 hover:text-white transition-colors ml-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Print Button */}
            <Button 
              variant="outline" 
              className={cn(
                "h-full rounded-xl border-2 flex items-center justify-center gap-2 font-black transition-all shrink-0 active:scale-95",
                booking.status === 'checked-out' ? "flex-1 bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20 hover:bg-slate-800" : "w-11 p-0 text-slate-400 border-slate-100 hover:border-slate-300"
              )}
              onClick={() => window.print()}
              title="Print Receipt"
            >
              <Printer className={cn("h-4 w-4", booking.status === 'checked-out' ? "text-white" : "text-slate-500")} />
              {booking.status === 'checked-out' && <span className="text-[11px] uppercase tracking-widest">Print Receipt</span>}
            </Button>

            {/* Cancel (Icon only) */}
            {booking.status !== 'cancelled' && booking.status !== 'checked-out' && !showPaymentSelection && (
              <Button 
                variant="outline" 
                size="icon"
                className="h-full w-11 rounded-xl border-2 border-red-50 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-100 shrink-0 transition-all active:scale-95"
                onClick={() => handleAction(cancelBooking)}
                disabled={isActioning}
              >
                {isActioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
        <BookingModal 
          isOpen={showEditModal} 
          onClose={() => setShowEditModal(false)} 
          initialBooking={booking} 
        />
      </SheetContent>
    </Sheet>
  );
}
