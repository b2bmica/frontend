import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { useBookings } from '../context/booking-context';
import { api } from '../lib/api';
import { format, differenceInDays } from 'date-fns';
import { 
  UserCircle, 
  Phone, 
  Mail, 
  Globe, 
  CreditCard, 
  CalendarDays, 
  Hash, 
  Loader2, 
  MapPin, 
  Briefcase,
  History,
  TrendingUp,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface GuestProfileSheetProps {
  guestId: string | null;
  onClose: () => void;
  onBookingClick?: (booking: any) => void;
}

export function GuestProfileSheet({ guestId, onClose, onBookingClick }: GuestProfileSheetProps) {
  const { rooms } = useBookings();
  const [guest, setGuest] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guestId) { 
      setGuest(null); 
      setHistory([]); 
      setError(null);
      return; 
    }
    
    setLoading(true);
    setError(null);
    
    Promise.all([
      api.getGuest(guestId),
      api.getGuestHistory(guestId),
    ]).then(([guestData, historyData]) => {
      setGuest(guestData);
      setHistory(Array.isArray(historyData) ? historyData : []);
    }).catch(err => {
      console.error(err);
      setError("Database connection error. Profile unreachable.");
    }).finally(() => setLoading(false));
  }, [guestId]);

  const totalSpend = history.reduce((sum: number, b: any) => {
    const room = typeof b.roomId === 'object' ? b.roomId : rooms.find(r => r._id === b.roomId);
    const nights = Math.max(1, differenceInDays(new Date(b.checkout), new Date(b.checkin)));
    return sum + (room?.price || 0) * nights;
  }, 0);

  const statusConfig: Record<string, { color: string; bgColor: string }> = {
    'reserved':    { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10' },
    'checked-in':  { color: 'text-blue-600', bgColor: 'bg-blue-500/10' },
    'checked-out': { color: 'text-orange-600', bgColor: 'bg-orange-500/10' },
    'cancelled':   { color: 'text-red-600', bgColor: 'bg-red-500/10' },
  };

  return (
    <Sheet open={!!guestId} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-slate-50">
        <div className="p-6 bg-white border-b">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center border-2 border-primary/10">
              <UserCircle className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">{guest?.name || 'In-House Guest'}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest px-2 h-5 bg-muted text-muted-foreground border-none">
                  {guest?.nationality || 'IND'} • UID Verified
                </Badge>
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
                    { label: 'Stay Logs', value: history.length, icon: History },
                    { label: 'Room Nights', value: history.reduce((s: number, b: any) => s + Math.max(1, differenceInDays(new Date(b.checkout), new Date(b.checkin))), 0), icon: CalendarDays },
                    { label: 'LTV Spend', value: `₹${(totalSpend/1000).toFixed(1)}k`, icon: CreditCard },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60 flex flex-col items-center text-center space-y-1">
                      <stat.icon className="h-3.5 w-3.5 text-primary/40" />
                      <div className="font-black text-sm tracking-tight">{stat.value}</div>
                      <div className="text-[7px] font-black uppercase text-muted-foreground tracking-widest">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Contact Data */}
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 divide-y">
                   <div className="flex items-center justify-between pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-50 text-slate-400"><Phone className="h-3.5 w-3.5" /></div>
                        <span className="text-xs font-bold">{guest.phone}</span>
                      </div>
                      <Badge className="text-[9px] font-black bg-emerald-50 text-emerald-600 border-none">PRIMARY</Badge>
                   </div>
                   <div className="flex items-center gap-3 pt-3">
                      <div className="p-2 rounded-xl bg-slate-50 text-slate-400"><Mail className="h-3.5 w-3.5" /></div>
                      <span className="text-xs font-bold truncate max-w-[200px]">{guest.email || 'Email not linked'}</span>
                   </div>
                </div>

                {/* Stay History Table - High Visibility */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                       <History className="h-3.5 w-3.5" /> Chronological Stay History
                    </h3>
                  </div>

                  {history.length === 0 ? (
                    <div className="py-12 text-center bg-white rounded-3xl border border-dashed flex flex-col items-center gap-2">
                      <AlertCircle className="h-6 w-6 text-slate-200" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No prior stays found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {history.map((b: any) => {
                        const room = typeof b.roomId === 'object' ? b.roomId : rooms.find(r => r._id === b.roomId);
                        const nights = Math.max(1, differenceInDays(new Date(b.checkout), new Date(b.checkin)));
                        const config = statusConfig[b.status] || { color: 'text-slate-400', bgColor: 'bg-slate-100' };
                        
                        return (
                          <div 
                            key={b._id} 
                            onClick={() => { if (onBookingClick) onBookingClick(b); }}
                            className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-400 group-hover:text-primary transition-colors">
                                  #{room?.roomNumber || '??'}
                                </div>
                                <div>
                                  <p className="text-xs font-black">{room?.roomType || 'Stay Log'}</p>
                                  <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-tighter">
                                    {format(new Date(b.checkin), 'dd MMM')} - {format(new Date(b.checkout), 'dd MMM yyyy')} • {nights}N
                                  </p>
                                </div>
                              </div>
                              <Badge className={cn("text-[8px] font-black uppercase tracking-tighter border-none h-5 px-2", config.bgColor, config.color)}>
                                {b.status.replace('-', ' ')}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                               <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  <Globe className="h-3 w-3" /> {b.bookingSource || 'Direct'}
                               </div>
                               <div className="text-sm font-black text-primary tracking-tighter">
                                  ₹{((room?.price || 0) * nights).toLocaleString()}
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
              <div className="py-24 text-center">
                 <AlertCircle className="h-12 w-12 mx-auto text-slate-200 mb-4" />
                 <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Data Link Severed</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}
