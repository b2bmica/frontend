import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, 
  differenceInDays, startOfDay
} from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Loader2, Bed, X } from 'lucide-react';
import { useBookings, type Booking } from '../context/booking-context';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { BookingModal } from '@/components/booking-modal';
import { BookingDetailSheet } from '@/components/booking-detail-sheet';
import { GuestProfileSheet } from '@/components/guest-profile-sheet';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'reserved', label: 'Reserved', color: 'bg-emerald-500' },
  { key: 'checked-in', label: 'Checked-in', color: 'bg-blue-500' },
  { key: 'checked-out', label: 'Checked-out', color: 'bg-orange-500' },
] as const;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'checked-in':  return 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20';
    case 'reserved':    return 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20';
    case 'checked-out': return 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20';
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
  const { bookings, rooms, loading } = useBookings();

  // Week-based navigation
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [daysCount, setDaysCount] = useState(14);
  useEffect(() => {
    const check = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      if (width < 768) setDaysCount(7);
      else if (width < 1200) setDaysCount(10);
      else setDaysCount(14);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const DAYS = daysCount;
  const COLUMN_WIDTH = isMobile ? 52 : 100;
  const ROW_HEIGHT  = isMobile ? 56 : 68;
  const ROOM_COL    = isMobile ? 84 : 152;

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
      <div className="flex flex-col bg-background border rounded-2xl overflow-hidden shadow-xl"
        style={{ height: isMobile ? 'auto' : 'calc(100vh - 280px)', minHeight: 480 }}>

        {/* ── Header ── */}
        <div className="flex flex-col gap-2.5 p-4 border-b bg-card/40 backdrop-blur-md">
          {/* Row 1: nav */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl border-slate-200"
                onClick={() => setWeekStart(addDays(weekStart, -DAYS))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs sm:text-[11px] font-black uppercase tracking-widest min-w-[200px] text-center text-slate-500">{periodLabel}</span>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl border-slate-200"
                onClick={() => setWeekStart(addDays(weekStart, DAYS))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest text-primary ml-2"
                onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                Current View
              </Button>
            </div>
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
        </div>

        {/* ── Board ── */}
        <div className="flex-1 overflow-auto">
          <div className="inline-block min-w-full">

            {/* Column headers */}
            <div className="flex sticky top-0 z-20 bg-card border-b">
              <div className="sticky left-0 z-30 bg-card border-r shadow-sm flex items-center px-2 md:px-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider"
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
              {rooms.map((room) => {
                const roomBookings = filteredBookings.filter(b => getBookingRoomId(b) === room._id);
                return (
                  <div key={room._id} className="flex border-b group relative" style={{ height: ROW_HEIGHT }}>

                    {/* Room label */}
                    <div className="sticky left-0 z-10 bg-card border-r flex flex-col justify-center px-2 md:px-3 shadow-sm flex-shrink-0"
                      style={{ width: ROOM_COL, minWidth: ROOM_COL }}>
                      <div className="font-bold text-xs md:text-sm flex items-center gap-1">
                        {room.roomNumber}
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",
                          room.status === 'clean'        ? 'bg-green-500' :
                          room.status === 'occupied'     ? 'bg-blue-500'  :
                          room.status === 'dirty'        ? 'bg-yellow-500': 'bg-red-500'
                        )} />
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

                      return (
                        <motion.div
                          key={booking._id}
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={cn(
                            "absolute z-10 rounded-md p-1.5 text-white shadow-md cursor-pointer overflow-hidden flex flex-col justify-between",
                            getStatusColor(booking.status)
                          )}
                          style={{
                            left:   ROOM_COL + (clampedOffset * COLUMN_WIDTH) + 3,
                            top:    5,
                            width:  (clampedDuration * COLUMN_WIDTH) - 6,
                            height: ROW_HEIGHT - 10,
                          }}
                          onClick={(e) => { e.stopPropagation(); setSelectedBooking(booking); }}
                        >
                          <button
                            className="text-[10px] md:text-xs font-bold truncate text-left hover:underline leading-tight"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (guest?._id) setSelectedGuestId(guest._id);
                              else setSelectedBooking(booking);
                            }}
                          >
                            {guest?.name || 'Guest'}
                          </button>
                          <span className="text-[8px] md:text-[10px] bg-black/20 px-1 rounded truncate capitalize w-fit">
                            {booking.status.replace('-', ' ')}
                          </span>
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

      <BookingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        selectedRoomId={selectedRoomId} selectedDate={selectedDate} />
      <BookingDetailSheet booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      <GuestProfileSheet guestId={selectedGuestId} onClose={() => setSelectedGuestId(null)} />
    </>
  );
}
