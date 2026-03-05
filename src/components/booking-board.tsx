import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  format, addDays, eachDayOfInterval, isSameDay,
  differenceInDays, startOfDay, parseISO, addHours
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Search, ChevronLeft, ChevronRight, ChevronDown, Bed, X, ShieldCheck, ArrowRight, Lock } from 'lucide-react';
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
  { key: 'cancelled', label: 'Cancelled', color: 'bg-slate-400' },
] as const;

const getStatusColor = (status: string, bookingType?: string) => {
  if (bookingType === 'enquiry') return 'bg-amber-400/80 hover:bg-amber-500/80 shadow-amber-400/20 border-dashed border-amber-500';
  if (bookingType === 'block')   return 'bg-slate-400/70 hover:bg-slate-500/70 shadow-slate-400/20';
  switch (status) {
    case 'checked-in':  return 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20';
    case 'reserved':
    case 'confirmed':   return 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20';
    case 'checked-out': return 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20';
    case 'cancelled':   return 'bg-slate-400 hover:bg-slate-500 shadow-slate-400/20';
    default:            return 'bg-gray-400';
  }
};

// Format a remaining-time countdown string from an ISO expiry timestamp
const formatCountdown = (expiresAt: string): string => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
      // We don't necessarily need to call refreshBookings() every minute unless
      // the backend actually changes the status. But for UI countdowns, a re-render is enough.
      // If any enquiry has expired, we might want to refresh from server.
      const hasExpired = bookings.some(b => 
        (b.bookingType === 'enquiry' || b.bookingType === 'block') && 
        b.enquiryExpiresAt && new Date(b.enquiryExpiresAt) < new Date()
      );
      if (hasExpired) refreshBookings();
    }, 60000);
    return () => clearInterval(timer);
  }, [bookings, refreshBookings]);

  const DAYS = viewMode === 'month' ? 30 : viewMode === 'today' ? 1 : 7;
  const ROOM_COL = isMobile ? 80 : 160;
  
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  // Column width calculations based on view mode
  const COLUMN_WIDTH = useMemo(() => {
    if (viewMode === 'today') return Math.max(80, (boardWidth - ROOM_COL) / 12); // Show 12h at once roughly
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

  // ── Pointer-based drag (long-press on touch) ─────────────────
  const handleCardDragStart = (e: React.PointerEvent<HTMLDivElement>, booking: Booking) => {
    const isEditable = booking.status !== 'checked-out' && booking.status !== 'cancelled';
    if (!isEditable) return;
    if (isResizingRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) return;

    const cardEl   = e.currentTarget as HTMLDivElement;
    const isTouch  = e.pointerType === 'touch' || e.pointerType === 'pen';
    const LONG_MS  = isTouch ? 380 : 150;

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

    let dragging         = false;
    let longPressReady   = false;
    let cancelled        = false;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let weekSwapTimer: ReturnType<typeof setTimeout> | null = null;

    let weekShiftRefX = 0; // Local ref tracker for coordinate shift

    if (!isTouch) {
      try { cardEl.setPointerCapture(e.pointerId); } catch { /* ignore capture error */ }
    }

     const activateDrag = () => {
       if (cancelled) return;
       longPressReady = true;
       isDraggingRef.current = true;
      try { cardEl.setPointerCapture(e.pointerId); } catch { /* ignore capture error */ }
      try { (navigator as Navigator & { vibrate?: (pattern: number[]) => void }).vibrate?.([12, 40, 12]); } catch { /* ignore vibrate error */ }
       
       cardEl.style.opacity    = '0.9';
       cardEl.style.zIndex     = '500';
       cardEl.style.transition = 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.15s ease';
       cardEl.style.transform  = 'scale(1.04) translateY(-2px)';
       cardEl.style.boxShadow  = '0 20px 40px rgba(0,0,0,0.3)';
       cardEl.style.outline = '2px solid white';
       cardEl.style.outlineOffset = '-2px';
       
       setTimeout(() => {
         if (!cancelled) cardEl.style.transition = 'none';
       }, 130);
     };

     longPressTimer = setTimeout(activateDrag, LONG_MS);

     const updateTransform = (meX: number, meY: number) => {
       const dx_view = meX - startX;
       const dy_view = meY - startY;
       const scrollDeltaL = (boardRef.current?.scrollLeft || 0) - initialScrollL;
       const scrollDeltaT = (boardRef.current?.scrollTop || 0) - initialScrollT;
       
       // Vertical clamping within room lanes
       const rect = boardContentRef.current?.getBoundingClientRect();
       let finalDY = dy_view + scrollDeltaT;
       
       if (rect) {
          const boardTop = rect.top + 48;
          const boardBottom = rect.top + 48 + (activeRooms.length * ROW_HEIGHT);
          const cardRect = cardEl.getBoundingClientRect();
          const cardH = cardRect.height;
          
          const currentT = (startY + (dy_view + scrollDeltaT)) - (startY - cardRect.top);
          const currentB = currentT + cardH;

          if (currentT < boardTop) finalDY -= (currentT - boardTop);
          else if (currentB > boardBottom) finalDY -= (currentB - boardBottom);
       }

       cardEl.style.transform = `translate(${dx_view + scrollDeltaL - weekShiftRefX}px, ${finalDY}px)${isTouch && !dragging ? ' scale(1.04)' : ''}`;
     };

     const onMove = (me: PointerEvent) => {
        const dist = Math.abs(me.clientX - startX) + Math.abs(me.clientY - startY);

        if (!longPressReady && dist > (isTouch ? 35 : 15)) {
          cancelled = true;
          if (longPressTimer) clearTimeout(longPressTimer);
        }

        if (dragging || longPressReady) {
          if (!dragging) {
            dragging = true;
            isDraggingRef.current = true;
          }
          
          updateTransform(me.clientX, me.clientY);

          if (boardRef.current) {
            const rect = boardRef.current.getBoundingClientRect();
            const edgeSize = isMobile ? 60 : 45;
            
            let scrollDY = 0;
            if (me.clientY < rect.top + edgeSize) scrollDY = -((rect.top + edgeSize) - me.clientY) * 0.8;
            else if (me.clientY > rect.bottom - edgeSize) scrollDY = (me.clientY - (rect.bottom - edgeSize)) * 0.8;
            
            if (scrollDY !== 0) {
              boardRef.current.scrollTop += scrollDY;
              updateTransform(me.clientX, me.clientY);
            }

            // WEEK SWAP dwell detection
            const atRight = me.clientX > rect.right - edgeSize;
            const atLeft  = me.clientX < rect.left + edgeSize + ROOM_COL;
            
            if ((atRight || atLeft) && !weekSwapTimer) {
              weekSwapTimer = setTimeout(() => {
                const direction = atRight ? 7 : -7;
                weekShiftRefX += (direction > 0 ? 1 : -1) * (7 * COLUMN_WIDTH);
                setWeekStart(p => addDays(p, direction));
                weekSwapTimer = null;
              }, 600);
            } else if (!atRight && !atLeft && weekSwapTimer) {
              clearTimeout(weekSwapTimer);
              weekSwapTimer = null;
            }
          }
        }
      };

    const onUp = (ue: PointerEvent) => {
       const dist = Math.abs(ue.clientX - startX) + Math.abs(ue.clientY - startY);
       const wasDragging = dragging;
       cleanup();
       if (wasDragging && dist > 10) {
         handleDragEnd(ue, { point: { x: ue.clientX, y: ue.clientY } }, booking);
       } else if (!wasDragging && dist < 10) {
         setSelectedBooking(booking);
       }
    };

    const cleanup = () => {
      try { cardEl.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
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
        className="flex flex-col bg-background border rounded-[24px] overflow-hidden shadow-sm h-full w-full max-w-full"
        style={{ minHeight: isMobile ? 420 : 480 }}
      >


        {/* ── Header ── */}
        <div className="flex flex-col gap-3 p-4 border-b bg-card/40 backdrop-blur-md">
          {/* Top Row: Navigation & View Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
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

            {/* View Toggle Pill */}
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
                        <div 
                           className="bg-white border-r flex flex-col justify-center flex-shrink-0 sticky left-0 z-20 shadow-[6px_0_15px_-5px_rgba(0,0,0,0.06)]"
                           style={{ width: ROOM_COL, minWidth: ROOM_COL, padding: '12px 14px' }}
                        >
                           {(() => {
                              const isOccupied = getRoomOccupancy(room._id);
                              return (
                                 <div className="space-y-1.5">
                                    <div className="flex items-center justify-between w-full">
                                       <div className="flex items-center gap-1.5">
                                          <span className="font-black text-slate-800 text-[13px] tracking-tighter">#{room.roomNumber}</span>
                                          {isOccupied && <Bed className="h-3 w-3 text-blue-500 fill-blue-50" />}
                                       </div>
                                       <div className={cn(
                                          "flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-tight",
                                          isOccupied ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-slate-50 border-slate-200 text-slate-400"
                                       )}>
                                          <div className={cn("w-1 h-1 rounded-full", isOccupied ? "bg-blue-500" : "bg-slate-300")} />
                                          {isOccupied ? 'Occupied' : 'Vacant'}
                                       </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 text-[9px] font-bold">
                                       <span className={cn(
                                          "w-1.5 h-1.5 rounded-full",
                                          room.status === 'clean' ? 'bg-emerald-500' : room.status === 'dirty' ? 'bg-amber-400' : 'bg-red-500'
                                       )} />
                                       <span className="text-slate-500 capitalize">{room.status}</span>
                                       <span className="text-slate-300 mx-0.5">|</span>
                                       <span className="text-slate-500 truncate w-16">{room.roomType}</span>
                                    </div>
                                    
                                    <div className="text-[10px] font-black text-primary">₹{room.price}</div>
                                 </div>
                              );
                           })()}
                        </div>

                        {/* Grid cells */}
                        {viewMode === 'today' && <div className="absolute top-0 bottom-0 bg-red-500/10 w-px z-40 pointer-events-none" style={{ left: ROOM_COL + currentTimePos }}><div className="bg-red-500 text-[8px] text-white px-1 rounded-sm absolute -top-1 -translate-x-1/2">Now</div></div>}
                        {timeline.map((item: Date) => {
                          const isDayBooked = viewMode !== 'today' && roomBookings.some(b => {
                            const start = startOfDay(parseISO(b.checkin));
                            const end   = startOfDay(parseISO(b.checkout));
                            return item >= start && item < end && b.status !== 'cancelled' && b.status !== 'checked-out';
                          });
                          return (
                            <div key={item.toISOString()}
                              className={cn(
                                "border-r transition-colors flex-shrink-0 relative z-10",
                                viewMode !== 'today' && isSameDay(item, new Date()) && "bg-primary/[0.02]",
                                isDayBooked ? "bg-slate-50/10 cursor-not-allowed" : "cursor-pointer hover:bg-primary/[0.04]"
                              )}
                              style={{ width: COLUMN_WIDTH }}
                              onClick={() => {
                                if (viewMode === 'today') {
                                  setSelectedRoomId(room._id);
                                  setSelectedDate(format(weekStart, 'yyyy-MM-dd'));
                                  setIsModalOpen(true);
                                } else if (!isDayBooked) handleCellClick(room._id, item);
                              }}
                            />
                          );
                        })}

                        {/* Booking cards overlay */}
                        {(() => {
                           const activeBookings = roomBookings.filter(b => b.status !== 'cancelled');
                           const cancelledBookings = roomBookings.filter(b => b.status === 'cancelled');
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

                           const cancelledByDay: Record<string, number> = {};
                           cancelledBookings.forEach(b => {
                              const cIn = startOfDay(parseISO(b.checkin));
                              const cOut = startOfDay(parseISO(b.checkout));
                  timeline.forEach(d => { if (d >= cIn && d < cOut) cancelledByDay[d.toISOString()] = (cancelledByDay[d.toISOString()] || 0) + 1; });
                           });

                           const heightTotal = ROW_HEIGHT - 12;

                            const getDayFraction = (t?: string) => {
                              if (!t) return 0;
                              const [h, m] = t.split(':').map(Number);
                              return (h + (m || 0) / 60) / 24;
                            };

                            const cardsJsx = visibleCards.map(({ primary: booking, others }) => {
                              const cIn = startOfDay(parseISO(booking.checkin));
                              const cOut = startOfDay(parseISO(booking.checkout));
                              const wS = startOfDay(weekStart);
                              const pE = addDays(wS, DAYS);
                              if (cOut < wS || cIn >= pE) return null;

                              const isDayUse = booking.checkin === booking.checkout;
                              // Position calculation helper
                              const calculateLayout = () => {
                                const bCI = parseISO(booking.checkin);
                                const bCO = parseISO(booking.checkout);
                                
                                if (viewMode === 'today') {
                                  // ONLY SHOW if booking overlaps with today
                                  const todayStart = startOfDay(weekStart);
                                  const todayEnd = addDays(todayStart, 1);
                                  const startDT = parseISO(`${booking.checkin}T${booking.checkinTime || '14:00'}:00`);
                                  const endDT = parseISO(`${booking.checkout}T${booking.checkoutTime || '11:00'}:00`);
                                  
                                  if (endDT < todayStart || startDT >= todayEnd) return null;
                                  
                                  const ciHours = Math.max(0, (startDT.getTime() - todayStart.getTime()) / 3600000);
                                  const coHours = Math.min(24, (endDT.getTime() - todayStart.getTime()) / 3600000);
                                  const dur = coHours - ciHours;
                                  
                                  return { 
                                    left: ROOM_COL + (ciHours * COLUMN_WIDTH),
                                    width: Math.max(20, dur * COLUMN_WIDTH)
                                  };
                                } else {
                                  const wS = startOfDay(weekStart);
                                  const pE = addDays(wS, DAYS);
                                  if (bCO < wS || bCI >= pE) return null;

                                  const ciF = getDayFraction(booking.checkinTime);
                                  const coF = getDayFraction(booking.checkoutTime);
                                  const osRaw = differenceInDays(startOfDay(bCI), wS) + ciF;
                                  const durRaw = differenceInDays(startOfDay(bCO), startOfDay(bCI)) + (coF - ciF);
                                  const cOs = Math.max(0, osRaw);
                                  const cDur = Math.min(osRaw + durRaw, DAYS) - cOs;
                                  
                                  return {
                                    left: ROOM_COL + (cOs * COLUMN_WIDTH) + 1,
                                    width: Math.max(4, (cDur * COLUMN_WIDTH) - 2)
                                  };
                                }
                              };

                              const layout = calculateLayout();
                              if (!layout) return null;

                              const isMonth = viewMode === 'month';
                              const guest = getGuest(booking);
                              const isBlock = booking.bookingType === 'block';
                              const isEnquiry = booking.bookingType === 'enquiry';
                              const isEditable = !isBlock && booking.status !== 'checked-out' && booking.status !== 'cancelled' && !isMonth;

                              return (
                                <motion.div
                                  layout
                                  layoutId={booking._id}
                                  key={booking._id}
                                  data-booking-card=""
                                  className={cn(
                                    'absolute overflow-hidden shadow-sm group/card border transition-all duration-300',
                                    getStatusColor(booking.status, booking.bookingType),
                                    isMonth ? 'rounded-md opacity-90' : 'rounded-[12px]',
                                    isBlock ? 'border-2 border-dashed border-slate-500/40' : '',
                                    isEnquiry ? 'border-2 border-dashed border-amber-500/60' : '',
                                    isEditable ? 'hover:shadow-md hover:z-20' : 'opacity-80',
                                    booking.groupId && hoveredGroupId === booking.groupId ? 'ring-2 ring-primary ring-offset-1 z-30 scale-[1.02] shadow-xl' : '',
                                    hoveredGroupId && booking.groupId !== hoveredGroupId ? 'opacity-30 grayscale-[0.5]' : ''
                                  )}
                                  style={{ 
                                    left: layout.left, 
                                    top: isMonth ? 10 : 6, 
                                    width: layout.width, 
                                    height: isMonth ? ROW_HEIGHT - 20 : heightTotal, 
                                    zIndex: booking.status === 'checked-in' ? 14 : (booking.groupId && hoveredGroupId === booking.groupId ? 40 : 12), 
                                    cursor: isEditable ? 'grab' : 'pointer'
                                  }}
                                  onMouseEnter={() => booking.isGroup && booking.groupId && setHoveredGroupId(booking.groupId)}
                                  onMouseLeave={() => setHoveredGroupId(null)}
                                  onPointerDown={isEditable ? (e) => handleCardDragStart(e, booking) : undefined}
                                  onClick={() => { if (!isDraggingRef.current && !isResizingRef.current) setSelectedBooking(booking); }}
                                >
                                  {!isMonth && (
                                    <div className="flex flex-col h-full justify-between p-1.5 md:p-2 text-white">
                                      <div className="flex justify-between items-start gap-1">
                                         <div className="flex flex-col min-w-0">
                                            {isBlock ? (
                                              <div className="flex items-center gap-1">
                                                <Lock className="h-2.5 w-2.5 opacity-80" />
                                                <span className="font-bold leading-tight text-[8px] md:text-[9px] opacity-90 truncate">{booking.blockReason || 'Blocked'}</span>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-1.5">
                                                {booking.isGroup && <span className="text-[10px]" title={`Group: ${booking.groupName}`}>🔗</span>}
                                                <button className="font-black truncate text-left hover:underline leading-tight text-[10px] md:text-[11px]" onClick={e => { e.stopPropagation(); if (guest?._id) setSelectedGuestId(guest._id); else setSelectedBooking(booking); }}>
                                                  {guest?.name || 'Guest'}
                                                </button>
                                              </div>
                                            )}
                                         </div>
                                         {others.length > 0 && (
                                           <div className="z-20 ml-auto" onClick={e => e.stopPropagation()}>
                                             <Popover>
                                               <PopoverTrigger asChild>
                                                 <button className="bg-white/30 hover:bg-white/40 text-[8px] md:text-[9px] px-1.5 py-0.5 rounded-md font-bold shadow-sm active:scale-95">+{others.length}</button>
                                               </PopoverTrigger>
                                               <PopoverContent className="w-64 p-2 rounded-xl shadow-xl border z-[300]">
                                                 <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 p-2 border-b">Others {others.length}</p>
                                                 <div className="space-y-1 mt-1">
                                                   {others.map(o => (
                                                     <button key={o._id} className="w-full p-2 hover:bg-slate-50 rounded-lg text-left flex items-center justify-between group/o" onClick={() => setSelectedBooking(o)}>
                                                       <span className="text-[10px] font-bold text-slate-900">{getGuest(o)?.name || 'Guest'}</span>
                                                       <div className={cn("w-2 h-2 rounded-full", o.status === 'reserved' ? 'bg-emerald-500' : 'bg-blue-500')} />
                                                     </button>
                                                   ))}
                                                 </div>
                                               </PopoverContent>
                                             </Popover>
                                           </div>
                                         )}
                                      </div>
                                      <div className="flex items-end justify-between gap-1">
                                        {isEnquiry && booking.enquiryExpiresAt ? (
                                          <span className="text-[7px] md:text-[8px] bg-amber-900/30 px-1.5 py-0.5 rounded-sm font-black w-fit border border-amber-200/20">
                                            ⏱ {formatCountdown(booking.enquiryExpiresAt)}
                                          </span>
                                        ) : isDayUse ? (
                                          <span className="text-[6px] md:text-[7px] bg-white/20 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Day Use</span>
                                        ) : (
                                          <span className="text-[7px] md:text-[8px] bg-black/10 px-1 py-0.5 rounded-sm font-semibold capitalize tracking-wide w-fit border border-white/10 opacity-70">
                                            {viewMode === 'today' ? `${booking.checkinTime} - ${booking.checkoutTime}` : (isBlock ? 'Blocked' : booking.status)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {isEditable && (
                                    <div className={cn("absolute right-0 top-0 bottom-0 cursor-ew-resize z-50 flex items-center justify-center w-3 opacity-0 group-hover/card:opacity-100 hover:bg-black/5")} onPointerDown={e => handleResizeDragStart(e, booking, room)}>
                                      <div className="h-4 w-1 rounded-full bg-white/60" />
                                    </div>
                                  )}
                                </motion.div>
                              );
                            });

                           const badgesJsx = Object.entries(cancelledByDay).map(([iso, count]) => {
                             const dD = new Date(iso);
                             if (visibleCards.some(vc => dD >= parseISO(vc.primary.checkin) && dD < parseISO(vc.primary.checkout))) return null;
                             const off = differenceInDays(startOfDay(dD), startOfDay(weekStart));
                             if (off<0 || off>=DAYS) return null;
                             const cLs = roomBookings.filter(b => b.status === 'cancelled' && dD >= parseISO(b.checkin) && dD < parseISO(b.checkout));
                             return (
                               <div key={`badge-${iso}`} className="absolute top-1.5 z-30" style={{ left: ROOM_COL + off * COLUMN_WIDTH + COLUMN_WIDTH - 24 }}>
                                 <Popover>
                                   <PopoverTrigger asChild>
                                      <button className="bg-slate-100 ring-1 ring-slate-200 text-slate-500 text-[8px] px-1.5 py-0.5 rounded-md font-bold shadow-sm">+{count}</button>
                                   </PopoverTrigger>
                                   <PopoverContent className="w-64 p-2 rounded-xl z-[300]">
                                      <p className="text-[9px] font-bold text-slate-500 p-2 border-b uppercase">Cancelled</p>
                                      {cLs.map(o => (
                                        <button key={o._id} className="w-full p-2 hover:bg-slate-50 rounded-lg text-left flex justify-between items-center" onClick={() => setSelectedBooking(o)}>
                                          <span className="text-[10px] font-bold line-through text-slate-400">{getGuest(o)?.name || 'Guest'}</span>
                                          <div className="w-2 h-2 rounded-full bg-slate-300" />
                                        </button>
                                      ))}
                                   </PopoverContent>
                                 </Popover>
                               </div>
                             );
                           });

                           return [...cardsJsx, ...badgesJsx];
                        })()}
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
