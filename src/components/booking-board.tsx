import { useState, useMemo, useRef, useEffect } from 'react';
import {
  format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay,
  differenceInDays, startOfDay, isBefore, parseISO
} from 'date-fns';
import { motion } from 'framer-motion';
import { Loader2, Search, UserPlus, IndianRupee, Info, Printer, ChevronLeft, ChevronRight, ChevronDown, Plus, Minus, Bed, X, ShieldCheck, ArrowRight, ArrowRightLeft, Calendar } from 'lucide-react';
import { useBookings, type Booking } from '../context/booking-context';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { BookingModal } from '@/components/booking-modal';
import { BookingDetailSheet } from '@/components/booking-detail-sheet';
import { GuestProfileSheet } from '@/components/guest-profile-sheet';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'reserved', label: 'Reserved', color: 'bg-emerald-500' },
  { key: 'checked-in', label: 'Checked In', color: 'bg-blue-500' },
  { key: 'checked-out', label: 'Checked Out', color: 'bg-orange-500' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-slate-400' },
] as const;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'checked-in':  return 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20';
    case 'reserved':
    case 'confirmed':   return 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20';
    case 'checked-out': return 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20';
    case 'cancelled':   return 'bg-slate-400 hover:bg-slate-500 shadow-slate-400/20';
    default:            return 'bg-gray-400';
  }
};

const getBookingRoomId = (b: Booking): string => {
  if (!b.roomId) return '';
  return typeof b.roomId === 'object' ? b.roomId._id : b.roomId as string;
};

const getGuest = (b: Booking) =>
  typeof b.guestId === 'object' ? b.guestId : null;

export function BookingBoard() {
  const { bookings, rooms, loading, updateBooking } = useBookings();
  const boardRef = useRef<HTMLDivElement>(null);
  const boardContentRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragGrabOffsetDaysRef = useRef(0);

  // Week-based navigation
  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [search, setSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [useNewPrice, setUseNewPrice] = useState(true);
  const [pendingUpdate, setPendingUpdate] = useState<{
    booking: Booking;
    updates: { roomId: string; checkin: string; checkout: string; roomPrice?: number };
    type: 'move' | 'resize';
    details: {
      oldRoom?: string;
      newRoom?: string;
      oldCheckin: string;
      newCheckin: string;
      oldCheckout: string;
      newCheckout: string;
      changeText: string;
      nightsDelta?: number;
      oldPrice: number;
      newPrice: number;
    }
  } | null>(null);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const daysCount = 7;
  const [boardWidth, setBoardWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => {
      setIsMobile(window.innerWidth < 768);
      
      // Request animation frame allows the browser to paint layout first
      // preventing the "wider on reload" bug where the panel doesn't know its size yet.
      requestAnimationFrame(() => {
        if (boardRef.current) {
          setBoardWidth(boardRef.current.clientWidth);
        }
      });
    };
    
    // Slight delay on first mount to let container shape settle
    const t = setTimeout(updateWidth, 50);

    window.addEventListener('resize', updateWidth);
    window.addEventListener('orientationchange', updateWidth);
    let observer: ResizeObserver | null = null;
    if (boardRef.current) {
      observer = new ResizeObserver(updateWidth);
      observer.observe(boardRef.current);
    }
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateWidth);
      window.removeEventListener('orientationchange', updateWidth);
      observer?.disconnect();
    };
  }, []);

  const DAYS = daysCount;
  const ROOM_COL = isMobile ? 80 : 152;
  // Ensure COLUMN_WIDTH fills exactly the available horizontal space, but doesn't shrink awkwardly on tiny devices
  const COLUMN_WIDTH = isMobile 
    ? Math.max(76, Math.floor((boardWidth - ROOM_COL) / DAYS)) 
    : Math.max(100, Math.min(350, Math.floor((boardWidth - ROOM_COL) / DAYS)));
  const ROW_HEIGHT = isMobile ? 64 : 72;

  const timeline = useMemo(() =>
    eachDayOfInterval({ start: weekStart, end: addDays(weekStart, DAYS - 1) }),
    [weekStart, DAYS]);

  // All bookings matching search/status filters globally (ignoring date window)
  const globalMatches = useMemo(() => {
    return bookings.filter(b => {
      const isBookingFilter = ['reserved', 'checked-in', 'checked-out', 'cancelled'].includes(statusFilter);
      if (isBookingFilter && b.status !== statusFilter) return false;

      const guestName = getGuest(b)?.name || '';
      const room = rooms.find(r => r._id === getBookingRoomId(b));
      const roomNum = room?.roomNumber || '';
      const bId = b._id || '';

      const matchSearch = !search || 
        guestName.toLowerCase().includes(search.toLowerCase()) ||
        roomNum.toLowerCase().includes(search.toLowerCase()) ||
        bId.toLowerCase().includes(search.toLowerCase());

      return matchSearch;
    });
  }, [bookings, rooms, statusFilter, search]);

  // Bookings specifically in the current calendar window
  const filteredBookings = useMemo(() => {
    const periodEnd = addDays(weekStart, DAYS);
    return globalMatches.filter(b => {
      const ci = startOfDay(new Date(b.checkin));
      const co = startOfDay(new Date(b.checkout));
      return ci < periodEnd && co > weekStart;
    });
  }, [globalMatches, weekStart, DAYS]);

  const offScreenMatches = useMemo(() => {
    return globalMatches.filter(m => !filteredBookings.find(fm => fm._id === m._id));
  }, [globalMatches, filteredBookings]);

  const isTodayView = isSameDay(weekStart, startOfDay(new Date()));

  // Status counts
  const counts = useMemo(() => {
    const bookingCounts = {
      reserved:    bookings.filter(b => b.status === 'reserved').length,
      'checked-in':  bookings.filter(b => b.status === 'checked-in').length,
      'checked-out': bookings.filter(b => b.status === 'checked-out').length,
      'cancelled':   bookings.filter(b => b.status === 'cancelled').length,
    };
    
    const roomCounts = {
      maintenance: rooms.filter(r => r.status?.toLowerCase().includes('maintenan')).length,
      clean: rooms.filter(r => r.status === 'clean').length,
      dirty: rooms.filter(r => r.status === 'dirty').length,
    };

    return { ...bookingCounts, ...roomCounts };
  }, [bookings, rooms]);

  const handleCellClick = (roomId: string, day: Date) => {
    if (resizingId) return;
    
    // Find if a booking exists here (ghost click prevention)
    const bookingAtCell = bookings.find(b => {
      if (b.status === 'cancelled' || b.status === 'checked-out') return false;
      if (getBookingRoomId(b) !== roomId) return false;
      const start = startOfDay(parseISO(b.checkin));
      const end = startOfDay(parseISO(b.checkout));
      return day >= start && day < end;
    });

    if (bookingAtCell) {
       setSelectedBooking(bookingAtCell);
       return;
    }

    setSelectedRoomId(roomId);
    setSelectedDate(format(day, 'yyyy-MM-dd'));
    setIsModalOpen(true);
  };

  const handleDragEnd = async (event: any, info: any, booking: Booking) => {
    setTimeout(() => { isDraggingRef.current = false; }, 100);
    if (isResizingRef.current) return;
    if (booking.status === 'checked-out' || booking.status === 'cancelled') return;
    if (!boardContentRef.current) return;
    
    // Calculate final position relative to board content
    const rect = boardContentRef.current.getBoundingClientRect();
    const x = info.point.x - rect.left;
    const y = info.point.y - rect.top;

    // Determine target day and room
    const HOZ_OFFSET = ROOM_COL;

    const activeRooms = rooms.filter(r => statusFilter === 'maintenance' ? (r.status === 'maintenance' || r.status === 'under-maintenance') : true);
    
    const dayAtMouse = (x - HOZ_OFFSET) / COLUMN_WIDTH;
    const dayIndexFinal = Math.round(dayAtMouse - dragGrabOffsetDaysRef.current);
    
    // getBoundingClientRect().top on boardContentRef already accounts for scroll,
    // so y is the correct absolute position within the content. Subtract header (48px).
    const roomIndexRaw = Math.floor((y - 48) / ROW_HEIGHT);
    const roomIndexFinal = Math.max(0, Math.min(activeRooms.length - 1, roomIndexRaw));

    // Allow drop anywhere valid — including outside the visible window (next/prev week)
    const isValidDay = dayIndexFinal >= -(DAYS * 2) && dayIndexFinal < DAYS * 3;
    const isValidRoom = true; // Always true now due to clamping above

    if (isValidDay && isValidRoom) {
      // No clamping — let the booking move to future/past weeks freely
      const targetDay = addDays(weekStart, dayIndexFinal);
      const targetRoom = activeRooms[roomIndexFinal];
      const duration = differenceInDays(new Date(booking.checkout), new Date(booking.checkin));
      const newCheckin = format(targetDay, 'yyyy-MM-dd');
      const newCheckout = format(addDays(targetDay, duration), 'yyyy-MM-dd');
      const currentCheckin = format(new Date(booking.checkin), 'yyyy-MM-dd');
      
      const newCheckinDate = parseISO(newCheckin);
      const newCheckoutDate = parseISO(newCheckout);
      
      const isClashing = bookings.some(b => {
        if (String(b._id) === String(booking._id) || b.status === 'cancelled' || b.status === 'checked-out') return false;
        if (getBookingRoomId(b) !== targetRoom._id) return false;
        const bStart = startOfDay(parseISO(b.checkin));
        const bEnd = startOfDay(parseISO(b.checkout));
        return newCheckinDate < bEnd && newCheckoutDate > bStart;
      });

      if (isClashing) return;
      if (newCheckin === currentCheckin && targetRoom._id === getBookingRoomId(booking)) return;

      const oldRoom = rooms.find(r => r._id === getBookingRoomId(booking));
      const dayDiff = Math.round(differenceInDays(newCheckinDate, startOfDay(parseISO(booking.checkin))));
      const nightText = dayDiff === 0 ? "" : (dayDiff > 0 ? ` +${dayDiff} night${dayDiff > 1 ? 's' : ''}` : ` -${Math.abs(dayDiff)} night${Math.abs(dayDiff) > 1 ? 's' : ''}`);
      const changeText = targetRoom._id !== getBookingRoomId(booking) ? `Push to Rm ${targetRoom.roomNumber}${nightText}` : (nightText ? `Shift ${nightText.trim()}` : "Save changes");

      // Auto-snap calendar to new viewport if dragged significantly off-screen
      if (dayIndexFinal < 0 || dayIndexFinal >= DAYS) {
        setWeekStart(startOfDay(targetDay));
      }
      
      setUseNewPrice(targetRoom.price !== booking.roomPrice);

      setPendingUpdate({
        booking,
        updates: { roomId: targetRoom._id, checkin: newCheckin, checkout: newCheckout },
        type: 'move', // Dragging is always a 'move' or 'shift'
        details: {
          oldRoom: oldRoom?.roomNumber,
          newRoom: targetRoom.roomNumber,
          oldCheckin: booking.checkin,
          newCheckin,
          oldCheckout: booking.checkout,
          newCheckout,
          changeText,
          nightsDelta: dayDiff,
          oldPrice: booking.roomPrice || 0,
          newPrice: targetRoom.price || 0
        }
      });
    }
  };

  const handleQuickExtend = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    const newCheckout = format(addDays(new Date(booking.checkout), 1), 'yyyy-MM-dd');
    updateBooking(booking._id, { roomId: getBookingRoomId(booking), checkin: booking.checkin, checkout: newCheckout });
  };

  const handleQuickReduce = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    const newCheckout = format(addDays(new Date(booking.checkout), -1), 'yyyy-MM-dd');
    if (newCheckout <= booking.checkin) return;
    updateBooking(booking._id, { roomId: getBookingRoomId(booking), checkin: booking.checkin, checkout: newCheckout });
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/20 rounded-xl border">
        <Bed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-bold">No rooms registered</h3>
        <p className="text-muted-foreground text-sm">Add rooms in the Rooms tab first, then create bookings here.</p>
      </div>
    );
  }

  const periodLabel = `${format(weekStart, "MMM dd")} – ${format(addDays(weekStart, DAYS - 1), "MMM dd, yyyy")}`;

  return (
    <>
      <div 
        className="flex flex-col bg-background border rounded-[24px] overflow-hidden shadow-sm h-full w-full max-w-full"
        style={{ minHeight: isMobile ? 420 : 480 }}
      >


        {/* ── Header ── */}
        <div className="flex flex-col gap-3 p-4 border-b bg-card/40 backdrop-blur-md">
          {/* Top Row: Navigation & Today */}
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-slate-200 bg-white shadow-sm font-bold text-xs transition-all active:scale-95"
              onClick={() => setWeekStart(addDays(weekStart, -DAYS))}>
              <ChevronLeft className="h-4 w-4 mr-1" /> {isMobile ? '' : 'Prev Week'}
            </Button>
            
            <div className="flex flex-col items-center flex-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex flex-col items-center hover:bg-slate-100/50 p-1 px-4 rounded-xl transition-colors min-w-[140px] group">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-primary transition-colors">Viewing Period</span>
                    <span className="text-xs font-black uppercase tracking-tight text-slate-900 flex items-center gap-1 group-hover:scale-105 transition-transform">
                      {periodLabel} <ChevronDown className="h-3 w-3 opacity-40 ml-0.5" />
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 rounded-2xl shadow-2xl border-none">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 text-slate-400">Jump to Date</Label>
                    <Input 
                      type="date" 
                      className="h-10 rounded-xl font-bold border-slate-200" 
                      value={format(weekStart, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        if (e.target.value) setWeekStart(startOfWeek(new Date(e.target.value), { weekStartsOn: 1 }));
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-slate-200 bg-white shadow-sm font-bold text-xs transition-all active:scale-95"
              onClick={() => setWeekStart(addDays(weekStart, DAYS))}>
              {isMobile ? '' : 'Next Week'} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                  <Input 
                    className="h-10 pl-10 pr-10 rounded-xl border-slate-200 bg-white shadow-sm focus:ring-4 focus:ring-primary/5 text-sm font-bold placeholder:font-medium transition-all"
                    placeholder="Search name, room or booking ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button 
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
                    >
                      <X className="h-3 w-3 text-slate-400" />
                    </button>
                  )}
                </div>

                {!isTodayView && (
                  <Button variant="secondary" size="sm" className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                    onClick={() => setWeekStart(startOfDay(new Date()))}>
                    {isMobile ? 'Today' : 'Go to Today'}
                  </Button>
                )}
             </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map((f: any) => {
              const key = f.key;
              const color = f.color;
              const label = f.label;
              const count = key === 'all'
                ? bookings.length
                : (counts[key as keyof typeof counts] ?? 0);
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold capitalize tracking-wide border transition-all active:scale-95",
                    statusFilter === key
                      ? "bg-slate-900 text-white border-slate-900 scale-105"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {color && <span className={cn("w-2 h-2 rounded-full flex-shrink-0", color)} />}
                  {label}
                  <span className={cn(
                    "inline-flex items-center justify-center rounded-full min-w-[18px] h-[18px] text-[8px] font-bold px-1 ml-0.5",
                    statusFilter === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
                  )}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100/50">
            <span className="text-[9px] font-bold tracking-[0.15em] text-slate-400 uppercase">Room:</span>
            {[
              { dot: 'bg-emerald-500', label: 'Clean' },
              { dot: 'bg-amber-400', label: 'Dirty' },
            ].map(({ dot, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", dot)} />
                <span className="text-[10px] font-medium text-slate-400 tracking-tight">{label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Board ── */}
        <div 
          className="flex-1 overflow-auto select-none" 
          ref={boardRef}
          style={{ 
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            touchAction: 'pan-x pan-y'
          }}
        >
          <div className="relative min-h-full min-w-full w-max" ref={boardContentRef}>

            {/* Column headers */}
            <div className="flex sticky top-0 z-[40] bg-card/80 backdrop-blur-md border-b shadow-sm w-max">
              <div 
                className="bg-slate-50 border-r flex items-center font-black text-slate-400 uppercase tracking-[0.15em] sticky left-0 z-30 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]"
                style={{ width: ROOM_COL, height: 48, minWidth: ROOM_COL, fontSize: isMobile ? 9 : 10, paddingLeft: isMobile ? 12 : 16 }}
              >
                Rooms
              </div>
              {timeline.map((day) => (
                <div key={day.toISOString()}
                  className={cn(
                    "flex flex-col items-center justify-center border-r flex-shrink-0 transition-colors",
                    isSameDay(day, new Date()) ? "bg-primary/[0.04] text-primary" : "text-slate-500"
                  )}
                  style={{ width: COLUMN_WIDTH, height: 48, minWidth: COLUMN_WIDTH }}>
                  <span style={{ fontSize: isMobile ? 7 : 9 }} className="font-black tracking-[0.1em] opacity-40 mb-0.5 leading-none">{format(day, 'EEE')}</span>
                  <span className={cn(
                    "font-black tracking-tight leading-none",
                    isSameDay(day, new Date())
                      ? "bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30"
                      : "",
                    isMobile ? "text-[10px]" : "text-xs"
                  )}
                  style={isSameDay(day, new Date()) ? { width: isMobile ? 22 : 28, height: isMobile ? 22 : 28 } : {}}>
                    {format(day, 'dd')}
                  </span>
                </div>
              ))}
            </div>

            {/* Room rows */}
            <div className="relative w-max">
              {rooms
                .filter(r => statusFilter === 'maintenance' ? (r.status === 'maintenance' || r.status === 'under-maintenance') : true)
                .map((room, rowIndex) => {
                const roomBookings = filteredBookings.filter(b => getBookingRoomId(b) === room._id);
                return (
                  <motion.div 
                    key={room._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(rowIndex * 0.02, 0.4), duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className="flex border-b group relative hover:bg-white transition-colors" 
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Room label */}
                    <div 
                      className="bg-white border-r flex flex-col justify-center flex-shrink-0 sticky left-0 z-20 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]"
                      style={{ width: ROOM_COL, minWidth: ROOM_COL, paddingLeft: isMobile ? 12 : 16, paddingRight: isMobile ? 8 : 12 }}
                    >
                      <div className="font-black flex items-center gap-1.5 text-slate-800" style={{ fontSize: isMobile ? 11 : 13 }}>
                        <span className="truncate">{room.roomNumber}</span>
                        {/* Always show clean/dirty status indicator */}
                        {room.status === 'clean' ? (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]" title="Clean" />
                        ) : room.status === 'dirty' ? (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.4)]" title="Dirty" />
                        ) : (room.status === 'maintenance' || room.status === 'under-maintenance') ? (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-500 animate-pulse" title="Maintenance" />
                        ) : null}
                      </div>
                      {!isMobile && <div className="text-[10px] font-black text-slate-400 truncate opacity-60 capitalize tracking-tighter leading-none mt-1">{room.roomType}</div>}
                      <div className="font-bold text-primary/70 mt-0.5" style={{ fontSize: isMobile ? 10 : 10 }}>₹{room.price}</div>
                    </div>

                    {/* Day cells */}
                    {timeline.map((day) => {
                      const isDayBooked = roomBookings.some(b => {
                        const start = startOfDay(parseISO(b.checkin));
                        const end   = startOfDay(parseISO(b.checkout));
                        return day >= start && day < end && b.status !== 'cancelled' && b.status !== 'checked-out';
                      });
                      return (
                        <div key={day.toISOString()}
                          className={cn(
                            "border-r transition-colors flex-shrink-0 relative z-10",
                            isSameDay(day, new Date()) && "bg-primary/[0.02]",
                            isDayBooked ? "bg-slate-50/30 cursor-not-allowed" : "cursor-pointer hover:bg-primary/[0.04]"
                          )}
                          style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH }}
                          title={isDayBooked ? "This room is already occupied on this date" : "Click to add booking"}
                          onClick={() => {
                            if (!isDayBooked) handleCellClick(room._id, day);
                          }}
                        />
                      );
                    })}

                    {/* Booking cards overlay */}
                    {(() => {
                        // Separate cancelled from active bookings
                        const activeBookings = roomBookings.filter(b => b.status !== 'cancelled');
                        const cancelledBookings = roomBookings.filter(b => b.status === 'cancelled');

                        // Priority-based Single-Lane Collapse Logic (active only)
                        const statusPriority: Record<string, number> = {
                          'checked-in': 4,
                          'reserved': 3,
                          'checked-out': 2,
                        };

                          const roomSortedBookings = [...activeBookings].sort((a, b) => {
                            const pA = statusPriority[a.status] || 0;
                            const pB = statusPriority[b.status] || 0;
                            if (pA !== pB) return pB - pA;
                            // Sort by duration (wider first) so they act as containers for others
                            const durA = differenceInDays(parseISO(a.checkout), parseISO(a.checkin));
                            const durB = differenceInDays(parseISO(b.checkout), parseISO(b.checkin));
                            if (durA !== durB) return durB - durA;
                            return parseISO(a.checkin).getTime() - parseISO(b.checkin).getTime();
                          });

                          const visibleCards: { primary: Booking, others: Booking[] }[] = [];
                          roomSortedBookings.forEach(b => {
                            const bStart = parseISO(b.checkin);
                            const bEnd = parseISO(b.checkout);
                            
                            // Merge if there's ANY date overlap with an existing primary card
                            const overlapCard = visibleCards.find(card => {
                              const cS = parseISO(card.primary.checkin);
                              const cE = parseISO(card.primary.checkout);
                              return bStart < cE && bEnd > cS;
                            });

                            if (overlapCard) {
                              overlapCard.others.push(b);
                            }
                            else visibleCards.push({ primary: b, others: [] });
                          });

                        // Build per-day cancelled badge map
                        const cancelledByDay: Record<string, number> = {};
                        cancelledBookings.forEach(b => {
                          const cIn  = startOfDay(parseISO(b.checkin));
                          const cOut = startOfDay(parseISO(b.checkout));
                          timeline.forEach(day => {
                            if (day >= cIn && day < cOut) {
                              const key = day.toISOString();
                              cancelledByDay[key] = (cancelledByDay[key] || 0) + 1;
                            }
                          });
                        });

                        const heightTotal = ROW_HEIGHT - 12; // 6px gap top and bottom for easier cell clicking

                        const cardJsx = visibleCards.map(({ primary: booking, others }) => {
                          const checkinDate  = startOfDay(parseISO(booking.checkin));
                          const checkoutDate = startOfDay(parseISO(booking.checkout));
                          const weekStartDay = startOfDay(weekStart);
                          const periodEnd    = addDays(weekStart, DAYS);

                          if (checkoutDate <= weekStart || checkinDate >= periodEnd) return null;

                          const isEditable = booking.status !== 'checked-out' && booking.status !== 'cancelled';

                          const offsetDays   = differenceInDays(checkinDate, weekStartDay);
                          const duration     = differenceInDays(checkoutDate, checkinDate);
                          const clampedOffset   = Math.max(0, offsetDays);
                          const clampedDuration = Math.min(offsetDays + duration, DAYS) - clampedOffset;
                          if (clampedDuration <= 0) return null;

                          const guest      = getGuest(booking);

                          const cardLeft  = ROOM_COL + (clampedOffset * COLUMN_WIDTH) + 1;
                          const cardWidth = (clampedDuration * COLUMN_WIDTH) - 2;

                          // ── Pointer-based drag (long-press on touch) ─────────────────
                          const handleCardDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
                            if (!isEditable) return;
                            if (isResizingRef.current) return;
                            // Allow left-click on mouse, any button on touch/pen
                            if (e.pointerType === 'mouse' && e.button !== 0) return;
                            const target = e.target as HTMLElement;
                            if (target.closest('[data-resize-handle]')) return;

                            const cardEl   = e.currentTarget as HTMLDivElement;
                            const isTouch  = e.pointerType === 'touch' || e.pointerType === 'pen';
                            const LONG_MS  = isTouch ? 380 : 150; // Quicker for mouse, standard for touch

                            e.stopPropagation();

                            const startX = e.clientX;
                            const startY = e.clientY;
                            if (boardContentRef.current) {
                              const rect = boardContentRef.current.getBoundingClientRect();
                              const x = e.clientX - rect.left;
                              dragGrabOffsetDaysRef.current = (x - ROOM_COL) / COLUMN_WIDTH - differenceInDays(startOfDay(parseISO(booking.checkin)), startOfDay(weekStart));
                            }

                             const initialScrollL = boardRef.current?.scrollLeft || 0;
                             const initialScrollT = boardRef.current?.scrollTop || 0;
                             let currentScrollL = initialScrollL;
                             let currentScrollT = initialScrollT;

                            let dragging         = false;
                            let longPressReady   = false;   // long press timer fired
                            let cancelled        = false;
                            let longPressTimer: ReturnType<typeof setTimeout> | null = null;
                            let weekSwapTimer: ReturnType<typeof setTimeout> | null = null;

                            // For mobile, we will still use a tiny 250ms press to lift the card,
                            // but we MUST have set touch-action: none on the card natively, so the browser doesn't steal it for scrolling.
                            if (!isTouch) {
                              try { cardEl.setPointerCapture(e.pointerId); } catch (_) {}
                            }

                             const activateDrag = () => {
                               if (cancelled) return;
                               longPressReady = true;
                               isDraggingRef.current = true;
                               try { cardEl.setPointerCapture(e.pointerId); } catch (_) {}
                               // Haptic feedback
                               try { (navigator as any).vibrate?.([12, 40, 12]); } catch (_) {}
                               cardEl.style.opacity    = '0.9';
                               cardEl.style.zIndex     = '100';
                               cardEl.style.transition = 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.15s ease';
                               cardEl.style.transform  = 'scale(1.04) translateY(-2px)';
                               cardEl.style.boxShadow  = '0 20px 40px rgba(0,0,0,0.3)';
                               cardEl.style.outline = '2px solid white';
                               cardEl.style.outlineOffset = '-2px';
                               
                               setTimeout(() => {
                                 if (!cancelled) cardEl.style.transition = 'none';
                               }, 130);
                             };

                             // DELIBERATE HOLD: Start timer.
                             longPressTimer = setTimeout(() => {
                               activateDrag();
                             }, LONG_MS);

                             const onMove = (me: PointerEvent) => {
                               const dx_view = me.clientX - startX;
                               const dy_view = me.clientY - startY;
                               const dist = Math.abs(dx_view) + Math.abs(dy_view);

                                // If we moved a lot before hold is finished, it's a scroll, cancel.
                                // For touch, we are more forgiving (35px). For mouse, 15px.
                                if (!longPressReady && dist > (isTouch ? 35 : 15)) {
                                  cancelled = true;
                                  if (longPressTimer) clearTimeout(longPressTimer);
                                }

                                if (!isTouch && !dragging && dist > 15 && !cancelled) {
                                  if (!longPressReady) activateDrag();
                                  dragging = true;
                                  isDraggingRef.current = true;
                                  cardEl.style.opacity    = '0.75';
                                  cardEl.style.zIndex     = '50';
                                  cardEl.style.cursor     = 'grabbing';
                                  cardEl.style.transition = 'none';
                               }
                               
                               if (dragging || longPressReady) {
                                 const updateTransform = () => {
                                   const scrollDeltaL = (boardRef.current?.scrollLeft || 0) - initialScrollL;
                                   const scrollDeltaT = (boardRef.current?.scrollTop || 0) - initialScrollT;
                                   cardEl.style.transform = `translate(${dx_view + scrollDeltaL}px, ${dy_view + scrollDeltaT}px)${isTouch && !dragging ? ' scale(1.04)' : ''}`;
                                 };
                                 
                                 updateTransform();
                                 if (longPressReady && !dragging) {
                                   dragging = true;
                                   isDraggingRef.current = true; // Ensure it stays true to prevent click-through
                                 }

                                 // Auto-scroll logic (vertical only, since columns fill viewport)
                                 if (boardRef.current) {
                                   const rect = boardRef.current.getBoundingClientRect();
                                   const edgeSize = isMobile ? 60 : 45;
                                   
                                   // Vertical auto-scroll
                                   let scrollDY = 0;
                                   if (me.clientY < rect.top + edgeSize) scrollDY = -((rect.top + edgeSize) - me.clientY) * 0.8;
                                   else if (me.clientY > rect.bottom - edgeSize) scrollDY = (me.clientY - (rect.bottom - edgeSize)) * 0.8;
                                   
                                   if (scrollDY !== 0) {
                                     boardRef.current.scrollTop += scrollDY;
                                     updateTransform();
                                   }

                                   // WEEK SWAP: If cursor is near horizontal edge, swap week after a dwell
                                   const atRightEdge = me.clientX > rect.right - edgeSize;
                                   const atLeftEdge = me.clientX < rect.left + edgeSize + ROOM_COL;
                                   
                                   if (atRightEdge && !weekSwapTimer) {
                                     weekSwapTimer = setTimeout(() => {
                                       setWeekStart(prev => addDays(prev, 7));
                                       weekSwapTimer = null;
                                     }, 600);
                                   } else if (atLeftEdge && !weekSwapTimer) {
                                     weekSwapTimer = setTimeout(() => {
                                       setWeekStart(prev => addDays(prev, -7));
                                       weekSwapTimer = null;
                                     }, 600);
                                   } else if (!atRightEdge && !atLeftEdge && weekSwapTimer) {
                                     clearTimeout(weekSwapTimer);
                                     weekSwapTimer = null;
                                   }
                                 }
                               }
                             };

                            const onUp = (ue: PointerEvent) => {
                              const totalDist = Math.abs(ue.clientX - startX) + Math.abs(ue.clientY - startY);
                              const wasDragging = dragging;
                              cleanup();
                              if (wasDragging && totalDist > 10) {
                                handleDragEnd(ue, { point: { x: ue.clientX, y: ue.clientY } }, booking);
                              } else if (!wasDragging && totalDist < 10) {
                                // It was a click, not a drag - show booking details
                                setSelectedBooking(booking);
                              }
                            };

                            const cleanup = () => {
                              try { cardEl.releasePointerCapture(e.pointerId); } catch (_) {}
                              window.removeEventListener('pointermove', onMove);
                              window.removeEventListener('pointerup',   onUp);
                              window.removeEventListener('pointercancel', cleanup);
                              if (weekSwapTimer) { clearTimeout(weekSwapTimer); weekSwapTimer = null; }
                              if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
                              if (dragging || longPressReady) {
                                cardEl.style.transform  = '';
                                cardEl.style.opacity    = '';
                                cardEl.style.zIndex     = '';
                                cardEl.style.cursor     = '';
                                cardEl.style.transition = '';
                                cardEl.style.boxShadow  = '';
                                cardEl.style.outline = '';
                                cardEl.style.outlineOffset = '';
                                cardEl.style.touchAction = isEditable ? 'none' : 'auto';
                              }
                              setTimeout(() => { isDraggingRef.current = false; }, 100);
                            };

                            window.addEventListener('pointermove', onMove);
                            window.addEventListener('pointerup',   onUp);
                            window.addEventListener('pointercancel', cleanup);
                          };

                          // ── Pointer-based resize ───────────────────────────────────────
                          const handleResizeDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (!isEditable) return;

                            const handleEl = e.currentTarget as HTMLDivElement;
                            const cardEl   = handleEl.closest('[data-booking-card]') as HTMLDivElement;
                            if (!cardEl) return;

                            try { handleEl.setPointerCapture(e.pointerId); } catch (_) {}

                            const startX        = e.clientX;
                            const originalWidth = cardEl.offsetWidth;
                            let moved = false;

                            const onMove = (me: PointerEvent) => {
                              const dx = me.clientX - startX;
                              if (!moved && Math.abs(dx) > 5) {
                                moved = true;
                                isResizingRef.current = true;
                                setResizingId(booking._id);
                                cardEl.style.transition = 'none';
                                cardEl.style.zIndex = '50';
                              }
                              if (moved) {
                                const snapped = Math.round(dx / COLUMN_WIDTH) * COLUMN_WIDTH;
                                const addedDays = snapped / COLUMN_WIDTH;
                                
                                // Prevent visual expansion into clash
                                if (addedDays > 0) {
                                  const newCO = addDays(startOfDay(parseISO(booking.checkout)), addedDays);
                                  const isClashing = bookings.some(b => {
                                    if (String(b._id) === String(booking._id) || b.status === 'cancelled' || b.status === 'checked-out') return false;
                                    if (getBookingRoomId(b) !== getBookingRoomId(booking)) return false;
                                    const bS = startOfDay(parseISO(b.checkin));
                                    const bE = startOfDay(parseISO(b.checkout));
                                    return startOfDay(parseISO(booking.checkin)) < bE && newCO > bS;
                                  });
                                  if (isClashing) return;
                                }

                                cardEl.style.width = `${Math.max(COLUMN_WIDTH, originalWidth + snapped)}px`;

                                // Auto-scroll logic for edge pushing
                                if (boardRef.current) {
                                  const rect = boardRef.current.getBoundingClientRect();
                                  const edgeSize = isMobile ? 60 : 45;
                                  let scrollDX = 0;
                                  
                                  if (me.clientX < rect.left + edgeSize) scrollDX = -((rect.left + edgeSize) - me.clientX) * 0.8;
                                  else if (me.clientX > rect.right - edgeSize) scrollDX = (me.clientX - (rect.right - edgeSize)) * 0.8;

                                  if (scrollDX !== 0) {
                                    boardRef.current.scrollLeft += scrollDX;
                                  }
                                }
                              }
                            };

                            const onUp = (ue: PointerEvent) => {
                              const dx        = ue.clientX - startX;
                              const daysDelta = Math.round(dx / COLUMN_WIDTH);

                              if (moved && daysDelta !== 0) {
                                const origCheckin = startOfDay(parseISO(booking.checkin));
                                const origNights  = differenceInDays(parseISO(booking.checkout), origCheckin);
                                 const newNights = origNights + daysDelta;
                                 if (newNights < 1) {
                                   cleanup();
                                   return;
                                 }
                                 
                                 const newCheckout = format(addDays(origCheckin, newNights), 'yyyy-MM-dd');
                                
                                // Clash check for resize
                                const newCheckoutDate = startOfDay(parseISO(newCheckout));
                                const isClashingRes = bookings.some(b => {
                                  if (String(b._id) === String(booking._id) || b.status === 'cancelled' || b.status === 'checked-out') return false;
                                  if (getBookingRoomId(b) !== getBookingRoomId(booking)) return false;
                                  const bS = startOfDay(parseISO(b.checkin));
                                  const bE = startOfDay(parseISO(b.checkout));
                                  return startOfDay(parseISO(booking.checkin)) < bE && newCheckoutDate > bS;
                                });

                                 if (!isClashingRes) {
                                   
                                   const addedDaysTotal = differenceInDays(startOfDay(parseISO(newCheckout)), startOfDay(weekStart));
                                   if (addedDaysTotal >= DAYS) {
                                     setWeekStart(startOfDay(addDays(weekStart, addedDaysTotal - DAYS + 1)));
                                   }
                                   
                                   setUseNewPrice(false); // Resizing usually keeps the same room price
                                   setPendingUpdate({
                                     booking,
                                     updates: { roomId: getBookingRoomId(booking), checkin: booking.checkin, checkout: newCheckout },
                                     type: 'resize',
                                     details: {
                                       oldRoom: room.roomNumber,
                                       newRoom: room.roomNumber, // Maintain same room
                                       oldCheckin: booking.checkin,
                                       newCheckin: booking.checkin,
                                       oldCheckout: booking.checkout,
                                       newCheckout: newCheckout,
                                       changeText: daysDelta > 0 ? `Extend stay` : `Shorten stay`,
                                       nightsDelta: daysDelta,
                                       oldPrice: booking.roomPrice || 0,
                                       newPrice: booking.roomPrice || 0
                                     }
                                   });
                                 }
                              }
                              cleanup();
                            };

                            const cleanup = () => {
                              try { handleEl.releasePointerCapture(e.pointerId); } catch (_) {}
                              window.removeEventListener('pointermove', onMove);
                              window.removeEventListener('pointerup',   onUp);
                              window.removeEventListener('pointercancel', cleanup);
                              if (moved) {
                                // KEY FIX: restore to original width explicitly so React's
                                // virtual-DOM diff doesn't skip re-applying the style.
                                // (Setting '' can leave card collapsed if React skips the update)
                                cardEl.style.width = `${originalWidth}px`;
                                cardEl.style.zIndex     = '';
                                cardEl.style.transition = '';
                              }
                              setResizingId(null);
                              setTimeout(() => { isResizingRef.current = false; }, 100);
                            };

                            window.addEventListener('pointermove', onMove);
                            window.addEventListener('pointerup',   onUp);
                            window.addEventListener('pointercancel', cleanup);
                          };

                          return (
                            <motion.div
                              layout
                              layoutId={booking._id}
                              key={booking._id}
                              data-booking-card=""
                              className={cn(
                                "absolute overflow-hidden shadow-sm group/card border rounded-[12px] transition-shadow",
                                getStatusColor(booking.status),
                                isEditable ? "hover:shadow-md hover:z-20" : "opacity-80"
                              )}
                              style={{
                                left:   cardLeft,
                                top:    6,
                                width:  cardWidth,
                                height: heightTotal,
                                zIndex: booking.status === 'checked-in' ? 14 : booking.status === 'reserved' ? 12 : 10,
                                cursor: isEditable ? 'grab' : 'pointer',
                                touchAction: isEditable && isMobile ? 'none' : undefined,
                                transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s ease',
                                transformOrigin: 'center left'
                              }}
                              onPointerDown={isEditable ? (e) => handleCardDragStart(e as any) : undefined}
                              onClick={(e) => {
                                if (isDraggingRef.current || isResizingRef.current) return;
                                if (booking.status !== 'cancelled' && booking.status !== 'checked-out') e.stopPropagation();
                                setSelectedBooking(booking);
                              }}
                            >
                                <div className="flex flex-col h-full justify-between p-1.5 md:p-2 text-white" data-card-content="">
                                  <div className="flex justify-between items-start gap-1">
                                    <button
                                      className="font-bold truncate text-left hover:underline leading-tight z-10 relative outline-none text-[9px] md:text-[10px]"
                                      onClick={(e) => {
                                        if (isDraggingRef.current || isResizingRef.current) return;
                                        e.stopPropagation();
                                        if (guest?._id) setSelectedGuestId(guest._id);
                                        else setSelectedBooking(booking);
                                      }}
                                    >
                                      {guest?.name || 'Guest'}
                                    </button>

                                    {others.length > 0 && (
                                       <div className="z-20 ml-auto" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                                         <Popover>
                                            <PopoverTrigger asChild>
                                               <button className="bg-white/30 hover:bg-white/40 text-[8px] md:text-[9px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0 shadow-sm border border-white/20 transition-transform active:scale-95">
                                                  +{others.length}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64 p-2 rounded-xl shadow-xl border z-[300]">
                                                <div className="p-2 border-b mb-1 flex items-center justify-between">
                                                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Other Stays</p>
                                                  <span className="bg-slate-100 text-slate-500 text-[8px] px-1.5 py-0.5 rounded-full font-black">+{others.length}</span>
                                                </div>
                                                <div className="space-y-1">
                                                  {others.map(o => {
                                                      const dotColorMap: Record<string, string> = {
                                                        'reserved': 'bg-emerald-500',
                                                        'checked-in': 'bg-blue-500',
                                                        'checked-out': 'bg-orange-500',
                                                        'cancelled': 'bg-slate-400',
                                                       };
                                                      return (
                                                        <button key={o._id} className="w-full p-2 hover:bg-slate-50 rounded-lg text-left flex items-center justify-between group/o" onClick={(e) => { e.stopPropagation(); setSelectedBooking(o); }}>
                                                           <div className="flex flex-col">
                                                              <span className="text-[10px] font-bold text-slate-900 group-hover/o:text-primary">{getGuest(o)?.name || 'Guest'}</span>
                                                              <span className="text-[8px] font-bold text-slate-400 capitalize tracking-tighter">{o.status}</span>
                                                           </div>
                                                           <div className={cn("w-2 h-2 rounded-full", dotColorMap[o.status] || 'bg-slate-300')} />
                                                        </button>
                                                      );
                                                  })}
                                                </div>
                                            </PopoverContent>
                                         </Popover>
                                       </div>
                                     )}
                                  </div>
                                   <span className="text-[7px] md:text-[8px] bg-black/10 px-1 py-0.5 rounded-sm font-semibold capitalize tracking-wide w-fit opacity-90 border border-white/10">
                                     {booking.status}
                                   </span>
                                 </div>

                                 {isEditable && (
                                   <div 
                                     className={cn(
                                       "absolute right-0 top-0 bottom-0 cursor-ew-resize z-50 flex items-center justify-center pointer-events-auto transition-all",
                                       "w-4 opacity-0 group-hover/card:opacity-100 hover:bg-black/5 active:opacity-100",
                                       !isMobile && "w-3 opacity-0"
                                     )}
                                     style={{ touchAction: 'none' }}
                                     onPointerDown={(e) => handleResizeDragStart(e as any)}
                                     onClick={e => e.stopPropagation()}
                                   >
                                     <div className={cn("rounded-full bg-white/60", isMobile ? "h-6 w-1.5 shadow-sm" : "h-4 w-1")} />
                                   </div>
                                 )}
                             </motion.div>
                           );
                         });

                         // Return cancelled mini-badges alongside active card JSX.
                         const cancelledBadgeEls = Object.entries(cancelledByDay).map(([dayIso, count]) => {
                           const dayDate  = new Date(dayIso);

                           // Prevent badge from rendering under semi-transparent active cards causing an overlapping, dirty look
                           const isOverlayedByCard = visibleCards.some(vc => {
                             const vcStart = startOfDay(parseISO(vc.primary.checkin));
                             const vcEnd = startOfDay(parseISO(vc.primary.checkout));
                             return dayDate >= vcStart && dayDate < vcEnd;
                           });
                           if (isOverlayedByCard) return null;

                           const dayOffset = differenceInDays(startOfDay(dayDate), startOfDay(weekStart));
                           if (dayOffset < 0 || dayOffset >= DAYS) return null;
                           const badgeLeft = ROOM_COL + dayOffset * COLUMN_WIDTH + COLUMN_WIDTH - 24;

                           const cancelledOnDayList = cancelledBookings.filter(b => {
                             const cIn = startOfDay(parseISO(b.checkin));
                             const cOut = startOfDay(parseISO(b.checkout));
                             return dayDate >= cIn && dayDate < cOut;
                           });

                           return (
                             <div 
                               key={`cnl-badge-${dayIso}`} 
                               className="absolute top-1.5 z-30 pointer-events-auto" 
                               style={{ left: badgeLeft }}
                             >
                                <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="bg-slate-100 ring-1 ring-slate-200 hover:bg-slate-200 text-slate-500 text-[8px] md:text-[9px] px-1.5 py-0.5 rounded-md font-bold shadow-sm transition-colors z-20">
                                        +{count}
                                      </button>
                                    </PopoverTrigger>
                                <PopoverContent className="w-64 p-2 rounded-xl shadow-xl border z-[300]">
                                        <div className="p-2 border-b mb-1 flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-slate-400" />
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Cancelled</p>
                                          </div>
                                          <span className="bg-slate-100 text-slate-600 text-[8px] px-1.5 py-0.5 rounded-full font-black">+{count}</span>
                                        </div>
                                        <div className="space-y-1">
                                          {cancelledOnDayList.map(o => (
                                              <button key={o._id} className="w-full p-2 hover:bg-slate-50 rounded-lg text-left flex items-center justify-between group/o" onClick={(e) => { e.stopPropagation(); setSelectedBooking(o); }}>
                                                 <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-slate-900 group-hover/o:text-primary line-through decoration-slate-300">{getGuest(o)?.name || 'Guest'}</span>
                                                    <span className="text-[8px] font-bold text-slate-400 capitalize tracking-tighter">{o.status}</span>
                                                 </div>
                                                 <div className="w-2 h-2 rounded-full bg-slate-300" />
                                              </button>
                                          ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                             </div>
                           );
                         });
                         return [...cardJsx, ...cancelledBadgeEls];
                       })()}
                  </motion.div>
                );
              })}
            </div>
            {/* Small spacer at bottom to ensure the last room is visible */}
            <div className="h-8 w-full pointer-events-none" />
          </div>
        </div>
      </div>

      <BookingModal isOpen={isModalOpen || !!editingBooking} onClose={() => { setIsModalOpen(false); setEditingBooking(null); }}
        selectedRoomId={selectedRoomId} selectedDate={selectedDate} initialBooking={editingBooking} />
      <BookingDetailSheet booking={selectedBooking} onClose={() => setSelectedBooking(null)} onOpenGuest={(id) => setSelectedGuestId(id)} />
      <GuestProfileSheet 
        guestId={selectedGuestId} 
        onClose={() => setSelectedGuestId(null)} 
        onBookingClick={(b) => {
          setSelectedBooking(b);
          setSelectedGuestId(null);
        }} 
      />

      {/* Refined Confirmation Dialog */}
      <Dialog open={!!pendingUpdate} onOpenChange={(open) => !open && !isUpdating && setPendingUpdate(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-[32px] p-0 border-none shadow-3xl overflow-hidden bg-white">
          <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner shadow-primary/5">
                 <ShieldCheck className="h-5 w-5" />
               </div>
                <DialogHeader className="p-0">
                   <DialogTitle className="text-xl font-black tracking-tighter text-slate-900 leading-none">Confirm Change</DialogTitle>
                </DialogHeader>
             </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 items-center px-1">
              {/* CURRENT */}
              <div className="space-y-2 text-center min-w-0">
                 <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest truncate">Original</p>
                 <div className="p-3 md:p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-inner group/card transition-all opacity-60 flex flex-col justify-center min-h-[72px]">
                    <p className="font-black text-slate-900 text-xs md:text-sm mb-1 leading-none truncate w-full" title={pendingUpdate ? `Rm ${pendingUpdate.details.oldRoom}` : 'Room'}>
                      {pendingUpdate ? `Rm ${pendingUpdate.details.oldRoom}` : 'Room'}
                    </p>
                    <p className="text-[9px] md:text-[10px] font-bold text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
                      {pendingUpdate && format(parseISO(pendingUpdate.details.oldCheckin), 'MMM dd')} - {pendingUpdate && format(parseISO(pendingUpdate.details.oldCheckout), 'MMM dd')}
                    </p>
                 </div>
              </div>

              <div className="bg-slate-100 h-6 w-6 md:h-8 md:w-8 rounded-full flex items-center justify-center border border-white shadow-sm opacity-50 flex-shrink-0">
                 <ArrowRight className="h-3 w-3 md:h-4 md:w-4 text-slate-400" />
              </div>

              {/* NEW */}
              <div className="space-y-2 text-center min-w-0">
                 <p className="text-[9px] font-black uppercase text-primary/60 tracking-widest truncate">Proposed</p>
                 <div className="p-3 md:p-4 rounded-2xl bg-primary/5 border border-primary/20 shadow-lg shadow-primary/5 ring-1 ring-primary/5 scale-105 flex flex-col justify-center min-h-[72px]">
                    <p className="font-black text-primary text-xs md:text-sm mb-1 leading-none truncate w-full" title={pendingUpdate ? `Rm ${pendingUpdate.details.newRoom}` : 'Room'}>
                      {pendingUpdate ? `Rm ${pendingUpdate.details.newRoom}` : 'Room'}
                    </p>
                    <p className="text-[9px] md:text-[10px] font-black text-primary whitespace-nowrap overflow-hidden text-ellipsis">
                      {pendingUpdate && format(parseISO(pendingUpdate.details.newCheckin), 'MMM dd')} - {pendingUpdate && format(parseISO(pendingUpdate.details.newCheckout), 'MMM dd')}
                    </p>
                 </div>
              </div>
            </div>

            {pendingUpdate && pendingUpdate.details.oldPrice !== pendingUpdate.details.newPrice && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Room Price Change</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 line-through decoration-slate-300">₹{pendingUpdate.details.oldPrice}</span>
                    <ArrowRight className="h-2.5 w-2.5 text-slate-300" />
                    <span className="text-[11px] font-black text-emerald-600">₹{pendingUpdate.details.newPrice}</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setUseNewPrice(!useNewPrice)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
                    useNewPrice 
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/10" 
                      : "bg-white border-slate-200 text-slate-600"
                  )}
                >
                  <div className={cn(
                    "w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all",
                    useNewPrice ? "bg-white border-transparent" : "bg-slate-100 border-slate-300"
                  )}>
                    {useNewPrice && <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tight">
                    {useNewPrice ? "Apply New Room Price" : "Keep Original Price"}
                  </span>
                </button>
              </div>
            )}

            {pendingUpdate?.details.changeText && (() => {
               const text = pendingUpdate.details.changeText;
               const nights = pendingUpdate.details.nightsDelta;
               const isResize = pendingUpdate.type === 'resize';
               const isExtend = isResize && nights && nights > 0;
               const isReduce = isResize && nights && nights < 0;
               const isMove   = pendingUpdate.type === 'move';
               
               const label = isExtend ? 'Extend Stay' : isReduce ? 'Shorten Stay' : 'Shift Booking';
               const sublabel = isMove ? text : `${Math.abs(nights || 0)} night${Math.abs(nights || 0) !== 1 ? 's' : ''} ${nights && nights > 0 ? 'added' : 'removed'}`;
               
               return (
                 <div className={cn(
                   "flex flex-col items-center justify-center py-4 px-6 rounded-[24px] text-center gap-1",
                   isExtend ? "bg-emerald-50 border border-emerald-100" :
                   isReduce ? "bg-amber-50 border border-amber-100" :
                   "bg-primary/5 border border-primary/10"
                 )}>
                   <span className={cn(
                     "text-[10px] md:text-[11px] font-black uppercase tracking-wider leading-tight",
                     isExtend ? "text-emerald-700" : isReduce ? "text-amber-700" : "text-primary"
                   )}>
                     {label}
                   </span>
                   <span className="text-[10px] font-bold text-slate-500 text-center">
                     {sublabel.replace('Confirmed', 'Reserved')}
                   </span>
                 </div>
               );
            })()}

            <DialogFooter className="flex flex-row gap-3 pt-2">
              <Button 
                variant="ghost" 
                disabled={isUpdating}
                onClick={() => setPendingUpdate(null)}
                className="flex-1 h-12 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
              >
                Discard
              </Button>
              <Button 
                disabled={isUpdating}
                onClick={async () => {
                  if (pendingUpdate) {
                    setIsUpdating(true);
                     try {
                        const finalUpdates = { ...pendingUpdate.updates };
                        if (useNewPrice && pendingUpdate.details.newPrice !== pendingUpdate.details.oldPrice) {
                          finalUpdates.roomPrice = pendingUpdate.details.newPrice;
                        }
                        await updateBooking(pendingUpdate.booking._id, finalUpdates);
                        setPendingUpdate(null);
                      } catch (err) {
                      console.error(err);
                    } finally {
                      setIsUpdating(false);
                    }
                  }
                }}
                className="flex-[1.5] h-12 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 text-[11px] font-black uppercase tracking-[0.1em] shadow-xl shadow-slate-900/20 ring-1 ring-white/10 transition-all active:scale-95"
              >
                {isUpdating ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Apply Entry'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
