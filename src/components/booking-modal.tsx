import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useBookings, type Booking, type Guest } from '../context/booking-context';
import { useAuth } from '../context/auth-context';
import { differenceInDays, format, addDays, parseISO, startOfDay, addHours } from 'date-fns';
import {
  Loader2, Search, UserPlus, IndianRupee, Info,
  CalendarCheck, Clock, Lock, Users, ArrowLeft, ChevronRight,
  Utensils, Coffee, Sun, Star, Bed, X
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { TimePicker } from './ui/time-picker';

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
  { key: 'MAP',    label: 'Modified American',     desc: 'Room + Breakfast + Dinner',             icon: Sun },
  { key: 'AP',     label: 'American Plan',         desc: 'Room + All Meals (B+L+D)',              icon: Utensils },
  { key: 'custom', label: 'Custom Inclusions',     desc: 'Specify your own package',              icon: Star },
];

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
}

export function BookingModal({ isOpen, onClose, selectedRoomId, selectedDate, initialBooking }: BookingModalProps) {
  const { rooms, bookings, createBooking, updateBooking, createGuest, searchGuests } = useBookings();
  const { hotel } = useAuth();

  // Step management
  type StepType = 'type' | 'dates' | 'room' | 'plan' | 'guest' | 'payment' | 'groupConfig' | 'roomAssignment';
  const [step, setStep] = useState<StepType>('type');
  const [reservationType, setReservationType] = useState<'booking' | 'enquiry' | 'block' | 'group'>('booking');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enquiry/Block expiry
  const [expiryHours, setExpiryHours] = useState('4');
  const [customExpiryHours, setcustomExpiryHours] = useState('6');
  const [blockReason, setBlockReason] = useState('');

  // Date/time state
  const defaultCheckinTime  = parseHotelTime(hotel?.settings?.checkinTime  || '14:00');
  const defaultCheckoutTime = parseHotelTime(hotel?.settings?.checkoutTime || '11:00');

  const [checkinDate,  setCheckinDate]  = useState('');
  const [checkinTime,  setCheckinTime]  = useState(defaultCheckinTime);
  const [checkoutDate, setCheckoutDate] = useState('');
  const [checkoutTime, setCheckoutTime] = useState(defaultCheckoutTime);

  // Room selection
  const [selectedRoom, setSelectedRoom] = useState<string>('');

  // Plan
  const [planType, setPlanType] = useState<'EP' | 'CP' | 'MAP' | 'AP' | 'custom'>('EP');
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

  // Group booking state
  const [groupName, setGroupName] = useState('');
  const [numRooms, setNumRooms] = useState(2);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [groupRoomPrefs, setGroupRoomPrefs] = useState<Record<string, number>>({});
  const [additionalGuests, setAdditionalGuests] = useState<Array<{ name: string; phone: string }>>([]);
  const [roomAssignments, setRoomAssignments] = useState<Record<string, { guestName: string; plan: 'EP' | 'CP' | 'MAP' | 'AP' | 'custom'; price: number }>>({});
  const [isSingleFolio, setIsSingleFolio] = useState(true);
  const [planMixed, setPlanMixed] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return;
    if (initialBooking) {
      const rm = typeof initialBooking.roomId === 'object' ? initialBooking.roomId : rooms.find(r => r._id === initialBooking.roomId);
      setReservationType(initialBooking.bookingType || 'booking');
      setCheckinDate(format(parseISO(initialBooking.checkin), 'yyyy-MM-dd'));
      setCheckinTime(initialBooking.checkinTime || defaultCheckinTime);
      setCheckoutDate(format(parseISO(initialBooking.checkout), 'yyyy-MM-dd'));
      setCheckoutTime(initialBooking.checkoutTime || defaultCheckoutTime);
      setSelectedRoom(rm?._id || '');
      setRoomPrice(initialBooking.roomPrice || rm?.price || 0);
      setPlanType(initialBooking.planType || 'EP');
      setplanCustomText(initialBooking.planCustomText || '');
      setAdults(initialBooking.adults || 2);
      setSelectedGuest(typeof initialBooking.guestId === 'object' ? initialBooking.guestId : null);
      setBookingSource(initialBooking.bookingSource || 'direct');
      setSpecialRequests(initialBooking.specialRequests || '');
      setAdvancePayment(initialBooking.advancePayment || 0);
      setStep('dates');
    } else {
      setStep('type');
      setReservationType('booking');
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      setCheckinDate(selectedDate || todayStr);
      setCheckinTime(defaultCheckinTime);
      setCheckoutDate(selectedDate ? format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd') : tomorrowStr);
      setCheckoutTime(defaultCheckoutTime);
      setSelectedRoom(selectedRoomId || '');
      setRoomPrice(rooms.find(r => r._id === selectedRoomId)?.price || 0);
      setPlanType('EP');
      setplanCustomText('');
      setAdults(2);
      setSelectedGuest(null);
      setGuestQuery('');
      setGuestResults([]);
      setShowNewGuest(false);
      setBookingSource('direct');
      setSpecialRequests('');
      setAdvancePayment(0);
      setPaymentMethod('');
      setBlockReason('');
      setExpiryHours(hotel?.settings?.enquiryHoldTime || '4');
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
  }, [isOpen, selectedRoomId, selectedDate, initialBooking, rooms, defaultCheckinTime, defaultCheckoutTime, hotel?.settings?.enquiryHoldTime]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Availability ─────────────────────────────────────────────────────────
  const checkinISO  = useMemo(() => toISO(checkinDate,  checkinTime), [checkinDate, checkinTime]);
  const checkoutISO = useMemo(() => toISO(checkoutDate, checkoutTime), [checkoutDate, checkoutTime]);

  const availableRooms = useMemo(() => {
    if (!checkinISO || !checkoutISO || new Date(checkinISO) >= new Date(checkoutISO)) return rooms;
    return rooms.filter(room => {
      if (room.status === 'maintenance' || room.status === 'under-maintenance') return false;
      return !bookings.some(b => {
        if (b.status === 'cancelled' || b.status === 'checked-out') return false;
        if (initialBooking && b._id === initialBooking._id) return false;
        const bRoomId = typeof b.roomId === 'object' ? b.roomId._id : b.roomId;
        if (bRoomId !== room._id) return false;
        const bCI = toISO(format(parseISO(b.checkin), 'yyyy-MM-dd'), b.checkinTime  || '00:00');
        const bCO = toISO(format(parseISO(b.checkout),'yyyy-MM-dd'), b.checkoutTime || '23:59');
        return overlaps(checkinISO, checkoutISO, bCI, bCO);
      });
    });
  }, [rooms, bookings, checkinISO, checkoutISO, initialBooking]);

  const isRoomAvailable = (roomId: string) => availableRooms.some(r => r._id === roomId);

  // ─── Price calculations ───────────────────────────────────────────────────
  const nights = useMemo(() => (checkinDate && checkoutDate
    ? Math.max(0, differenceInDays(startOfDay(parseISO(checkoutDate)), startOfDay(parseISO(checkinDate))))
    : 0), [checkinDate, checkoutDate]);
  
  const isDayUse = nights === 0 && checkinDate === checkoutDate;

  const mealRates: Record<string, number> = hotel?.settings?.mealRates || {};
  const mealCharge = planType !== 'EP' && planType !== 'custom'
    ? (mealRates[planType] || 0) * adults * Math.max(nights, isDayUse ? 1 : 0)
    : 0;

  const rm = rooms.find(r => r._id === selectedRoom);
  const baseOccupancy = rm?.baseOccupancy || 2;
  const extraPersonPrice = rm?.extraPersonPrice || 0;
  const extraAdults = Math.max(0, adults - baseOccupancy);
  const baseSubtotal  = roomPrice * Math.max(nights, isDayUse ? 1 : 0);
  const extraCharge   = extraAdults * extraPersonPrice * Math.max(nights, isDayUse ? 1 : 0);
  const subtotal = baseSubtotal + extraCharge + mealCharge;
  const taxConfig = hotel?.settings?.taxConfig;
  const taxAmount = taxConfig?.enabled ? ((subtotal * ((taxConfig.cgst || 0) + (taxConfig.sgst || 0))) / 100) : 0;
  const totalAmount = subtotal + taxAmount;

  // ─── Navigation ───────────────────────────────────────────────────────────
  const STEP_ORDER_BOOKING: StepType[] = ['type', 'dates', 'room', 'plan', 'guest', 'payment'];
  const STEP_ORDER_BLOCK:   StepType[] = ['type', 'dates', 'room', 'payment'];
  const STEP_ORDER_GROUP:   StepType[] = ['type', 'dates', 'groupConfig', 'guest', 'roomAssignment', 'payment'];

  const stepOrder = reservationType === 'block' ? STEP_ORDER_BLOCK : 
                    reservationType === 'group' ? STEP_ORDER_GROUP : STEP_ORDER_BOOKING;

  const goNext = (nextStep: StepType) => { 
    if (nextStep === 'roomAssignment' && reservationType === 'group') {
      const init: Record<string, { guestName: string; plan: 'EP' | 'CP' | 'MAP' | 'AP' | 'custom'; price: number }> = { ...roomAssignments };
      const guestNames = [selectedGuest?.name || 'Lead', ...additionalGuests.map(ag => ag.name).filter(Boolean)];
      
      selectedRooms.forEach((rid, i) => {
        if (!init[rid]) {
          const r = rooms.find(rm => rm._id === rid);
          init[rid] = { 
            guestName: guestNames[i] || 'TBA', 
            plan: planType as 'EP' | 'CP' | 'MAP' | 'AP' | 'custom', 
            price: r?.price || 0 
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
    dates: 'Dates & Times',
    room: 'Room Selection',
    plan: 'Stay Plan',
    guest: reservationType === 'group' ? 'Lead Guest' : 'Guest Info',
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
      goNext('payment');
    } catch (err: unknown) { 
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage); 
    }
    setIsSubmitting(false);
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (reservationType !== 'group' && !selectedRoom) { setError('Please select a room'); return; }
    if (reservationType === 'group' && selectedRooms.length === 0) { setError('Please select rooms'); return; }
    if (!nights && !isDayUse) { setError('Invalid dates'); return; }
    if (reservationType !== 'block' && !selectedGuest) { setError('Guest required'); return; }

    setIsSubmitting(true); setError(null);
    try {
      const effectiveExpiry = expiryHours === 'custom' ? parseFloat(customExpiryHours) : parseFloat(expiryHours);
      const enquiryExpiresAt = (reservationType === 'enquiry' || reservationType === 'block')
        ? addHours(new Date(), effectiveExpiry).toISOString()
        : undefined;

      if (reservationType === 'group') {
        const conflictRooms = selectedRooms.filter(rid => !isRoomAvailable(rid));
        if (conflictRooms.length > 0) {
          const conflictNames = conflictRooms.map(id => rooms.find(r => r._id === id)?.roomNumber).join(', ');
          setError(`Conflicts detected. The following rooms are no longer available: ${conflictNames}. Please reselect.`);
          setIsSubmitting(false);
          return;
        }

        const groupId = `GRP-${Date.now()}`;
        for (const rid of selectedRooms) {
          const assignment = roomAssignments[rid];
          const rmLocal = rooms.find(r => r._id === rid);
          if (!selectedGuest?._id) {
            setError('Guest is required for group booking');
            setIsSubmitting(false);
            return;
          }

          const payload = {
            roomId: rid,
            checkin: checkinDate,
            checkout: checkoutDate,
            checkinTime,
            checkoutTime,
            adults: 2,
            children: 0,
            roomPrice: assignment?.price || rmLocal?.price || 0,
            baseOccupancy: rmLocal?.baseOccupancy || 2,
            extraPersonPrice: rmLocal?.extraPersonPrice || 0,
            advancePayment: isSingleFolio ? (advancePayment / selectedRooms.length) : (advancePayment / selectedRooms.length),
            paymentMethod: (advancePayment > 0) ? paymentMethod : undefined,
            bookingSource,
            specialRequests: `GROUP: ${groupName}. Room Guest: ${assignment?.guestName || 'TBA'}. ${specialRequests}`,
            reservationType: 'booking' as const,
            planType: (assignment?.plan || planType) as 'EP' | 'CP' | 'MAP' | 'AP' | 'custom',
            isGroup: true,
            groupId,
            groupName,
            guestId: selectedGuest._id,
          };
          await createBooking(payload);
        }
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
          children: 0,
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
      { key: 'block',   label: 'Block',    desc: 'Maintenance / owner use', icon: Lock, color: 'text-slate-600 bg-slate-50 border-slate-200' },
      { key: 'group',   label: 'Group',    desc: 'Multiple rooms at once', icon: Users, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    ];
    return (
      <div className="grid grid-cols-2 gap-3 p-2">
        {types.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => { 
                setReservationType(t.key as 'booking' | 'enquiry' | 'block' | 'group');
                if (t.key === 'block') {
                   const bdStr = hotel?.settings?.blockDuration?.split(' ')[0] || '1';
                   const bd = parseInt(bdStr, 10);
                   if (!isNaN(bd) && checkinDate) {
                      setCheckoutDate(format(addDays(parseISO(checkinDate), bd), 'yyyy-MM-dd'));
                   }
                }
                goNext('dates'); 
              }}
              className={cn('flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all text-center active:scale-95', t.color, 'hover:scale-[1.02] hover:shadow-md cursor-pointer')}>
              <Icon className="h-7 w-7" />
              <span className="font-black text-sm">{t.label}</span>
              <span className="text-[10px] font-medium opacity-70 leading-tight">{t.desc}</span>
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
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
          <Label className="text-xs font-black uppercase tracking-widest opacity-60">Number of Rooms</Label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setNumRooms(Math.max(2, numRooms - 1))}>–</Button>
            <span className="font-black text-lg">{numRooms}</span>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setNumRooms(Math.min(50, numRooms + 1))}>+</Button>
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-xs font-black uppercase tracking-widest opacity-60">Room Distribution</Label>
          <div className="grid gap-2">
            {roomTypesInHotel.map(type => (
              <div key={type} className="flex items-center justify-between p-2.5 rounded-xl border bg-white">
                <span className="text-xs font-bold">{type}</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setGroupRoomPrefs({...groupRoomPrefs, [type]: Math.max(0, (groupRoomPrefs[type] || 0) - 1)})}>–</Button>
                  <span className="text-xs font-black w-4 text-center">{groupRoomPrefs[type] || 0}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setGroupRoomPrefs({...groupRoomPrefs, [type]: (groupRoomPrefs[type] || 0) + 1})}>+</Button>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full h-8 text-[10px] font-black uppercase tracking-widest mt-2 border-dashed"
            onClick={() => {
              const newSelection: string[] = [];
              Object.entries(groupRoomPrefs).forEach(([type, count]) => {
                const candidates = availableRooms.filter(r => r.roomType === type).map(r => r._id);
                newSelection.push(...candidates.slice(0, count));
              });
              if (newSelection.length < numRooms) {
                const remaining = availableRooms.filter(r => !newSelection.includes(r._id)).map(r => r._id);
                newSelection.push(...remaining.slice(0, numRooms - newSelection.length));
              }
              setSelectedRooms(newSelection);
            }}>Auto-select Rooms</Button>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-black uppercase tracking-widest opacity-60">Select Rooms ({selectedRooms.length}/{numRooms})</Label>
          <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
            {rooms.map(room => {
              const avail = isRoomAvailable(room._id);
              const idx = selectedRooms.indexOf(room._id);
              const sel = idx !== -1;
              return (
                <button key={room._id} disabled={!avail} onClick={() => sel ? setSelectedRooms(selectedRooms.filter(id => id !== room._id)) : (selectedRooms.length < numRooms && setSelectedRooms([...selectedRooms, room._id]))}
                  className={cn('h-10 rounded-lg border-2 flex items-center justify-center relative transition-all', sel ? 'border-primary bg-primary text-white font-black' : avail ? 'border-slate-200 hover:border-primary/40' : 'opacity-20 cursor-not-allowed')}>
                  <span className="text-[10px]">{room.roomNumber}</span>
                  {sel && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white text-primary text-[8px] rounded-full border border-primary flex items-center justify-center font-black">{idx + 1}</span>}
                </button>
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
              <SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>{PLAN_TYPES.map(p => <SelectItem key={p.key} value={p.key}>{p.key} — {p.label}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        <Button className="w-full h-11 rounded-xl font-black" disabled={!groupName || selectedRooms.length < 2} onClick={() => goNext('guest')}>Continue <ChevronRight className="ml-1 h-4 w-4" /></Button>
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
            <Input type="date" className="h-11 rounded-xl" value={checkinDate} onChange={e => { 
                setCheckinDate(e.target.value); 
                if (e.target.value >= checkoutDate) setCheckoutDate(format(addDays(parseISO(e.target.value), 1), 'yyyy-MM-dd')); 
                if (selectedRoom) { setSelectedRoom(''); setError('Dates changed. Please reselect a room.'); }
            }} />
            <TimePicker 
               className="h-11 rounded-xl font-bold" 
               value={checkinTime} 
               onChange={v => { setCheckinTime(v); if (selectedRoom) { setSelectedRoom(''); setError('Dates changed. Please reselect a room.'); } }} 
            />
          </div>
          <div className="space-y-1.5 col-span-2 sm:col-span-1">
            <Label className="text-xs font-black uppercase tracking-widest opacity-60">Check-out</Label>
            <Input type="date" className="h-11 rounded-xl" value={checkoutDate} min={checkinDate} onChange={e => {
                setCheckoutDate(e.target.value);
                if (selectedRoom) { setSelectedRoom(''); setError('Dates changed. Please reselect a room.'); }
            }} />
            <TimePicker 
               className="h-11 rounded-xl font-bold" 
               value={checkoutTime} 
               onChange={v => { setCheckoutTime(v); if (selectedRoom) { setSelectedRoom(''); setError('Dates changed. Please reselect a room.'); } }} 
            />
          </div>
        </div>
        {!validDates && checkinDate === checkoutDate && checkinTime >= checkoutTime && (
          <p className="text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg mt-2 inline-block">Check-out time must be after check-in time for day use.</p>
        )}
        {validDates && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-primary/10 text-primary text-xs font-black px-3 py-1 rounded-full">{isDayUse ? 'Day Use' : `${nights} night${nights !== 1 ? 's' : ''}`}</span>
            <span className={cn('text-xs font-black px-3 py-1 rounded-full', availableRooms.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{availableRooms.length} room{availableRooms.length !== 1 ? 's' : ''} available</span>
          </div>
        )}
        {(reservationType === 'enquiry' || reservationType === 'block') && (
          <div className={cn('rounded-xl border-2 p-4 space-y-3', reservationType === 'enquiry' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50')}>
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
            {reservationType === 'block' && (
              <div>
                <Label className="text-xs font-black uppercase tracking-widest opacity-60 mb-1 block">Reason (optional)</Label>
                <Input className="h-10 rounded-xl" placeholder="e.g. Owner stay, deep cleaning…" value={blockReason} onChange={e => setBlockReason(e.target.value)} />
              </div>
            )}
          </div>
        )}
        <Button className="w-full h-11 rounded-xl font-black" disabled={!validDates} onClick={() => goNext(reservationType === 'group' ? 'groupConfig' : 'room')}>Continue <ChevronRight className="ml-1 h-4 w-4" /></Button>
      </div>
    );
  };

  // ─── Render Step: Room ────────────────────────────────────────────────────
  const renderRoomStep = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
        {rooms.map(room => {
          const avail = isRoomAvailable(room._id);
          const sel = selectedRoom === room._id;
          return (
            <button key={room._id} disabled={!avail} onClick={() => { setSelectedRoom(room._id); setRoomPrice(room.price); }}
              className={cn('p-3 rounded-xl border-2 text-left transition-all flex flex-col gap-1', sel ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm' : avail ? 'border-slate-200 hover:border-primary/40 bg-white' : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed')}>
              <div className="flex items-center justify-between"><span className="font-black text-sm">{room.roomNumber}</span><span className={cn('text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full', avail ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{avail ? 'Free' : 'Occupied'}</span></div>
              <span className="text-[10px] font-bold text-slate-400 capitalize">{room.roomType}</span>
              <span className="text-xs font-black text-primary mt-1">₹{room.price}<span className="text-[9px] font-medium text-slate-400">/night</span></span>
            </button>
          );
        })}
      </div>
      {selectedRoom && (
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
          <Label className="text-xs font-black uppercase tracking-widest opacity-60 shrink-0">Rate/night</Label>
          <div className="relative flex-1">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input type="number" className="h-9 pl-8 rounded-lg font-bold" value={roomPrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoomPrice(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      )}
      {selectedRoom && nights >= 0 && (
        <div className="rounded-xl bg-muted/30 border p-4 space-y-1.5 text-xs font-bold">
          <div className="flex justify-between text-slate-500"><span>Stay ({Math.max(nights, isDayUse ? 1 : 0)}N)</span><span className="text-slate-800">₹{baseSubtotal.toLocaleString()}</span></div>
          {extraAdults > 0 && <div className="flex justify-between text-slate-500"><span>Extra persons</span><span>+ ₹{extraCharge.toLocaleString()}</span></div>}
          {taxConfig?.enabled && <div className="flex justify-between text-orange-600"><span>GST</span><span>+ ₹{taxAmount.toLocaleString()}</span></div>}
          <Separator className="my-1" />
          <div className="flex justify-between text-base font-black text-primary"><span>Total</span><span>₹{totalAmount.toLocaleString()}</span></div>
        </div>
      )}
      <div>
        <Label className="text-xs font-black uppercase tracking-widest opacity-60 mb-1.5 block">Adults</Label>
        <Select value={adults.toString()} onValueChange={v => setAdults(Number(v))}>
          <SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger>
          <SelectContent>{[1,2,3,4,5,6].map(n => <SelectItem key={n} value={n.toString()}>{n} Adult{n > 1 ? 's' : ''}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button className="w-full h-11 rounded-xl font-black" disabled={!selectedRoom} onClick={() => goNext(reservationType === 'block' ? 'payment' : 'plan')}>Continue <ChevronRight className="ml-1 h-4 w-4" /></Button>
    </div>
  );

  // ─── Render Step: Plan ────────────────────────────────────────────────────
  const renderPlanStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        {PLAN_TYPES.map(p => {
          const Icon = p.icon;
          const rate = p.key !== 'EP' && p.key !== 'custom' ? (mealRates[p.key] || 0) : 0;
          return (
            <button key={p.key} onClick={() => setPlanType(p.key as 'EP' | 'CP' | 'MAP' | 'AP' | 'custom')} className={cn('w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left', planType === p.key ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white')}>
              <div className={cn('p-2.5 rounded-lg', planType === p.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500')}><Icon className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0"><span className="font-black text-sm uppercase">{p.key}</span><p className="text-[10px] text-slate-400">{p.desc}</p></div>
              {rate > 0 && <span className="text-xs font-black text-primary shrink-0">+₹{rate}/pp</span>}
            </button>
          );
        })}
      </div>
      <Button className="w-full h-11 rounded-xl font-black" onClick={() => goNext('guest')}>Continue <ChevronRight className="ml-1 h-4 w-4" /></Button>
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

              <Button className="w-full h-11 rounded-xl font-black" onClick={() => goNext(reservationType === 'group' ? 'roomAssignment' : 'payment')}>
                Continue to {reservationType === 'group' ? 'Assignments' : 'Payment'} <ChevronRight className="ml-1 h-4 w-4" />
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
        <div className="border rounded-xl overflow-hidden text-xs">
          <table className="w-full">
            <thead className="bg-slate-50 border-b"><tr><th className="p-2 text-left">Room</th><th className="p-2 text-left">Guest</th><th className="p-2 text-right">Price</th></tr></thead>
            <tbody>
              {selectedRooms.map(rid => {
                const r = rooms.find(rmLocal => rmLocal._id === rid);
                const a = roomAssignments[rid] || { guestName: 'TBA', plan: planType, price: r?.price || 0 };
                return (
                  <tr key={rid} className="border-b">
                    <td className="p-2 font-black">#{r?.roomNumber}</td>
                    <td className="p-2">
                       <Select value={a.guestName} onValueChange={v => setRoomAssignments({...roomAssignments, [rid]: {...a, guestName: v}})}>
                        <SelectTrigger className="h-8 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{['TBA', ...allGroupGuestNames].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                       </Select>
                    </td>
                    <td className="p-2 text-right">₹{a.price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button className="w-full h-11 rounded-xl font-black" onClick={() => goNext('payment')}>Continue <ChevronRight className="ml-1 h-4 w-4" /></Button>
      </div>
    );
  };

  // ─── Render Step: Payment ─────────────────────────────────────────────────
  const renderPaymentStep = () => {
    const isGroup = reservationType === 'group';
    let groupSubtotal = 0;
    if (isGroup) {
      selectedRooms.forEach(rid => {
        const a = roomAssignments[rid];
        const roomStay = (a?.price || 0) * Math.max(nights, isDayUse ? 1 : 0);
        // Add meal costs for each room if applicable
        const mealRate = (a?.plan && a.plan !== 'EP' && a.plan !== 'custom') ? (mealRates[a.plan] || 0) : 0;
        const roomMeals = mealRate * adults * Math.max(nights, isDayUse ? 1 : 0);
        groupSubtotal += roomStay + roomMeals;
      });
    }
    const groupTaxAmount = isGroup && taxConfig?.enabled ? (groupSubtotal * ((taxConfig.cgst || 0) + (taxConfig.sgst || 0)) / 100) : 0;
    const finalTotal = isGroup ? (groupSubtotal + groupTaxAmount) : totalAmount;
    
    return (
      <div className="space-y-4">
        <div className="p-4 bg-slate-50 rounded-2xl border space-y-2">
          <div className="flex justify-between font-bold text-sm"><span>Total Amount</span><span className="text-primary font-black">₹{finalTotal.toLocaleString()}</span></div>
          <div className="flex justify-between text-xs text-slate-500"><span>Advance Paid</span><span>₹{advancePayment.toLocaleString()}</span></div>
          <Separator />
          <div className="flex justify-between font-black text-lg"><span>Balance Due</span><span className="text-primary">₹{(finalTotal - advancePayment).toLocaleString()}</span></div>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Collect Advance</Label>
          <div className="flex gap-2">
            <Input type="number" className="h-11 rounded-xl" value={advancePayment} onChange={e => setAdvancePayment(parseFloat(e.target.value) || 0)} />
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-11 rounded-xl w-32"><SelectValue placeholder="Method" /></SelectTrigger>
              <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="upi">UPI</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <Button className="w-full h-12 rounded-2xl font-black text-lg shadow-lg" disabled={isSubmitting || (advancePayment > 0 && !paymentMethod)} onClick={handleSubmit}>
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Confirm Reservation'}
        </Button>
      </div>
    );
  };

  const stepContent: Record<StepType, () => React.JSX.Element> = {
    type: renderTypeStep,
    dates: renderDatesStep,
    room: renderRoomStep,
    plan: renderPlanStep,
    guest: renderGuestStep,
    payment: renderPaymentStep,
    groupConfig: renderGroupConfigStep,
    roomAssignment: renderRoomAssignmentStep,
  };

  const currentStepNum = stepOrder.indexOf(step) + 1;
  const totalSteps = stepOrder.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] w-full max-w-none h-[100dvh] sm:h-auto p-0 overflow-hidden border-none sm:rounded-[32px] rounded-none flex flex-col shadow-2xl bg-white">
        <div className="bg-slate-50 border-b flex items-center justify-between p-4 sm:p-6 shrink-0 relative z-10">
          <div className="flex items-center gap-3 w-full">
            {step !== 'type' && (
              <Button variant="ghost" size="icon" onClick={goBack} className="h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-white shadow-sm border border-slate-200 shrink-0 hover:bg-slate-100 hover:scale-105 transition-all">
                <ArrowLeft className="h-5 w-5 sm:h-4 sm:w-4" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
               <DialogTitle className="text-lg sm:text-xl font-black tracking-tighter truncate">{initialBooking ? 'Edit' : 'New'} Reservation</DialogTitle>
               <p className="text-[10px] font-black tracking-widest text-primary/60 uppercase">
                 Step {currentStepNum} of {totalSteps} &bull; {stepLabel[step]}
               </p>
            </div>
            <DialogTitle className="sr-only">New Booking Modal</DialogTitle>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto bg-white/50 pb-24 sm:pb-6"
             onKeyDown={(e) => {
               if (e.key === 'Escape') {
                 e.stopPropagation();
                 onClose();
               }
             }}>
          <AnimatePresence mode="wait">
            <motion.div 
               key={step} 
               initial={{ opacity: 0, x: 20 }} 
               animate={{ opacity: 1, x: 0 }} 
               exit={{ opacity: 0, x: -20 }} 
               transition={{ type: "spring", stiffness: 300, damping: 30 }}
               className="h-full"
            >
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0" />
                  <span className="flex-1 leading-tight">{error}</span>
                  <button onClick={() => setError(null)}><X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" /></button>
                </div>
              )}
              {stepContent[step]()}
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
