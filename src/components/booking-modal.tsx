import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Sheet, SheetContent, SheetTitle } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useBookings, type Booking, type Guest } from '../context/booking-context';
import { useAuth } from '../context/auth-context';
import { calculateBookingPrice } from '../lib/pricing';
import { differenceInDays, format, addDays, parseISO, startOfDay, addHours } from 'date-fns';
import {
  Loader2, Search, UserPlus, IndianRupee, Info,
  CalendarCheck, Clock, Lock, Users, ArrowLeft, ChevronRight,
  Utensils, Coffee, Sun, Star, Bed, X
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { cn, isExpiredBooking, formatTime } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ──────────────────────────────────────────────────────────────

const ENQUIRY_DURATIONS = [
  { value: '1', label: '1 hour' },
  { value: '2', label: '2 hours' },
  { value: '4', label: '4 hours' },
  { value: '8', label: '8 hours' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '24 hours' },
  { value: 'custom', label: 'Custom' },
];

const PLAN_TYPES = [
  { key: 'EP',     label: 'Room Only',            desc: 'No meals included',                     icon: Bed },
  { key: 'CP',     label: 'Continental Plan',      desc: 'Room + Breakfast',                      icon: Coffee },
  { key: 'MAP',    label: 'Modified American Plan', desc: 'Room + Breakfast + Dinner',             icon: Sun },
  { key: 'AP',     label: 'American Plan',         desc: 'Room + All Meals (B+L+D)',              icon: Utensils },
  { key: 'custom', label: 'Custom Inclusions',     desc: 'Specify your own package',              icon: Star },
];

const PLAN_LABELS = {
  EP: 'Room Only',
  CP: 'Continental Plan',
  MAP: 'Modified American Plan',
  AP: 'American Plan'
};

// Removed TIME_SLOTS, using TimePicker instead

// ─── Helpers ─────────────────────────────────────────────────────────────────
const parseHotelTime = (timeStr: string): string => {
  if (!timeStr) return '12:00';
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  try {
    const [time, period] = timeStr.split(' ');
    const [h, m] = time.split(':').map(Number);
    const hour24 = period?.toUpperCase() === 'PM' && h !== 12 ? h + 12 :
                   period?.toUpperCase() === 'AM' && h === 12 ? 0 : h;
    return `${hour24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  } catch { return '12:00'; }
};

const toISO = (date: string, time: string) => {
  if (!date || !time) return '';
  return `${date}T${time}:00`;
};

const overlaps = (s1: string, e1: string, s2: string, e2: string) =>
  new Date(s1) < new Date(e2) && new Date(e1) > new Date(s2);


// ─── Component ───────────────────────────────────────────────────────────────
interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRoomId?: string;
  selectedDate?: string;
  initialBooking?: Booking;
  isEditingGroup?: boolean;
  asSheet?: boolean;
}

export function BookingModal({ isOpen, onClose, selectedRoomId, selectedDate, initialBooking, isEditingGroup, asSheet }: BookingModalProps) {
  const { rooms, bookings, createBooking, updateBooking, cancelBooking, createGuest, searchGuests, updateGroupMetadata } = useBookings();
  const { hotel } = useAuth();

  // Step management
  type StepType = 'type' | 'dates' | 'room' | 'guest' | 'payment' | 'groupConfig' | 'roomAssignment';
  const [step, setStep] = useState<StepType>('type');
  const [reservationType, setReservationType] = useState<'booking' | 'enquiry' | 'block' | 'group'>('booking');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enquiry/Block expiry
  const [expiryHours, setExpiryHours] = useState('4');
  const [customExpiryHours, setcustomExpiryHours] = useState('6');
  const [blockReason, setBlockReason] = useState('');

  // Date/time state
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const defaultCheckinTime  = parseHotelTime(hotel?.settings?.checkinTimes?.[0]  || '14:00');
  const defaultCheckoutTime = parseHotelTime(hotel?.settings?.checkoutTimes?.[0] || '11:00');

  const [checkinDate,  setCheckinDate]  = useState('');
  const [checkinTime,  setCheckinTime]  = useState(defaultCheckinTime);
  const [checkoutDate, setCheckoutDate] = useState('');
  const [checkoutTime, setCheckoutTime] = useState(defaultCheckoutTime);

  // Room selection
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');

  // Plan
  const [planType, setPlanType] = useState<string>('EP');
  const [planCustomText, setplanCustomText] = useState('');

  // Guest
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState<Guest[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', email: '', nationality: 'Indian', idProof: { idType: 'aadhaar', number: '' } });

  // Payment
  const [bookingSource, setBookingSource] = useState('direct');
  const [specialRequests, setSpecialRequests] = useState('');
  const [advancePayment, setAdvancePayment] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [roomPrice, setRoomPrice] = useState(0);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // Group booking state
  const [groupName, setGroupName] = useState('');
  const [numRooms, setNumRooms] = useState(2);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [groupRoomPrefs, setGroupRoomPrefs] = useState<Record<string, number>>({});
  const [additionalGuests, setAdditionalGuests] = useState<Array<{ name: string; phone: string }>>([]);
  const [roomAssignments, setRoomAssignments] = useState<Record<string, { guestName: string; plan: string; price: number; adults: number; children: number }>>({});
  const [isSingleFolio, setIsSingleFolio] = useState(true);
  const [planMixed, setPlanMixed] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) { setError(null); return; }
    setError(null); // Clear errors on every open
    if (initialBooking) {
      const rm = typeof initialBooking.roomId === 'object' ? initialBooking.roomId : rooms.find(r => r._id === initialBooking.roomId);
      const effectiveType = (isEditingGroup ? 'group' : (initialBooking.reservationType || initialBooking.bookingType || 'booking')) as 'booking' | 'enquiry' | 'block' | 'group';
      setReservationType(effectiveType);
      setCheckinDate(format(parseISO(initialBooking.checkin), 'yyyy-MM-dd'));
      setCheckinTime(initialBooking.checkinTime || defaultCheckinTime);
      setCheckoutDate(format(parseISO(initialBooking.checkout), 'yyyy-MM-dd'));
      setCheckoutTime(initialBooking.checkoutTime || defaultCheckoutTime);
      setSelectedRoom(rm?._id || '');
      setSelectedRoomType(rm?.roomType || '');
      setRoomPrice(initialBooking.roomPrice || rm?.price || 0);
      setPlanType(initialBooking.planType || 'EP');
      setplanCustomText(initialBooking.planCustomText || '');
      setAdults(initialBooking.adults || 2);
      setChildren(initialBooking.children || 0);
      
      if (isEditingGroup && initialBooking.groupId) {
        const groupRooms = bookings
          .filter(b => b.groupId === initialBooking.groupId && b.status !== 'cancelled' && b.status !== 'expired')
          .map(b => (typeof b.roomId === 'object' ? b.roomId._id : b.roomId));
        setSelectedRooms(groupRooms);
        setNumRooms(groupRooms.length);
        setGroupName(initialBooking.groupName || '');
         const groupBookings = bookings.filter(b => b.groupId === initialBooking.groupId && b.status !== 'cancelled' && b.status !== 'expired');
         setNumRooms(groupBookings.length || 1);
        const rIds = groupBookings.map(b => typeof b.roomId === 'object' ? b.roomId._id : b.roomId).filter(Boolean) as string[];
        setSelectedRooms(rIds);
        
        const assignments: Record<string, { guestName: string; plan: string; price: number; adults: number; children: number }> = {};
        groupBookings.forEach(b => {
          const rid = typeof b.roomId === 'object' ? b.roomId._id : b.roomId;
          const gName = typeof b.guestId === 'object' ? b.guestId.name : (bookings.find(bx => bx._id === b._id)?.guestId as any)?.name || 'Lead';
          assignments[rid] = {
            guestName: gName,
            plan: b.planType || 'EP',
            price: b.roomPrice || 0,
            adults: b.adults || adults,
            children: b.children || children
          };
        });
        setRoomAssignments(assignments);
        setStep('groupConfig');
      }
      
      // Intelligent Guest Resolution: if ID is a string, try to find data in other bookings
      if (typeof initialBooking.guestId === 'object') {
        setSelectedGuest(initialBooking.guestId);
      } else if (initialBooking.guestId) {
        const guestData = bookings.find(b => typeof b.guestId === 'object' && (b.guestId as any)._id === initialBooking.guestId)?.guestId;
        setSelectedGuest(guestData as any || null);
      } else {
        setSelectedGuest(null);
      }

      setBookingSource(initialBooking.bookingSource || 'direct');
      let cleanedRequests = initialBooking.specialRequests || '';
      cleanedRequests = cleanedRequests.replace(/GROUP:[^.]*\.\s*/g, '');
      cleanedRequests = cleanedRequests.replace(/Room Guest:[^.]*\.\s*/g, '');
      setSpecialRequests(cleanedRequests.trim());
      setAdvancePayment(initialBooking.advancePayment || 0);
      setBlockReason(initialBooking.blockReason || '');
      if (!(isEditingGroup && initialBooking.groupId)) {
        setStep('dates');
      } else {
        setStep('dates'); // Allow editing dates for groups too
      }
    } else {
      setStep('type');
      setReservationType('booking');
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      setCheckinDate(selectedDate || todayStr);
      setCheckinTime(defaultCheckinTime || '14:00');
      setCheckoutDate(selectedDate ? format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd') : tomorrowStr);
      setCheckoutTime(defaultCheckoutTime || '11:00');
      const preRm = rooms.find(r => r._id === selectedRoomId);
      setSelectedRoom(selectedRoomId || '');
      setSelectedRoomType(preRm?.roomType || '');
      setRoomPrice(preRm?.price || 0);
      setPlanType('EP');
      setplanCustomText('');
      setAdults(2);
      setChildren(0);
      setSelectedGuest(null);
      setGuestQuery('');
      setGuestResults([]);
      setShowNewGuest(false);
      setBookingSource('direct');
      setSpecialRequests('');
      setAdvancePayment(0);
      setPaymentMethod('');
      setBlockReason('');
      setExpiryHours(hotel?.settings?.defaultEnquiryHold ? String(hotel.settings.defaultEnquiryHold / 60) : '4');
      setError(null);
      setGroupName('');
      setNumRooms(2);
      setSelectedRooms([]);
      setGroupRoomPrefs({});
      setAdditionalGuests([]);
      setRoomAssignments({});
      setIsSingleFolio(true);
      setPlanMixed(false);
    }
  }, [isOpen, selectedRoomId, selectedDate, initialBooking, rooms, defaultCheckinTime, defaultCheckoutTime, hotel?.settings?.defaultEnquiryHold]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Availability ─────────────────────────────────────────────────────────
  const checkinISO  = useMemo(() => toISO(checkinDate,  checkinTime), [checkinDate, checkinTime]);
  const checkoutISO = useMemo(() => toISO(checkoutDate, checkoutTime), [checkoutDate, checkoutTime]);

  const availableRooms = useMemo(() => {
    if (!checkinISO || !checkoutISO || new Date(checkinISO) >= new Date(checkoutISO)) return rooms;
    const now = new Date();
    return rooms.filter(room => {
      if (room.status === 'maintenance' || room.status === 'under-maintenance') return false;
      return !bookings.some(b => {
        const bStatus = b.status;
        const bType = b.reservationType || (b as any).bookingType;
        
        const bStatusLower = bStatus?.toLowerCase();
        // Skip explicitly non-blocking statuses
        if (['cancelled', 'checked-out', 'expired', 'no-show', 'no_show'].includes(bStatusLower)) return false;
        
        // Skip expired enquiries or blocks
        const expiry = b.enquiryExpiresAt || b.blockExpiresAt;
        if (expiry && new Date(expiry) < now && (bType === 'enquiry' || bType === 'block')) return false;

        // Always skip the current booking being edited
        const bId = typeof b._id === 'object' ? String((b._id as any)) : String(b._id);
        const initId = initialBooking ? (typeof initialBooking._id === 'object' ? String((initialBooking._id as any)) : String(initialBooking._id)) : null;
        if (initId && bId === initId) return false;
        
        // If editing group, skip all bookings in that group
        if (isEditingGroup && initialBooking?.groupId && b.groupId === initialBooking.groupId) return false;
        
        const bRoomId = typeof b.roomId === 'object' ? String((b.roomId as any)._id) : String(b.roomId);
        if (bRoomId !== String(room._id)) return false;

        const checkinDateStr = typeof b.checkin === 'string' ? b.checkin.slice(0, 10) : format(new Date(b.checkin), 'yyyy-MM-dd');
        const checkoutDateStr = typeof b.checkout === 'string' ? b.checkout.slice(0, 10) : format(new Date(b.checkout), 'yyyy-MM-dd');
        
        const bCI = toISO(checkinDateStr, b.checkinTime  || '14:00');
        const bCO = toISO(checkoutDateStr, b.checkoutTime || '11:00');
        return overlaps(checkinISO, checkoutISO, bCI, bCO);
      });
    });
  }, [rooms, bookings, checkinISO, checkoutISO, initialBooking]);

  const isRoomAvailable = (roomId: string) => {
    // If we're editing an existing booking, the original room is always available for this booking
    const initId = initialBooking ? (typeof initialBooking._id === 'object' ? String((initialBooking._id as any)) : String(initialBooking._id)) : null;
    const originalRoomIdStr = typeof initialBooking?.roomId === 'object' ? String((initialBooking.roomId as any)._id) : String(initialBooking?.roomId ?? '');
    if (initId && roomId === originalRoomIdStr) return true;
    return availableRooms.some(r => r._id === roomId);
  };

  // ─── Financials ───────────────────────────────────────────────────────────
  const { 
    nights,
    baseSubtotal, 
    extraAdults, 
    extraCharge, 
    mealCharge, 
    subtotal,
    taxAmount, 
    grandTotal: totalAmount,
    taxConfig
  } = useMemo(() => {
    const rm = rooms.find(r => r._id === selectedRoom);
    return calculateBookingPrice({
      roomPrice,
      checkin: checkinDate,
      checkout: checkoutDate,
      adults,
      baseOccupancy: rm?.baseOccupancy || 2,
      extraPersonRate: rm?.extraPersonPrice || 0,
      planType: planType as any,
      mealRates: hotel?.settings?.mealRates || {},
      gstRates: hotel?.settings?.taxConfig,
      isDayUse: checkinDate === checkoutDate
    });
  }, [roomPrice, checkinDate, checkoutDate, adults, selectedRoom, rooms, planType, hotel?.settings?.mealRates, hotel?.settings?.taxConfig]);

  const mealRates: Record<string, number> = hotel?.settings?.mealRates || {};
  const baseOccupancy = rooms.find(r => r._id === selectedRoom)?.baseOccupancy || 2;
  const extraPersonPrice = rooms.find(r => r._id === selectedRoom)?.extraPersonPrice || 0;
  const isDayUse = nights === 0 && checkinDate === checkoutDate;

  // ─── Navigation ───────────────────────────────────────────────────────────
  const STEP_ORDER_BOOKING: StepType[] = ['type', 'dates', 'room', 'guest', 'payment'];
  const STEP_ORDER_BLOCK:   StepType[] = ['type', 'dates', 'room'];
  const STEP_ORDER_GROUP:   StepType[] = ['type', 'dates', 'groupConfig', 'guest', 'roomAssignment', 'payment'];
  const STEP_ORDER_ENQUIRY: StepType[] = ['type', 'dates', 'room', 'guest'];

  const getActiveSteps = () => {
    if (reservationType === 'group') return STEP_ORDER_GROUP;
    if (reservationType === 'block') return STEP_ORDER_BLOCK;
    if (reservationType === 'enquiry') return STEP_ORDER_ENQUIRY;
    return STEP_ORDER_BOOKING;
  };



  const stepOrder = getActiveSteps();

  const goNext = (nextStep: StepType) => { 
    if (nextStep === 'roomAssignment' && reservationType === 'group') {
      const init: Record<string, { guestName: string; plan: string; price: number; adults: number; children: number }> = { ...roomAssignments };
      const leadName = selectedGuest?.name || 'Lead';
      const allNames = [leadName, ...additionalGuests.map(ag => ag.name).filter(Boolean)];
      
      selectedRooms.forEach((rid, i) => {
        if (!init[rid]) {
          const r = rooms.find(rm => rm._id === rid);
          // Default first room to lead, others to TBA or subsequent names
          init[rid] = { 
            guestName: allNames[i] || leadName, 
            plan: planType, 
            price: r?.price || 0,
            adults: adults,
            children: children
          };
        }
      });
      setRoomAssignments(init);
    }
    setStep(nextStep); 
    setError(null); 
  };
  const goBack = () => {
    const idx = stepOrder.indexOf(step);
    if (idx > 0) { setStep(stepOrder[idx - 1]); }
  };

  const stepLabel: Record<StepType, string> = {
    type: 'Select Type',
    dates: reservationType === 'block' ? 'Block Duration' : 'Dates & Times',
    room: reservationType === 'block' ? 'Select Room' : 'Room & Plan',
    guest: reservationType === 'group' ? 'Lead Guest' : (reservationType === 'enquiry' ? 'Enquirer Details' : 'Guest Info'),
    payment: 'Payment',
    groupConfig: 'Group Config',
    roomAssignment: 'Assignments',
  };

  // ─── Guest search ─────────────────────────────────────────────────────────
  const handleGuestSearch = async (q: string) => {
    setGuestQuery(q);
    if (q.length < 2) { setGuestResults([]); return; }
    setIsSearching(true);
    try { setGuestResults(await searchGuests(q)); } catch { /* ignore error on search */ }
    setIsSearching(false);
  };

  const handleCreateGuest = async () => {
    if (!newGuest.name.trim()) { setError('Guest name is required'); return; }
    if (!/^\+?[0-9]{10,15}$/.test(newGuest.phone)) { setError('Valid phone number required'); return; }
    setIsSubmitting(true); setError(null);
    try {
      const payload: Omit<Guest, '_id'> = { 
        name: newGuest.name, 
        phone: newGuest.phone, 
        email: newGuest.email || '', 
        nationality: newGuest.nationality,
        idProof: newGuest.idProof.number ? newGuest.idProof : { idType: 'aadhaar', number: 'TBA' }
      };
      const guest = await createGuest(payload);
      setSelectedGuest(guest); 
      setShowNewGuest(false); 
      goNext(reservationType === 'group' ? 'roomAssignment' : 'payment');
    } catch (err: unknown) { 
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage); 
    }
    setIsSubmitting(false);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Mode-specific validation
    const isActuallyGroup = reservationType === 'group' && (!initialBooking || isEditingGroup);
    
    if (!isActuallyGroup && reservationType !== 'block' && !selectedRoom) { setError('Please select a room'); return; }
    if (isActuallyGroup && selectedRooms.length === 0) { setError('Please select rooms'); return; }
    if (!nights && !isDayUse) { setError('Invalid dates'); return; }
    if (reservationType !== 'block' && !selectedGuest) { setError('Guest required'); return; }

    setIsSubmitting(true); setError(null);
    try {
      const effectiveExpiry = expiryHours === 'custom' ? parseFloat(customExpiryHours) : parseFloat(expiryHours);
      const enquiryExpiresAt = initialBooking?.enquiryExpiresAt 
        ? initialBooking.enquiryExpiresAt 
        : (reservationType === 'enquiry' || reservationType === 'block')
          ? addHours(new Date(), effectiveExpiry).toISOString()
          : undefined;

      if (isActuallyGroup) {
        const conflictRooms = selectedRooms.filter(rid => {
          // If editing, exclude the rooms already assigned to this group
          if (isEditingGroup && initialBooking?.groupId) {
             const groupRoomIds = bookings.filter(b => b.groupId === initialBooking.groupId).map(b => typeof b.roomId === 'object' ? b.roomId._id : b.roomId);
             if (groupRoomIds.includes(rid)) return false;
          }
          return !isRoomAvailable(rid);
        });

        if (conflictRooms.length > 0) {
          const conflictNames = conflictRooms.map(id => rooms.find(r => r._id === id)?.roomNumber).join(', ');
          setError(`Conflicts detected. The following rooms are no longer available: ${conflictNames}. Please reselect.`);
          setIsSubmitting(false);
          return;
        }

        const groupId = isEditingGroup ? initialBooking?.groupId : `GRP-${Date.now()}`;
        
        // If editing group, handle removal of rooms
        if (isEditingGroup && initialBooking?.groupId) {
           const existingGroupBookings = bookings.filter(b => b.groupId === initialBooking.groupId && b.status !== 'cancelled' && b.status !== 'expired');
           const toRemove = existingGroupBookings.filter(b => !selectedRooms.includes(typeof b.roomId === 'object' ? b.roomId._id : b.roomId));
           
           if (toRemove.length > 0) {
             await Promise.all(toRemove.map(b => cancelBooking(b._id)));
           }

           // Update group metadata if a record exists (optional)
           try {
              await updateGroupMetadata(initialBooking.groupId, {
                groupName,
                totalRooms: selectedRooms.length
              });
           } catch (metaErr) {
              console.warn('Group metadata update skipped (likely ad-hoc group):', metaErr);
           }
        }

        const roomOps = selectedRooms.map(async (rid) => {
          const assignment = roomAssignments[rid];
          const rmLocal = rooms.find(r => r._id === rid);
          if (!selectedGuest?._id) return;

          const partialPayload = {
            checkin: checkinDate,
            checkout: checkoutDate,
            checkinTime,
            checkoutTime,
            roomPrice: assignment?.price || rmLocal?.price || 0,
            specialRequests: specialRequests,
            planType: (assignment?.plan || planType) as 'EP' | 'CP' | 'MAP' | 'AP' | 'custom',
            mealRate: mealRates[assignment?.plan as string || planType] || 0,
            mealChargeTotal: (mealRates[assignment?.plan as string || planType] || 0) * (assignment?.adults || adults) * Math.max(nights, isDayUse ? 1 : 0),
            groupName,
            guestId: selectedGuest._id,
            adults: assignment?.adults || adults,
            children: assignment?.children || children,
            baseOccupancy: rmLocal?.baseOccupancy || 2,
            extraPersonPrice: rmLocal?.extraPersonPrice || 0,
            isGroup: true,
            groupId: groupId!,
            reservationType: 'group' as const,
            status: 'reserved' as const,
          };

          const existing = isEditingGroup ? bookings.find(b => b.groupId === groupId && (typeof b.roomId === 'object' ? b.roomId._id : b.roomId) === rid) : null;
          
          if (existing) {
            return updateBooking(existing._id, partialPayload);
          } else {
            return createBooking({
              ...partialPayload,
              roomId: rid,
              advancePayment: (advancePayment / selectedRooms.length),
              paymentMethod: (advancePayment > 0) ? paymentMethod : undefined,
              bookingSource,
            });
          }
        });

        await Promise.all(roomOps);
      } else {
        if (!selectedGuest?._id && reservationType !== 'block') {
          setError('Guest is required');
          setIsSubmitting(false);
          return;
        }

        const bookingPayload: Partial<Booking> & { roomId: string; checkin: string; checkout: string } = {
          roomId: selectedRoom,
          guestId: selectedGuest?._id,  // undefined is fine for blocks
          checkin: checkinDate,
          checkout: checkoutDate,
          checkinTime,
          checkoutTime,
          adults,
          children,
          roomPrice,
          baseOccupancy,
          extraPersonPrice,
          advancePayment,
          paymentMethod: advancePayment > 0 ? paymentMethod : undefined,
          bookingSource,
          specialRequests: specialRequests || undefined,
          bookingType: reservationType === 'booking' ? undefined : reservationType as 'enquiry' | 'block',
          reservationType: reservationType,
          planType: (reservationType === 'block' ? undefined : planType) as 'EP' | 'CP' | 'MAP' | 'AP' | 'custom' | undefined,
          planCustomText: planType === 'custom' ? planCustomText : undefined,
          mealRate: mealRates[planType] || 0,
          mealChargeTotal: mealCharge,
          enquiryExpiresAt,
          blockReason: reservationType === 'block' ? blockReason || undefined : undefined,
        };

        if (initialBooking) {
          await updateBooking(initialBooking._id, bookingPayload as Partial<Booking>);
        } else {
          await createBooking(bookingPayload);
        }
      }
      onClose();
    } catch (err: unknown) { 
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage); 
    }
    setIsSubmitting(false);
  };

  // ─── Render Step: Type ────────────────────────────────────────────────────
  const renderTypeStep = () => {
    const types = [
      { key: 'booking', label: 'Booking', desc: 'Confirmed reservation', icon: CalendarCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
      { key: 'enquiry', label: 'Enquiry',  desc: 'Tentative hold, auto-releases', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
      { key: 'block',   label: 'Room Block', desc: 'Maintenance / owner use', icon: Lock, color: 'text-slate-600 bg-slate-50 border-slate-200' },
      { key: 'group',   label: 'Group',    desc: 'Multiple rooms at once', icon: Users, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    ];
    return (
      <div className="grid grid-cols-2 gap-3 p-2">
        {types.map(t => {
          const Icon = t.icon;
          const isActive = reservationType === t.key;
          return (
            <button 
              key={t.key} 
              disabled={!!initialBooking}
              onClick={() => { 
                setReservationType(t.key as 'booking' | 'enquiry' | 'block' | 'group');
                if (t.key === 'block') {
                   const bdMinutes = hotel?.settings?.defaultBlockDuration || 1440;
                   const bd = Math.max(1, bdMinutes / 1440);
                   if (!isNaN(bd) && checkinDate) {
                      setCheckoutDate(format(addDays(parseISO(checkinDate), bd), 'yyyy-MM-dd'));
                   }
                }
                goNext('dates'); 
              }}
              className={cn(
                'relative flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all text-center',
                initialBooking 
                  ? (isActive ? t.color + ' border-primary ring-2 ring-primary/20 opacity-100 shadow-sm' : 'opacity-40 grayscale pointer-events-none border-slate-100') 
                  : (t.color + ' hover:scale-[1.02] hover:shadow-md cursor-pointer active:scale-95')
              )}>
              <Icon className="h-7 w-7" />
              <span className="font-black text-sm">{t.label}</span>
              <span className="text-[10px] font-medium opacity-70 leading-tight">{t.desc}</span>
              {initialBooking && isActive && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-2 border-white">
                  <Lock className="h-2.5 w-2.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // ─── Render Step: Group Config ────────────────────────────────────────────
  const renderGroupConfigStep = () => {
    const roomTypesInHotel = Array.from(new Set(rooms.map(r => r.roomType)));
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-black uppercase tracking-widest opacity-60">Group Name *</Label>
          <Input className="h-11 rounded-xl" placeholder="e.g. Singh Wedding Party" value={groupName} onChange={e => setGroupName(e.target.value)} />
        </div>
        {/* Removed Adults/Children / Room selection from here as per user request */}
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
          <Label className="text-xs font-black uppercase tracking-widest opacity-60">Number of Rooms</Label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" 
              onClick={() => {
                const newNum = Math.max(1, numRooms - 1);
                setNumRooms(newNum);
                if (selectedRooms.length > newNum) {
                  setSelectedRooms(selectedRooms.slice(0, newNum));
                }
              }}>–</Button>
            <span className="font-black text-lg">{numRooms}</span>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setNumRooms(Math.min(50, numRooms + 1))}>+</Button>
          </div>
        </div>
        <div className="space-y-3 bg-slate-50/50 p-3 rounded-2xl border border-dashed border-slate-200">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Distribution Preferences</Label>
            <span className="text-[9px] font-medium text-slate-400">Total: {Object.values(groupRoomPrefs).reduce((a,b)=>a+b,0)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {roomTypesInHotel.map(type => (
              <div key={type} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl border bg-white shadow-sm">
                <span className="text-[10px] font-bold text-slate-600 truncate mr-2">{type}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="h-5 w-5 rounded-md hover:bg-slate-100 flex items-center justify-center transition-colors" onClick={() => setGroupRoomPrefs({...groupRoomPrefs, [type]: Math.max(0, (groupRoomPrefs[type] || 0) - 1)})}>–</button>
                  <span className="text-[10px] font-black w-3 text-center">{groupRoomPrefs[type] || 0}</span>
                  <button className="h-5 w-5 rounded-md hover:bg-slate-100 flex items-center justify-center transition-colors font-bold" onClick={() => setGroupRoomPrefs({...groupRoomPrefs, [type]: (groupRoomPrefs[type] || 0) + 1})}>+</button>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full h-8 text-[9px] font-black uppercase tracking-widest mt-1 border-slate-200 bg-white hover:bg-primary hover:text-white hover:border-primary transition-all"
            onClick={() => {
              const newSelection: string[] = [];
              let remainingToSelect = numRooms;

              // 1. First follow distribution preferences
              Object.entries(groupRoomPrefs).forEach(([type, count]) => {
                if (count <= 0) return;
                const candidates = availableRooms.filter(r => r.roomType === type).map(r => r._id);
                const toTake = Math.min(count, candidates.length, remainingToSelect);
                newSelection.push(...candidates.slice(0, toTake));
                remainingToSelect -= toTake;
              });

              // 2. If still need rooms, fill from available pool
              if (remainingToSelect > 0) {
                const availablePool = availableRooms
                  .filter(r => !newSelection.includes(r._id))
                  .map(r => r._id);
                newSelection.push(...availablePool.slice(0, remainingToSelect));
              }

              setSelectedRooms(newSelection);
            }}>
            Auto-fill from Distribution
          </Button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <Label className="text-xs font-black uppercase tracking-widest opacity-60">
              {isEditingGroup ? 'Manage Group Rooms' : 'Select Rooms'} ({selectedRooms.length}/{numRooms})
            </Label>
            {selectedRooms.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-[9px] font-black uppercase text-red-500" onClick={() => setSelectedRooms([])}>Clear All</Button>
            )}
          </div>
          
          {/* Category Tabs / Filters */}
          <div className="flex flex-wrap gap-1.5 px-0.5 sm:px-1">
            {roomTypesInHotel.map(type => {
              const count = selectedRooms.filter(rid => rooms.find(r => r._id === rid)?.roomType === type).length;
              const isActive = activeCategoryFilter === type || (!activeCategoryFilter && type === roomTypesInHotel[0]);
              
              return (
                <button 
                  key={type}
                  onClick={() => setActiveCategoryFilter(type)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border-2",
                    isActive 
                      ? "bg-primary text-white border-primary shadow-sm" 
                      : "bg-white text-slate-400 border-slate-100 hover:border-primary/20"
                  )}
                >
                  {type} {count > 0 && <span className="ml-0.5 opacity-60">({count})</span>}
                </button>
              );
            })}
          </div>

          <div className="max-h-60 overflow-y-auto pr-1">
            {roomTypesInHotel.map(type => {
              const isFiltered = activeCategoryFilter ? activeCategoryFilter === type : type === roomTypesInHotel[0];
              if (!isFiltered) return null;

              const roomsInType = rooms.filter(r => r.roomType === type);
              return (
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                    {roomsInType.map(room => {
                      const avail = isRoomAvailable(room._id);
                      const idx = selectedRooms.indexOf(room._id);
                      const sel = idx !== -1;
                      return (
                        <button 
                          key={room._id} 
                          disabled={!avail} 
                          onClick={() => sel ? setSelectedRooms(selectedRooms.filter(id => id !== room._id)) : (selectedRooms.length < numRooms && setSelectedRooms([...selectedRooms, room._id]))}
                          className={cn(
                            'group/room h-14 rounded-2xl border-2 flex flex-col items-center justify-center relative transition-all duration-200', 
                            sel 
                              ? 'border-primary bg-primary text-white font-black shadow-lg shadow-primary/20 z-10' 
                              : avail 
                                ? 'border-slate-100 bg-white hover:border-primary/30 hover:bg-slate-50' 
                                : 'opacity-25 cursor-not-allowed bg-slate-100 border-transparent'
                          )}
                        >
                          <span className={cn("text-xs tabular-nums font-black transition-transform", sel && "scale-110")}>{room.roomNumber}</span>
                          {sel && (
                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-white text-primary text-[9px] rounded-full border-2 border-primary flex items-center justify-center font-black shadow-md">
                              {idx + 1}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
              );
            })}
          </div>
        </div>
        <div className="space-y-3 pt-2">
          <Label className="text-xs font-black uppercase tracking-widest opacity-60">Group Plan</Label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPlanMixed(false)} className={cn('p-3 rounded-xl border-2 text-xs font-black transition-all', !planMixed ? 'border-primary bg-primary/5' : 'border-slate-200')}>Single Plan</button>
            <button onClick={() => setPlanMixed(true)} className={cn('p-3 rounded-xl border-2 text-xs font-black transition-all', planMixed ? 'border-primary bg-primary/5' : 'border-slate-200')}>Mixed Plans</button>
          </div>
          {!planMixed && (
            <Select value={planType} onValueChange={(v: 'EP' | 'CP' | 'MAP' | 'AP' | 'custom') => setPlanType(v)}>
              <SelectTrigger className="h-11 rounded-xl font-bold bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-2xl">
                {(hotel?.settings?.stayPlans || PLAN_TYPES).map((p: any) => (
                  <SelectItem key={p.key} value={p.key}>
                    <div className="flex flex-col py-1">
                       <span className="font-black text-xs uppercase tracking-tight">{p.label}</span>
                       <span className="text-[9px] opacity-50 font-medium leading-none">{p.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button className="w-full h-11 rounded-xl font-black" disabled={!groupName || selectedRooms.length < 1} onClick={() => goNext('guest')}>Continue <ChevronRight className="ml-1 h-4 w-4" /></Button>
      </div>
    );
  };

  // ─── Render Step: Dates ───────────────────────────────────────────────────
  const renderDatesStep = () => {
    const validDates = checkinISO && checkoutISO && new Date(checkinISO) < new Date(checkoutISO) && (!isDayUse || checkinTime < checkoutTime);
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-xs font-black uppercase tracking-widest opacity-60">Check-in</Label>
            <Input type="date" className="h-11 rounded-xl" value={checkinDate} min={!initialBooking ? todayStr : undefined} onChange={e => { 
                setCheckinDate(e.target.value); 
                if (e.target.value >= checkoutDate) setCheckoutDate(format(addDays(parseISO(e.target.value), 1), 'yyyy-MM-dd')); 
                // Let the user keep their selected room; validation is handled downstream.
            }} />
            <Select value={checkinTime} onValueChange={v => { setCheckinTime(v); }}>
              <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue placeholder="Check-in Time" /></SelectTrigger>
              <SelectContent>
                {(hotel?.settings?.checkinTimes?.length ? hotel.settings.checkinTimes : ['14:00']).map(t => <SelectItem key={t} value={t}>{format(parseISO(`2000-01-01T${t}:00`), 'h:mm a')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-xs font-black uppercase tracking-widest opacity-60">Check-out</Label>
            <Input type="date" className="h-11 rounded-xl" value={checkoutDate} min={checkinDate} onChange={e => {
                setCheckoutDate(e.target.value);
            }} />
            <Select value={checkoutTime} onValueChange={v => { setCheckoutTime(v); }}>
              <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue placeholder="Check-out Time" /></SelectTrigger>
              <SelectContent>
                {(hotel?.settings?.checkoutTimes?.length ? hotel.settings.checkoutTimes : ['11:00']).map(t => <SelectItem key={t} value={t}>{format(parseISO(`2000-01-01T${t}:00`), 'h:mm a')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!validDates && checkinDate === checkoutDate && checkinTime >= checkoutTime && (
          <p className="text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg mt-2 inline-block">Check-out time must be after check-in time for day use.</p>
        )}
        {validDates && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-primary/10 text-primary text-[10px] font-black px-4 py-1.5 rounded-full border border-primary/20 shadow-sm flex items-center gap-2">
               <Clock className="w-3 h-3" />
               {isDayUse ? 'DAY USE (No Night)' : `${nights} NIGHT${nights !== 1 ? 'S' : ''}`}
            </div>
            {/* Only show rooms available count for new bookings, not edits */}
            {!initialBooking && (
              <div className={cn(
                 'text-[10px] font-black px-4 py-1.5 rounded-full border shadow-sm flex items-center gap-2', 
                 availableRooms.length > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
              )}>
                 <Bed className="w-3 h-3" />
                 {availableRooms.length} ROOMS AVAILABLE
              </div>
            )}
          </div>
        )}
        {reservationType === 'enquiry' && (
          <div className="rounded-xl border-2 p-4 space-y-3 border-amber-200 bg-amber-50">
            <Label className="text-xs font-black uppercase tracking-widest opacity-70">Auto-release after</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {ENQUIRY_DURATIONS.map(d => (
                <button key={d.value} type="button" onClick={() => setExpiryHours(d.value)} className={cn('px-2 py-2 rounded-lg text-[10px] font-black border-2 transition-all', expiryHours === d.value ? 'bg-primary text-white border-primary' : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40')}>{d.label}</button>
              ))}
            </div>
            {expiryHours === 'custom' && (
              <div className="flex items-center gap-2">
                <Input type="number" min="0.5" step="0.5" className="h-9 rounded-xl w-28" value={customExpiryHours} onChange={e => setcustomExpiryHours(e.target.value)} />
                <span className="text-xs font-bold text-slate-500">hours</span>
              </div>
            )}
          </div>
        )}
        {reservationType === 'block' && (
          <div className="rounded-xl border-2 p-4 space-y-3 border-slate-200 bg-slate-50">
            <div>
              <Label className="text-xs font-black uppercase tracking-widest opacity-60 mb-1 block">Block Reason</Label>
              <Input className="h-10 rounded-xl" placeholder="e.g. Owner stay, maintenance, deep cleaning…" value={blockReason} onChange={e => setBlockReason(e.target.value)} />
            </div>
          </div>
        )}
        <Button className="w-full h-11 rounded-xl font-black" disabled={!validDates} onClick={() => {
            goNext(reservationType === 'group' ? 'groupConfig' : 'room');
        }}>Continue <ChevronRight className="ml-1 h-4 w-4" /></Button>
      </div>
    );
  };

  // ─── Render Step: Room ────────────────────────────────────────────────────
  const renderRoomStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-black uppercase tracking-widest opacity-60">1. Select Category</Label>
          <Select 
            value={selectedRoomType} 
            onValueChange={val => {
              setSelectedRoomType(val);
              setSelectedRoom(''); // Clear specific room when type changes
            }}
          >
            <SelectTrigger className="h-11 rounded-xl font-black">
              <SelectValue placeholder="Room Type" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(new Set(rooms.map(r => r.roomType))).map(type => (
                <SelectItem key={type} value={type} className="font-bold">{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-black uppercase tracking-widest opacity-60">2. Select Room</Label>
          <Select 
            value={selectedRoom || undefined} 
            disabled={!selectedRoomType}
            onValueChange={val => {
              const rm = rooms.find(r => r._id === val);
              setSelectedRoom(val);
              if (rm) {
                setRoomPrice(rm.price);
                if (adults > rm.maxOccupancy) setAdults(rm.maxOccupancy);
              }
            }}
          >
            <SelectTrigger className="w-full h-11 rounded-xl font-black px-3.5">
              <SelectValue placeholder={selectedRoomType ? "Select Number" : "Select type first"} />
            </SelectTrigger>
            <SelectContent>
                  {rooms.filter(r => r.roomType === selectedRoomType).map(room => {
                    const avail = isRoomAvailable(room._id);
                    // Find the booking causing the clash to determine exact status
                    const clash = !avail ? bookings.find(b => {
                       if (b.status === 'cancelled' || b.status === 'checked-out' || b.status === 'expired') return false;
                       const bRoomId = typeof b.roomId === 'object' ? (b.roomId as any)._id : b.roomId;
                       if (bRoomId !== room._id) return false;
                       
                       const checkinDateStr = typeof b.checkin === 'string' ? b.checkin.slice(0, 10) : format(new Date(b.checkin), 'yyyy-MM-dd');
                       const checkoutDateStr = typeof b.checkout === 'string' ? b.checkout.slice(0, 10) : format(new Date(b.checkout), 'yyyy-MM-dd');
                       const bCI = toISO(checkinDateStr, b.checkinTime  || '14:00');
                       const bCO = toISO(checkoutDateStr, b.checkoutTime || '11:00');
                       return overlaps(checkinISO, checkoutISO, bCI, bCO);
                    }) : null;

                    const clashStatus = clash?.status;
                    const isOccupied = !avail && clashStatus === 'checked-in';
                    const isReserved = !avail && (clashStatus === 'reserved' || clash?.bookingType === 'enquiry' || clash?.reservationType === 'enquiry');

                    return (
                      <SelectItem 
                        key={room._id} 
                        value={room._id} 
                        disabled={!avail}
                        className={cn("font-bold text-sm", !avail && "opacity-40")}
                      >
                        <div className="flex items-center justify-between w-full pr-1">
                           <div className="flex items-center gap-2">
                              <span className={cn(
                                 "w-1.5 h-1.5 rounded-full shrink-0",
                                 isOccupied ? 'bg-red-500' : 
                                 isReserved ? 'bg-indigo-500' :
                                 (room.status === 'maintenance' || room.status === 'under-maintenance') ? 'bg-slate-400' : 
                                 room.status === 'dirty' ? 'bg-amber-400' : 'bg-emerald-500'
                              )} />
                              <span className="tabular-nums">Room #{room.roomNumber}</span>
                           </div>
                           <span className={cn(
                              'text-[10px] font-black uppercase px-2.5 py-1 rounded-full ml-6 tracking-wider leading-none transition-colors border', 
                              isOccupied ? 'bg-red-50 text-red-600 border-red-100' :
                              isReserved ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                              (room.status === 'maintenance' || room.status === 'under-maintenance') ? 'bg-slate-50 text-slate-500 border-slate-200' :
                              (room.status === 'dirty' ? 'bg-amber-100 text-amber-700 border-amber-200/50' : 'bg-emerald-100 text-emerald-700 border-emerald-200/50')
                           )}>
                              {isOccupied ? 'Occupied' : 
                               isReserved ? 'Reserved' :
                               (room.status === 'maintenance' || room.status === 'under-maintenance') ? 'Service' :
                               (room.status === 'dirty' ? 'Dirty' : 'Clean')}
                           </span>
                        </div>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
          </Select>
        </div>
      </div>
      {selectedRoom && reservationType !== 'block' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-widest opacity-60 mb-1.5 block">Adults</Label>
            <Select value={adults.toString()} onValueChange={v => setAdults(Number(v))}>
              <SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].filter(n => n <= (rooms.find(r => r._id === selectedRoom)?.maxOccupancy || 6)).map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} Adult{n > 1 ? 's' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-widest opacity-60 block mb-1.5">Stay Plan</Label>
            <Select value={planType} onValueChange={setPlanType}>
              <SelectTrigger className="h-10 rounded-xl font-bold bg-white">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {(hotel?.settings?.stayPlans || PLAN_TYPES).map((p: any) => {
                  const rate = mealRates[p.key] || 0;
                  return (
                  <SelectItem key={p.key} value={p.key}>
                    <div className="flex items-center justify-between min-w-[200px] w-full py-0.5">
                      <span className="font-black text-xs uppercase">{p.label}</span>
                      {rate > 0 && (
                        <div className="ml-4 flex flex-col items-end shrink-0">
                          <span className="text-[10px] font-black text-primary">₹{rate.toLocaleString('en-IN')}</span>
                          <span className="text-[8px] opacity-40 uppercase tracking-tighter">per pax</span>
                        </div>
                      )}
                    </div>
                  </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {planType && planType !== 'EP' && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-black rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-1">
                <Utensils className="h-3 w-3" />
                Extra ₹{(mealRates[planType] || 0).toLocaleString('en-IN')} / person
              </div>
            )}
          </div>
        </div>
      )}
      {selectedRoom && nights >= 0 && (reservationType !== 'block') && (
        <div className="rounded-[24px] bg-slate-50 border border-slate-100 p-5 space-y-3 shadow-inner">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estimated Total</span>
            <div className="flex items-baseline gap-1">
               <span className="text-[10px] font-bold text-slate-400">₹</span>
               <span className="text-2xl font-black text-primary tracking-tighter">{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
          
          <Separator className="bg-slate-200" />
          
          <div className="grid grid-cols-1 gap-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-bold text-slate-500">Occupancy</span>
              <span className="text-[11px] font-black text-slate-800">{adults} Adult{adults > 1 ? 's' : ''}{children > 0 ? `, ${children} Child${children > 1 ? 'ren' : ''}` : ''}</span>
            </div>
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-bold text-slate-500">Base Fare ({Math.max(nights, isDayUse ? 1 : 0)}N × ₹{roomPrice.toLocaleString('en-IN')})</span>
              <span className="text-[11px] font-black text-slate-800">₹{baseSubtotal.toLocaleString('en-IN')}</span>
            </div>
            {extraAdults > 0 && (
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-emerald-600">Extra Person ({extraAdults} × ₹{extraPersonPrice})</span>
                <span className="text-[11px] font-black text-emerald-700">+ ₹{extraCharge.toLocaleString('en-IN')}</span>
              </div>
            )}
            {mealCharge > 0 && (
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-blue-600">
                  {planType === 'custom' 
                    ? (planCustomText || 'Custom Plan')
                    : (PLAN_LABELS[planType as keyof typeof PLAN_LABELS] || planType + ' Plan')}
                </span>
                <span className="text-[11px] font-black text-blue-700">+ ₹{mealCharge.toLocaleString('en-IN')}</span>
              </div>
            )}
            {taxConfig?.enabled && (
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-orange-600">GST ({ (taxConfig.cgst||0)+(taxConfig.sgst||0) }%)</span>
                <span className="text-[11px] font-black text-orange-700">+ ₹{taxAmount.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>
      )}
      <Button 
        className="w-full h-11 rounded-xl font-black" 
        disabled={!selectedRoom || isSubmitting} 
        onClick={() => {
          if (reservationType === 'block') handleSubmit();
          else goNext(reservationType === 'group' ? 'guest' : 'guest');
        }}
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (
          reservationType === 'block' ? 'Confirm Block' : <>Continue <ChevronRight className="ml-1 h-4 w-4" /></>
        )}
      </Button>
    </div>
  );

  // ─── Render Step: Guest ───────────────────────────────────────────────────
  const renderGuestStep = () => (
    <div className="space-y-4">
      {!showNewGuest ? (
        <>
          {!selectedGuest ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-10 h-11 rounded-xl" 
                  placeholder="Search lead guest..." 
                  value={guestQuery} 
                  onChange={e => handleGuestSearch(e.target.value)} 
                />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
              </div>
              {guestResults.length > 0 && (
                <div className="border rounded-xl divide-y overflow-hidden bg-white shadow-sm">
                  {guestResults.map(g => (
                    <button 
                      key={g._id} 
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between" 
                      onClick={() => setSelectedGuest(g)}
                    >
                      <div>
                        <div className="font-black text-sm">{g.name}</div>
                        <div className="text-[10px] text-slate-500">{g.phone}</div>
                      </div>
                      <Badge variant="outline" className="text-[8px] font-black uppercase">Select</Badge>
                    </button>
                  ))}
                </div>
              )}
              <Button variant="outline" className="w-full h-11 rounded-xl border-2 font-bold border-dashed" onClick={() => setShowNewGuest(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> New Lead Guest
              </Button>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-primary opacity-60">Lead Guest Selected</p>
                  <p className="font-black text-base">{selectedGuest.name}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold" onClick={() => setSelectedGuest(null)}>Change</Button>
              </div>

              {reservationType === 'group' && (
                <div className="space-y-3 p-4 rounded-2xl border bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Additional Guests ({additionalGuests.length}/{numRooms - 1})</Label>
                    {additionalGuests.length < numRooms - 1 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-[9px] font-black uppercase tracking-widest text-primary"
                        onClick={() => setAdditionalGuests([...additionalGuests, { name: '', phone: '' }])}
                      >
                        + Add Name
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {additionalGuests.map((ag, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input 
                          placeholder={`Guest ${idx + 2} Name`} 
                          className="h-9 text-xs rounded-lg" 
                          value={ag.name} 
                          onChange={e => {
                            const newGuests = [...additionalGuests];
                            newGuests[idx].name = e.target.value;
                            setAdditionalGuests(newGuests);
                          }} 
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-slate-400 hover:text-red-500"
                          onClick={() => setAdditionalGuests(additionalGuests.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {additionalGuests.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">No additional names collected yet.</p>
                    )}
                  </div>
                </div>
              )}

              <Button 
                className="w-full h-11 rounded-xl font-black" 
                onClick={() => {
                  if (reservationType === 'enquiry') handleSubmit();
                  else goNext(reservationType === 'group' ? 'roomAssignment' : 'payment');
                }}
              >
                {reservationType === 'enquiry' ? 'Confirm Enquiry' : `Continue to ${reservationType === 'group' ? 'Assignments' : 'Payment'}`} <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-widest opacity-60">Full Name</Label>
              <Input className="h-11 rounded-xl" placeholder="Guest Name" value={newGuest.name} onChange={e => setNewGuest({...newGuest, name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-widest opacity-60">Phone Number</Label>
              <Input className="h-11 rounded-xl" placeholder="+91 XXXXX XXXXX" value={newGuest.phone} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-widest opacity-60">Email (Optional)</Label>
              <Input className="h-11 rounded-xl" placeholder="guest@example.com" value={newGuest.email} onChange={e => setNewGuest({...newGuest, email: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 h-11 rounded-xl font-bold" onClick={() => setShowNewGuest(false)}>Cancel</Button>
            <Button className="flex-1 h-11 rounded-xl font-black bg-primary" onClick={handleCreateGuest} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Register & Select'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Render Step: Assignment ──────────────────────────────────────────────
  const renderRoomAssignmentStep = () => {
    const allGroupGuestNames = [selectedGuest?.name || 'Lead', ...additionalGuests.map(ag => ag.name).filter(Boolean)];
    return (
      <div className="space-y-4">
        <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="max-h-[380px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-left font-black tracking-widest uppercase text-[9px] opacity-60">Room</th>
                  <th className="p-3 text-left font-black tracking-widest uppercase text-[9px] opacity-60">Guest</th>
                  <th className="p-3 text-left font-black tracking-widest uppercase text-[9px] opacity-60">Plan & Occupancy</th>
                  <th className="p-3 text-right font-black tracking-widest uppercase text-[9px] opacity-60">Price Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedRooms.map(rid => {
                  const r = rooms.find(rmLocal => rmLocal._id === rid);
                  const a = roomAssignments[rid] || { guestName: allGroupGuestNames[0] || 'TBA', plan: planType, price: r?.price || 0, adults: adults, children: children };
                  
                  // Calculate room-specific breakdown
                  const stats = calculateBookingPrice({
                    roomPrice: a.price,
                    checkin: checkinDate,
                    checkout: checkoutDate,
                    adults: a.adults || adults,
                    baseOccupancy: r?.baseOccupancy || 2,
                    extraPersonRate: r?.extraPersonPrice || 0,
                    planType: (a.plan || planType) as any,
                    mealRates: hotel?.settings?.mealRates || {},
                    gstRates: hotel?.settings?.taxConfig as any,
                    isDayUse: checkinDate === checkoutDate
                  });

                  return (
                    <tr key={rid} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-3 font-black whitespace-nowrap align-top">
                         <div className="flex flex-col">
                           <span className="text-slate-900 text-xs tracking-tight">#{r?.roomNumber}</span>
                           <span className="text-[7px] text-primary/60 font-black uppercase tracking-widest">{r?.roomType}</span>
                         </div>
                      </td>
                      <td className="p-3 align-top min-w-[120px]">
                         <Select value={a.guestName} onValueChange={v => setRoomAssignments({...roomAssignments, [rid]: {...a, guestName: v}})}>
                          <SelectTrigger className="h-7 text-[10px] w-full rounded-md border-slate-100 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-2xl">
                            {allGroupGuestNames.map(n => <SelectItem key={n} value={n} className="text-xs font-bold">{n}</SelectItem>)}
                          </SelectContent>
                         </Select>
                      </td>
                      <td className="p-3 align-top">
                        <div className="flex items-center gap-1.5">
                           <Select value={a.plan} onValueChange={v => setRoomAssignments({...roomAssignments, [rid]: {...a, plan: v}})}>
                            <SelectTrigger className="h-7 text-[10px] w-full min-w-[65px] rounded-md border-slate-100 bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                              {(hotel?.settings?.stayPlans || [{key: 'EP', label: 'EP'}]).map((p: any) => (
                                <SelectItem key={p.key} value={p.key}>
                                  <span className="font-black text-[10px] uppercase tracking-tighter">{p.key}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                           </Select>

                           <Popover>
                             <PopoverTrigger asChild>
                               <button className="h-7 px-2 flex items-center justify-center gap-1.5 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 text-[10px] font-black rounded-md transition-all">
                                 <Users className="h-3 w-3" />
                                 <span className="tabular-nums">{a.adults}A/{a.children || 0}C</span>
                               </button>
                             </PopoverTrigger>
                             <PopoverContent className="w-40 p-3 rounded-2xl shadow-2xl border-none" align="end">
                               <div className="space-y-3">
                                 <div className="flex items-center justify-between">
                                   <span className="text-[9px] font-black uppercase opacity-60">Adults</span>
                                   <div className="flex items-center gap-2">
                                     <button className="h-5 w-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold" onClick={() => setRoomAssignments({...roomAssignments, [rid]: {...a, adults: Math.max(1, a.adults - 1)}})}>−</button>
                                     <span className="text-xs font-black w-3 text-center">{a.adults}</span>
                                     <button className="h-5 w-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold" onClick={() => setRoomAssignments({...roomAssignments, [rid]: {...a, adults: a.adults + 1}})}>+</button>
                                   </div>
                                 </div>
                                 <div className="flex items-center justify-between">
                                   <span className="text-[9px] font-black uppercase opacity-60">Children</span>
                                   <div className="flex items-center gap-2">
                                     <button className="h-5 w-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold" onClick={() => setRoomAssignments({...roomAssignments, [rid]: {...a, children: Math.max(0, (a.children || 0) - 1)}})}>−</button>
                                     <span className="text-xs font-black w-3 text-center">{a.children || 0}</span>
                                     <button className="h-5 w-5 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold" onClick={() => setRoomAssignments({...roomAssignments, [rid]: {...a, children: (a.children || 0) + 1}})}>+</button>
                                   </div>
                                 </div>
                               </div>
                             </PopoverContent>
                           </Popover>
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold align-top">
                         <div className="flex flex-col text-[10px] tracking-tight text-right items-end">
                           <span className="text-primary font-black text-[11px] tabular-nums underline decoration-primary/20 underline-offset-2">₹{stats.grandTotal.toLocaleString('en-IN')}</span>
                           <div className="flex flex-col text-[7px] font-bold uppercase tracking-tighter mt-0.5 w-max">
                             <span className="text-slate-400 opacity-80 tabular-nums">Room: ₹{stats.baseSubtotal.toLocaleString('en-IN')}</span>
                             {stats.extraCharge > 0 && <span className="text-blue-500 tabular-nums">+ ₹{stats.extraCharge.toLocaleString('en-IN')} (Adults)</span>}
                             {stats.mealCharge > 0 && <span className="text-amber-500 tabular-nums">+ ₹{stats.mealCharge.toLocaleString('en-IN')} (Plan)</span>}
                             <span className="text-slate-400 opacity-80 tabular-nums">+ ₹{stats.taxAmount.toLocaleString('en-IN')} (GST)</span>
                           </div>
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <Button className="w-full h-11 rounded-xl font-black" onClick={() => goNext('payment')}>Continue <ChevronRight className="ml-1 h-4 w-4" /></Button>
      </div>
    );
  };

  // ─── Render Step: Payment ─────────────────────────────────────────────────
  const renderPaymentStep = () => {
    const isGroup = reservationType === 'group';
    let groupBaseSubtotal = 0;
    let groupExtraCharge = 0;
    let groupMealCharge = 0;
    let groupTaxTotal = 0;
    let groupGrandTotal = 0;
    let groupExtraPaxCount = 0;
    let groupMealPaxCount = 0;

    if (isGroup) {
      selectedRooms.forEach(rid => {
        const r = rooms.find(rm => rm._id === rid);
        const a = roomAssignments[rid] || { price: r?.price || 0, plan: planType, adults: adults, children: children };
        
        const stats = calculateBookingPrice({
          roomPrice: a.price,
          checkin: checkinDate,
          checkout: checkoutDate,
          adults: a.adults || adults,
          baseOccupancy: r?.baseOccupancy || 2,
          extraPersonRate: r?.extraPersonPrice || 0,
          planType: (a.plan || planType) as any,
          mealRates: hotel?.settings?.mealRates || {},
          gstRates: hotel?.settings?.taxConfig as any,
          isDayUse: checkinDate === checkoutDate
        });

        groupBaseSubtotal += stats.baseSubtotal;
        groupExtraCharge += stats.extraCharge;
        groupMealCharge += stats.mealCharge;
        groupTaxTotal += stats.taxAmount;
        groupGrandTotal += stats.grandTotal;

        const extraPax = Math.max(0, (a.adults || adults) - (r?.baseOccupancy || 2));
        if (stats.extraCharge > 0) groupExtraPaxCount += extraPax;

        const mRate = stats.mealCharge > 0;
        if (mRate) groupMealPaxCount += (a.adults || adults);
      });
    }

    const displayBase = isGroup ? groupBaseSubtotal : baseSubtotal;
    const displayExtra = isGroup ? groupExtraCharge : extraCharge;
    const displayMeals = isGroup ? groupMealCharge : mealCharge;
    const displayTax = isGroup ? groupTaxTotal : taxAmount;
    const finalTotal = isGroup ? groupGrandTotal : totalAmount;

    const isDayUse = checkinDate === checkoutDate;
    const computedNights = isDayUse ? 1 : Math.max(1, differenceInDays(startOfDay(parseISO(checkoutDate)), startOfDay(parseISO(checkinDate))));
    
    // Formatting metadata labels for the summary
    const displayRoomCountStr = isGroup ? `${selectedRooms.length} Rooms` : '1 Room';
    const displayNightStr = isDayUse ? 'Day Use' : `${computedNights} Night${computedNights !== 1 ? 's' : ''}`;
    
    const singleRoom = rooms.find(r => r._id === selectedRoom);
    const singleExtraPax = Math.max(0, adults - (singleRoom?.baseOccupancy || 2));
    const singleMealPax = displayMeals > 0 ? adults : 0;
    
    const displayExtraCountStr = isGroup 
       ? `${groupExtraPaxCount} Extra Guest${groupExtraPaxCount !== 1 ? 's' : ''}` 
       : `${singleExtraPax} Extra Guest${singleExtraPax !== 1 ? 's' : ''}`;
       
    const displayMealCountStr = isGroup
       ? `${groupMealPaxCount} Guest${groupMealPaxCount !== 1 ? 's' : ''}`
       : `${singleMealPax} Guest${singleMealPax !== 1 ? 's' : ''}`;

    return (
      <div className="space-y-4">
        <div className="p-4 bg-slate-50 rounded-2xl border space-y-3">
          <div className="space-y-1.5 border-b border-slate-200/60 pb-3">
            <div className="flex justify-between text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5 font-black">Room Charges <span className="text-[10px] font-bold opacity-60">({displayRoomCountStr}, {displayNightStr})</span></span>
              <span>₹{displayBase.toLocaleString('en-IN')}</span>
            </div>
            {displayExtra > 0 && (
              <div className="flex justify-between text-xs font-bold text-blue-600 border-t border-slate-100 pt-1 mt-1">
                <span className="flex items-center gap-1.5">Extra Guest Charges <span className="text-[10px] opacity-60">({displayExtraCountStr})</span></span>
                <span>₹{displayExtra.toLocaleString('en-IN')}</span>
              </div>
            )}
            {displayMeals > 0 && (
              <div className="flex justify-between text-xs font-bold text-amber-600 border-t border-slate-100 pt-1 mt-1">
                <span className="flex items-center gap-1.5">Meal Plan Charges <span className="text-[10px] opacity-60">({displayMealCountStr})</span></span>
                <span>₹{displayMeals.toLocaleString('en-IN')}</span>
              </div>
            )}
            {(taxConfig?.enabled && displayTax > 0) && (
              <div className="flex justify-between text-xs font-bold text-slate-500 italic border-t border-slate-100 pt-1 mt-1">
                <span>GST ({((taxConfig.cgst || 0) + (taxConfig.sgst || 0))}%)</span>
                <span>₹{displayTax.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
          
          <div className="flex justify-between font-black text-sm"><span>Grand Total</span><span className="text-primary font-black">₹{finalTotal.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between text-xs text-slate-500 font-bold"><span>Advance Paid</span><span>₹{advancePayment.toLocaleString('en-IN')}</span></div>
          <Separator />
          <div className="flex justify-between font-black text-lg"><span>Balance Due</span><span className="text-primary">₹{(finalTotal - advancePayment).toLocaleString('en-IN')}</span></div>
        </div>
        <Button className="w-full h-12 rounded-2xl font-black text-lg shadow-lg" disabled={isSubmitting || (advancePayment > 0 && !paymentMethod)} onClick={handleSubmit}>
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : `Confirm ${reservationType === 'group' ? 'Group Booking' : 'Reservation'}`}
        </Button>
      </div>
    );
  };

  // ─── Render Group Edit Form (single-page, no wizard) ─────────────────────
  const renderGroupEditForm = () => {
    return (
      <div className="space-y-8 pb-8 group-edit-form">
        <style>{`
          .group-edit-form .group-step-section > div > button:last-of-type {
             display: none !important;
          }
        `}</style>

        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Bulk Editing Group</p>
              <h3 className="text-sm font-black text-slate-800 leading-tight">{groupName || 'Unnamed Group'}</h3>
            </div>
          </div>
          <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-600 font-black">
            {selectedRooms.length} Rooms
          </Badge>
        </div>

        <div className="space-y-8 divide-y divide-slate-100">
          <div className="group-step-section pt-0 space-y-4">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
               <span className="h-5 w-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">1</span>
               Dates & Guest
            </h4>
            {renderDatesStep()}
            {renderGuestStep()}
          </div>
          <div className="group-step-section pt-8 space-y-4">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
               <span className="h-5 w-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">2</span>
               Group Configuration
            </h4>
            {renderGroupConfigStep()}
          </div>
          <div className="group-step-section pt-8 space-y-4">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
               <span className="h-5 w-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">3</span>
               Room Assignments
            </h4>
            {renderRoomAssignmentStep()}
          </div>
          <div className="pt-8 space-y-4">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
               <span className="h-5 w-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">4</span>
               Summary & Confirmation
            </h4>
            {renderPaymentStep()}
          </div>
        </div>
      </div>
    );
  };

  // ─── Render Edit Form (single-page, no wizard) ───────────────────────────
  const renderEditForm = () => {
    const validDates = checkinISO && checkoutISO && new Date(checkinISO) < new Date(checkoutISO) && (!isDayUse || checkinTime < checkoutTime);
    // Resolve the original room ID regardless of whether roomId is a populated object or a plain string
    const originalRoomId = typeof initialBooking?.roomId === 'object'
      ? String((initialBooking!.roomId as any)._id)
      : String(initialBooking?.roomId ?? '');
    // Only flag conflict if the room genuinely conflicts AND it's not the booking's original room.
    // (Note: isRoomAvailable now returns true for the original room, so selectedRoom !== originalRoomId is extra safety)
    const isRoomConflicted = !!selectedRoom && !isRoomAvailable(selectedRoom) && selectedRoom !== originalRoomId;
    
    return (
      <div className="space-y-5">
        {/* Dates Row */}
        <div>
          <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2 block">Check-in / Check-out</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Input type="date" className="h-11 rounded-xl font-bold" value={checkinDate} onChange={e => {
                setCheckinDate(e.target.value);
                if (e.target.value >= checkoutDate) setCheckoutDate(format(addDays(parseISO(e.target.value), 1), 'yyyy-MM-dd'));
              }} />
              <Select value={checkinTime} onValueChange={setCheckinTime}>
                <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(hotel?.settings?.checkinTimes?.length ? hotel.settings.checkinTimes : ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']).map(t => <SelectItem key={t} value={t}>{format(parseISO(`2000-01-01T${t}:00`), 'h:mm a')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Input type="date" className="h-11 rounded-xl font-bold" value={checkoutDate} min={checkinDate} onChange={e => setCheckoutDate(e.target.value)} />
              <Select value={checkoutTime} onValueChange={setCheckoutTime}>
                <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(hotel?.settings?.checkoutTimes?.length ? hotel.settings.checkoutTimes : ['08:00','09:00','10:00','11:00','12:00','13:00','14:00']).map(t => <SelectItem key={t} value={t}>{format(parseISO(`2000-01-01T${t}:00`), 'h:mm a')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {validDates && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {isDayUse ? 'DAY USE' : `${nights} NIGHT${nights !== 1 ? 'S' : ''}`}
              </span>
            </div>
          )}
          {!validDates && checkinDate === checkoutDate && checkinTime >= checkoutTime && (
            <p className="text-xs font-bold text-red-500 mt-1">Check-out time must be after check-in.</p>
          )}
        </div>

        <Separator />

        {/* Room Selection */}
        {reservationType !== 'block' && (
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2 block">Room</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={selectedRoomType} onValueChange={val => { setSelectedRoomType(val); setSelectedRoom(''); }}>
                <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(rooms.map(r => r.roomType))).map(type => (
                    <SelectItem key={type} value={type} className="font-bold">{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedRoom || undefined} disabled={!selectedRoomType} onValueChange={val => {
                const rm = rooms.find(r => r._id === val);
                setSelectedRoom(val);
                if (rm) { setRoomPrice(rm.price); if (adults > rm.maxOccupancy) setAdults(rm.maxOccupancy); }
              }}>
                <SelectTrigger className={cn('h-11 rounded-xl font-bold transition-colors', isRoomConflicted && 'border-red-500 bg-red-50 text-red-700 shadow-[0_0_0_1px_rgba(239,68,68,0.1)]')}>
                  <SelectValue placeholder={rooms.filter(r => r.roomType === selectedRoomType).length === 0 ? "No Rooms Found" : "Room #"} />
                </SelectTrigger>
                <SelectContent>
                  {rooms.filter(r => r.roomType === selectedRoomType).map(room => {
                    const avail = isRoomAvailable(room._id);
                    const isCurrent = room._id === (typeof initialBooking?.roomId === 'object' ? (initialBooking.roomId as any)._id : initialBooking?.roomId);
                    const isSelectable = avail || isCurrent;
                    
                    const clash = !avail ? bookings.find(b => {
                        if (b.status === 'cancelled' || b.status === 'checked-out' || b.status === 'expired') return false;
                        const bRoomId = typeof b.roomId === 'object' ? (b.roomId as any)._id : b.roomId;
                        if (bRoomId !== room._id) return false;
                        const checkinDateStr = typeof b.checkin === 'string' ? b.checkin.slice(0, 10) : format(new Date(b.checkin), 'yyyy-MM-dd');
                        const checkoutDateStr = typeof b.checkout === 'string' ? b.checkout.slice(0, 10) : format(new Date(b.checkout), 'yyyy-MM-dd');
                        const bCI = toISO(checkinDateStr, b.checkinTime  || '14:00');
                        const bCO = toISO(checkoutDateStr, b.checkoutTime || '11:00');
                        return overlaps(checkinISO, checkoutISO, bCI, bCO);
                    }) : null;

                    const clashStatus = clash?.status;
                    const isOccupied = !avail && clashStatus === 'checked-in';
                    const isReserved = !avail && (clashStatus === 'reserved' || clash?.bookingType === 'enquiry' || clash?.reservationType === 'enquiry');

                    return (
                      <SelectItem 
                        key={room._id} 
                        value={room._id} 
                        disabled={!isSelectable}
                        className={cn("font-bold text-sm h-11", !isSelectable && "opacity-40")}
                      >
                        <div className="flex items-center justify-between w-full min-w-[240px] pr-1">
                           <div className="flex items-center gap-2">
                              <span className={cn(
                                 "w-2 h-2 rounded-full shrink-0",
                                  isOccupied ? 'bg-red-500' : 
                                  isReserved ? 'bg-indigo-500' :
                                  (room.status === 'maintenance' || room.status === 'under-maintenance') ? 'bg-slate-400' : 
                                  room.status === 'dirty' ? 'bg-amber-400' : 'bg-emerald-500'
                              )} />
                              <span className="whitespace-nowrap tabular-nums">Room #{room.roomNumber}</span>
                           </div>
                           <span className={cn(
                              'text-[10px] font-black uppercase px-2.5 py-1 rounded-full ml-4 tracking-widest leading-none shrink-0 border', 
                              isCurrent ? 'bg-slate-100 text-slate-600 border border-slate-200' : 
                              isOccupied ? 'bg-red-50 text-red-600 border-red-100' :
                              isReserved ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                              (room.status === 'maintenance' || room.status === 'under-maintenance') ? 'bg-slate-50 text-slate-500 border-slate-200' :
                              (room.status === 'dirty' ? 'bg-amber-100 text-amber-700 border-amber-200/50' : 'bg-emerald-100 text-emerald-700 border-emerald-200/50')
                           )}>
                              {isCurrent ? 'Current' : 
                               isOccupied ? 'Occupied' : 
                               isReserved ? 'Reserved' : 
                               (room.status === 'maintenance' || room.status === 'under-maintenance') ? 'Service' :
                               (room.status === 'dirty' ? 'Dirty' : 'Clean')}
                           </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {isRoomConflicted && (
              <p className="text-xs font-bold text-red-500 mt-2 bg-red-50/50 p-2 rounded-lg border border-red-100/50 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <Info className="h-3 w-3" />
                This room is no longer available for the selected dates.
              </p>
            )}
          </div>
        )}

        {/* Block reason */}
        {reservationType === 'block' && (
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2 block">Block Reason</Label>
            <Input className="h-11 rounded-xl font-bold" placeholder="e.g. Owner stay, maintenance…" value={blockReason} onChange={e => setBlockReason(e.target.value)} />
          </div>
        )}

        <Separator />

        {/* Adults + Plan + Rate */}
        {reservationType !== 'block' && selectedRoom && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1.5 block">Adults</Label>
              <Select value={adults.toString()} onValueChange={v => setAdults(Number(v))}>
                <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8].filter(n => n <= (rooms.find(r => r._id === selectedRoom)?.maxOccupancy || 6)).map(n => (
                    <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1.5 block">Children</Label>
              <Select value={children.toString()} onValueChange={v => setChildren(Number(v))}>
                <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4,5,6].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1.5 block">Plan</Label>
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(hotel?.settings?.stayPlans || [{key: 'EP', label: 'EP'}]).map((p: any) => {
                    const key = typeof p === 'string' ? p : p.key;
                    const label = typeof p === 'string' ? p : p.label;
                    const desc = typeof p === 'string' ? '' : p.desc;
                    return (
                      <SelectItem key={key} value={key} className="py-2.5">
                        <div className="flex flex-col">
                           <div className="flex items-center justify-between gap-12">
                             <span className="font-black text-xs uppercase tracking-tight">{label}</span>
                             {mealRates[key] > 0 && <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">₹{mealRates[key]}</span>}
                           </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1.5 block">Rate / Night</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">₹</span>
                <Input type="number" className="h-11 rounded-xl pl-7 font-bold bg-slate-50 border-slate-200 cursor-not-allowed opacity-80" value={roomPrice} readOnly />
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Lead Guest */}
        {reservationType !== 'block' && (
          <div className="space-y-3">
             <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1 block">Lead Guest</Label>
             {!selectedGuest ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                    <Input 
                      className="pl-10 h-11 rounded-xl font-bold" 
                      placeholder="Search for guest..." 
                      value={guestQuery} 
                      onChange={e => handleGuestSearch(e.target.value)} 
                    />
                    {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                  </div>
                  {guestResults.length > 0 && (
                    <div className="border rounded-xl divide-y overflow-hidden bg-white shadow-md animate-in fade-in slide-in-from-top-2">
                      {guestResults.map(g => (
                        <button key={g._id} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between" onClick={() => setSelectedGuest(g)}>
                          <div>
                            <div className="font-bold text-sm">{g.name}</div>
                            <div className="text-[10px] text-slate-500">{g.phone}</div>
                          </div>
                          <Badge variant="outline" className="text-[9px] font-black uppercase">Select</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                  <Button variant="outline" className="w-full h-11 rounded-xl border-2 font-black border-dashed opacity-60 hover:opacity-100" onClick={() => setShowNewGuest(true)}>
                    <UserPlus className="h-4 w-4 mr-2" /> Register New Guest
                  </Button>
                </div>
             ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between group">
                   <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-xs shadow-sm">
                        {selectedGuest.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-black text-sm text-slate-900">{selectedGuest.name}</div>
                        <div className="text-[10px] font-bold text-slate-500">{selectedGuest.phone}</div>
                      </div>
                   </div>
                   <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setSelectedGuest(null)}>Change</Button>
                </div>
             )}
          </div>
        )}

        {/* Guest Registration Popover (for single-page flow) */}
        {showNewGuest && (
           <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 space-y-4 animate-in zoom-in-95 fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">New Guest Registration</span>
                <button onClick={() => setShowNewGuest(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Full Name" className="h-11 rounded-xl font-bold" value={newGuest.name} onChange={e => setNewGuest({...newGuest, name: e.target.value})} />
                <Input placeholder="Phone" className="h-11 rounded-xl font-bold" value={newGuest.phone} onChange={e => setNewGuest({...newGuest, phone: e.target.value})} />
              </div>
              <Button className="w-full h-11 rounded-xl font-black bg-indigo-600 hover:bg-indigo-700" onClick={handleCreateGuest} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create & Select'}
              </Button>
           </div>
        )}

        <Separator />

        {/* Finance/Source Section */}
        {reservationType !== 'block' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Booking Source</Label>
              <Select value={bookingSource} onValueChange={setBookingSource}>
                <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['direct', 'whatsapp', 'booking.com', 'makemytrip', 'agent', 'corporate', 'walk-in', 'other'].map(s => (
                    <SelectItem key={s} value={s} className="font-bold capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Advance Payment</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input 
                  type="number" 
                  className="pl-9 h-11 rounded-xl font-bold" 
                  value={advancePayment} 
                  onChange={e => setAdvancePayment(Number(e.target.value))} 
                />
              </div>
            </div>
          </div>
        )}

        {advancePayment > 0 && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
             <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Payment Method</Label>
             <div className="grid grid-cols-4 gap-2">
                {['UPI', 'Cash', 'Card', 'Bank'].map(m => (
                  <Button 
                    key={m} 
                    type="button"
                    variant={paymentMethod === m ? 'default' : 'outline'} 
                    className={cn("h-9 rounded-lg text-[10px] font-black uppercase tracking-widest", paymentMethod === m ? 'bg-primary border-primary' : 'border-slate-200 text-slate-500')}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {m}
                  </Button>
                ))}
             </div>
          </div>
        )}
        {planType && planType !== 'EP' && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-black rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-1 w-fit">
            <Utensils className="h-3 w-3" />
            Extra ₹{(mealRates[planType] || 0).toLocaleString('en-IN')} / person
          </div>
        )}

        {/* Price summary */}
        {reservationType !== 'block' && selectedRoom && nights >= 0 && (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estimated Total</p>
                <p className="text-2xl font-black text-indigo-600">₹{totalAmount.toLocaleString('en-IN')}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Occupancy</p>
                <p className="text-xs font-black text-slate-700">{adults}A, {children}C</p>
              </div>
            </div>
            
            <div className="space-y-2 pt-3 border-t border-slate-200/60">
              <div className="flex justify-between text-[11px] font-bold text-slate-500">
                <span>Room charges ({nights}N)</span>
                <span className="text-slate-900">₹{baseSubtotal.toLocaleString('en-IN')}</span>
              </div>
              {extraCharge > 0 && (
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>Extra Person charges</span>
                  <span className="text-slate-900">₹{extraCharge.toLocaleString('en-IN')}</span>
                </div>
              )}
              {mealCharge > 0 && (
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>
                    {planType === 'custom' 
                      ? (planCustomText || 'Custom Plan')
                      : (PLAN_LABELS[planType as keyof typeof PLAN_LABELS] || planType + ' Plan')}
                  </span>
                  <span className="text-slate-900">₹{mealCharge.toLocaleString('en-IN')}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>GST ({ (taxConfig?.cgst||0)+(taxConfig?.sgst||0) }%)</span>
                  <span className="text-slate-900">₹{taxAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Special requests */}
        {reservationType !== 'block' && (
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1.5 block">Special Requests</Label>
                <textarea
                className="w-full h-16 rounded-xl border border-input bg-transparent px-3 py-2 text-sm font-medium resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="e.g. High floor, extra pillow…"
                value={specialRequests}
                onChange={e => setSpecialRequests(e.target.value)}
              />
            </div>
          </div>
        )}

        <Button
          className="w-full h-11 rounded-xl font-black"
          disabled={!validDates || isSubmitting || (!!isRoomConflicted)}
          onClick={handleSubmit}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save Changes'}
        </Button>
      </div>
    );
  };

  const stepContent: Record<StepType, () => React.JSX.Element> = {
    type: renderTypeStep,
    dates: renderDatesStep,
    room: renderRoomStep,
    guest: renderGuestStep,
    payment: renderPaymentStep,
    groupConfig: renderGroupConfigStep,
    roomAssignment: renderRoomAssignmentStep,
  };

  const currentStepNum = stepOrder.indexOf(step) + 1;
  const totalSteps = stepOrder.length;

  const Wrapper = asSheet ? Sheet : Dialog;
  const ContentWrapper = asSheet ? SheetContent : DialogContent;
  const TitleWrapper = asSheet ? SheetTitle : DialogTitle;

  return (
    <Wrapper open={isOpen} onOpenChange={onClose}>
      <ContentWrapper aria-describedby="dialog-description" className={asSheet ? cn("w-full sm:max-w-2xl lg:max-w-4xl p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-white focus:outline-none transition-all duration-500", (reservationType === 'group' && step === 'roomAssignment') || (reservationType === 'group' && step === 'payment') ? "sm:max-w-4xl" : "sm:max-w-3xl") : cn("w-full max-w-none h-auto sm:max-h-[96dvh] p-0 overflow-hidden border-none sm:rounded-[32px] rounded-none flex flex-col shadow-2xl bg-white focus:outline-none transition-all duration-500", (reservationType === 'group' && step === 'roomAssignment') || (reservationType === 'group' && step === 'payment') ? "sm:max-w-[850px]" : "sm:max-w-[500px]")}>
        <div className="bg-slate-50 border-b flex items-center justify-between p-4 sm:p-6 shrink-0 relative z-10">
          <div className="flex items-center gap-3 w-full">
            {/* Back button — show in wizard mode (new bookings OR group edits) */}
            {((!initialBooking && step !== 'type') || (initialBooking && isEditingGroup && step !== 'dates')) && (
              <Button variant="ghost" size="icon" onClick={goBack} className="h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-white shadow-sm border border-slate-200 shrink-0 hover:bg-slate-100 hover:scale-105 transition-all">
                <ArrowLeft className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
                <TitleWrapper className="text-lg sm:text-xl font-black tracking-tighter truncate">
                  {isEditingGroup ? 'Edit Group Booking' : (initialBooking ? 'Edit Booking' : (reservationType === 'group' ? 'Add Group Booking' : `New ${reservationType === 'block' ? 'Room Block' : reservationType === 'enquiry' ? 'Enquiry Hold' : 'Room Booking'}`))}
                </TitleWrapper>
               {!initialBooking && (
                 <p className="text-[10px] font-black tracking-widest text-primary/60 uppercase">
                   Step {currentStepNum} of {totalSteps} &bull; {stepLabel[step]}
                 </p>
               )}
               {initialBooking && !isEditingGroup && (
                 <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    {typeof initialBooking.roomId === 'object' 
                       ? `Room ${(initialBooking.roomId as any).roomNumber}` 
                       : rooms.find(r => r._id === initialBooking.roomId)?.roomNumber 
                         ? `Room ${rooms.find(r => r._id === initialBooking.roomId)!.roomNumber}` 
                         : ''}
                 </p>
               )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-white shadow-sm border border-slate-200 shrink-0 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all">
              <X className="h-5 w-5 sm:h-4 sm:w-4" />
            </Button>
            <TitleWrapper className="sr-only">New Booking Modal</TitleWrapper>
            <p id="dialog-description" className="sr-only">Modal for creating a new booking, editing an existing one, or managing group bookings.</p>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto bg-white/50 pb-6 sm:pb-6"
             onKeyDown={(e) => {
               if (e.key === 'Escape') {
                 e.stopPropagation();
                 onClose();
               }
             }}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0" />
              <span className="flex-1 leading-tight">{error}</span>
              <button onClick={() => setError(null)}><X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" /></button>
            </div>
          )}

          {initialBooking ? (
             isEditingGroup ? renderGroupEditForm() : renderEditForm()
          ) : (
            <AnimatePresence mode="wait">
              <motion.div 
                 key={step} 
                 initial={{ opacity: 0, x: 20 }} 
                 animate={{ opacity: 1, x: 0 }} 
                 exit={{ opacity: 0, x: -20 }} 
                 transition={{ type: "spring", stiffness: 300, damping: 30 }}
                 className="h-full"
              >
                {stepContent[step]()}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </ContentWrapper>
    </Wrapper>
  );
}
