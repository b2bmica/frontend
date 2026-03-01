import { useState, useMemo, useRef, useEffect } from 'react';
import {
  format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay,
  differenceInDays, startOfDay, isBefore, parseISO
} from 'date-fns';
import { motion } from 'framer-motion';
import { Loader2, Search, UserPlus, IndianRupee, Info, Printer, ChevronLeft, ChevronRight, ChevronDown, Plus, Bed, X, ShieldCheck, ArrowRight, Calendar } from 'lucide-react';
import { useBookings, type Booking } from '../context/booking-context';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { BookingModal } from '@/components/booking-modal';
import { BookingDetailSheet } from '@/components/booking-detail-sheet';
import { GuestProfileSheet } from '@/components/guest-profile-sheet';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

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
    case 'reserved':    return 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20';
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
  const [weekStart, setWeekStart] = useState(() => addDays(startOfDay(new Date()), -2));
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
  const [pendingUpdate, setPendingUpdate] = useState<{
    booking: Booking;
    updates: { roomId: string; checkin: string; checkout: string };
    type: 'move' | 'resize';
    details: {
      oldRoom?: string;
      newRoom?: string;
      oldCheckin: string;
      newCheckin: string;
      oldCheckout: string;
      newCheckout: string;
      changeText: string;
    }
  } | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [daysCount, setDaysCount] = useState(14);
  useEffect(() => {
    const check = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      if (width < 768) setDaysCount(12);
      else if (width < 1200) setDaysCount(18);
      else setDaysCount(28);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const DAYS = daysCount;
  const COLUMN_WIDTH = isMobile ? 65 : 100;
  const ROW_HEIGHT  = isMobile ? 60 : 68;
  const ROOM_COL    = isMobile ? 100 : 152;

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

  const isTodayView = isSameDay(weekStart, addDays(startOfDay(new Date()), -2));

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
    const VER_OFFSET = 40; // sticky header height

    const dayAtMouse = (x - HOZ_OFFSET) / COLUMN_WIDTH;
    const dayIndex = Math.round(dayAtMouse - dragGrabOffsetDaysRef.current);
    const roomIndex = Math.floor((y - VER_OFFSET) / ROW_HEIGHT);

    const activeRooms = rooms.filter(r => statusFilter === 'maintenance' ? (r.status === 'maintenance' || r.status === 'under-maintenance') : true);
    
    // Loosen bounds slightly or ensure precise containment
    const isValidDay = dayIndex >= -1 && dayIndex < DAYS + 1;
    const isValidRoom = roomIndex >= 0 && roomIndex < activeRooms.length;

    if (isValidDay && isValidRoom) {
      const clampedDayIndex = Math.max(0, Math.min(DAYS - 1, dayIndex));
      const targetDay = addDays(weekStart, clampedDayIndex);
      const targetRoom = activeRooms[roomIndex];
      const duration = differenceInDays(new Date(booking.checkout), new Date(booking.checkin));
      const newCheckin = format(targetDay, 'yyyy-MM-dd');
      const newCheckout = format(addDays(targetDay, duration), 'yyyy-MM-dd');
      const currentCheckin = format(new Date(booking.checkin), 'yyyy-MM-dd');
      
      const newCheckinDate = parseISO(newCheckin);
      const newCheckoutDate = parseISO(newCheckout);
      
      const isClashing = bookings.some(b => {
        if (b._id === booking._id || b.status === 'cancelled' || b.status === 'checked-out') return false;
        if (getBookingRoomId(b) !== targetRoom._id) return false;
        const bStart = parseISO(b.checkin);
        const bEnd = parseISO(b.checkout);
        return newCheckinDate < bEnd && newCheckoutDate > bStart;
      });

      if (isClashing) return;
      if (newCheckin === currentCheckin && targetRoom._id === getBookingRoomId(booking)) return;

      const oldRoom = rooms.find(r => r._id === getBookingRoomId(booking));
      const dayDiff = Math.round(differenceInDays(newCheckinDate, startOfDay(parseISO(booking.checkin))));
      const nightText = dayDiff === 0 ? "" : (dayDiff > 0 ? ` +${dayDiff} night${dayDiff > 1 ? 's' : ''}` : ` -${Math.abs(dayDiff)} night${Math.abs(dayDiff) > 1 ? 's' : ''}`);
      const changeText = targetRoom._id !== getBookingRoomId(booking) ? `Push to Rm ${targetRoom.roomNumber}${nightText}` : (nightText ? `Shift ${nightText.trim()}` : "Save changes");
      
      setPendingUpdate({
        booking,
        updates: { roomId: targetRoom._id, checkin: newCheckin, checkout: newCheckout },
        type: targetRoom._id !== getBookingRoomId(booking) ? 'move' : 'resize',
        details: {
          oldRoom: oldRoom?.roomNumber,
          newRoom: targetRoom.roomNumber,
          oldCheckin: booking.checkin,
          newCheckin,
          oldCheckout: booking.checkout,
          newCheckout,
          changeText
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
      <div className="flex flex-col bg-background border rounded-2xl overflow-hidden shadow-sm h-full"
        style={{ minHeight: 480 }}>

        {/* ── Header ── */}
        <div className="flex flex-col gap-3 p-4 border-b bg-card/40 backdrop-blur-md">
          {/* Top Row: Navigation & Today */}
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-slate-200 bg-white shadow-sm font-bold text-xs"
              onClick={() => setWeekStart(addDays(weekStart, -DAYS))}>
              <ChevronLeft className="h-4 w-4 mr-1" /> {isMobile ? '' : 'Earlier'}
            </Button>
            
            <div className="flex flex-col items-center flex-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex flex-col items-center hover:bg-slate-100/50 p-1 px-4 rounded-xl transition-colors min-w-[140px]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Viewing Period</span>
                    <span className="text-xs font-black uppercase tracking-tight text-slate-900 flex items-center gap-1">
                      {periodLabel} <ChevronDown className="h-3 w-3 opacity-40" />
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 rounded-2xl shadow-2xl border-none">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Jump to Date</Label>
                    <Input 
                      type="date" 
                      className="h-10 rounded-xl font-bold" 
                      value={format(weekStart, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        if (e.target.value) setWeekStart(startOfWeek(new Date(e.target.value), { weekStartsOn: 1 }));
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-slate-200 bg-white shadow-sm font-bold text-xs"
              onClick={() => setWeekStart(addDays(weekStart, DAYS))}>
              {isMobile ? '' : 'Later'} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Middle Row: Search and Quick Stats */}
          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                  <Input 
                    className="h-10 pl-10 pr-10 rounded-xl border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-primary/10 text-sm font-bold placeholder:font-medium transition-all"
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
                  <Button variant="secondary" size="sm" className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                    onClick={() => setWeekStart(addDays(startOfDay(new Date()), -2))}>
                    {isMobile ? 'Today' : 'Go to Today'}
                  </Button>
                )}
             </div>

             {/* Filter Stats/Indicator */}
             {search && (
                <div className="flex items-center justify-between px-1 animate-in fade-in slide-in-from-top-1 duration-200">
                   <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black uppercase text-slate-400">Results:</span>
                       <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] h-5 font-black">
                         {globalMatches.length} Found
                       </Badge>
                       <span className="text-[10px] font-bold text-slate-400">
                         ({filteredBookings.length} in view)
                       </span>
                   </div>
                   {offScreenMatches.length > 0 && (
                      <Popover>
                         <PopoverTrigger asChild>
                            <button className="text-[10px] font-black text-primary hover:underline uppercase tracking-tighter flex items-center gap-1">
                              {offScreenMatches.length} Off-Screen <Info className="h-3 w-3" />
                            </button>
                         </PopoverTrigger>
                         <PopoverContent className="w-64 p-2 rounded-2xl shadow-3xl border-none">
                            <div className="p-2 border-b mb-1">
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">External Results</p>
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                               {offScreenMatches.map(m => (
                                  <button
                                     key={m._id}
                                     onClick={() => setWeekStart(addDays(startOfDay(new Date(m.checkin)), -1))}
                                     className="w-full p-2 hover:bg-slate-50 rounded-lg text-left transition-colors flex items-center justify-between group/ext"
                                  >
                                     <div>
                                        <p className="text-[11px] font-black text-slate-900 group-hover/ext:text-primary transition-colors">{getGuest(m)?.name || 'Guest'}</p>
                                        <p className="text-[9px] font-bold text-slate-400">{format(parseISO(m.checkin), 'MMM dd')} - {m.status}</p>
                                     </div>
                                     <ChevronRight className="h-3 w-3 text-slate-200 group-hover/ext:text-primary transition-colors" />
                                  </button>
                               ))}
                            </div>
                         </PopoverContent>
                      </Popover>
                   )}
                </div>
             )}
          </div>

          {/* Row 2: status filter chips + counts */}
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
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                    statusFilter === key
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40"
                  )}
                >
                  {color && <span className={cn("w-2 h-2 rounded-full flex-shrink-0", color)} />}
                  {label}
                  <span className={cn(
                    "inline-flex items-center justify-center rounded-full min-w-[18px] h-[18px] text-[10px] px-1",
                    statusFilter === key ? "bg-white/20" : "bg-border"
                  )}>{count}</span>
                </button>
              );
            })}
            {statusFilter !== 'all' && (
              <button onClick={() => setStatusFilter('all')} className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Compact room-status legend */}
          <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Room:</span>
            {[
              { dot: 'bg-green-500', label: 'Clean' },
              { dot: 'bg-yellow-400', label: 'Dirty' },
              { dot: 'bg-red-500',   label: 'Repair' },
            ].map(({ dot, label }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                <span className="text-[9px] font-bold text-slate-400">{label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Board ── */}
        <div className="flex-1 overflow-auto" ref={boardRef}>
          <div className="inline-block min-w-full relative" ref={boardContentRef}>

            {/* Column headers */}
            <div className="flex sticky top-0 z-30 bg-card border-b">
              <div className="sticky left-0 z-50 bg-slate-50 border-r shadow-[2px_0_10px_rgba(0,0,0,0.05)] flex items-center px-2 md:px-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider"
                style={{ width: ROOM_COL, height: 40, minWidth: ROOM_COL }}>
                Rooms
              </div>
              {timeline.map((day) => (
                <div key={day.toISOString()}
                  className={cn(
                    "flex flex-col items-center justify-center border-r text-xs flex-shrink-0",
                    isSameDay(day, new Date()) && "bg-primary/10 text-primary font-bold"
                  )}
                  style={{ width: COLUMN_WIDTH, height: 40, minWidth: COLUMN_WIDTH }}>
                  <span className="text-[10px] uppercase">{format(day, 'EEE')}</span>
                  <span className={cn(
                    "text-xs leading-tight",
                    isSameDay(day, new Date()) && "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                  )}>
                    {format(day, 'dd')}
                  </span>
                </div>
              ))}
            </div>

            {/* Room rows */}
            <div className="relative">
              {rooms
                .filter(r => statusFilter === 'maintenance' ? (r.status === 'maintenance' || r.status === 'under-maintenance') : true)
                .map((room) => {
                const roomBookings = filteredBookings.filter(b => getBookingRoomId(b) === room._id);
                return (
                  <div key={room._id} className="flex border-b group relative" style={{ height: ROW_HEIGHT }}>

                    {/* Room label - High Z to stay above scrollable cards */}
                    <div className="sticky left-0 z-40 bg-white border-r flex flex-col justify-center px-2 md:px-3 shadow-[2px_0_10px_rgba(0,0,0,0.05)] flex-shrink-0"
                      style={{ width: ROOM_COL, minWidth: ROOM_COL }}>
                      <div className="font-bold text-xs md:text-sm flex items-center gap-1.5">
                        {room.roomNumber}
                        <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                          (room.status === 'maintenance' || room.status === 'under-maintenance') ? 'bg-red-600 animate-pulse' :
                          room.status === 'clean'        ? 'bg-emerald-500' :
                          room.status === 'occupied'     ? 'bg-blue-500'  :
                          room.status === 'dirty'        ? 'bg-amber-500': 'bg-slate-300'
                        )} title={room.status} />
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{room.roomType}</div>
                      <div className="text-[10px] text-muted-foreground">₹{room.price}</div>
                    </div>

                    {/* Day cells */}
                    {timeline.map((day) => (
                      <div key={day.toISOString()}
                        className={cn(
                          "border-r cursor-pointer hover:bg-primary/5 transition-colors flex-shrink-0",
                          isSameDay(day, new Date()) && "bg-primary/5"
                        )}
                        style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH }}
                        onClick={() => handleCellClick(room._id, day)}
                      />
                    ))}

                      {(() => {
                        // Multi-Lane Stacking Logic
                        // 1. Sort bookings by checkin
                        const roomMatchBookings = [...roomBookings].sort((a, b) => 
                          parseISO(a.checkin).getTime() - parseISO(b.checkin).getTime()
                        );
                        
                        // 2. Assign lanes (0, 1, 2...) such that no bookings in the same lane overlap
                        const lanes: Booking[][] = [];
                        roomMatchBookings.forEach(b => {
                          const bStart = parseISO(b.checkin);
                          const bEnd = parseISO(b.checkout);
                          
                          let assigned = false;
                          for (let i = 0; i < lanes.length; i++) {
                            const lastInLane = lanes[i][lanes[i].length - 1];
                            const lastEnd = parseISO(lastInLane.checkout);
                            if (bStart >= lastEnd) {
                              lanes[i].push(b);
                              assigned = true;
                              break;
                            }
                          }
                          if (!assigned) {
                            lanes.push([b]);
                          }
                        });

                        const totalLanes = Math.max(1, lanes.length);
                        const heightTotal = ROW_HEIGHT - 6;
                        const laneHeight = heightTotal / totalLanes;

                        return lanes.map((laneBookings, laneIdx) => {
                          return laneBookings.map(booking => {
                            const checkinDate  = startOfDay(parseISO(booking.checkin));
                            const checkoutDate = startOfDay(parseISO(booking.checkout));
                            const weekStartDay = startOfDay(weekStart);
                            const periodEnd    = addDays(weekStart, DAYS);

                            // Only render if some part of the booking is visible in this week
                            if (checkoutDate <= weekStart || checkinDate >= periodEnd) return null;

                            const offsetDays   = differenceInDays(checkinDate, weekStartDay);
                            const duration     = differenceInDays(checkoutDate, checkinDate);

                            const clampedOffset   = Math.max(0, offsetDays);
                            const clampedDuration = Math.min(offsetDays + duration, DAYS) - clampedOffset;
                            if (clampedDuration <= 0) return null;

                             const myStart = parseISO(booking.checkin);
                             const myEnd = parseISO(booking.checkout);
                             // Find max concurrency at any point in this specific booking's duration
                             let maxConcurrentAtAnyPoint = 1;
                             const startDate = parseISO(booking.checkin);
                             const endDate   = parseISO(booking.checkout);
                             
                             // Check each day of this booking
                             const myDays = eachDayOfInterval({ start: startDate, end: addDays(endDate, -1) });
                             myDays.forEach(day => {
                               const countAtDay = roomMatchBookings.filter(b => {
                                 const s = parseISO(b.checkin);
                                 const e = parseISO(b.checkout);
                                 return day >= s && day < e;
                               }).length;
                               if (countAtDay > maxConcurrentAtAnyPoint) maxConcurrentAtAnyPoint = countAtDay;
                             });

                             const displayHeight = heightTotal / maxConcurrentAtAnyPoint;
                             const isSolitary = maxConcurrentAtAnyPoint === 1;

                             const guest = getGuest(booking);
                             const isEditable = booking.status !== 'checked-out' && booking.status !== 'cancelled';
                            
                            return (
                              <motion.div
                                key={`${booking._id}-lane`}
                                drag={isEditable && resizingId !== booking._id}
                                dragSnapToOrigin
                                dragElastic={0}
                                dragMomentum={false}
                                onDragStart={(e, info) => { 
                                  isDraggingRef.current = true; 
                                  if (boardContentRef.current) {
                                    const rect = boardContentRef.current.getBoundingClientRect();
                                    const x = info.point.x - rect.left;
                                    const dayAtMouse = (x - ROOM_COL) / COLUMN_WIDTH;
                                    const bookingStartDay = differenceInDays(startDate, weekStartDay);
                                    dragGrabOffsetDaysRef.current = dayAtMouse - bookingStartDay;
                                  }
                                }}
                                onDragEnd={(e, info) => handleDragEnd(e, info, booking)}
                                whileDrag={{ scale: 1.02, zIndex: 100, opacity: 0.9, cursor: 'grabbing' }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={cn(
                                  "absolute z-10 rounded-md p-1.5 text-white shadow-md overflow-hidden flex flex-col justify-between transition-all group/booking",
                                  getStatusColor(booking.status),
                                  isEditable ? "cursor-grab" : "cursor-pointer",
                                  isDraggingRef.current && "opacity-50"
                                )}
                                 style={{
                                   left:   ROOM_COL + (clampedOffset * COLUMN_WIDTH) + 1,
                                   top:    3 + (laneIdx * (heightTotal / Math.max(laneIdx + 1, maxConcurrentAtAnyPoint))),
                                   width:  (clampedDuration * COLUMN_WIDTH) - 2,
                                   height: Math.max(14, (heightTotal / Math.max(laneIdx + 1, maxConcurrentAtAnyPoint)) - 2),
                                   transition: (resizingId === booking._id || isDraggingRef.current) ? 'none' : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                 }}
                                onClick={(e) => { 
                                  if (isDraggingRef.current || isResizingRef.current) return;
                                  e.stopPropagation(); 
                                  setSelectedBooking(booking); 
                                }}
                              >
                                 <div className="flex flex-col h-full justify-between">
                                     <button
                                       className={cn(
                                         "font-bold truncate text-left hover:underline leading-tight z-10 relative w-fit outline-none",
                                         isSolitary ? "text-[10px] md:text-xs" : "text-[8px] md:text-[9px]"
                                       )}
                                       onClick={(e) => {
                                         if (isDraggingRef.current || isResizingRef.current) return;
                                         e.stopPropagation();
                                         if (guest?._id) setSelectedGuestId(guest._id);
                                         else setSelectedBooking(booking);
                                       }}
                                     >
                                       {guest?.name || 'Guest'}
                                     </button>
                                     
                                     {totalLanes === 1 && (
                                       <span className="text-[8px] md:text-[10px] bg-black/20 px-1 py-0.5 rounded-full truncate font-semibold capitalize tracking-tighter w-fit z-10 relative pointer-events-none">
                                         {booking.status.replace('-', ' ')}
                                       </span>
                                     )}
                                 </div>

                                 {/* Resize handle (Right edge) */}
                                 {isEditable && totalLanes === 1 && (
                                   <div 
                                     className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 z-50 flex items-center justify-center opacity-0 group-hover/booking:opacity-100 transition-opacity touch-none"
                                     onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                                     onPointerDown={(e) => {
                                       e.stopPropagation();
                                       e.preventDefault();
                                       const handleEl = e.currentTarget as HTMLElement;
                                       try {
                                         handleEl.setPointerCapture(e.pointerId);
                                       } catch (err) {}
                                       
                                       const startX = e.clientX;
                                       const cardElement = handleEl.parentElement as HTMLElement;
                                       const originalWidth = cardElement.getBoundingClientRect().width;
                                       let hasMovedSignificant = false;

                                       const onPointerMove = (moveEvent: PointerEvent) => {
                                          const deltaX = moveEvent.clientX - startX;
                                          if (!hasMovedSignificant && Math.abs(deltaX) > 8) { // Increased threshold to 8px
                                            hasMovedSignificant = true;
                                            isResizingRef.current = true;
                                            setResizingId(booking._id);
                                          }
                                          if (hasMovedSignificant && cardElement) {
                                            const snappedDeltaX = Math.round(deltaX / COLUMN_WIDTH) * COLUMN_WIDTH;
                                            const minWidth = COLUMN_WIDTH;
                                            const newWidth = Math.max(minWidth, originalWidth + snappedDeltaX);
                                            cardElement.style.width = newWidth + "px";
                                            if (cardElement.style.transition !== 'none') cardElement.style.transition = 'none';
                                          }
                                       };

                                       const onPointerUp = (upEvent: PointerEvent) => {
                                         cleanup();
                                         const deltaX = upEvent.clientX - startX;
                                         const rawDaysDelta = Math.round(deltaX / COLUMN_WIDTH);
                                         
                                         if (hasMovedSignificant && rawDaysDelta !== 0) {
                                           const originalCheckin = startOfDay(parseISO(booking.checkin));
                                           const originalNights = differenceInDays(parseISO(booking.checkout), originalCheckin);
                                           const newNights = Math.max(1, originalNights + rawDaysDelta);
                                           const newCheckout = format(addDays(originalCheckin, newNights), 'yyyy-MM-dd');
                                           
                                           setPendingUpdate({
                                              booking,
                                              updates: { roomId: getBookingRoomId(booking), checkin: booking.checkin, checkout: newCheckout },
                                              type: 'resize',
                                              details: {
                                                oldRoom: room.roomNumber,
                                                newRoom: room.roomNumber,
                                                oldCheckin: booking.checkin,
                                                newCheckin: booking.checkin,
                                                oldCheckout: booking.checkout,
                                                newCheckout,
                                                changeText: rawDaysDelta > 0 
                                                  ? `Extend +${rawDaysDelta} night${Math.abs(rawDaysDelta) > 1 ? 's' : ''}` 
                                                  : `Reduce -${Math.abs(rawDaysDelta)} night${Math.abs(rawDaysDelta) > 1 ? 's' : ''}`
                                              }
                                           });
                                         }
                                       };

                                       const cleanup = () => {
                                         try { handleEl.releasePointerCapture(e.pointerId); } catch (err) {}
                                         window.removeEventListener('pointermove', onPointerMove);
                                         window.removeEventListener('pointerup', onPointerUp);
                                         window.removeEventListener('pointercancel', cleanup);
                                         if (cardElement) {
                                           cardElement.style.width = ""; 
                                           cardElement.style.zIndex = "";
                                           cardElement.style.transition = "";
                                         }
                                         setResizingId(null);
                                         setTimeout(() => { isResizingRef.current = false; }, 50);
                                       };

                                       window.addEventListener('pointermove', onPointerMove);
                                       window.addEventListener('pointerup', onPointerUp);
                                       window.addEventListener('pointercancel', cleanup);
                                     }}
                                   >
                                     <div className="h-6 w-1 bg-white/40 rounded-full" />
                                   </div>
                                 )}
                              </motion.div>
                            );
                          });
                        });
                      })()}
                  </div>
                );
              })}
            </div>
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
                   <DialogTitle className="text-xl font-black italic tracking-tighter text-slate-900 leading-none">Confirm Change</DialogTitle>
                </DialogHeader>
             </div>
              <div className="flex flex-col items-end">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-50">Manual Registry Override</p>
              </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
              {/* CURRENT */}
              <div className="space-y-2 text-center">
                 <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Original</p>
                 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-inner group/card transition-all opacity-60">
                    <p className="font-black text-slate-900 text-sm mb-1 leading-none">{pendingUpdate ? `Rm ${pendingUpdate.details.oldRoom}` : 'Room'}</p>
                    <p className="text-[10px] font-bold text-slate-400 italic">
                      {pendingUpdate && format(parseISO(pendingUpdate.details.oldCheckin), 'MMM dd')} - {pendingUpdate && format(parseISO(pendingUpdate.details.oldCheckout), 'MMM dd')}
                    </p>
                 </div>
              </div>

              <div className="bg-slate-100 h-8 w-8 rounded-full flex items-center justify-center border border-white shadow-sm opacity-50">
                 <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>

              {/* NEW */}
              <div className="space-y-2 text-center">
                 <p className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Proposed</p>
                 <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 shadow-lg shadow-primary/5 ring-1 ring-primary/5 scale-105">
                    <p className="font-black text-primary text-sm mb-1 leading-none">{pendingUpdate ? `Rm ${pendingUpdate.details.newRoom}` : 'Room'}</p>
                    <p className="text-[10px] font-black text-primary italic">
                      {pendingUpdate && format(parseISO(pendingUpdate.details.newCheckin), 'MMM dd')} - {pendingUpdate && format(parseISO(pendingUpdate.details.newCheckout), 'MMM dd')}
                    </p>
                 </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100/50 text-center animate-in fade-in slide-in-from-bottom-2 duration-400">
               <p className="text-xs font-medium text-slate-600 leading-relaxed">
                 {pendingUpdate?.details.changeText.includes('Push') 
                   ? `Moving booking to ${pendingUpdate.details.newRoom} and shifting by ${pendingUpdate.details.changeText.split('night')[0].split('+')[1] || pendingUpdate.details.changeText.split('night')[0].split('-')[1] || '0'} nights.`
                   : pendingUpdate?.details.changeText}
               </p>
            </div>

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
                      await updateBooking(pendingUpdate.booking._id, pendingUpdate.updates);
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
