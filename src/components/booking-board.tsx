import { useState, useMemo, useRef, useEffect } from 'react';
import {
  format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay,
  differenceInDays, startOfDay, isBefore, parseISO
} from 'date-fns';
import { motion } from 'framer-motion';
import { Loader2, Search, UserPlus, IndianRupee, Info, Printer, ChevronLeft, ChevronRight, ChevronDown, Plus, Bed, X, ShieldCheck } from 'lucide-react';
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
    // Correct for the header height and room col width
    const HOZ_OFFSET = ROOM_COL;
    const VER_OFFSET = 40; // sticky header height

    const dayIndex = Math.floor((x - HOZ_OFFSET) / COLUMN_WIDTH);
    const roomIndex = Math.floor((y - VER_OFFSET) / ROW_HEIGHT);

    if (dayIndex >= 0 && dayIndex < DAYS && roomIndex >= 0 && roomIndex < rooms.length) {
      const targetDay = addDays(weekStart, dayIndex);
      const targetRoom = rooms[roomIndex];
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

      updateBooking(booking._id, { roomId: targetRoom._id, checkin: newCheckin, checkout: newCheckout });
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

                    {/* Booking bars — absolutely positioned within the row */}
                    {(() => {
                        const groups: Booking[][] = [];
                        const sorted = [...roomBookings].sort((a,b) => parseISO(a.checkin).getTime() - parseISO(b.checkin).getTime());
                        for (const b of sorted) {
                          let foundGroup = -1;
                          for (let i = 0; i < groups.length; i++) {
                            if (groups[i].some(e => {
                              const aS = parseISO(e.checkin);
                              const aE = parseISO(e.checkout);
                              const bS = parseISO(b.checkin);
                              const bE = parseISO(b.checkout);
                              return bS < aE && bE > aS;
                            })) {
                               foundGroup = i;
                               break;
                            }
                          }
                          if (foundGroup !== -1) groups[foundGroup].push(b);
                          else groups.push([b]);
                        }

                        return groups.map((group, groupIdx) => {
                          if (group.length === 1) {
                            const booking = group[0];
                            const checkinDate  = startOfDay(new Date(booking.checkin));
                            const checkoutDate = startOfDay(new Date(booking.checkout));
                            const weekStartDay = startOfDay(weekStart);

                            const offsetDays   = differenceInDays(checkinDate, weekStartDay);
                            const duration     = differenceInDays(checkoutDate, checkinDate);

                            if (offsetDays + duration <= 0 || offsetDays >= DAYS) return null;
                            const clampedOffset   = Math.max(0, offsetDays);
                            const clampedDuration = Math.min(offsetDays + duration, DAYS) - clampedOffset;
                            if (clampedDuration <= 0) return null;

                            const guest = getGuest(booking);
                            const isEditable = booking.status !== 'checked-out' && booking.status !== 'cancelled';

                            return (
                              <motion.div
                                key={`${booking._id}-${booking.checkin}-${booking.checkout}`}
                                drag={isEditable && resizingId !== booking._id}
                                dragSnapToOrigin
                                dragElastic={0}
                                dragMomentum={false}
                                onDragStart={() => { isDraggingRef.current = true; }}
                                onDragEnd={(e, info) => handleDragEnd(e, info, booking)}
                                whileDrag={{ scale: 1.02, zIndex: 40, opacity: 0.8, cursor: 'grabbing' }}
                                initial={{ opacity: 0, scale: 1 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={cn(
                                  "absolute z-10 rounded-md p-1.5 text-white shadow-md overflow-hidden flex flex-col justify-between transition-all group/booking",
                                  getStatusColor(booking.status),
                                  isEditable ? "cursor-grab" : "cursor-pointer"
                                )}
                                style={{
                                  left:   ROOM_COL + (clampedOffset * COLUMN_WIDTH) + 1,
                                  top:    3,
                                  width:  (clampedDuration * COLUMN_WIDTH) - 2,
                                  height: ROW_HEIGHT - 6,
                                  transition: resizingId === booking._id ? 'none' : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                }}
                                onClick={(e) => { 
                                  if (isDraggingRef.current || isResizingRef.current) return;
                                  e.stopPropagation(); 
                                  setSelectedBooking(booking); 
                                }}
                              >
                                <button
                                  className="text-[10px] md:text-xs font-bold truncate text-left hover:underline leading-tight z-10 relative w-fit outline-none"
                                  onClick={(e) => {
                                    if (isDraggingRef.current || isResizingRef.current) return;
                                    e.stopPropagation();
                                    if (guest?._id) setSelectedGuestId(guest._id);
                                    else setSelectedBooking(booking);
                                  }}
                                >
                                  {guest?.name || 'Guest'}
                                </button>
                                <span className="text-[8px] md:text-[10px] bg-black/20 px-1 py-0.5 rounded-full truncate font-black uppercase tracking-tighter w-fit z-10 relative pointer-events-none">
                                  {booking.status.replace('-', ' ')}
                                </span>
                                {/* Resize handle (Right edge) - Robust tracking with PointerCapture */}
                                {isEditable && (
                                  <div 
                                    className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-white/30 z-50 flex items-center justify-center opacity-0 group-hover/booking:opacity-100 transition-opacity touch-none"
                                      onPointerDown={(e) => {
                                      e.stopPropagation();
                                      if (isResizingRef.current) return; // Prevent starting a new resize if one is already in progress
                                      
                                      const handleEl = e.currentTarget as HTMLDivElement;
                                      try {
                                        handleEl.setPointerCapture(e.pointerId);
                                      } catch (err) {}
                                      
                                      setResizingId(booking._id);
                                      const startX = e.clientX;
                                      // Use date-fns for robust parsing
                                      const originalCheckout = parseISO(booking.checkout);
                                      const cardElement = handleEl.parentElement as HTMLElement;
                                      // Use getBoundingClientRect for more precise measurements during rapid clicks
                                      const originalWidth = cardElement.getBoundingClientRect().width;

                                      cardElement.style.zIndex = '40';
                                      cardElement.style.transition = 'none'; 
                                      
                                      let hasMovedSignificant = false;

                                      const onPointerMove = (moveEvent: PointerEvent) => {
                                        const deltaX = moveEvent.clientX - startX;
                                        
                                        if (!hasMovedSignificant && Math.abs(deltaX) > 4) { // Reduced threshold for 'significant' move
                                          hasMovedSignificant = true;
                                          isResizingRef.current = true;
                                        }

                                        if (hasMovedSignificant && cardElement) {
                                          const snappedDeltaX = Math.round(deltaX / COLUMN_WIDTH) * COLUMN_WIDTH;
                                          const minWidth = COLUMN_WIDTH - 2;
                                          const newWidth = Math.max(minWidth, originalWidth + snappedDeltaX);
                                          cardElement.style.width = newWidth + "px";
                                        }
                                      };
                                        const onPointerUp = (upEvent: PointerEvent) => {
                                          try {
                                            handleEl.releasePointerCapture(upEvent.pointerId);
                                          } catch (err) {}
                                          window.removeEventListener('pointermove', onPointerMove);
                                          window.removeEventListener('pointerup', onPointerUp);

                                          const deltaX = upEvent.clientX - startX;
                                          const rawDaysDelta = Math.round(deltaX / COLUMN_WIDTH);
                                          
                                          // Reset visuals immediately
                                          if (cardElement) {
                                            cardElement.style.width = ""; 
                                            cardElement.style.zIndex = "";
                                            cardElement.style.transition = "";
                                          }

                                          const finalHasMoved = hasMovedSignificant;
                                          
                                          // Always reset resizing state promptly
                                          setResizingId(null);
                                          setTimeout(() => {
                                            isResizingRef.current = false;
                                          }, 100);

                                          if (finalHasMoved && rawDaysDelta !== 0) {
                                            const originalCheckin = parseISO(booking.checkin);
                                            const originalCheckout = parseISO(booking.checkout);
                                            const originalNights = differenceInDays(originalCheckout, originalCheckin);
                                            const newNights = Math.max(1, originalNights + rawDaysDelta);
                                            const newCheckout = format(addDays(originalCheckin, newNights), 'yyyy-MM-dd');
                                            
                                            // Overlap Check
                                            const proposedEnd = parseISO(newCheckout);
                                            const proposedStart = parseISO(booking.checkin);
                                            
                                            const isClashing = bookings.some(b => {
                                              if (b._id === booking._id || b.status === 'cancelled' || b.status === 'checked-out') return false;
                                              if (getBookingRoomId(b) !== getBookingRoomId(booking)) return false;
                                              const bStart = parseISO(b.checkin);
                                              const bEnd = parseISO(b.checkout);
                                              return proposedStart < bEnd && proposedEnd > bStart;
                                            });

                                            if (isClashing) return;
                                            
                                            if (proposedEnd > proposedStart) {
                                              updateBooking(booking._id, { 
                                                roomId: getBookingRoomId(booking), 
                                                checkin: booking.checkin, 
                                                checkout: newCheckout 
                                              });
                                            }
                                          }
                                        };

                                      window.addEventListener('pointermove', onPointerMove);
                                      window.addEventListener('pointerup', onPointerUp);
                                    }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                    onClick={(e) => e.stopPropagation()} // Prevent click events from propagating during resize
                                  >
                                    <div className="h-6 w-1.5 bg-white/50 rounded-full shadow-sm" />
                                  </div>
                                )}
                              </motion.div>
                            );
                          } else {
                            // Render Group Card
                            const checkins  = group.map(b => parseISO(b.checkin).getTime());
                            const checkouts = group.map(b => parseISO(b.checkout).getTime());
                            const minCheckin  = startOfDay(new Date(Math.min(...checkins)));
                            const maxCheckout = startOfDay(new Date(Math.max(...checkouts)));
                            const weekStartDay = startOfDay(weekStart);

                            const offsetDays   = differenceInDays(minCheckin, weekStartDay);
                            const duration     = differenceInDays(maxCheckout, minCheckin);

                            if (offsetDays + duration <= 0 || offsetDays >= DAYS) return null;
                            const clampedOffset   = Math.max(0, offsetDays);
                            const clampedDuration = Math.min(offsetDays + duration, DAYS) - clampedOffset;
                            if (clampedDuration <= 0) return null;

                            return (
                               <Popover key={`group-${groupIdx}`}>
                                 <PopoverTrigger asChild>
                                   <div
                                     className="absolute z-10 rounded-md p-1.5 text-white shadow-xl flex flex-col justify-center items-center transition-all bg-slate-900 cursor-pointer overflow-hidden border border-white/20"
                                     style={{
                                       left:   ROOM_COL + (clampedOffset * COLUMN_WIDTH) + 1,
                                       top:    3,
                                       width:  (clampedDuration * COLUMN_WIDTH) - 2,
                                       height: ROW_HEIGHT - 6,
                                     }}
                                   >
                                      <div className="flex flex-col items-center">
                                         <span className="text-[10px] md:text-sm font-black italic tracking-tighter leading-none">{group.length} BOOKINGS</span>
                                         <span className="text-[8px] font-black uppercase opacity-60 tracking-[0.2em] mt-0.5">Overlap Pool</span>
                                      </div>
                                      {/* Indicator dots */}
                                      <div className="flex gap-1 mt-1.5 flex-wrap justify-center px-1">
                                         {group.map((b, i) => (
                                           <div key={b._id} className={cn("w-1.5 h-1.5 rounded-full border border-white/20", getStatusColor(b.status).split(' ')[0])} />
                                         ))}
                                      </div>
                                   </div>
                                 </PopoverTrigger>
                                 <PopoverContent className="w-64 p-2 rounded-2xl shadow-3xl border-none z-[600]">
                                    <div className="space-y-1">
                                       <div className="px-2 py-1.5 border-b mb-1">
                                          <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Overlapping Registry</h4>
                                          <p className="text-[10px] font-bold text-slate-800">Unit #{room.roomNumber} History & Active</p>
                                       </div>
                                       {group.map(b => {
                                          const g = getGuest(b);
                                          return (
                                             <button
                                                key={b._id}
                                                onClick={() => setSelectedBooking(b)}
                                                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors group/item"
                                             >
                                                <div className="flex items-center gap-3">
                                                   <div className={cn("w-2 h-8 rounded-full", getStatusColor(b.status).split(' ')[0])} />
                                                   <div className="text-left">
                                                      <p className="text-[11px] font-black tracking-tight text-slate-900 group-hover/item:text-primary transition-colors">{g?.name || 'Guest'}</p>
                                                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                                         {format(parseISO(b.checkin), 'MMM dd')} — {format(parseISO(b.checkout), 'MMM dd')}
                                                      </p>
                                                   </div>
                                                </div>
                                                <div className={cn(
                                                   "px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest",
                                                   b.status === 'cancelled' ? "bg-slate-100 text-slate-400" :
                                                   b.status === 'checked-out' ? "bg-orange-50 text-orange-600" :
                                                   b.status === 'checked-in' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                                                )}>
                                                   {b.status.replace('-', ' ')}
                                                </div>
                                             </button>
                                          );
                                       })}
                                    </div>
                                 </PopoverContent>
                               </Popover>
                            );
                          }
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
      <GuestProfileSheet guestId={selectedGuestId} onClose={() => setSelectedGuestId(null)} onBookingClick={(b) => setSelectedBooking(b)} />
    </>
  );
}
