import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  format, addDays, eachDayOfInterval, isSameDay,
  differenceInDays, startOfDay, parseISO, addHours
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2, Search, ChevronLeft, ChevronRight, ChevronDown, Bed, X, ShieldCheck, ArrowRight, Lock, Globe, User, Info, Users } from 'lucide-react';
import { useBookings, type Booking, type Room } from '../context/booking-context';
import { cn } from '../lib/utils';
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
    case 'reserved':
    case 'confirmed':   return cn(base, 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20 hover:bg-emerald-700');
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
  const [viewMode, setViewMode] = useState<'today' | 'week' | 'month'>('week');
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
    const handleResize = () => setIsMobile(window.innerWidth < 768);
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

  const DAYS = viewMode === 'month' ? 30 : viewMode === 'today' ? 1 : 7;
  const ROOM_COL = isMobile ? 80 : 157;
  
   const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
   const [hoveredBookingId, setHoveredBookingId] = useState<string | null>(null);
   const [dragTarget, setDragTarget] = useState<{ roomId: string, date: Date } | null>(null);

  // Column width calculations based on view mode
  const COLUMN_WIDTH = useMemo(() => {
    if (viewMode === 'today') return Math.max(isMobile ? 80 : 40, (boardWidth - ROOM_COL) / (isMobile ? 12 : 24)); 
    if (viewMode === 'month') return 40; // Thin columns for month
    return isMobile 
      ? Math.max(76, Math.floor((boardWidth - ROOM_COL) / 7)) 
      : Math.max(100, Math.min(350, Math.floor((boardWidth - ROOM_COL) / 7)));
  }, [viewMode, boardWidth, isMobile, ROOM_COL]);

  const ROW_HEIGHT = viewMode === 'month' ? 48 : (isMobile ? 64 : 82);

  const timeline = useMemo(() => {
    if (viewMode === 'today') {
      // 24 hour Date objects for today view
      return Array.from({ length: 24 }, (_, i) => addHours(startOfDay(weekStart), i));
    }
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, DAYS - 1) });
  }, [weekStart, DAYS, viewMode]);

  const activeRooms = useMemo(() => 
    rooms.filter(r => statusFilter === 'maintenance' ? (r.status === 'maintenance' || r.status === 'under-maintenance') : true),
  [rooms, statusFilter]);

  // All bookings matching search/status filters globally (ignoring date window)
  const globalMatches = useMemo(() => {
    return bookings.filter(b => {
      if (statusFilter !== 'all') {
        const type = b.reservationType || b.bookingType || 'booking';
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
          // Standard status filters
          if (type !== 'booking' || b.status !== statusFilter) return false;
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

  const isTodayView = viewMode === 'today';

  // Real-time occupancy check helper
  const getRoomOccupancy = useCallback((roomId: string) => {
    const now = new Date();
    return bookings.some(b => {
      if (b.status !== 'checked-in') return false;
      const bRoomId = typeof b.roomId === 'object' ? b.roomId._id : b.roomId;
      if (bRoomId !== roomId) return false;
      
      const checkin = parseISO(toISO(format(parseISO(b.checkin), 'yyyy-MM-dd'), b.checkinTime || '00:00'));
      const checkout = parseISO(toISO(format(parseISO(b.checkout), 'yyyy-MM-dd'), b.checkoutTime || '23:59'));
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
      const isExpiredEnquiry = (b.reservationType || b.bookingType) === 'enquiry'
        && !!b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date();
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
      const duration = differenceInDays(new Date(booking.checkout), new Date(booking.checkin));
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
    const isEnquiry = (booking.reservationType || booking.bookingType) === 'enquiry';
    const isEditable = (booking.status !== 'checked-out' && booking.status !== 'cancelled') || isEnquiry;
    if (!isEditable) return;
    if (isResizingRef.current || isDraggingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) return;

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
       try { cardEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
       try { (navigator as any).vibrate?.([10, 30, 10]); } catch { /* ignore */ }
       
       cardEl.style.opacity = '0.7';
       cardEl.style.zIndex = '1000';
       cardEl.style.transition = 'transform 0.1s ease-out, box-shadow 0.2s ease, opacity 0.2s ease';
       cardEl.style.transform = 'scale(1.02) translateY(-4px)';
       cardEl.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.4)';
       cardEl.style.outline = '2px solid white';
    };

    longPressTimer = setTimeout(activateDrag, LONG_MS);

    const updateUI = (meX: number, meY: number) => {
      if (!boardContentRef.current) return;
      
      const rect = boardContentRef.current.getBoundingClientRect();
      const numCols = viewMode === 'today' ? 24 : DAYS;
      const gridW = numCols * COLUMN_WIDTH;
      const gridH = activeRooms.length * ROW_HEIGHT;
      
      // Calculate where the pointer is RELATIVE to the grid content
      const contentX = meX - rect.left;
      const contentY = meY - rect.top;

      // Clamp the pointer coordinates so it stays within the grid area
      // X: Starts from ROOM_COL and extends gridW
      // Y: Starts from 48px (header) and extends gridH
      const clampedContentX = Math.max(ROOM_COL, Math.min(ROOM_COL + gridW, contentX));
      const clampedContentY = Math.max(48, Math.min(48 + gridH, contentY));

      // Re-calculate dx/dy based on clamped content coordinates
      // The original content coordinates at start were:
      const initialContentX = startX - (boardContentRef.current.getBoundingClientRect().left + (initialScrollL - (boardRef.current?.scrollLeft || 0)));
      // Wait, let's just use the current rect and current scroll to find displacement.
      // displacement = current_clamped_x - initial_x (both in screen or both in content)
      // Displace = current_clamped_content_x - initial_content_x (at start)
      
      const dx = clampedContentX - (startX - rect.left + (initialScrollL - (boardRef.current?.scrollLeft || 0)));
      const dy = clampedContentY - (startY - rect.top + (initialScrollT - (boardRef.current?.scrollTop || 0)));

      // Ghost Calculation
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

         // Auto-scroll
         if (boardRef.current) {
           const rect = boardRef.current.getBoundingClientRect();
           const edge = 50;
           let sX = 0, sY = 0;
           
           if (me.clientX < rect.left + edge + ROOM_COL) sX = -8;
           else if (me.clientX > rect.right - edge) sX = 8;
           
           if (me.clientY < rect.top + edge) sY = -8;
           else if (me.clientY > rect.bottom - edge) sY = 8;
           
           if (sX !== 0 || sY !== 0) {
             boardRef.current.scrollLeft += sX;
             boardRef.current.scrollTop += sY;
             updateUI(me.clientX, me.clientY);
           }
         }
       }
    };

    const onUp = (ue: PointerEvent) => {
       const dist = Math.hypot(ue.clientX - startX, ue.clientY - startY);
       cleanup();
       
       if (dragging && dist > 10) {
         handleDragEnd(ue, { point: { x: ue.clientX, y: ue.clientY } }, booking);
       } else if (!cancelled) {
         setSelectedBooking(booking);
       }
    };

    const cleanup = () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (longPressTimer) clearTimeout(longPressTimer);
      try { cardEl.releasePointerCapture(e.pointerId); } catch { }
      
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cleanup);
      
      setDragTarget(null);
      cardEl.style.transform = '';
      cardEl.style.opacity = '';
      cardEl.style.zIndex = '';
      cardEl.style.transition = '';
      cardEl.style.boxShadow = '';
      cardEl.style.outline = '';
      
      setTimeout(() => { isDraggingRef.current = false; }, 50);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cleanup);
  };

  // ── Pointer-based resize ───────────────────────────────────────
  const handleResizeDragStart = (e: React.PointerEvent<HTMLDivElement>, booking: Booking, room: Room) => {
    e.stopPropagation();
    const isEditable = booking.status !== 'checked-out' && booking.status !== 'cancelled';
    if (!isEditable) return;
    const handleEl = e.currentTarget as HTMLDivElement;
    const cardEl   = handleEl.closest('[data-booking-card]') as HTMLDivElement;
    if (!cardEl) return;
    try { handleEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }

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
        const newCO = format(addDays(origIn, differenceInDays(parseISO(booking.checkout), origIn) + daysDelta), 'yyyy-MM-dd');
        if (newCO > booking.checkin) {
          setPendingUpdate({
            booking,
            updates: { roomId: getBookingRoomId(booking), checkin: booking.checkin, checkout: newCO },
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
        className="flex flex-col bg-background h-full w-full max-w-full"
        style={{ minHeight: isMobile ? 420 : 480 }}
      >


        {/* ── Header ── */}
        <div className="flex flex-col gap-3 p-4 border-b bg-card/40 backdrop-blur-md">
          {/* Top Row: Navigation & View Toggle */}
          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
            {/* Left Action: Add Booking */}
            <div className="hidden md:flex items-center">
              <Button 
                onClick={() => {
                  setSelectedRoomId(undefined);
                  setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
                  setIsModalOpen(true);
                }}
                className="h-9 px-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center gap-2 font-black uppercase tracking-widest text-[9px]"
              >
                <Plus className="h-3.5 w-3.5" /> 
                <span>New Booking</span>
              </Button>
            </div>

            {/* Navigation (Centered) */}
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-slate-200 bg-white shadow-sm font-bold text-xs"
                onClick={() => setWeekStart(addDays(weekStart, viewMode === 'month' ? -30 : -DAYS))}>
                <ChevronLeft className="h-4 w-4 mr-1" /> {isMobile ? '' : 'Prev'}
              </Button>
              
              <div className="flex flex-col items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex flex-col items-center hover:bg-slate-100/50 p-1 px-4 rounded-xl transition-colors min-w-[140px] group">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-primary transition-colors">Viewing Period</span>
                      <span className="text-xs font-black uppercase tracking-tight text-slate-900 flex items-center gap-1 group-hover:scale-105 transition-transform">
                        {viewMode === 'today' ? format(weekStart, 'MMM dd, yyyy') : periodLabel} <ChevronDown className="h-3 w-3 opacity-40 ml-0.5" />
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
                          if (e.target.value) setWeekStart(startOfDay(new Date(e.target.value)));
                        }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-slate-200 bg-white shadow-sm font-bold text-xs"
                onClick={() => setWeekStart(addDays(weekStart, viewMode === 'month' ? 30 : DAYS))}>
                {isMobile ? '' : 'Next'} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* View Toggle Pill (Right Aliigned) */}
            <div className="flex justify-center md:justify-end">
              <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                {(['today', 'week', 'month'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      'relative px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all z-10',
                      viewMode === mode ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                    )}
                  >
                    {viewMode === mode && (
                      <motion.div layoutId="viewModeBg" className="absolute inset-0 bg-white rounded-xl shadow-sm z-[-1]" />
                    )}
                    {mode}
                  </button>
                ))}
              </div>
            </div>
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
              {viewMode === 'today' ? (
                // Hour headers for Today View
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

              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={weekStart.toISOString()}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="w-full"
                >
                  {activeRooms.map((room) => {
                    const roomBookings = filteredBookings.filter(b => getBookingRoomId(b) === room._id);
                    return (
                      <div 
                        key={room._id}
                        className="flex border-b group relative hover:bg-white transition-colors" 
                        style={{ height: ROW_HEIGHT }}
                      >
                         {/* Room label: OCCUPIED STATUS Indicators */}
                         <div className="sticky left-0 z-30 bg-white/95 backdrop-blur-sm border-r flex flex-col justify-center px-4 shrink-0 transition-all group-hover:bg-slate-50 shadow-[6px_0_15px_-5px_rgba(0,0,0,0.06)]" style={{ width: ROOM_COL }}>
                            <div className="flex items-center gap-2 mb-1">
                               <div className={cn("w-2.5 h-2.5 rounded-full ring-2 ring-offset-2", room.status === 'clean' ? 'bg-emerald-500 ring-emerald-100' : 'bg-amber-400 ring-amber-100')} />
                               <div className="text-sm font-black tracking-tighter text-slate-800">Rm {room.roomNumber}</div>
                            </div>
                            <div className="flex items-center justify-between gap-1 overflow-hidden">
                               <div className="text-[9px] font-bold text-slate-400 truncate tracking-tight">{room.roomType}</div>
                               <div className="text-[10px] font-black text-primary/80">₹{room.price}</div>
                            </div>
                            {getRoomOccupancy(room._id) && (
                               <div className="mt-1.5 flex items-center gap-1">
                                  <div className="px-1.5 py-0.5 rounded-sm bg-blue-100/80 text-blue-700 text-[7px] font-black uppercase tracking-tighter border border-blue-200">BUSY NOW</div>
                               </div>
                            )}
                         </div>

                         {/* Grid cells */}
                         {viewMode === 'today' && (
                           <div className="absolute top-0 bottom-0 bg-red-500/20 w-0.5 z-20 pointer-events-none" style={{ left: ROOM_COL + currentTimePos }}>
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
                                 const day = startOfDay(item).getTime();
                                 return day >= bS && day < bE;
                               }
                             });

                             const isDayBooked = !!bookingAtCell;
                             const isBookingHovered = bookingAtCell && hoveredBookingId === bookingAtCell._id;
                             const isBookingSelected = bookingAtCell && selectedBooking?._id === bookingAtCell._id;
                             const isActive = isBookingHovered || isBookingSelected;

                             const nextDay = timeline[idx + 1];
                             const isNextInSameBooking = nextDay && bookingAtCell && (() => {
                                const endDt = parseISO(`${bookingAtCell.checkout}T${bookingAtCell.checkoutTime || '11:00'}:00`);
                                return nextDay.getTime() < endDt.getTime();
                             })();

                             return (
                               <div key={item.toISOString()}
                                 className={cn(
                                   "transition-all duration-150 flex-shrink-0 relative z-10",
                                   !isNextInSameBooking && "border-r",
                                   viewMode !== 'today' && isSameDay(item, new Date()) && "bg-primary/[0.04] z-10",
                                   isDayBooked ? (isActive ? "bg-slate-200/50 cursor-pointer" : "bg-slate-50/10 cursor-pointer hover:bg-slate-100/50") : 
                                   (dragTarget && dragTarget.roomId === room._id && isSameDay(dragTarget.date, item) ? "bg-primary/20 ring-2 ring-primary/40 ring-inset z-20" : 
                                   (item < startOfDay(new Date()) ? "bg-slate-50/40 cursor-not-allowed" : "cursor-pointer hover:bg-primary/[0.04]"))
                                 )}
                                 style={{ width: COLUMN_WIDTH }}
                                 onMouseEnter={() => isDayBooked && setHoveredBookingId(bookingAtCell._id)}
                                 onMouseLeave={() => setHoveredBookingId(null)}
                                 onClick={() => handleCellClick(room._id, item)}
                               />
                             );
                           })}

                           {/* Booking cards overlay for this room */}
                           {(() => {
                               const isExpiredEnquiry = (b: Booking) =>
                                 (b.reservationType || b.bookingType) === 'enquiry' &&
                                 !!b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date();

                               const activeBookings = roomBookings.filter(b => b.status !== 'cancelled' && !isExpiredEnquiry(b));
                               const cancelledBookings = roomBookings.filter(b => b.status === 'cancelled');
                               const expiredEnquiries = roomBookings.filter(b => isExpiredEnquiry(b));
                               const statusPriority: Record<string, number> = { 'checked-in': 5, 'confirmed': 4, 'reserved': 3, 'checked-out': 2 };

                               const sorted = [...activeBookings].sort((a, b) => {
                                 const pA = statusPriority[a.status] || 0;
                                 const pB = statusPriority[b.status] || 0;
                                 if (pA !== pB) return pB - pA;
                                 const durA = differenceInDays(parseISO(a.checkout), parseISO(a.checkin));
                                 const durB = differenceInDays(parseISO(b.checkout), parseISO(b.checkin));
                                 if (durA !== durB) return durB - durA;
                                 return parseISO(a.checkin).getTime() - parseISO(b.checkin).getTime();
                               });

                               const visibleCards: { primary: Booking, others: Booking[] }[] = [];
                               sorted.forEach(b => {
                                 const bS = parseISO(b.checkin);
                                 const bE = parseISO(b.checkout);
                                 const group = visibleCards.find(g => [g.primary, ...g.others].some(m => bS < parseISO(m.checkout) && bE > parseISO(m.checkin)));
                                 if (group) group.others.push(b); else visibleCards.push({ primary: b, others: [] });
                               });

                                // Track cancelled bookings by checkin day for badge rendering
                                const cancelledByDay: Record<string, Booking[]> = {};
                                cancelledBookings.forEach(b => {
                                   const key = startOfDay(parseISO(b.checkin)).toISOString();
                                   if (!cancelledByDay[key]) cancelledByDay[key] = [];
                                   cancelledByDay[key].push(b);
                                });

                               // Track expired enquiries by checkin day for badge rendering
                               const expiredByDay: Record<string, Booking[]> = {};
                               expiredEnquiries.forEach(b => {
                                  const key = startOfDay(parseISO(b.checkin)).toISOString();
                                  if (!expiredByDay[key]) expiredByDay[key] = [];
                                  expiredByDay[key].push(b);
                               });

                              const cardsJsx = visibleCards.map(({ primary: booking, others }) => {
                                const isDayUse = booking.checkin === booking.checkout;
                                
                                const calculateLayout = () => {
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
                                    const pE  = addDays(wS, DAYS);
                                    
                                    if (bCO <= wS || bCI >= pE) return null;

                                    const visibleCI = bCI < wS ? wS : bCI;
                                    const visibleCO = bCO > pE ? pE : bCO;
                                    
                                    const startOffset = differenceInDays(visibleCI, wS);
                                    const visibleDuration = Math.max(0, differenceInDays(visibleCO, visibleCI));
                                    
                                    return { 
                                       left: startOffset * COLUMN_WIDTH + (visibleCI > bCI ? 0 : 1), 
                                       width: Math.max(COLUMN_WIDTH - 2, (visibleDuration * COLUMN_WIDTH) - (visibleCI > bCI ? 0 : 1) - (visibleCO < bCO ? 0 : 1))
                                    };
                                  }
                                };

                                const layout = calculateLayout();
                                if (!layout) return null;

                                const isHovered = hoveredBookingId === booking._id;
                                const isSelected = selectedBooking?._id === booking._id;
                                const isSolid = ['checked-in', 'reserved', 'confirmed'].includes(booking.status);
                                const isEnquiry = (booking.reservationType || booking.bookingType) === 'enquiry';
                                const isBlock = (booking.reservationType || booking.bookingType) === 'block';
                                const isExpired = isEnquiry && booking.enquiryExpiresAt && new Date(booking.enquiryExpiresAt) < new Date();
                                const isWalkin = booking.bookingSource?.toLowerCase().includes('walk');
                                const isEditable = booking.status !== 'checked-out' && booking.status !== 'cancelled';

                                return (
                                  <motion.div
                                    key={booking._id}
                                    data-booking-card={booking._id}
                                    layoutId={booking._id}
                                    className={cn(
                                       "absolute rounded-xl flex flex-col justify-center transition-all duration-200 group/card cursor-pointer md:cursor-grab active:cursor-grabbing",
                                       isExpired 
                                         ? "top-[25%] bottom-[25%] opacity-60 hover:opacity-100 z-10" 
                                         : "top-[6px] bottom-[6px] border-2",
                                       getStatusColor(booking.status, booking.bookingType, booking.reservationType, !!isExpired),
                                       (isHovered || isSelected) ? "z-30 opacity-100 ring-2 ring-white/50 shadow-2xl scale-[1.01]" : (!isExpired ? "z-10" : ""),
                                       isSelected && "ring-primary/40 ring-4"
                                    )}
                                    style={{ 
                                      left: layout.left, 
                                      width: isExpired ? 80 : layout.width, 
                                      touchAction: 'none' 
                                    }}
                                    onPointerDown={(e) => handleCardDragStart(e, booking)}
                                    onMouseEnter={() => setHoveredBookingId(booking._id)}
                                    onMouseLeave={() => setHoveredBookingId(null)}
                                  >
                                    <div className={cn("p-1.5 h-full flex items-center justify-between min-w-0 overflow-hidden", isExpired && "opacity-80")}>
                                      {isExpired ? (
                                        <div className="flex items-center gap-1.5 w-full">
                                          <div className="text-[9px] font-bold uppercase tracking-tighter truncate flex-1">
                                            {getGuest(booking)?.name || 'EXP'}
                                          </div>
                                          <div className="shrink-0 bg-red-100 text-red-600 border border-red-200 px-1 py-0.5 rounded text-[6px] font-black uppercase">EXP</div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col justify-between h-full w-full">
                                          <div className="flex items-start justify-between gap-1 overflow-visible">
                                            <div className="min-w-0 flex-1">
                                              <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-tighter truncate leading-none mb-0.5">
                                                {getGuest(booking)?.name || 'ROOM BLOCKED'}
                                              </div>
                                              {(booking.adults || booking.children) && !isBlock && (
                                                <div className={cn("text-[8px] font-bold opacity-70 flex items-center gap-1", isSolid ? "text-white" : "text-slate-500")}>
                                                  <Users className="h-2 w-2" /> {booking.adults || 0}A {booking.children > 0 && `• ${booking.children}C`}
                                                </div>
                                              )}
                                            </div>

                                            {/* Others Indicator */}
                                            {others.length > 0 ? (
                                              <div className="z-10 shrink-0 pointer-events-auto" onClick={e => e.stopPropagation()}>
                                                <Popover>
                                                  <PopoverTrigger asChild>
                                                    <button className={cn(
                                                      "px-1.5 py-0.5 rounded-md font-bold shadow-sm transition-all active:scale-95 text-[8px]",
                                                      isSolid
                                                        ? "bg-white/20 hover:bg-white/30 text-white border border-white/20"
                                                        : "bg-slate-100 ring-1 ring-slate-200 text-slate-500 hover:bg-slate-200"
                                                    )}>
                                                      +{others.length}
                                                    </button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-64 p-2 rounded-xl shadow-xl border z-40">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 p-2 border-b">Others {others.length}</p>
                                                    <div className="space-y-1 mt-1">
                                                      {others.map(o => (
                                                        <button key={o._id} className="w-full p-2.5 hover:bg-slate-50 rounded-xl text-left flex items-center justify-between group/o" onClick={() => setSelectedBooking(o)}>
                                                          <span className="text-[10px] font-black text-slate-900">{getGuest(o)?.name || 'Guest'}</span>
                                                          <div className={cn("w-2 h-2 rounded-full", getStatusColor(o.status, o.bookingType, o.reservationType))} />
                                                        </button>
                                                      ))}
                                                    </div>
                                                  </PopoverContent>
                                                </Popover>
                                              </div>
                                            ) : (isEnquiry || isBlock) && booking.enquiryExpiresAt ? (
                                              <div className={cn("shrink-0 flex justify-center items-center h-4 border px-1 rounded text-[8px] font-bold shadow-sm", isExpired ? "bg-red-500 text-white border-red-600" : "bg-amber-100 border-amber-200 text-amber-700")}>
                                                {isExpired ? "EXPIRED" : `⏱ ${formatCountdown(booking.enquiryExpiresAt)}`}
                                              </div>
                                            ) : isDayUse ? (
                                              <div className="shrink-0 bg-white border border-slate-200 shadow-sm text-slate-800 font-black text-[7px] md:text-[8px] uppercase tracking-tighter px-1.5 py-0.5 rounded-sm">DAY USE</div>
                                            ) : null}
                                          </div>

                                          {/* Bottom Row */}
                                          <div className="flex items-end justify-between gap-1 mt-1">
                                            <div className="flex gap-1 items-center min-w-0">
                                              {isEnquiry && <div className="px-1 py-0.5 rounded bg-amber-400 text-[6px] font-black text-white uppercase tracking-widest">Enquiry</div>}
                                              {isBlock && <div className="px-1 py-0.5 rounded bg-slate-900 text-[6px] font-black text-white uppercase tracking-widest">Blocked</div>}
                                            </div>
                                            {!isBlock && !isEnquiry && (
                                              <div className="shrink-0 rounded-md bg-white/20 p-[2px] w-4 h-4 flex items-center justify-center text-white border border-white/10 forced-colors:hidden">
                                                {isWalkin ? <User className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Resize handle */}
                                    {isEditable && (
                                      <div 
                                        data-resize-handle 
                                        onPointerDown={(e) => handleResizeDragStart(e, booking, room)}
                                        className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center group-hover/card:opacity-100 opacity-0 transition-opacity"
                                      >
                                        <div className="h-5 w-1 rounded-full bg-white/40" />
                                      </div>
                                    )}
                                  </motion.div>
                                );
                              });

                               // Unified badge rendering: per column, show can/exp tags at bottom side by side
                               const allDayKeys = new Set([...Object.keys(cancelledByDay), ...Object.keys(expiredByDay)]);
                               const badgesJsx = Array.from(allDayKeys).map(iso => {
                                 const dD = new Date(iso);
                                 const off = differenceInDays(startOfDay(dD), startOfDay(weekStart));
                                 if (off < 0 || off >= DAYS) return null;
                                 const canList = cancelledByDay[iso] || [];
                                 const expList = expiredByDay[iso] || [];
                                 const totalCount = canList.length + expList.length;
                                 return (
                                   <div key={`badges-${iso}`} className="absolute top-1.5 z-40 flex items-center gap-0.5 justify-end px-1" style={{ left: off * COLUMN_WIDTH, width: COLUMN_WIDTH }}>
                                     {totalCount === 1 ? (
                                       expList.length === 1 ? (
                                         <button
                                           title="View expired hold details"
                                           className="bg-red-50 ring-1 ring-red-200 text-red-500 text-[8px] px-1.5 py-0.5 rounded-md font-bold shadow-sm hover:bg-red-100 hover:ring-red-300 transition-all active:scale-95 whitespace-nowrap"
                                           onClick={(e) => { e.stopPropagation(); setSelectedBooking(expList[0]); }}
                                         >exp</button>
                                       ) : (
                                         <Popover>
                                           <PopoverTrigger asChild>
                                             <button
                                               className="bg-slate-100 ring-1 ring-slate-200 text-slate-500 text-[8px] px-1.5 py-0.5 rounded-md font-bold shadow-sm hover:bg-slate-200 transition-colors whitespace-nowrap"
                                               onClick={e => e.stopPropagation()}
                                             >can</button>
                                           </PopoverTrigger>
                                           <PopoverContent className="w-56 p-2 rounded-xl z-[400] shadow-2xl border-none">
                                             <p className="text-[9px] font-black text-slate-400 p-2 border-b uppercase tracking-widest">Cancelled</p>
                                             <div className="mt-1 space-y-0.5">
                                               {canList.map(o => (
                                                 <div key={o._id} className="w-full p-2 rounded-lg flex justify-between items-center text-left">
                                                   <div className="flex flex-col gap-0.5 min-w-0">
                                                     <span className="text-[10px] font-bold line-through text-slate-400 truncate">{getGuest(o)?.name || 'Guest'}</span>
                                                     <span className="text-[8px] text-slate-300">{o.checkin} – {o.checkout}</span>
                                                   </div>
                                                   <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                                                 </div>
                                               ))}
                                             </div>
                                           </PopoverContent>
                                         </Popover>
                                       )
                                     ) : (
                                       <Popover>
                                         <PopoverTrigger asChild>
                                           <button
                                             title="View multiple notifications"
                                             className="bg-slate-100 ring-1 ring-slate-200 text-slate-600 text-[8px] px-1.5 py-0.5 rounded-md font-bold shadow-sm hover:bg-slate-200 transition-all active:scale-95 whitespace-nowrap"
                                             onClick={e => e.stopPropagation()}
                                           >
                                             +{totalCount} alerts
                                           </button>
                                         </PopoverTrigger>
                                         <PopoverContent className="w-64 p-2 rounded-xl z-[400] shadow-2xl border-none">
                                           <p className="text-[9px] font-black text-slate-400 p-2 border-b uppercase tracking-widest">Day Alerts · {totalCount}</p>
                                           <div className="mt-1 space-y-0.5 max-h-[300px] overflow-y-auto pr-1">
                                             {expList.map(o => (
                                               <button key={o._id} className="w-full p-2 hover:bg-red-50/50 rounded-lg text-left flex justify-between items-center group/exp" onClick={() => setSelectedBooking(o)}>
                                                 <div className="flex flex-col gap-0.5 min-w-0">
                                                   <span className="text-[10px] font-bold text-red-500 truncate">{getGuest(o)?.name || 'Guest'}</span>
                                                   <span className="text-[8px] text-slate-400">Hold Expired • {o.checkin}</span>
                                                 </div>
                                                 <div className="text-[7px] font-black text-red-400 bg-red-100/50 px-1 rounded uppercase group-hover/exp:bg-red-200 transition-colors">exp</div>
                                               </button>
                                             ))}
                                             {canList.map(o => (
                                               <div key={o._id} className="w-full p-2 rounded-lg flex justify-between items-center text-left">
                                                 <div className="flex flex-col gap-0.5 min-w-0">
                                                   <span className="text-[10px] font-bold text-slate-500 truncate line-through opacity-60">{getGuest(o)?.name || 'Guest'}</span>
                                                   <span className="text-[8px] text-slate-400">Cancelled • {o.checkin}</span>
                                                 </div>
                                                 <div className="text-[7px] font-black text-slate-400 bg-slate-100 px-1 rounded uppercase">can</div>
                                               </div>
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
            {/* Bottom spacer */}
            <div className="h-8 w-full pointer-events-none" />
          </div>
        </div>
      </div>

      <BookingModal isOpen={isModalOpen || !!editingBooking} onClose={() => { setIsModalOpen(false); setEditingBooking(null); }}
        selectedRoomId={selectedRoomId} selectedDate={selectedDate} initialBooking={editingBooking || undefined} />
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
