import { useEffect, useState } from 'react';
import { Sheet, SheetContent } from './ui/sheet';
import { Badge } from './ui/badge';
import { useBookings, type Booking, type Guest } from '../context/booking-context';
import { api } from '../lib/api';
import { format, differenceInDays } from 'date-fns';
import { 
  UserCircle, 
  Phone, 
  Mail, 
  Globe, 
  CreditCard, 
  CalendarDays, 
  Loader2, 
  History,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface GuestProfileSheetProps {
  guestId: string | null;
  onClose: () => void;
  onBookingClick?: (booking: Booking) => void;
}

export function GuestProfileSheet({ guestId, onClose, onBookingClick }: GuestProfileSheetProps) {
  const { rooms } = useBookings();
  const [guest, setGuest] = useState<Guest | null>(null);
  const [history, setHistory] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guestId) { 
      setTimeout(() => {
        setGuest(null); 
        setHistory([]); 
        setError(null);
      }, 0);
      return; 
    }
    
    setTimeout(() => {
      setLoading(true);
      setError(null);
    }, 0);
    
    Promise.all([
      api.getGuest(guestId),
      api.getGuestHistory(guestId),
    ]).then(([guestData, historyData]) => {
      setGuest(guestData as Guest);
      setHistory(Array.isArray(historyData) ? historyData as Booking[] : []);
    }).catch(err => {
      console.error(err);
      setError("Database connection error. Profile unreachable.");
    }).finally(() => setLoading(false));
  }, [guestId]);

  const totalSpend = history.reduce((sum: number, b: Booking) => {
    const room = typeof b.roomId === 'object' ? b.roomId : rooms.find(r => r._id === b.roomId);
    const nights = Math.max(1, differenceInDays(new Date(b.checkout), new Date(b.checkin)));
    return sum + (room?.price || 0) * nights;
  }, 0);

  const statusConfig: Record<string, { color: string; bgColor: string; label?: string }> = {
    'reserved':    { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', label: 'Reserved' },
    'checked-in':  { color: 'text-blue-600', bgColor: 'bg-blue-500/10', label: 'Checked In' },
    'checked-out': { color: 'text-orange-600', bgColor: 'bg-orange-500/10', label: 'Checked Out' },
    'cancelled':   { color: 'text-red-600', bgColor: 'bg-red-500/10', label: 'Cancelled' },
    'enquiry':     { color: 'text-amber-600', bgColor: 'bg-amber-500/10', label: 'Enquiry' },
    'expired':     { color: 'text-slate-400', bgColor: 'bg-slate-100', label: 'Expired' },
  };

  return (
    <Sheet open={!!guestId} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-slate-50">
        <div className="p-6 bg-white border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center border-2 border-indigo-100/50 shadow-sm text-indigo-600">
              <UserCircle className="h-9 w-9" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-900">{guest?.name || 'In-House Guest'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-[0.15em] px-2 h-5 bg-indigo-50 text-indigo-700 border-indigo-100/50">
                  {guest?.nationality || 'IND'}
                </Badge>
                {/* UID Verified tag removed per request */}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Retrieving Intelligence</p>
              </motion.div>
            ) : guest ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Stay Logs', value: history.length, icon: History, color: 'text-blue-500', bgColor: 'bg-blue-50' },
                    { label: 'Room Nights', value: history.reduce((s: number, b: Booking) => s + Math.max(1, differenceInDays(new Date(b.checkout), new Date(b.checkin))), 0), icon: CalendarDays, color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
                    { label: 'LTV Spend', value: `₹${(totalSpend/1000).toFixed(1)}k`, icon: CreditCard, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col items-center text-center space-y-2 group transition-all hover:border-slate-200">
                      <div className={cn("p-2 rounded-xl transition-colors", stat.bgColor, stat.color)}>
                        <stat.icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-black text-sm tracking-tight text-slate-900">{stat.value}</div>
                        <div className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{stat.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Contact Data */}
                <div className="bg-white rounded-2xl border border-slate-100 p-4 divide-y divide-slate-50 shadow-sm">
                   <div className="flex items-center justify-between pb-3.5">
                      <div className="flex items-center gap-3.5">
                        <div className="h-9 w-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center"><Phone className="h-4 w-4" /></div>
                        <div className="space-y-0.5">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Primary Phone</p>
                          <span className="text-xs font-black text-slate-800 tracking-tight">{guest.phone}</span>
                        </div>
                      </div>
                      <div className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 text-[8px] font-black tracking-widest border border-emerald-100">PRIMARY</div>
                   </div>
                   <div className="flex items-center gap-3.5 pt-3.5">
                      <div className="h-9 w-9 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center"><Mail className="h-4 w-4" /></div>
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Email Address</p>
                        <span className="text-xs font-black text-slate-800 tracking-tight truncate block max-w-[220px]">{guest.email || 'Not Provided'}</span>
                      </div>
                   </div>
                </div>

                {/* Stay History Table - High Visibility */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                       <History className="h-3.5 w-3.5 text-indigo-400" /> Chronological Stay History
                    </h3>
                  </div>

                  {history.length === 0 ? (
                    <div className="py-12 text-center bg-white rounded-3xl border border-dashed flex flex-col items-center gap-2">
                      <AlertCircle className="h-6 w-6 text-slate-200" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No prior stays found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {history.map((b: Booking) => {
                        const room = typeof b.roomId === 'object' ? b.roomId : rooms.find(r => r._id === b.roomId);
                        const nights = Math.max(1, differenceInDays(new Date(b.checkout), new Date(b.checkin)));
                        const isEnquiry = b.reservationType === 'enquiry' || b.bookingType === 'enquiry';
                        const isExpired = b.status === 'expired' || (isEnquiry && b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date());
                        const effectiveStatus = isExpired ? 'expired' : isEnquiry ? 'enquiry' : b.status;
                        const config = statusConfig[effectiveStatus] || { color: 'text-slate-400', bgColor: 'bg-slate-100', label: (b.status || 'Reserved').replace('-', ' ') };
                        
                        return (
                          <div 
                            key={b._id} 
                            onClick={() => { if (onBookingClick) onBookingClick(b); }}
                            className="bg-white rounded-[22px] border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden active:scale-[0.98]"
                          >
                            <div className="flex items-start justify-between mb-3 relative z-10">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center font-black text-[11px] text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors border border-slate-100">
                                  #{room?.roomNumber || '??'}
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-[13px] font-black text-slate-900 tracking-tight">{room?.roomType || 'Stay Log'}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                    {format(new Date(b.checkin), 'dd MMM')} – {format(new Date(b.checkout), 'dd MMM yyyy')}
                                  </p>
                                </div>
                              </div>
                              <div className={cn("px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border shadow-sm", config.bgColor, config.color, "border-current/10")}>
                                {config.label}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-3 border-t border-slate-50 relative z-10">
                               <div className="flex items-center gap-4">
                                 <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <Globe className="h-3 w-3" /> {b.bookingSource || 'Direct'}
                                 </div>
                                 <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <CalendarDays className="h-3 w-3" /> {nights}N
                                 </div>
                               </div>
                               <div className="text-base font-black text-slate-900 tracking-tighter">
                                  ₹{((room?.price || 0) * nights).toLocaleString('en-IN')}
                               </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="py-24 text-center space-y-4">
                 <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto border-4 border-white shadow-xl">
                   <AlertCircle className="h-10 w-10 text-slate-200" />
                 </div>
                 <div className="space-y-1">
                   <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Intelligence Link Severed</p>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Please re-establish connection to synchronize</p>
                 </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}
