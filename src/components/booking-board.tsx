import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, 
  differenceInDays, startOfDay
} from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Loader2, Bed, X } from 'lucide-react';
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
  { key: 'reserved', label: 'Reserved', color: 'bg-indigo-600' },
  { key: 'checked-in', label: 'Checked-in', color: 'bg-emerald-600' },
  { key: 'checked-out', label: 'Checked-out', color: 'bg-slate-500' },
] as const;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'reserved':    return 'bg-indigo-600 border-indigo-700/30';
    case 'checked-in':  return 'bg-emerald-600 border-emerald-700/30';
    case 'checked-out': return 'bg-slate-500 border-slate-600/30';
    case 'cancelled':   return 'bg-red-500 border-red-600/30';
    default:            return 'bg-slate-400 border-slate-500/30';
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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{booking: Booking, updates: any} | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [daysCount, setDaysCount] = useState(14);
  useEffect(() => {
    const check = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      if (width < 768) setDaysCount(7);
      else if (width < 1200) setDaysCount(14);
      else setDaysCount(21);
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

  // Filtered bookings for current view range
  const filteredBookings = useMemo(() => {
    const periodEnd = addDays(weekStart, DAYS);
    return bookings.filter(b => {
      if (b.status === 'cancelled') return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      const ci = startOfDay(new Date(b.checkin));
      const co = startOfDay(new Date(b.checkout));
      return ci < periodEnd && co > weekStart;
    });
  }, [bookings, weekStart, statusFilter, DAYS]);

  // Status counts
  const counts = useMemo(() => ({
    reserved:    bookings.filter(b => b.status === 'reserved').length,
    'checked-in':  bookings.filter(b => b.status === 'checked-in').length,
    'checked-out': bookings.filter(b => b.status === 'checked-out').length,
  }), [bookings]);

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
      
      // If dropped in the same place exactly, don't update
      if (newCheckin === currentCheckin && targetRoom._id === getBookingRoomId(booking)) return;

      setPendingUpdate({ booking, updates: { roomId: targetRoom._id, checkin: newCheckin, checkout: newCheckout } });
    }
  };

  const handleQuickExtend = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    const newCheckout = format(addDays(new Date(booking.checkout), 1), 'yyyy-MM-dd');
    setPendingUpdate({ booking, updates: { roomId: getBookingRoomId(booking), checkin: booking.checkin, checkout: newCheckout } });
  };

  const handleQuickReduce = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    const newCheckout = format(addDays(new Date(booking.checkout), -1), 'yyyy-MM-dd');
    if (newCheckout <= booking.checkin) return;
    setPendingUpdate({ booking, updates: { roomId: getBookingRoomId(booking), checkin: booking.checkin, checkout: newCheckout } });
  };

  const confirmUpdate = async () => {
    if (!pendingUpdate) return;
    setIsUpdating(true);
    try {
      await updateBooking(pendingUpdate.booking._id, pendingUpdate.updates);
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setIsUpdating(false);
      setPendingUpdate(null);
    }
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

  const periodLabel = `${format(weekStart, 'MMM dd')} – ${format(addDays(weekStart, DAYS - 1), 'MMM dd, yyyy')}`;

  return (
    <>
      <div className="flex flex-col bg-background border rounded-2xl overflow-hidden shadow-sm h-full"
        style={{ minHeight: 480 }}>

        {/* ── Header ── */}
        <div className="flex flex-col gap-2.5 p-4 border-b bg-white shadow-sm z-50">
          {/* Row 1: nav */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-slate-200 bg-white shadow-sm font-bold text-xs"
                onClick={() => setWeekStart(addDays(weekStart, -DAYS))}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Earlier
              </Button>
              <div className="flex flex-col items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex flex-col items-center hover:bg-slate-100/50 p-1 px-4 rounded-xl transition-colors">
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
                Later <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <Button variant="ghost" size="sm" className="h-7 px-4 rounded-full text-[9px] font-black uppercase tracking-[0.2em] text-primary hover:bg-primary/5 bg-primary/5"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Go to Today
            </Button>
          </div>

          {/* Row 2: status filter chips + counts */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map((f: any) => {
              const key = f.key;
              const color = f.color;
              const label = f.label;
              const count = key === 'all'
                ? bookings.filter(b => b.status !== 'cancelled').length
                : counts[key as keyof typeof counts] ?? 0;
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
            <div className="flex sticky top-0 z-40 bg-white border-b shadow-xs">
              <div 
                className="sticky left-0 z-50 bg-white border-r flex items-center justify-center shadow-[1px_0_3px_rgba(0,0,0,0.02)]"
                style={{ width: ROOM_COL, height: 40, minWidth: ROOM_COL }}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Inventory</span>
              </div>
              {timeline.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={day.toISOString()}
                    className={cn(
                      "flex flex-col items-center justify-center border-r shrink-0 transition-colors",
                      isToday ? "bg-primary/[0.03]" : "bg-white"
                    )}
                    style={{ width: COLUMN_WIDTH, height: 40, minWidth: COLUMN_WIDTH }}>
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest opacity-40",
                      isToday && "text-primary opacity-100"
                    )}>
                      {format(day, 'EEE')}
                    </span>
                    <span className={cn(
                      "text-[11px] font-black mt-0.5",
                      isToday ? "text-primary" : "text-slate-900"
                    )}>
                      {format(day, 'dd')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Room rows */}
            <div className="relative">
              {rooms.map((room) => {
                const roomBookings = filteredBookings.filter(b => getBookingRoomId(b) === room._id);
                return (
                  <div key={room._id} className="flex relative group/row" style={{ height: ROW_HEIGHT }}>

                    {/* Room label - High Z to stay above scrollable cards */}
                    <div className="sticky left-0 z-40 bg-white border-r border-b flex flex-col justify-center px-4 md:px-5 shadow-[4px_0_12px_rgba(0,0,0,0.03)] flex-shrink-0 group-hover/row:bg-slate-50 transition-colors whitespace-nowrap overflow-hidden"
                      style={{ width: ROOM_COL, minWidth: ROOM_COL }}>
                      <div className="flex items-center gap-1.5 font-black text-xs md:text-sm text-slate-900 tracking-tight">
                        Room {room.roomNumber}
                        <span className={cn("w-1.5 h-1.5 rounded-full",
                          room.status === 'clean'        ? 'bg-emerald-500' :
                          room.status === 'occupied'     ? 'bg-blue-500'  :
                          room.status === 'dirty'        ? 'bg-yellow-500': 'bg-red-500'
                        )} />
                      </div>
                      <div className="flex flex-col mt-0.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 opacity-80">{room.roomType}</span>
                        <span className="text-[10px] font-bold text-emerald-600 mt-0.5">₹{room.price}</span>
                      </div>
                    </div>

                    {/* Day cells */}
                    {timeline.map((day) => {
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div key={day.toISOString()}
                          className={cn(
                            "border-r border-b cursor-cell hover:bg-slate-100/50 transition-all flex-shrink-0 relative",
                            isToday && "bg-primary/[0.02]"
                          )}
                          style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH }}
                          onClick={() => handleCellClick(room._id, day)}
                        >
                          {isToday && (
                            <div className="absolute inset-y-0 left-0 w-px bg-primary/10 pointer-events-none" />
                          )}
                        </div>
                      );
                    })}

                    {/* Booking bars — absolutely positioned within the row */}
                    {roomBookings.map(booking => {
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
                          whileDrag={{ scale: 1.01, zIndex: 100, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "absolute z-10 rounded-xl p-3 text-white shadow-sm overflow-hidden flex flex-col justify-between transition-all group/booking",
                            getStatusColor(booking.status),
                            isEditable ? "cursor-grab" : "cursor-pointer",
                            "border-l-[4px]"
                          )}
                          style={{
                            left:   ROOM_COL + (clampedOffset * COLUMN_WIDTH) + 4,
                            top:    6,
                            width:  (clampedDuration * COLUMN_WIDTH) - 8,
                            height: ROW_HEIGHT - 12,
                            borderLeftColor: 'rgba(255,255,255,0.4)'
                          }}
                          onClick={(e) => { 
                            if (isDraggingRef.current || isResizingRef.current) return;
                            e.stopPropagation(); 
                            setSelectedBooking(booking); 
                          }}
                        >
                          <div className="flex flex-col gap-0.5 pointer-events-none">
                            <h4 className="text-[10px] md:text-xs font-black truncate leading-none tracking-tight">
                              {guest?.name || 'Guest'}
                            </h4>
                            <div className="flex items-center gap-1.5 opacity-80">
                              <span className="text-[8px] font-black uppercase tracking-widest whitespace-nowrap">
                                {booking.status.replace('-', ' ')}
                              </span>
                              <span className="h-0.5 w-0.5 rounded-full bg-white/40" />
                              <span className="text-[8px] font-bold uppercase tracking-tighter">
                                {differenceInDays(new Date(booking.checkout), new Date(booking.checkin))}N
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-auto pointer-events-none opacity-60">
                             <div className="bg-black/10 px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest">
                               {booking.bookingSource}
                             </div>
                          </div>
                          {/* Resize handle (Right edge) - Robust tracking with PointerCapture */}
                          {isEditable && (
                            <div 
                              className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize hover:bg-white/30 z-50 flex items-center justify-center opacity-0 group-hover/booking:opacity-100 transition-opacity touch-none"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                                setResizingId(booking._id);
                                
                                const startX = e.clientX;
                                const originalCheckout = new Date(booking.checkout);
                                const cardElement = e.currentTarget.parentElement as HTMLElement;
                                const originalWidth = cardElement.offsetWidth;

                                // Boost z-index during resize
                                cardElement.style.zIndex = '100';
                                cardElement.style.transition = 'none'; // Disable transition for pure raw move
                                
                                let hasMovedSignificant = false;

                                const onPointerMove = (moveEvent: PointerEvent) => {
                                  const deltaX = moveEvent.clientX - startX;
                                  
                                  // Threshold of 12px to start resizing (more robust)
                                  if (!hasMovedSignificant && Math.abs(deltaX) > 12) {
                                    hasMovedSignificant = true;
                                    isResizingRef.current = true;
                                  }

                                  if (hasMovedSignificant && cardElement) {
                                    cardElement.style.width = `${Math.max(COLUMN_WIDTH, originalWidth + deltaX)}px`;
                                  }
                                };

                                const onPointerUp = (upEvent: PointerEvent) => {
                                  const deltaX = upEvent.clientX - startX;
                                  const daysDelta = Math.round(deltaX / COLUMN_WIDTH);
                                  
                                  (e.currentTarget as HTMLDivElement).releasePointerCapture(upEvent.pointerId);
                                  window.removeEventListener('pointermove', onPointerMove);
                                  window.removeEventListener('pointerup', onPointerUp);
                                  
                                  setResizingId(null);
                                  // Reset card styles
                                  if (cardElement) {
                                    cardElement.style.width = '';
                                    cardElement.style.zIndex = '';
                                    cardElement.style.transition = '';
                                  }

                                  if (!hasMovedSignificant) {
                                    setTimeout(() => { isResizingRef.current = false; }, 50);
                                    return;
                                  }

                                  if (daysDelta !== 0) {
                                    const newCheckout = format(addDays(originalCheckout, daysDelta), 'yyyy-MM-dd');
                                    if (new Date(newCheckout) > new Date(booking.checkin)) {
                                      setPendingUpdate({ 
                                        booking, 
                                        updates: { 
                                          roomId: getBookingRoomId(booking), 
                                          checkin: booking.checkin, 
                                          checkout: newCheckout 
                                        } 
                                      });
                                    }
                                  }
                                  
                                  setTimeout(() => { isResizingRef.current = false; }, 100);
                                };

                                window.addEventListener('pointermove', onPointerMove);
                                window.addEventListener('pointerup', onPointerUp);
                              }}
                            >
                              <div className="h-6 w-1.5 bg-white/50 rounded-full shadow-sm" />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
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
      
      <Dialog open={!!pendingUpdate} onOpenChange={(open) => !open && !isUpdating && setPendingUpdate(null)}>
        <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black text-xl tracking-tight">Confirm Modification</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm font-medium text-slate-500 space-y-4">
            <p>Please confirm you want to proceed with structural date and room assignments updates for this itinerary.</p>
            {pendingUpdate && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 opacity-5">
                  <Bed className="h-12 w-12" />
                </div>
                
                <div className="flex justify-between items-start text-slate-400">
                  <span className="font-black uppercase tracking-widest text-[9px] mt-1">Current State</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-600">
                      {format(new Date(pendingUpdate.booking.checkin), 'MMM dd')} — {format(new Date(pendingUpdate.booking.checkout), 'MMM dd')}
                    </span>
                    <div className="text-[10px] font-black uppercase text-slate-400 mt-0.5 tracking-tight">
                      Room {rooms.find(r => r._id === getBookingRoomId(pendingUpdate.booking))?.roomNumber || 'Unknown'}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-200/50 w-full" />

                <div className="flex justify-between items-start text-primary">
                  <span className="font-black uppercase tracking-widest text-[9px] mt-1">Proposed Update</span>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-sm font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg w-fit shadow-xs">
                      {format(new Date(pendingUpdate.updates.checkin), 'MMM dd')} — {format(new Date(pendingUpdate.updates.checkout), 'MMM dd')}
                    </span>
                    {pendingUpdate.updates.roomId && pendingUpdate.updates.roomId !== getBookingRoomId(pendingUpdate.booking) ? (
                      <div className="text-[10px] font-black uppercase mt-2 inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 px-2 py-1 rounded-lg tracking-tight w-fit shadow-xs border border-amber-200">
                        <Plus className="h-3 w-3" /> Relocate to Room {rooms.find(r => r._id === pendingUpdate.updates.roomId)?.roomNumber || 'Unknown'}
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5 mt-2">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-tight">
                          Same Room Assignment
                        </div>
                        {pendingUpdate && (() => {
                          const oldDays = differenceInDays(new Date(pendingUpdate.booking.checkout), new Date(pendingUpdate.booking.checkin));
                          const newDays = differenceInDays(new Date(pendingUpdate.updates.checkout), new Date(pendingUpdate.updates.checkin));
                          const diff = newDays - oldDays;
                          if (diff > 0) return <Badge key="ext" className="bg-emerald-500 hover:bg-emerald-500 text-[9px] font-black uppercase h-5">+{diff} Day{diff > 1 ? 's' : ''} Extended</Badge>;
                          if (diff < 0) return <Badge key="red" variant="destructive" className="text-[9px] font-black uppercase h-5">{diff} Day{Math.abs(diff) > 1 ? 's' : ''} Reduced</Badge>;
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setPendingUpdate(null)} disabled={isUpdating}>Cancel</Button>
            <Button className="rounded-xl font-bold px-8 shadow-lg shadow-primary/20" onClick={confirmUpdate} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isUpdating ? 'Updating...' : 'Save Dates'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
