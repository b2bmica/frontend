import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  format, addDays, eachDayOfInterval, isSameDay,
  differenceInDays, startOfDay, parseISO, addHours
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2, Search, ChevronLeft, ChevronRight, ChevronDown, Bed, X, ShieldCheck, ArrowRight, Lock, Globe, User, Info, Users, Timer, Clock, CalendarDays } from 'lucide-react';
import { useBookings, type Booking, type Room } from '../context/booking-context';
import { useAuth } from '../context/auth-context';
import { cn, isExpiredBooking } from '../lib/utils';
import { Button } from './ui/button';
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
  { key: 'enquiry', label: 'Enquiry', color: 'bg-amber-400' },
  { key: 'expired-hold', label: 'Expired Hold', color: 'bg-red-400' },
  { key: 'block', label: 'Room Block', color: 'bg-slate-400 opacity-60' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-slate-300' },
] as const;

const getStatusColor = (status: string, bookingType?: string, reservationType?: string, isExpired?: boolean) => {
  if (isExpired) return 'bg-slate-100 ring-1 ring-slate-200 text-slate-500 shadow-sm border-0 hover:bg-slate-200 transition-colors pointer-events-auto';
  
  const type = reservationType || bookingType;
  if (type === 'enquiry') return 'bg-white border-2 border-dashed border-amber-400 text-slate-800 shadow-sm shadow-amber-500/10 pointer-events-auto ring-1 ring-amber-100 hover:bg-amber-50';
  if (type === 'block')   return 'bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#f1f5f9_10px,#f1f5f9_20px)] border border-slate-300 text-slate-700 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] pointer-events-auto';
  
  const base = 'shadow-md border pointer-events-auto transition-colors duration-200';
  switch (status) {
    case 'checked-in':  return cn(base, 'bg-blue-600 text-white border-blue-700 shadow-blue-500/20 hover:bg-blue-700');
    case 'reserved':    return cn(base, 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20 hover:bg-emerald-700');
    case 'checked-out': return cn(base, 'bg-orange-500 text-white border-orange-600 shadow-orange-500/20 hover:bg-orange-600');
    case 'cancelled':   return cn(base, 'bg-slate-100 text-slate-400 border-slate-200 opacity-60');
    default:            return cn(base, 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50');
  }
};

// Format a remaining-time countdown string from an ISO expiry timestamp
const formatCountdown = (expiresAt: string): string => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const getBookingRoomId = (b: Booking): string => {
  if (!b.roomId) return '';
  return typeof b.roomId === 'object' ? b.roomId._id : b.roomId as string;
};

const getGuest = (b: Booking) =>
  typeof b.guestId === 'object' ? b.guestId : null;

export function BookingBoard() {
  const { bookings, rooms, loading, updateBooking, refreshBookings } = useBookings();
  const { hotel } = useAuth();
  const taxConfig = hotel?.settings?.taxConfig;
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
  const [viewMode] = useState<'today' | 'week' | 'month'>('week');
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [navDirection, setNavDirection] = useState<number>(0); // -1 for prev, 1 for next
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
  const [isLandscape, setIsLandscape] = useState(() => typeof window !== 'undefined' && window.innerHeight < 500 && window.innerWidth > window.innerHeight);
  const [boardWidth, setBoardWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth - (window.innerWidth < 768 ? 20 : 300) : 1000);

  // Use a callback ref + ResizeObserver so we always get the correct width,
  // even if the sidebar animation hasn't finished yet on first load.
  const boardObserverRef = useRef<ResizeObserver | null>(null);
  
  // Use useLayoutEffect to measure before paint if possible, avoiding the 'small' jump
  useEffect(() => {
    // Initial measure
    if (boardRef.current) {
      setBoardWidth(boardRef.current.clientWidth);
    }
    // Periodic check to ensure layout is settled (sidebar animations etc)
    const timers = [
      setTimeout(() => window.dispatchEvent(new Event('resize')), 50),
      setTimeout(() => window.dispatchEvent(new Event('resize')), 150),
      setTimeout(() => window.dispatchEvent(new Event('resize')), 400),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const setBoardRef = useCallback((node: HTMLDivElement | null) => {
    // Cleanup old observer
    if (boardObserverRef.current) {
      boardObserverRef.current.disconnect();
      boardObserverRef.current = null;
    }
    // Store the ref for other code that reads boardRef.current
    boardRef.current = node;
    if (node) {
      // Measure immediately
      setBoardWidth(node.clientWidth);
      // Observe for future resizes (sidebar toggle, window resize, etc.)
      boardObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
          setBoardWidth(w);
        }
      });
      boardObserverRef.current.observe(node);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsLandscape(window.innerHeight < 500 && window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      boardObserverRef.current?.disconnect();
    };
  }, []);

  // Update countdowns / check for expired enquiries every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      if (isResizingRef.current || isDraggingRef.current) return;
      setTick(t => t + 1);
      // We don't necessarily need to call refreshBookings() every second unless
      // the backend actually changes the status. But for UI countdowns, a re-render is enough.
      // 60s check for actual expiry refresh
      if (Date.now() % 60000 < 1000) {
        const hasExpired = bookings.some(b => 
          (b.bookingType === 'enquiry' || b.bookingType === 'block') && 
          b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date()
        );
        if (hasExpired) refreshBookings();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [bookings, refreshBookings]);

  const DAYS = 7;
  const ROOM_COL = isMobile ? 80 : 157;
  
   const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
    const [hoveredBookingId, setHoveredBookingId] = useState<string | null>(null);
    const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

   const [dragTarget, setDragTarget] = useState<{ roomId: string, date: Date } | null>(null);

  // Column width calculations based on weekly view
  const COLUMN_WIDTH = useMemo(() => {
    return isMobile 
      ? Math.max(76, Math.floor((boardWidth - ROOM_COL) / 7)) 
      : Math.max(100, Math.min(350, Math.floor((boardWidth - ROOM_COL) / 7)));
  }, [boardWidth, isMobile, ROOM_COL]);

  const ROW_HEIGHT = viewMode === 'month' ? 48 : (isMobile ? 64 : 82);

  const timeline = useMemo(() => {
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, DAYS - 1) });
  }, [weekStart, DAYS]);

  const activeRooms = useMemo(() => 
    rooms.filter(r => statusFilter === 'maintenance' ? (r.status === 'maintenance' || r.status === 'under-maintenance') : true),
  [rooms, statusFilter]);

  // All bookings matching search/status filters globally (ignoring date window)
  const globalMatches = useMemo(() => {
    return bookings.filter(b => {
      const type = b.reservationType || b.bookingType || 'booking';
      const isExpired = type === 'enquiry' && b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date();
      const isCancelled = b.status === 'cancelled';

      // Always include these as they become notifications/alerts on the grid
      if (isCancelled || isExpired) {
        // Still apply search if present
        const guestName = getGuest(b)?.name || '';
        const room = rooms.find(r => r._id === getBookingRoomId(b));
        const roomNum = room?.roomNumber || '';
        const bId = b._id || '';
        if (search && !guestName.toLowerCase().includes(search.toLowerCase()) && !roomNum.toLowerCase().includes(search.toLowerCase()) && !bId.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'enquiry') {
          if (type !== 'enquiry') return false;
          // Filter out expired when looking at active enquiries
          if (b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date()) return false;
        } else if (statusFilter === 'expired-hold') {
          if (type !== 'enquiry') return false;
          // Only show expired
          if (!b.enquiryExpiresAt || new Date(b.enquiryExpiresAt) >= new Date()) return false;
        } else if (statusFilter === 'block') {
          if (type !== 'block') return false;
        } else {
          // Standard status filters (reserved, checked-in, checked-out, etc.)
          // Include both regular bookings AND group bookings
          if ((type !== 'booking' && type !== 'group') || b.status !== statusFilter) return false;
        }
      }

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
    const bufferStart = addDays(weekStart, -2);
    const bufferEnd = addDays(periodEnd, 2);
    return globalMatches.filter(b => {
      const ci = startOfDay(new Date(b.checkin));
      const co = startOfDay(new Date(b.checkout));
      return ci < bufferEnd && co > bufferStart;
    });
  }, [globalMatches, weekStart, DAYS]);

  const isTodayView = false;

  // Real-time occupancy check helper
  const getRoomOccupancy = useCallback((roomId: string) => {
    const now = new Date();
    return bookings.some(b => {
      if (b.status !== 'checked-in') return false;
      const bRoomId = typeof b.roomId === 'object' ? b.roomId._id : b.roomId;
      if (bRoomId !== roomId) return false;
      
      const checkin = parseISO(toISO(format(parseISO(b.checkin), 'yyyy-MM-dd'), b.checkinTime || '14:00'));
      const checkout = parseISO(toISO(format(parseISO(b.checkout), 'yyyy-MM-dd'), b.checkoutTime || '11:00'));
      return now >= checkin && now <= checkout;
    });
  }, [bookings]);

  // Red vertical line for current time in Today view
  const [currentTimePos, setCurrentTimePos] = useState(0);
  useEffect(() => {
    if (viewMode !== 'today') return;
    const update = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      setCurrentTimePos((h + m / 60) * COLUMN_WIDTH);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [viewMode, COLUMN_WIDTH]);

  const toISO = (date: string, time: string) => `${date}T${time}:00`;

  // Status counts
  const counts = useMemo(() => {
    const bookingCounts = {
      reserved:    bookings.filter(b => b.status === 'reserved').length,
      'checked-in':  bookings.filter(b => b.status === 'checked-in').length,
      'checked-out': bookings.filter(b => b.status === 'checked-out').length,
      'cancelled':   bookings.filter(b => b.status === 'cancelled').length,
      'enquiry':     bookings.filter(b => (b.reservationType || b.bookingType) === 'enquiry' && (!b.enquiryExpiresAt || new Date(b.enquiryExpiresAt) >= new Date())).length,
      'expired-hold': bookings.filter(b => (b.reservationType || b.bookingType) === 'enquiry' && b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date()).length,
      'block':       bookings.filter(b => (b.reservationType || b.bookingType) === 'block').length,
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
      // Expired enquiries are removed from the card layer — cell click should open new booking
      const isExpiredEnquiry = isExpiredBooking(b);
      if (isExpiredEnquiry) return false;
      if (getBookingRoomId(b) !== roomId) return false;
      const start = startOfDay(parseISO(b.checkin));
      const end = startOfDay(parseISO(b.checkout));
      return day >= start && day < end;
    });

    if (bookingAtCell) {
       setSelectedBooking(bookingAtCell);
       return;
    }

    // Don't allow creating new bookings in the past unless an expired hold was there
    const hasExpiredHoldHere = bookings.some(b => {
      const isExp = (b.reservationType || b.bookingType) === 'enquiry'
        && !!b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date();
      if (!isExp || getBookingRoomId(b) !== roomId) return false;
      const s = startOfDay(parseISO(b.checkin));
      const e = startOfDay(parseISO(b.checkout));
      return day >= s && day < e;
    });
    if (day < startOfDay(new Date()) && !hasExpiredHoldHere) return;

    setSelectedRoomId(roomId);
    // If date is in the past (expired hold cell), open modal with today's date instead
    setSelectedDate(day < startOfDay(new Date()) ? format(new Date(), 'yyyy-MM-dd') : format(day, 'yyyy-MM-dd'));
    setIsModalOpen(true);
  };

  interface DragInfo {
    point: { x: number; y: number };
  }

  const handleDragEnd = async (event: React.PointerEvent | PointerEvent, info: DragInfo, booking: Booking) => {
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
    
    const numCols = viewMode === 'today' ? 24 : DAYS;
    const dayAtMouse = (x - HOZ_OFFSET) / COLUMN_WIDTH;
    const dayIndexFinal = Math.round(dayAtMouse - dragGrabOffsetDaysRef.current);
    
    // getBoundingClientRect().top on boardContentRef already accounts for scroll,
    // so y is the correct absolute position within the content. Subtract header (48px).
    const roomIndexRaw = Math.floor((y - 48) / ROW_HEIGHT);
    const roomIndexFinal = Math.max(0, Math.min(activeRooms.length - 1, roomIndexRaw));

    // Strictly restrict to visible range per user request
    const isValidDay = dayIndexFinal >= 0 && dayIndexFinal < numCols;
    const isValidRoom = true;

    if (isValidDay && isValidRoom) {
      const targetDay = addDays(startOfDay(weekStart), dayIndexFinal);
      const targetRoom = activeRooms[roomIndexFinal];
      const duration = differenceInDays(startOfDay(parseISO(booking.checkout)), startOfDay(parseISO(booking.checkin)));
      const newCheckin = format(targetDay, 'yyyy-MM-dd');
      const newCheckout = format(addDays(targetDay, duration), 'yyyy-MM-dd');
      const currentCheckin = format(new Date(booking.checkin), 'yyyy-MM-dd');
      
      const newCheckinDate = parseISO(newCheckin);
      const newCheckoutDate = parseISO(newCheckout);
      
      const isClashing = bookings.some(b => {
        if (String(b._id) === String(booking._id) || b.status === 'cancelled' || b.status === 'checked-out') return false;
        
        // Ignore expired enquiries when checking for clashes
        const isExpEnquiry = (b.reservationType || b.bookingType) === 'enquiry' && b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date();
        if (isExpEnquiry) return false;

        if (getBookingRoomId(b) !== targetRoom._id) return false;
        // Time-aware: same-day checkout(11:00) then checkin(14:00) is NOT a clash
        const toDateTime = (dateStr: string, timeStr?: string, dt = '14:00') => {
          const [h, m] = (timeStr || dt).split(':').map(Number);
          const d = parseISO(dateStr); d.setHours(h, m, 0, 0); return d;
        };
        const bStart = toDateTime(b.checkin, b.checkinTime, '14:00');
        const bEnd = toDateTime(b.checkout, b.checkoutTime, '11:00');
        const newCI = toDateTime(newCheckin, booking.checkinTime, '14:00');
        const newCO2 = toDateTime(newCheckout, booking.checkoutTime, '11:00');
        return newCI < bEnd && newCO2 > bStart;
      });

      if (isClashing) return;
      if (newCheckin === currentCheckin && targetRoom._id === getBookingRoomId(booking)) return;

      const oldRoom = rooms.find(r => r._id === getBookingRoomId(booking));
      const dayDiff = Math.round(differenceInDays(newCheckinDate, startOfDay(parseISO(booking.checkin))));
      const nightText = dayDiff === 0 ? "" : (dayDiff > 0 ? ` +${dayDiff} night${dayDiff > 1 ? 's' : ''}` : ` -${Math.abs(dayDiff)} night${Math.abs(dayDiff) > 1 ? 's' : ''}`);
      const changeText = targetRoom._id !== getBookingRoomId(booking) ? `Push to ${targetRoom.roomNumber}${nightText}` : (nightText ? `Shift ${nightText.trim()}` : "Save changes");

      /* Auto-snap disabled per user request to keep view on the same page */
      /*
      if (dayIndexFinal < 0 || dayIndexFinal >= DAYS) {
        setWeekStart(startOfDay(targetDay));
      }
      */
      
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

  const handleCardDragStart = (e: React.PointerEvent<HTMLDivElement>, booking: Booking) => {
    // We allow selection (clicking) for all cards, but only dragging/resizing for editable ones
    const isEnquiry = (booking.reservationType || booking.bookingType) === 'enquiry';
    const isEditable = (booking.status !== 'checked-out' && booking.status !== 'cancelled') || isEnquiry || (booking.bookingType === 'block');

    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) return;

    // Even if not editable, we want to allow clicking to view details
    if (!isEditable) {
      const sX = e.clientX;
      const sY = e.clientY;
      const startT = Date.now();
      
      const onUp = (ue: PointerEvent) => {
        window.removeEventListener('pointerup', onUp);
        const dist = Math.hypot(ue.clientX - sX, ue.clientY - sY);
        const duration = Date.now() - startT;
        if (dist < 10 && duration < 300) {
          setSelectedBooking(booking);
        }
      };
      window.addEventListener('pointerup', onUp);
      return;
    }

    if (isResizingRef.current || isDraggingRef.current) return;

    const cardEl = e.currentTarget as HTMLDivElement;
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const LONG_MS = isTouch ? 350 : 120;

    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    
    let dragging = false;
    let longPressReady = false;
    let cancelled = false;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let frameId: number | null = null;

    if (boardContentRef.current) {
        const rect = boardContentRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const currentCoord = (x - ROOM_COL) / COLUMN_WIDTH;
        if (viewMode === 'today') {
           const startDT = parseISO(`${booking.checkin}T${booking.checkinTime || '14:00'}:00`);
           const todayStart = startOfDay(weekStart);
           const bookingHour = (startDT.getTime() - todayStart.getTime()) / 3600000;
           dragGrabOffsetDaysRef.current = currentCoord - bookingHour;
        } else {
           const bookingDay = differenceInDays(startOfDay(parseISO(booking.checkin)), startOfDay(weekStart));
           dragGrabOffsetDaysRef.current = currentCoord - bookingDay;
        }
    }

    const initialScrollL = boardRef.current?.scrollLeft || 0;
    const initialScrollT = boardRef.current?.scrollTop || 0;

    if (!isTouch) {
      try { cardEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }

    const activateDrag = () => {
       if (cancelled) return;
       longPressReady = true;
       isDraggingRef.current = true;
       setDraggingId(booking._id);
       try { cardEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
       try { (navigator as any).vibrate?.([10, 30, 10]); } catch { /* ignore */ }
       
       cardEl.style.opacity = '0.7';
       cardEl.style.zIndex = '1000';
       cardEl.style.transition = 'transform 0.1s ease-out, box-shadow 0.2s ease, opacity 0.2s ease';
       cardEl.style.transform = 'scale(1.02) translateY(-4px)';
       cardEl.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.4)';
       cardEl.style.outline = '2px solid white';
       cardEl.style.touchAction = 'none'; // Prevent browser scroll taking over
    };

    longPressTimer = setTimeout(activateDrag, LONG_MS);

    const updateUI = (meX: number, meY: number) => {
      if (!boardContentRef.current) return;
      
      const rect = boardContentRef.current.getBoundingClientRect();
      const numCols = viewMode === 'today' ? 24 : DAYS;
      const gridW = numCols * COLUMN_WIDTH;
      const gridH = activeRooms.length * ROW_HEIGHT;
      
      const contentX = meX - rect.left;
      const contentY = meY - rect.top;

      const clampedContentX = Math.max(ROOM_COL, Math.min(ROOM_COL + gridW, contentX));
      const clampedContentY = Math.max(48, Math.min(48 + gridH, contentY));

      const dx = clampedContentX - (startX - rect.left + (initialScrollL - (boardRef.current?.scrollLeft || 0)));
      const dy = clampedContentY - (startY - rect.top + (initialScrollT - (boardRef.current?.scrollTop || 0)));

      const dayIdxRaw = (clampedContentX - ROOM_COL) / COLUMN_WIDTH - dragGrabOffsetDaysRef.current;
      const dayIdx    = Math.round(Math.max(0, Math.min(numCols - 1, dayIdxRaw)));
      const roomIdx   = Math.max(0, Math.min(activeRooms.length - 1, Math.floor((clampedContentY - 48) / ROW_HEIGHT)));
      
      const targetRoom = activeRooms[roomIdx];
      const targetDate = addDays(startOfDay(weekStart), dayIdx);
      
      if (!dragTarget || dragTarget.roomId !== targetRoom._id || !isSameDay(dragTarget.date, targetDate)) {
         setDragTarget({ roomId: targetRoom._id, date: targetDate });
      }

      cardEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.02)`;
    };

    const onMove = (me: PointerEvent) => {
       const dist = Math.hypot(me.clientX - startX, me.clientY - startY);
       
       if (!longPressReady && dist > (isTouch ? 30 : 10)) {
         cancelled = true;
         if (longPressTimer) clearTimeout(longPressTimer);
       }

       if (longPressReady || dragging) {
          if (!dragging) {
            dragging = true;
            isDraggingRef.current = true;
          }
          
          if (frameId) cancelAnimationFrame(frameId);
          frameId = requestAnimationFrame(() => updateUI(me.clientX, me.clientY));

          // Smooth Proportional Auto-scroll
          if (boardRef.current) {
            const rect = boardRef.current.getBoundingClientRect();
            const edgeH = isMobile ? 40 : 60;
            const edgeV = 45;
            let sX = 0, sY = 0;
            
            if (me.clientX < rect.left + edgeH + (isMobile ? 0 : ROOM_COL)) {
               const dist = (rect.left + edgeH + (isMobile ? 0 : ROOM_COL)) - me.clientX;
               sX = -Math.min(10, dist / 4);
            } else if (me.clientX > rect.right - edgeH) {
               const dist = me.clientX - (rect.right - edgeH);
               sX = Math.min(10, dist / 4);
            }
            
            if (me.clientY < rect.top + edgeV + 48) {
               const dist = (rect.top + edgeV + 48) - me.clientY;
               sY = -Math.min(10, dist / 4);
            } else if (me.clientY > rect.bottom - edgeV) {
               const dist = me.clientY - (rect.bottom - edgeV);
               sY = Math.min(10, dist / 4);
            }
            
            if (sX !== 0 || sY !== 0) {
              const b = boardRef.current;
              if (sX < 0 && b.scrollLeft > 0) b.scrollLeft += sX;
              else if (sX > 0 && b.scrollLeft < b.scrollWidth - b.clientWidth) b.scrollLeft += sX;
              
              if (sY < 0 && b.scrollTop > 0) b.scrollTop += sY;
              else if (sY > 0 && b.scrollTop < b.scrollHeight - b.clientHeight) b.scrollTop += sY;

              if (frameId) cancelAnimationFrame(frameId);
              frameId = requestAnimationFrame(() => updateUI(me.clientX, me.clientY));
            }
          }
        }
    };

    const onUp = (ue: PointerEvent) => {
       const dist = Math.hypot(ue.clientX - startX, ue.clientY - startY);
       
       if (dragging && dist > 10) {
         handleDragEnd(ue, { point: { x: ue.clientX, y: ue.clientY } }, booking);
       } else if (!cancelled) {
         setSelectedBooking(booking);
       }
       cleanup();
    };

    const cleanup = () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (longPressTimer) clearTimeout(longPressTimer);
      try { cardEl.releasePointerCapture(e.pointerId); } catch { }
      
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cleanup);
      
      setDragTarget(null);
      setDraggingId(null);
      cardEl.style.transform = '';
      cardEl.style.opacity = '';
      cardEl.style.zIndex = '';
      cardEl.style.transition = '';
      cardEl.style.boxShadow = '';
      cardEl.style.outline = '';
      cardEl.style.touchAction = '';
      
      setTimeout(() => { isDraggingRef.current = false; }, 50);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cleanup);
  };

  // ── Pointer-based resize ───────────────────────────────────────
  const handleResizeDragStart = (e: React.PointerEvent<HTMLDivElement>, booking: Booking, room: Room) => {
    e.stopPropagation();
    const isEditable = booking.status !== 'checked-out' && booking.status !== 'cancelled' || (booking.bookingType === 'block');
    if (!isEditable) return;
    const handleEl = e.currentTarget as HTMLDivElement;
    const cardEl   = handleEl.closest('[data-booking-card]') as HTMLDivElement;
    if (!cardEl) return;
    
    // For touch devices, ensure capture works reliably
    if (e.pointerType === 'touch') {
      setTimeout(() => {
        try { handleEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }, 0);
    } else {
      try { handleEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }

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
        cardEl.style.touchAction = 'none'; // Prevent browser intercept
      }
      if (moved) {
        const snapped = Math.round(dx / COLUMN_WIDTH) * COLUMN_WIDTH;
        cardEl.style.width = `${Math.max(COLUMN_WIDTH, originalWidth + snapped)}px`;

        if (boardRef.current) {
          const rect = boardRef.current.getBoundingClientRect();
          const edgeSize = isMobile ? 60 : 45;
          let scrollDX = 0;
          if (me.clientX < rect.left + edgeSize) scrollDX = -((rect.left + edgeSize) - me.clientX) * 0.8;
          else if (me.clientX > rect.right - edgeSize) scrollDX = (me.clientX - (rect.right - edgeSize)) * 0.8;
          if (scrollDX !== 0) boardRef.current.scrollLeft += scrollDX;
        }
      }
    };

    const onUp = (ue: PointerEvent) => {
      const dx = ue.clientX - startX;
      const daysDelta = Math.round(dx / COLUMN_WIDTH);
      if (moved && daysDelta !== 0) {
        const origIn = startOfDay(parseISO(booking.checkin));
        const newCO = format(addDays(origIn, differenceInDays(startOfDay(parseISO(booking.checkout)), startOfDay(origIn)) + daysDelta), 'yyyy-MM-dd');
        if (newCO > booking.checkin) {
          const toResizeDT = (dateStr: string, timeStr?: string, dt = '14:00') => {
            const [h, m] = (timeStr || dt).split(':').map(Number);
            const d = parseISO(dateStr); d.setHours(h, m, 0, 0); return d;
          };
          const resizeCI = toResizeDT(booking.checkin, booking.checkinTime, '14:00');
          const resizeCO = toResizeDT(newCO, booking.checkoutTime, '11:00');
          const rRoomId = getBookingRoomId(booking);
          const resizeClash = bookings.some(b => {
            if (String(b._id) === String(booking._id) || b.status === 'cancelled' || b.status === 'checked-out') return false;
            const isExp = (b.reservationType || b.bookingType) === 'enquiry' && b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date();
            if (isExp || getBookingRoomId(b) !== rRoomId) return false;
            const bStart2 = toResizeDT(b.checkin, b.checkinTime, '14:00');
            const bEnd2 = toResizeDT(b.checkout, b.checkoutTime, '11:00');
            return resizeCI < bEnd2 && resizeCO > bStart2;
          });
          if (!resizeClash) {
            setPendingUpdate({
              booking,
              updates: { roomId: rRoomId, checkin: booking.checkin, checkout: newCO },
              type: 'resize',
              details: {
                oldRoom: room.roomNumber, newRoom: room.roomNumber,
                oldCheckin: booking.checkin, newCheckin: booking.checkin,
                oldCheckout: booking.checkout, newCheckout: newCO,
                changeText: daysDelta > 0 ? "Extend" : "Shorten",
                nightsDelta: daysDelta,
                oldPrice: booking.roomPrice || 0, newPrice: booking.roomPrice || 0
              }
            });
          }
        }
      }
      cleanup();
    };

    const cleanup = () => {
      try { handleEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
      window.removeEventListener('pointercancel', cleanup);
      if (moved) {
        cardEl.style.width = `${originalWidth}px`;
        cardEl.style.zIndex     = '';
        cardEl.style.transition = '';
        cardEl.style.touchAction = '';
      }
      setResizingId(null);
      setTimeout(() => { isResizingRef.current = false; }, 100);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    window.addEventListener('pointercancel', cleanup);
  };


  return (
    <>
      <div 
        className="flex flex-col bg-slate-50/40 p-1.5 md:p-4 lg:p-6 h-full w-full max-w-full overflow-hidden"
        style={{ minHeight: isMobile ? 400 : 500 }}
      >
        <div className="flex flex-col flex-1 bg-white border border-slate-200/60 shadow-2xl shadow-slate-200/40 rounded-[24px] md:rounded-[32px] overflow-hidden relative">


        {/* ── Header ── */}
        <div className={cn(
          "flex flex-col gap-3 p-4 border-b bg-card/40 backdrop-blur-md transition-all shrink-0",
          isLandscape && "p-2 gap-2"
        )}>
          {/* Top Row: Navigation & View Toggle */}
          <div className={cn(
            "grid grid-cols-1 md:grid-cols-3 items-center gap-4",
            isLandscape && "flex items-center justify-between gap-2"
          )}>
            {/* Left Action: Add Booking (Removed and moved to Top Nav) */}
            <div className="hidden md:flex items-center w-[120px]" />


            {/* Navigation (Centered) */}
            {isMobile && !isLandscape ? (
              <div className="flex items-center justify-between border border-slate-200 rounded-[28px] p-1.5 bg-white shadow-sm mt-1 mb-2 mx-1">
                <Button variant="ghost" size="icon" className="h-10 w-10 p-0 rounded-full border border-slate-200 shadow-sm shrink-0 bg-white"
                  onClick={() => {
                    setNavDirection(-1);
                    setWeekStart(addDays(weekStart, -7));
                  }}>
                  <ChevronLeft className="h-5 w-5 text-slate-700" />
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex flex-col items-center justify-center flex-1 px-2 group">
                      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 group-hover:text-primary transition-colors mb-0.5">Viewing Period</span>
                      <span className="text-xs font-black uppercase tracking-tight text-slate-800 flex items-center gap-1">
                        {periodLabel} <ChevronDown className="h-3 w-3 opacity-40 ml-0.5" />
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4 rounded-2xl shadow-2xl border-none">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 text-slate-400">Jump to Date</Label>
                      <Input 
                        type="date" 
                        className="h-10 rounded-[20px] font-bold border-slate-200" 
                        value={format(weekStart, 'yyyy-MM-dd')}
                        onChange={(e) => {
                          if (e.target.value) {
                            const newDate = startOfDay(new Date(e.target.value));
                            setNavDirection(newDate > weekStart ? 1 : -1);
                            setWeekStart(newDate);
                          }
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>

                <Button variant="ghost" size="icon" className="h-10 w-10 p-0 rounded-full border border-slate-200 shadow-sm shrink-0 bg-white"
                  onClick={() => {
                    setNavDirection(1);
                    setWeekStart(addDays(weekStart, 7));
                  }}>
                  <ChevronRight className="h-5 w-5 text-slate-700" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" className={cn("h-9 px-3 rounded-xl border-slate-200 bg-white shadow-sm font-bold text-xs", isLandscape && "h-8 px-2")}
                  onClick={() => {
                    setNavDirection(-1);
                    setWeekStart(addDays(weekStart, -7));
                  }}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> {(isMobile || isLandscape) ? '' : 'Prev'}
                </Button>
                
                <div className="flex flex-col items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn("flex flex-col items-center hover:bg-slate-100/50 p-1 px-4 rounded-xl transition-colors min-w-[140px] group", isLandscape && "min-w-[100px] px-2")}>
                        {!isLandscape && <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-primary transition-colors">Viewing Period</span>}
                        <span className={cn("text-xs font-black uppercase tracking-tight text-slate-900 flex items-center gap-1 group-hover:scale-105 transition-transform", isLandscape && "text-[10px]")}>
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
                            if (e.target.value) {
                              const newDate = startOfDay(new Date(e.target.value));
                              setNavDirection(newDate > weekStart ? 1 : -1);
                              setWeekStart(newDate);
                            }
                          }}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <Button variant="outline" size="sm" className={cn("h-9 px-3 rounded-xl border-slate-200 bg-white shadow-sm font-bold text-xs", isLandscape && "h-8 px-2")}
                  onClick={() => {
                    setNavDirection(1);
                    setWeekStart(addDays(weekStart, 7));
                  }}>
                  {(isMobile || isLandscape) ? '' : 'Next'} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {/* View Toggle Pill (Removed per user request) */}
            {/* Status Legend Tags in Top Right */}

          </div>

          {!isLandscape && (
            <>
              <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-2">
                    <div className="relative flex-1 group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                      <Input 
                        className={cn("pl-10 pr-10 border-slate-200 bg-white shadow-sm focus:ring-4 focus:ring-primary/5 text-sm font-bold placeholder:font-medium transition-all", isMobile ? "h-12 rounded-[24px]" : "h-11 rounded-xl")}
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

                    {!timeline.some(d => isSameDay(d, new Date())) && (
                      <Button variant="secondary" size="sm" className="h-11 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95 shrink-0"
                        onClick={() => setWeekStart(startOfDay(new Date()))}>
                        {isMobile ? 'Today' : 'Go to Today'}
                      </Button>
                    )}

                    {/* Out-of-view search results indicator */}
                    {search && (() => {
                      const periodEnd = addDays(weekStart, DAYS);
                      const outOfView = globalMatches.filter(b => {
                        const ci = startOfDay(new Date(b.checkin));
                        const co = startOfDay(new Date(b.checkout));
                        return !(ci < periodEnd && co > weekStart);
                      });
                      if (!outOfView.length) return null;
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all shrink-0 animate-in fade-in slide-in-from-right-2 shadow-sm">
                              <CalendarDays className="h-3 w-3" />
                              <span>{outOfView.length} more</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-80 p-0 rounded-2xl shadow-2xl border-none overflow-hidden">
                            <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Results Outside Current View</p>
                              <p className="text-xs text-amber-600 font-medium mt-0.5">{outOfView.length} booking{outOfView.length !== 1 ? 's' : ''} found — click to navigate</p>
                            </div>
                            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                              {outOfView.map(b => {
                                const guest = getGuest(b);
                                const room = rooms.find(r => r._id === getBookingRoomId(b));
                                const statusColorMap: Record<string, string> = {
                                  'checked-in': 'bg-blue-100 text-blue-700',
                                  'reserved': 'bg-emerald-100 text-emerald-700',
                                  'checked-out': 'bg-orange-100 text-orange-700',
                                  'enquiry': 'bg-amber-100 text-amber-700',
                                  'block': 'bg-slate-100 text-slate-600',
                                  'cancelled': 'bg-red-100 text-red-500',
                                };
                                const statusKey = b.status || b.reservationType || b.bookingType || 'booking';
                                return (
                                  <button
                                    key={b._id}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors group"
                                    onClick={() => {
                                      setNavDirection(startOfDay(new Date(b.checkin)) > weekStart ? 1 : -1);
                                      setWeekStart(startOfDay(new Date(b.checkin)));
                                      setTimeout(() => setSelectedBooking(b), 150);
                                    }}
                                  >
                                    <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-700 shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                                      {room?.roomNumber || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-black text-slate-800 truncate">{guest?.name || (b.bookingType === 'block' ? 'Room Block' : 'Unknown')}</p>
                                      <p className="text-[10px] font-bold text-slate-400">
                                        {format(new Date(b.checkin), 'MMM d')} → {format(new Date(b.checkout), 'MMM d, yyyy')}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                      <span className={cn('text-[9px] font-black uppercase px-2 py-0.5 rounded-full', statusColorMap[statusKey] || 'bg-slate-100 text-slate-500')}>
                                        {b.status || statusKey}
                                      </span>
                                      <ArrowRight className="h-3 w-3 text-slate-300 group-hover:text-primary transition-colors" />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })()}

                 </div>
              </div>

              <div className="flex items-center gap-2 py-1 pb-2 overflow-x-auto no-scrollbar -mx-4 px-4 scroll-smooth">
                {STATUS_FILTERS.map((f) => {
                  const key = f.key;
                  const color = 'color' in f ? f.color : undefined;
                  const label = f.label;
                  const count = key === 'all'
                    ? bookings.length
                    : (counts[key as keyof typeof counts] ?? 0);
                  return (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold capitalize tracking-wide border transition-all active:scale-95 whitespace-nowrap shrink-0",
                        statusFilter === key
                          ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/10"
                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
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

                {/* Out-of-view pill: fires for specific status filters or search, NOT for "All" without search */}
                {(statusFilter !== 'all' || search) && (() => {
                  const periodEnd = addDays(weekStart, DAYS);
                  // From globalMatches, pick only those outside the current view window
                  let outOfView = globalMatches.filter(b => {
                    const ci = startOfDay(new Date(b.checkin));
                    const co = startOfDay(new Date(b.checkout));
                    return !(ci < periodEnd && co > weekStart);
                  });
                  // globalMatches always includes cancelled/expired for grid alerts —
                  // strip those out when a specific status filter is active so counts are accurate
                  if (statusFilter !== 'all') {
                    outOfView = outOfView.filter(b => {
                      const type = b.reservationType || b.bookingType || 'booking';
                      if (statusFilter === 'enquiry') return type === 'enquiry' && (!b.enquiryExpiresAt || new Date(b.enquiryExpiresAt) >= new Date());
                      if (statusFilter === 'expired-hold') return type === 'enquiry' && b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date();
                      if (statusFilter === 'block') return type === 'block';
                      if (statusFilter === 'cancelled') return b.status === 'cancelled';
                      return (type === 'booking' || type === 'group') && b.status === statusFilter;
                    });
                  }
                  if (!outOfView.length) return null;
                  const filterLabel = statusFilter !== 'all'
                    ? STATUS_FILTERS.find(f => f.key === statusFilter)?.label || statusFilter
                    : search ? 'Search' : null;
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all shrink-0 animate-in fade-in slide-in-from-right-2 shadow-sm whitespace-nowrap">
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          <span>{outOfView.length} outside view</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" sideOffset={8} className="w-[340px] p-0 rounded-2xl shadow-2xl border-none overflow-hidden">
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-b border-amber-100 px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-amber-600" />
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Outside Current View{filterLabel ? ` — ${filterLabel}` : ''}</p>
                              <p className="text-xs text-amber-600/80 font-medium mt-0.5">{outOfView.length} booking{outOfView.length !== 1 ? 's' : ''} matched · click any to jump there</p>
                            </div>
                          </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 bg-white">
                          {outOfView.map(b => {
                            const guest = getGuest(b);
                            const room = rooms.find(r => r._id === getBookingRoomId(b));
                            const statusColorMap: Record<string, string> = {
                              'checked-in':  'bg-blue-100 text-blue-700 border border-blue-200',
                              'reserved':    'bg-emerald-100 text-emerald-700 border border-emerald-200',
                              'checked-out': 'bg-orange-100 text-orange-700 border border-orange-200',
                              'enquiry':     'bg-amber-100 text-amber-700 border border-amber-200',
                              'block':       'bg-slate-100 text-slate-600 border border-slate-200',
                              'cancelled':   'bg-red-50 text-red-500 border border-red-100',
                            };
                            const statusKey = b.status || b.reservationType || b.bookingType || 'booking';
                            const nights = Math.max(1, Math.round((new Date(b.checkout).getTime() - new Date(b.checkin).getTime()) / 86400000));
                            return (
                              <button
                                key={b._id}
                                className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 text-left transition-colors group"
                                onClick={() => {
                                  setNavDirection(startOfDay(new Date(b.checkin)) > weekStart ? 1 : -1);
                                  setWeekStart(startOfDay(new Date(b.checkin)));
                                  setTimeout(() => setSelectedBooking(b), 150);
                                }}
                              >
                                {/* Room avatar */}
                                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-sm text-slate-700 shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                                  {room?.roomNumber || '?'}
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-black text-slate-800 truncate">
                                    {guest?.name || (b.bookingType === 'block' ? 'Room Block' : 'Unknown Guest')}
                                  </p>
                                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                    {format(new Date(b.checkin), 'MMM d')} → {format(new Date(b.checkout), 'MMM d, yyyy')}
                                    <span className="ml-1 opacity-60">· {nights}N</span>
                                  </p>
                                  {room && (
                                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">{room.roomType}</p>
                                  )}
                                </div>
                                {/* Status + arrow */}
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className={cn('text-[9px] font-black uppercase px-2 py-0.5 rounded-full', statusColorMap[statusKey] || 'bg-slate-100 text-slate-500 border border-slate-200')}>
                                    {b.status || statusKey}
                                  </span>
                                  <ArrowRight className="h-3.5 w-3.5 text-slate-200 group-hover:text-primary transition-colors" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })()}

              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-bold tracking-[0.15em] text-slate-400 uppercase">{isMobile ? 'Room:' : 'Room Cleanliness:'}</span>
                  {[
                    { dot: 'bg-emerald-500', label: 'Clean' },
                    { dot: 'bg-amber-400', label: 'Dirty' },
                    { dot: 'bg-red-500', label: 'Repair' },
                  ].map(({ dot, label }) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", dot)} />
                      <span className="text-[10px] font-medium text-slate-400 tracking-tight">{label}</span>
                    </span>
                  ))}
                </div>
                {isMobile && (
                   <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Alerts Active</span>
                   </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Board ── */}
        <div 
          className="flex-1 overflow-auto select-none" 
          ref={setBoardRef}
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
              <div className="flex-1 min-w-0 overflow-hidden relative">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={weekStart.toISOString()}
                    initial={{ x: navDirection * 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -navDirection * 50, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 350, damping: 35, mass: 1 }}
                    className="flex"
                    style={{ width: timeline.length * COLUMN_WIDTH }}
                  >
                    {viewMode === 'today' ? (
                      timeline.map((hourDate: Date) => (
                        <div key={hourDate.toISOString()} className="flex flex-col items-center justify-center border-r flex-shrink-0 bg-white/50" style={{ width: COLUMN_WIDTH, height: 48 }}>
                          <span className="text-[10px] font-black tracking-widest opacity-40">{format(hourDate, 'HH:00')}</span>
                        </div>
                      ))
                    ) : timeline.map((day: Date) => (
                      <div key={day.toISOString()}
                        className={cn(
                          "flex flex-col items-center justify-center border-r flex-shrink-0 transition-colors",
                          isSameDay(day, new Date()) ? "bg-primary/[0.04] text-primary" : "text-slate-500"
                        )}
                        style={{ width: COLUMN_WIDTH, height: 48, minWidth: COLUMN_WIDTH }}>
                        <span style={{ fontSize: (isMobile || viewMode === 'month') ? 7 : 9 }} className="font-black tracking-[0.1em] opacity-40 mb-0.5 leading-none">{format(day, 'EEE')}</span>
                        <span className={cn(
                          "font-black tracking-tight leading-none",
                          isSameDay(day, new Date()) ? "bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30" : "",
                          (isMobile || viewMode === 'month') ? "text-[10px]" : "text-xs"
                        )}
                        style={isSameDay(day, new Date()) ? { width: (isMobile || viewMode === 'month') ? 22 : 28, height: (isMobile || viewMode === 'month') ? 22 : 28 } : {}}>
                          {format(day, 'dd')}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Grid Area with smooth week-swap animation */}
            <div className="relative w-max h-full">
              {(() => {
                if (viewMode !== 'today') return null;
                const todayHasConfirmed = filteredBookings.some(b => {
                  if (b.status === 'cancelled' || b.bookingType === 'block' || b.bookingType === 'enquiry') return false;
                  return startOfDay(parseISO(b.checkin)) <= startOfDay(weekStart) && startOfDay(parseISO(b.checkout)) >= startOfDay(weekStart);
                });
                if (todayHasConfirmed) return null;
                return (
                  <div className="absolute top-4 z-[45] pointer-events-none" style={{ left: ROOM_COL + 20 }}>
                     <div className="bg-slate-50/90 backdrop-blur-sm border border-slate-200 text-slate-500 text-[11px] font-bold py-2 px-4 rounded-xl shadow-sm flex items-center gap-2 pointer-events-auto">
                       <Info className="w-4 h-4" /> No confirmed bookings today
                     </div>
                  </div>
                );
              })()}

              <div className="flex">
                {/* Sticky Room Labels Sidebar - Outside motion for perfect stickiness */}
                <div className="z-30 shrink-0 sticky left-0 bg-white/95 backdrop-blur-sm shadow-[4px_0_10px_-2px_rgba(0,0,0,0.05)]">
                  {activeRooms.map((room) => (
                    <div 
                      key={`sidebar-${room._id}`}
                      className={cn(
                        "border-r border-b flex flex-col transition-all hover:bg-slate-50",
                        isMobile ? "p-2 items-start justify-center gap-0.5" : "justify-center px-1.5 md:px-3.5"
                      )} 
                      style={{ width: ROOM_COL, height: ROW_HEIGHT }}
                    >
                      {isMobile ? (
                        <>
                          <div className="flex items-center gap-1.5 w-full">
                            <span className="text-[12px] font-black text-slate-800 tracking-tight leading-none">{room.roomNumber}</span>
                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", room.status === 'clean' ? 'bg-emerald-500' : (room.status === 'maintenance' || room.status === 'under-maintenance') ? 'bg-red-500' : 'bg-amber-400')} />
                            {getRoomOccupancy(room._id) && (
                              <Clock className="h-2.5 w-2.5 text-blue-500 animate-pulse shrink-0 ml-auto" />
                            )}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 capitalize opacity-90 leading-tight mt-0.5">{room.roomType}</div>
                          <div className="text-[10px] font-bold text-slate-500 flex-1 flex items-end">₹{room.price?.toLocaleString('en-IN') || '0'}</div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-col md:flex-row md:items-center justify-between mb-0.5 gap-0.5 md:gap-1.5">
                            <div className="flex items-center gap-1 md:gap-1.5">
                              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", room.status === 'clean' ? 'bg-emerald-500' : (room.status === 'maintenance' || room.status === 'under-maintenance') ? 'bg-red-500' : 'bg-amber-400')} />
                              <div className="text-[10px] md:text-[12px] font-black tracking-tight text-slate-800 leading-none">
                                {room.roomNumber}
                              </div>
                            </div>
                            {getRoomOccupancy(room._id) && (
                              <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 text-blue-500 animate-pulse shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-50/50">
                            <div className="text-[7px] md:text-[9px] font-bold text-slate-400 truncate tracking-tight opacity-70 uppercase">
                              {room.roomType}
                            </div>
                            <div className="text-[9px] md:text-[10px] font-black text-primary/60 tracking-tighter">
                              ₹{room.price?.toLocaleString('en-IN') || '0'}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex-1 min-w-0 overflow-hidden relative">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={weekStart.toISOString()}
                      initial={{ x: navDirection * 50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -navDirection * 50, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 350, damping: 35, mass: 1 }}
                      className="flex-1 min-w-0"
                      style={{ width: timeline.length * COLUMN_WIDTH }}
                    >
                    {activeRooms.map((room) => {
                      const roomBookings = filteredBookings.map(b => {
                        if (pendingUpdate && pendingUpdate.booking._id === b._id) {
                          return { ...b, ...pendingUpdate.updates };
                        }
                        return b;
                      }).filter(b => getBookingRoomId(b) === room._id);
                      return (
                        <div 
                          key={room._id}
                          className="flex border-b group relative hover:bg-white transition-colors" 
                          style={{ height: ROW_HEIGHT }}
                        >
                           {/* Today Marker */}
                           {viewMode === 'today' && (
                             <div className="absolute top-0 bottom-0 bg-red-500/20 w-0.5 z-20 pointer-events-none" style={{ left: currentTimePos }}>
                               <div className="bg-red-500 text-[8px] font-black text-white px-1.5 py-0.5 rounded shadow-lg absolute -top-1 -translate-x-1/2 whitespace-nowrap ring-2 ring-white animate-pulse">NOW</div>
                             </div>
                           )}
                           
                           <div className="flex relative flex-1 min-w-0">
                             {timeline.map((item: Date, idx) => {
                               const itemTime = item.getTime();
                               const bookingAtCell = roomBookings.find(b => {
                                 if (b.status === 'cancelled' || b.status === 'checked-out') return false;
                                 const startDT = parseISO(`${b.checkin}T${b.checkinTime || '14:00'}:00`);
                                 const endDT = parseISO(`${b.checkout}T${b.checkoutTime || '11:00'}:00`);
                                 
                                 if (viewMode === 'today') {
                                   return itemTime >= startDT.getTime() && itemTime < endDT.getTime();
                                 } else {
                                   const bS = startOfDay(parseISO(b.checkin)).getTime();
                                   const bE = startOfDay(parseISO(b.checkout)).getTime();
                                   return itemTime >= bS && itemTime < bE;
                                 }
                               });

                               const isDayBooked = !!bookingAtCell;
                               const isWeekend = item.getDay() === 0 || item.getDay() === 6;

                               return (
                                 <div
                                   key={idx}
                                   className={cn(
                                     "border-r relative transition-colors duration-150 shrink-0",
                                     isWeekend && !isDayBooked && "bg-slate-50/30",
                                     hoveredRoomId === room._id && "bg-slate-50/50",
                                     !isDayBooked && "hover:bg-primary/5 cursor-crosshair"
                                   )}
                                   style={{ width: COLUMN_WIDTH }}
                                   onMouseEnter={() => {
                                     if (isDayBooked) {
                                       setHoveredBookingId(bookingAtCell._id);
                                       setHoveredRoomId(room._id);
                                     }
                                   }}
                                   onMouseLeave={() => {
                                     setHoveredBookingId(null);
                                     setHoveredRoomId(null);
                                   }}

                                   onClick={() => handleCellClick(room._id, item)}
                                 />
                               );
                             })}

                             {/* Booking cards overlay for this room */}
                             {(() => {
                                 const isExpiredEnquiry = (b: Booking) => isExpiredBooking(b);

                                                                   const patchedBookings = filteredBookings.map(b => {
                                    if (pendingUpdate && pendingUpdate.booking._id === b._id) {
                                      return { ...b, ...pendingUpdate.updates };
                                    }
                                    return b;
                                  });
                                  const roomBookingsAll = patchedBookings.filter(b => getBookingRoomId(b) === room._id);
                                 
                                 const statusPriority: Record<string, number> = { 'checked-in': 5, 'confirmed': 4, 'reserved': 3, 'checked-out': 2 };

                                 const sorted = [...roomBookingsAll].sort((a, b) => {
                                    const isExpA = isExpiredEnquiry(a);
                                    const isExpB = isExpiredEnquiry(b);
                                    if (isExpA !== isExpB) return isExpA ? 1 : -1;
                                    if (a.status === 'cancelled' && b.status !== 'cancelled') return 1;
                                    if (a.status !== 'cancelled' && b.status === 'cancelled') return -1;
                                   const pA = statusPriority[a.status] || 0;
                                   const pB = statusPriority[b.status] || 0;
                                   if (pA !== pB) return pB - pA;
                                   const durA = differenceInDays(parseISO(a.checkout), parseISO(a.checkin));
                                   const durB = differenceInDays(parseISO(b.checkout), parseISO(b.checkin));
                                   if (durA !== durB) return durB - durA;
                                   return parseISO(a.checkin).getTime() - parseISO(b.checkin).getTime();
                                 });

                                 const cancelledByDay: Record<string, Booking[]> = {};
                                 const expiredByDay: Record<string, Booking[]> = {};
                                 const checkedOutOverlappedByDay: Record<string, Booking[]> = {};

                                 const visibleCards: { primary: Booking, others: Booking[] }[] = [];
                                 sorted.forEach(b => {
                                   const isExp = isExpiredBooking(b);
                                   if (b.status === 'cancelled') {
                                     const key = startOfDay(parseISO(b.checkin)).toISOString();
                                     if (!cancelledByDay[key]) cancelledByDay[key] = [];
                                     cancelledByDay[key].push(b);
                                     return;
                                   }
                                   if (isExp) {
                                     const key = startOfDay(parseISO(b.checkin)).toISOString();
                                     if (!expiredByDay[key]) expiredByDay[key] = [];
                                     expiredByDay[key].push(b);
                                     return;
                                   }

                                   const bS = parseISO(b.checkin);
                                   const bE = parseISO(b.checkout);
                                   const group = visibleCards.find(g => [g.primary, ...g.others].some(m => bS < parseISO(m.checkout) && bE > parseISO(m.checkin)));
                                   
                                   if (group) {
                                     if (b.status === 'checked-out') {
                                       const key = startOfDay(parseISO(b.checkin)).toISOString();
                                       if (!checkedOutOverlappedByDay[key]) checkedOutOverlappedByDay[key] = [];
                                       checkedOutOverlappedByDay[key].push(b);
                                     } else {
                                       group.others.push(b);
                                     }
                                   } else {
                                     visibleCards.push({ primary: b, others: [] });
                                   }
                                 });

                                 const cardsJsx = visibleCards.map(({ primary: booking, others }) => {
                                   const calculateLayoutValue = () => {
                                     if (viewMode === 'today') {
                                       const todayStart = startOfDay(weekStart);
                                       const todayEnd = addDays(todayStart, 1);
                                       const startDT = parseISO(`${booking.checkin}T${booking.checkinTime || '14:00'}:00`);
                                       const endDT = parseISO(`${booking.checkout}T${booking.checkoutTime || '11:00'}:00`);
                                       if (endDT < todayStart || startDT >= todayEnd) return null;
                                       const ciHours = Math.max(0, (startDT.getTime() - todayStart.getTime()) / 3600000);
                                       const coHours = Math.min(24, (endDT.getTime() - todayStart.getTime()) / 3600000);
                                       const dur = coHours - ciHours;
                                       return { left: (ciHours * COLUMN_WIDTH), width: Math.max(20, dur * COLUMN_WIDTH) };
                                     } else {
                                       const bCI = startOfDay(parseISO(booking.checkin));
                                       const bCO = startOfDay(parseISO(booking.checkout));
                                       const wS  = startOfDay(weekStart);
                                       
                                       const getFraction = (time?: string) => {
                                         if (!time) return 0.5;
                                         const [h, m] = time.split(':').map(Number);
                                         return (h + m/60) / 24;
                                       };

                                       const startPos = differenceInDays(bCI, wS) + getFraction(booking.checkinTime || '14:00');
                                       const endPos = differenceInDays(bCO, wS) + getFraction(booking.checkoutTime || '11:00');

                                       if (endPos <= 0 || startPos >= DAYS) return null;

                                       const visStart = Math.max(0, startPos);
                                       const visEnd = Math.min(DAYS, endPos);

                                       return {
                                         left: visStart * COLUMN_WIDTH,
                                         width: Math.max(COLUMN_WIDTH * 0.1, (visEnd - visStart) * COLUMN_WIDTH)
                                       };
                                     }
                                   };

                                   const layout = calculateLayoutValue();
                                   if (!layout) return null;
                                                                       const isResizing = resizingId === booking._id;
                                    const isPendingMove = !!(pendingUpdate && pendingUpdate.booking._id === booking._id);
                                   const isExpired = isExpiredBooking(booking);
                                   const isEnquiry = (booking.reservationType || booking.bookingType) === 'enquiry';
                                   const isBlock = booking.bookingType === 'block' || booking.reservationType === 'block';
                                   const isSolid = ['checked-in', 'confirmed', 'reserved', 'checked-out'].includes(booking.status);
                                   const isEditable = booking.status !== 'checked-out' && booking.status !== 'cancelled' && !isExpired;
                                   const isToday = isSameDay(parseISO(booking.checkin), new Date());

                                   return (
                                     <motion.div
                                       key={booking._id}
                                       data-booking-card
                                       initial={false}
                                                                               animate={{ 
                                          left: layout.left, 
                                          ...((isResizing || draggingId === booking._id) ? {} : { width: layout.width }) 
                                        }}
                                       className={cn(
                                         "absolute top-2 bottom-2 rounded-xl text-white select-none group/card cursor-pointer active:scale-[0.99] transition-all",
                                         getStatusColor(booking.status, booking.bookingType, booking.reservationType, isExpired),
                                         (hoveredBookingId === booking._id || booking.status === 'cancelled') ? "z-30 opacity-100" : "z-10 opacity-90 hover:opacity-100 hover:z-20",
                                         hoveredGroupId === booking.groupId && booking.groupId && "ring-2 ring-white ring-offset-2 ring-offset-primary shadow-xl scale-[1.02]",
                                         isResizing && "ring-2 ring-primary ring-offset-2 z-50 opacity-100 scale-[1.02] shadow-2xl"
                                       )}
                                       onPointerDown={(e) => {
                                         // On touch devices, prevent default to stop scroll takeover if it's a drag interaction
                                         if (e.pointerType === 'touch') {
                                           (e.target as HTMLElement).style.touchAction = 'none';
                                         }
                                         handleCardDragStart(e, booking);
                                       }}
                                       onMouseEnter={() => {
                                         setHoveredBookingId(booking._id);
                                         if (booking.groupId) setHoveredGroupId(booking.groupId);
                                       }}
                                       onMouseLeave={() => {
                                         setHoveredBookingId(null);
                                         setHoveredGroupId(null);
                                       }}
                                     >
                                       <div className="p-1 px-1.5 md:p-2.5 h-full flex flex-col justify-between relative overflow-hidden">
                                         {/* Background gradient for depth */}
                                         <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

                                         {isToday && isSolid && booking.status !== 'checked-out' && (
                                           <div className="absolute top-0 right-0 w-12 h-12 -mr-6 -mt-6 bg-white/20 blur-2xl rounded-full" />
                                         )}

                                         <div className="flex justify-between items-start gap-1">
                                           <div className={cn("flex flex-col min-w-0", isMobile && "gap-0.5")}>
                                            {isBlock ? (
                                              <button
                                                className="flex items-center gap-1 cursor-pointer pointer-events-auto active:scale-95 transition-transform"
                                                onClick={(e) => { e.stopPropagation(); setSelectedBooking(booking); }}
                                                onPointerDown={(e) => e.stopPropagation()}
                                              >
                                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/80 text-white border border-slate-700/50 shadow-sm">
                                                  <Lock className="h-2 w-2 shrink-0 opacity-70" />
                                                  <span className="text-[8px] md:text-[10px] font-black uppercase tracking-tight leading-none">Blocked</span>
                                                </div>
                                                
                                              </button>
                                            ) : (
                                              <div
                                                className="group/name flex items-center gap-1 cursor-pointer pointer-events-auto"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedGuestId(getGuest(booking)?._id || null);
                                                }}
                                                onPointerDown={(e) => e.stopPropagation()}
                                              >
                                                <span className="inline-block text-[9px] md:text-[11px] font-bold uppercase tracking-tighter truncate transition-all duration-200 group-hover/name:border-b-2 border-current pb-[0.5px] leading-tight max-w-full">
                                                  {getGuest(booking)?.name || 'NO GUEST'}
                                                </span>
                                              </div>
                                            )}
                                           
                                           {isEnquiry && !isExpired && booking.enquiryExpiresAt && (
                                              <div className="flex items-center gap-1 text-[7px] md:text-[8px] font-bold text-amber-600/80 uppercase">
                                                <Timer className="h-2 w-2" />
                                                {formatCountdown(booking.enquiryExpiresAt)}
                                              </div>
                                           )}
                                           {isMobile && !isBlock && !isEnquiry && (
                                             <span className="text-[7px] font-black opacity-80 uppercase tracking-tighter leading-none mt-0.5">
                                               {booking.status.replace('-', ' ')}
                                             </span>
                                           )}
                                           </div>

                                           <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
                                             {/* Status Tags in Top Right of Card */}
                                             <div className="flex gap-1 items-center">
                                                {isEnquiry && <div className="px-1 py-0.5 rounded-sm bg-amber-400/20 text-[6px] font-black text-amber-600 uppercase tracking-tighter border border-amber-400/30">ENQ</div>}
                                                
                                             </div>

                                             {others.length > 0 && booking.status !== 'checked-out' && (
                                               <div onClick={e => e.stopPropagation()}>
                                                 <Popover>
                                                   <PopoverTrigger asChild>
                                                     <button className={cn(
                                                       "px-1 py-0.5 md:px-1.5 md:py-0.5 rounded-md font-bold shadow-sm transition-all active:scale-95 text-[8px]",
                                                       isSolid ? "bg-white/20 hover:bg-white/30 text-white border border-white/20" : "bg-slate-100 ring-1 ring-slate-200 text-slate-500 hover:bg-slate-200"
                                                     )}>
                                                       +{others.length}
                                                     </button>
                                                   </PopoverTrigger>
                                                   <PopoverContent className="w-56 p-2 rounded-xl z-[400] shadow-2xl border-none">
                                                     <p className="text-[9px] font-black text-slate-400 p-2 border-b uppercase tracking-widest text-center">Overlapping Stays</p>
                                                     <div className="mt-1 space-y-0.5 max-h-[250px] overflow-y-auto pr-1">
                                                       {others.map(o => (
                                                         <button key={o._id} onClick={() => setSelectedBooking(o)} className="w-full p-2 hover:bg-slate-50 rounded-lg flex justify-between items-center text-left group">
                                                           <div className="flex-1 min-w-0">
                                                             <p className="text-[10px] font-bold text-slate-700 truncate">{getGuest(o)?.name || 'Guest'}</p>
                                                             <p className="text-[8px] text-slate-400 capitalize">{o.status} · {format(parseISO(o.checkout), 'MMM dd')}</p>
                                                           </div>
                                                           <div className={cn("w-2 h-2 rounded-full", getStatusColor(o.status, o.bookingType, o.reservationType, false))} />
                                                         </button>
                                                       ))}
                                                     </div>
                                                   </PopoverContent>
                                                 </Popover>
                                               </div>
                                             )}
                                           </div>
                                         </div>

                                         <div className="flex items-end justify-between gap-1">
                                           <div className="flex flex-col gap-0.5 md:gap-1 items-start min-w-0">
                                             {booking.groupName && (
                                                 <div className="flex items-center opacity-100 max-w-full">
                                                   <span className="text-[8px] md:text-[11px] font-black uppercase tracking-tight truncate max-w-[50px] md:max-w-[120px] bg-black/10 px-1 md:px-2 py-0.5 rounded-sm md:rounded-md border border-black/5 flex items-center gap-1">
                                                     <Users className="h-2 w-2 md:h-2.5 md:w-2.5 text-current/80 shrink-0" />
                                                     {booking.groupName}
                                                   </span>
                                                 </div>
                                               )}
                                           </div>
                                         </div>
                                       </div>
                                       {isEditable && (
                                         <div data-resize-handle onPointerDown={(e) => {
                                           if (e.pointerType === 'touch') {
                                             (e.target as HTMLElement).style.touchAction = 'none';
                                           }
                                           handleResizeDragStart(e, booking, room);
                                         }} className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center group-hover/card:opacity-100 opacity-80 md:opacity-0 transition-opacity">
                                           <div className="h-5 w-1 rounded-full bg-white/40" />
                                         </div>
                                       )}
                                     </motion.div>
                                   );
                                 });

                                 const allDayKeys = new Set([...Object.keys(cancelledByDay), ...Object.keys(expiredByDay), ...Object.keys(checkedOutOverlappedByDay)]);
                                 const badgesJsx = Array.from(allDayKeys).map(iso => {
                                   const dD = new Date(iso);
                                   const off = differenceInDays(startOfDay(dD), startOfDay(weekStart));
                                   if (off < 0 || off >= DAYS) return null;
                                   const canList = cancelledByDay[iso] || [];
                                   const expList = expiredByDay[iso] || [];
                                   const outList = checkedOutOverlappedByDay[iso] || [];
                                   const totalCount = canList.length + expList.length + outList.length;

                                   return (
                                     <div key={`badges-${iso}`} className="absolute top-3 z-40 flex items-center gap-0.5 justify-end px-1 pointer-events-none" style={{ left: off * COLUMN_WIDTH, width: COLUMN_WIDTH }}>
                                       {totalCount === 1 ? (
                                         expList.length === 1 ? (
                                           <button title="Expired Hold" className="bg-red-50 ring-1 ring-red-200 text-red-500 text-[8px] px-1.5 py-0.5 rounded-md font-bold shadow-sm hover:bg-red-100 transition-all pointer-events-auto" onClick={(e) => { e.stopPropagation(); setSelectedBooking(expList[0]); }}>+1</button>
                                         ) : outList.length === 1 ? (
                                           <button title="Checked Out" className="bg-orange-50 ring-1 ring-orange-200 text-orange-500 text-[8px] px-1.5 py-0.5 rounded-md font-bold shadow-sm hover:bg-orange-100 transition-all pointer-events-auto" onClick={(e) => { e.stopPropagation(); setSelectedBooking(outList[0]); }}>+1</button>
                                         ) : (
                                           <button title="Cancelled" className="bg-slate-100 ring-1 ring-slate-200 text-slate-500 text-[8px] px-1.5 py-0.5 rounded-md font-bold shadow-sm hover:bg-slate-200 transition-all pointer-events-auto" onClick={(e) => { e.stopPropagation(); setSelectedBooking(canList[0]); }}>+1</button>
                                         )
                                       ) : (
                                         <Popover>
                                           <PopoverTrigger asChild>
                                             <button className="bg-white ring-1 ring-slate-200 text-slate-600 text-[8px] px-1.5 py-0.5 rounded-md font-bold shadow-sm hover:bg-slate-50 transition-all pointer-events-auto" onClick={e => e.stopPropagation()}>+{totalCount}</button>
                                           </PopoverTrigger>
                                           <PopoverContent className="w-56 p-2 rounded-xl z-[400] shadow-2xl border border-slate-100">
                                             <p className="text-[10px] font-black text-slate-400 p-2 border-b uppercase tracking-widest text-center">Day Notifications · {totalCount}</p>
                                             <div className="mt-1 space-y-0.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
                                               {outList.map((o: Booking) => (
                                                 <button key={o._id} className="w-full p-2.5 hover:bg-orange-50/50 rounded-xl text-left flex justify-between items-center group/out" onClick={() => setSelectedBooking(o)}>
                                                   <div className="flex-1 min-w-0 mr-2">
                                                     <p className="text-[10px] font-black text-orange-600 truncate">{getGuest(o)?.name || 'Guest'}</p>
                                                     <p className="text-[8px] text-slate-400 font-bold">Checked Out · {format(parseISO(o.checkout), 'MMM dd')}</p>
                                                   </div>
                                                   <div className="text-[7px] font-black text-orange-400 bg-orange-100/50 px-1 rounded uppercase">out</div>
                                                 </button>
                                               ))}
                                               {expList.map((o: Booking) => (
                                                 <button key={o._id} className="w-full p-2.5 hover:bg-red-50/50 rounded-xl text-left flex justify-between items-center group/exp" onClick={() => setSelectedBooking(o)}>
                                                   <div className="flex-1 min-w-0 mr-2">
                                                     <p className="text-[10px] font-black text-red-500 truncate">{getGuest(o)?.name || 'Guest'}</p>
                                                     <p className="text-[8px] text-slate-400 font-bold">Hold Expired · {format(parseISO(o.checkin), 'MMM dd')}</p>
                                                   </div>
                                                   <div className="text-[7px] font-black text-red-400 bg-red-100/50 px-1 rounded uppercase">exp</div>
                                                 </button>
                                               ))}
                                               {canList.map((o: Booking) => (
                                                 <button key={o._id} className="w-full p-2.5 hover:bg-slate-50 rounded-xl text-left flex justify-between items-center group/can" onClick={() => setSelectedBooking(o)}>
                                                   <div className="flex-1 min-w-0 mr-2">
                                                     <p className="text-[10px] font-bold line-through text-slate-400 truncate">{getGuest(o)?.name || 'Guest'}</p>
                                                     <p className="text-[8px] text-slate-300 font-bold">Cancelled · {format(parseISO(o.checkin), 'MMM dd')}</p>
                                                   </div>
                                                   <div className="w-2 h-2 rounded-full bg-slate-300" />
                                                 </button>
                                               ))}
                                             </div>
                                           </PopoverContent>
                                         </Popover>
                                       )}
                                     </div>
                                   );
                                 });

                               return [...cardsJsx, ...badgesJsx];
                             })()}
                           </div>
                          </div>
                        );
                      })}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
            {/* Bottom spacer */}
          </div>
        </div>
      </div>
      </div>

      <BookingModal isOpen={isModalOpen || !!editingBooking} onClose={() => { setIsModalOpen(false); setEditingBooking(null); }}
        selectedRoomId={selectedRoomId} selectedDate={selectedDate} initialBooking={editingBooking || undefined} isEditingGroup={!!editingBooking?.groupId} />
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
                    <p className="font-black text-slate-900 text-xs md:text-sm mb-1 leading-none truncate w-full" title={pendingUpdate ? pendingUpdate.details.oldRoom : 'Room'}>
                      {pendingUpdate ? pendingUpdate.details.oldRoom : 'Room'}
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
                    <p className="font-black text-primary text-xs md:text-sm mb-1 leading-none truncate w-full" title={pendingUpdate ? pendingUpdate.details.newRoom : 'Room'}>
                      {pendingUpdate ? pendingUpdate.details.newRoom : 'Room'}
                    </p>
                    <p className="text-[9px] md:text-[10px] font-black text-primary whitespace-nowrap overflow-hidden text-ellipsis">
                      {pendingUpdate && format(parseISO(pendingUpdate.details.newCheckin), 'MMM dd')} - {pendingUpdate && format(parseISO(pendingUpdate.details.newCheckout), 'MMM dd')}
                    </p>
                 </div>
              </div>
            </div>
            {pendingUpdate && (() => {
                          const isResizeChange = pendingUpdate.type === 'resize';
                          const nights = pendingUpdate.details.nightsDelta || 0;
                          const origNights = differenceInDays(startOfDay(parseISO(pendingUpdate.details.oldCheckout)), startOfDay(parseISO(pendingUpdate.details.oldCheckin)));
                          const newNights = differenceInDays(startOfDay(parseISO(pendingUpdate.details.newCheckout)), startOfDay(parseISO(pendingUpdate.details.newCheckin)));
                          const oldPricePerNight = pendingUpdate.details.oldPrice || 0;
                          const newPricePerNight = isResizeChange ? oldPricePerNight : (pendingUpdate.details.newPrice || 0);
                          const oldSubtotal = origNights * oldPricePerNight;
                          const newSubtotal = newNights * newPricePerNight;
                          const gstRate = taxConfig?.enabled ? ((taxConfig.cgst || 0) + (taxConfig.sgst || 0)) : 0;
                          const oldGst = gstRate > 0 ? Math.round(oldSubtotal * gstRate / 100) : 0;
                          const newGst = gstRate > 0 ? Math.round(newSubtotal * gstRate / 100) : 0;
                          const oldTotal = oldSubtotal + oldGst;
                          const newTotal = newSubtotal + newGst;
                          const roomPriceChanged = pendingUpdate.details.oldPrice !== pendingUpdate.details.newPrice;
                          const amountChanged = oldTotal !== newTotal || origNights !== newNights;
                          if (!roomPriceChanged && !amountChanged) return null;
                          return (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col gap-2.5">
                              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-1">Amount Breakdown</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
                                  <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Before</p>
                                  <p className="text-[9px] font-bold text-slate-400">{origNights}n × ₹{oldPricePerNight.toLocaleString('en-IN')}</p>
                                  {oldGst > 0 && <p className="text-[8px] text-orange-400">+GST {gstRate}% = ₹{oldGst.toLocaleString('en-IN')}</p>}
                                  <p className="text-sm font-black text-slate-600 mt-1">₹{oldTotal.toLocaleString('en-IN')}</p>
                                </div>
                                <div className="bg-primary/5 rounded-xl p-2.5 border border-primary/20 text-center">
                                  <p className="text-[8px] font-black uppercase text-primary/60 tracking-widest mb-1.5">After</p>
                                  <p className="text-[9px] font-bold text-primary/70">{newNights}n × ₹{newPricePerNight.toLocaleString('en-IN')}</p>
                                  {newGst > 0 && <p className="text-[8px] text-orange-500">+GST {gstRate}% = ₹{newGst.toLocaleString('en-IN')}</p>}
                                  <p className="text-sm font-black text-primary mt-1">₹{newTotal.toLocaleString('en-IN')}</p>
                                </div>
                              </div>
                              {roomPriceChanged && (
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
                                    {useNewPrice ? `Apply new price (₹${pendingUpdate.details.newPrice.toLocaleString('en-IN')}/n)` : `Keep original (₹${pendingUpdate.details.oldPrice.toLocaleString('en-IN')}/n)`}
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
            

            {pendingUpdate?.details.changeText && (() => {
               const text = pendingUpdate.details.changeText;
               const nights = pendingUpdate.details.nightsDelta;
               const isResize = pendingUpdate.type === 'resize';
               const isExtend = isResize && nights && nights > 0;
               const isReduce = isResize && nights && nights < 0;
               const isMove   = pendingUpdate.type === 'move';
               
               const label = isExtend ? 'Extend Stay' : isReduce ? 'Shorten Stay' : 'Shift Booking';
               const sublabel = isMove ? text : `${Math.abs(nights || 0)} night${Math.abs(nights || 0) !== 1 ? 's' : ''} ${nights && nights > 0 ? 'added' : 'removed'}`;
               
               const totalPriceDelta = Math.abs((nights || 0) * (pendingUpdate?.details.oldPrice || 0));
               const priceDeltaText = isResize && totalPriceDelta > 0 
                 ? `Amount ${nights && nights > 0 ? 'increased' : 'decreased'} by ₹${totalPriceDelta.toLocaleString('en-IN')}`
                 : '';
               
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
                   <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-slate-500 text-center">
                        {sublabel.replace('Confirmed', 'Reserved')}
                      </span>
                      {priceDeltaText && (
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-tight",
                          isExtend ? "text-emerald-600" : "text-amber-600"
                        )}>
                          {priceDeltaText}
                        </span>
                      )}
                    </div>
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

