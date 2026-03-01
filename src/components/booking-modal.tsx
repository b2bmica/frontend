import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBookings } from '../context/booking-context';
import { useAuth } from '../context/auth-context';
import { differenceInDays, format, addDays, parseISO, startOfDay, isBefore, isSameDay } from 'date-fns';
import { Loader2, Search, UserPlus, IndianRupee, Info, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRoomId?: string;
  selectedDate?: string;
  initialBooking?: any;
}

const OTA_CHANNELS = [
  { value: 'direct', label: 'Walk-in / Direct' },
  { value: 'phone', label: 'Phone Booking' },
  { value: 'mmt', label: 'MakeMyTrip' },
  { value: 'goibibo', label: 'Goibibo' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'agoda', label: 'Agoda' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'cleartrip', label: 'Cleartrip' },
  { value: 'easemytrip', label: 'EaseMyTrip' },
];

export function BookingModal({ isOpen, onClose, selectedRoomId, selectedDate, initialBooking }: BookingModalProps) {
  const { rooms, bookings, createBooking, updateBooking, createGuest, searchGuests } = useBookings();
  const { hotel } = useAuth();
  const [step, setStep] = useState<'guest' | 'booking'>('guest');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guest search
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState<any[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewGuest, setShowNewGuest] = useState(false);

  // New guest form
  const [newGuest, setNewGuest] = useState({
    name: '', phone: '', email: '', nationality: 'Indian',
    idProof: { idType: 'aadhaar', number: '' }
  });

  // Booking form
  const [bookingForm, setBookingForm] = useState({
    roomId: '', checkin: '', checkout: '', adults: 2, children: 0,
    advancePayment: 0, bookingSource: 'direct', paymentMethod: '',
    baseOccupancy: 2, extraPersonPrice: 0, roomPrice: 0
  });

  // Safe date parser helper
  const safeParse = (dStr: string) => {
    if (!dStr) return new Date();
    // For YYYY-MM-DD, parseISO is clean. 
    return startOfDay(parseISO(dStr));
  };

  // Derived State
  const selectedRoom = rooms.find(r => r._id === bookingForm.roomId);
  const nights = (bookingForm.checkin && bookingForm.checkout)
    ? differenceInDays(safeParse(bookingForm.checkout), safeParse(bookingForm.checkin))
    : 0;
  
  const baseSubtotal = nights * (bookingForm.roomPrice || 0);
  
  // Extra person logic
  const extraAdults = Math.max(0, bookingForm.adults - (bookingForm.baseOccupancy || 2));
  const extraPersonCharge = extraAdults * (bookingForm.extraPersonPrice || 0) * nights;
  
  const subtotal = baseSubtotal + extraPersonCharge;
  
  // Tax logic
  const taxConfig = hotel?.settings?.taxConfig;
  let taxAmount = 0;
  if (taxConfig?.enabled && taxConfig.cgst !== undefined && taxConfig.sgst !== undefined && subtotal > 0) {
    const cgst = (subtotal * (taxConfig.cgst || 0)) / 100;
    const sgst = (subtotal * (taxConfig.sgst || 0)) / 100;
    taxAmount = cgst + sgst;
  }
  
  const totalAmount = subtotal + taxAmount;
  const balanceDue = totalAmount - (bookingForm.advancePayment || 0);

  // Available rooms calculation
  const availableRooms = useMemo(() => {
    if (!bookingForm.checkin || !bookingForm.checkout) return rooms;
    
    const start = safeParse(bookingForm.checkin);
    const end = safeParse(bookingForm.checkout);

    return rooms.filter(room => {
      // Check for overlapping active bookings
      const hasConflict = bookings.some(b => {
        if (!b.roomId) return false;
        const bRoomId = typeof b.roomId === 'object' ? b.roomId._id : b.roomId;
        if (bRoomId !== room._id) return false;
        if (b.status === 'cancelled' || b.status === 'checked-out') return false;

        const bStart = safeParse(b.checkin);
        const bEnd = safeParse(b.checkout);

        // Standard overlap: (StartA < EndB) && (EndA > StartB)
        return start < bEnd && end > bStart;
      });

        // Exclude rooms under maintenance
        const isMaintenance = room.status === 'maintenance' || room.status === 'under-maintenance';

        return !hasConflict && !isMaintenance;
      });
    }, [rooms, bookings, bookingForm.checkin, bookingForm.checkout]);

  useEffect(() => {
    if (isOpen) {
      if (initialBooking) {
        setStep('booking');
        setSelectedGuest(typeof initialBooking.guestId === 'object' ? initialBooking.guestId : null);
        setBookingForm({
          roomId: (typeof initialBooking.roomId === 'object' ? initialBooking.roomId._id : initialBooking.roomId) || '',
          checkin: format(new Date(initialBooking.checkin), 'yyyy-MM-dd'),
          checkout: format(new Date(initialBooking.checkout), 'yyyy-MM-dd'),
          adults: initialBooking.adults || 1,
          children: initialBooking.children || 0,
          advancePayment: initialBooking.advancePayment || 0,
          bookingSource: initialBooking.bookingSource || 'direct',
          paymentMethod: '',
          baseOccupancy: initialBooking.baseOccupancy || 2,
          extraPersonPrice: initialBooking.extraPersonPrice || 0,
          roomPrice: initialBooking.roomPrice || 0
        });
      } else {
        setStep('guest');
        setSelectedGuest(null);
        setGuestQuery('');
        setGuestResults([]);
        setShowNewGuest(false);
        setError(null);
        setNewGuest({ name: '', phone: '', email: '', nationality: 'Indian', idProof: { idType: 'aadhaar', number: '' } });
        
        const initialCheckin = selectedDate || format(new Date(), 'yyyy-MM-dd');
        // Avoid TZ issues by adding day to the start-of-day parsed date
        const initialCheckout = format(addDays(safeParse(initialCheckin), 1), 'yyyy-MM-dd');

        setBookingForm({
          roomId: selectedRoomId || '',
          checkin: initialCheckin,
          checkout: initialCheckout,
          adults: 2, children: 0,
          advancePayment: 0,
          paymentMethod: '',
          bookingSource: 'direct',
          baseOccupancy: 2,
          extraPersonPrice: 0,
          roomPrice: 0
        });
      }
    }
  }, [isOpen, selectedRoomId, selectedDate, initialBooking]);

  useEffect(() => {
    if (selectedRoom) {
      // Logic: Only update the price automatically if:
      // 1. It's a new booking
      // 2. It's an existing booking but the ROOM has changed from its original room
      const originalRoomId = initialBooking 
        ? (typeof initialBooking.roomId === 'object' ? initialBooking.roomId._id : initialBooking.roomId)
        : null;

      if (!initialBooking || bookingForm.roomId !== originalRoomId) {
        setBookingForm(prev => ({
          ...prev,
          baseOccupancy: selectedRoom.baseOccupancy || 2,
          extraPersonPrice: selectedRoom.extraPersonPrice || 0,
          roomPrice: selectedRoom.price || 0
        }));
      }
    }
  }, [bookingForm.roomId, selectedRoom, initialBooking]);

  // Ensure checkout is after checkin
  useEffect(() => {
    if (bookingForm.checkin && bookingForm.checkout) {
      const start = safeParse(bookingForm.checkin);
      const end = safeParse(bookingForm.checkout);
      
      if (!isBefore(start, end) || isSameDay(start, end)) {
        // Automatically bump checkout to checkin + 1
        setBookingForm(prev => ({
          ...prev,
          checkout: format(addDays(start, 1), 'yyyy-MM-dd')
        }));
      }
    }
  }, [bookingForm.checkin]);

  const handleGuestSearch = async (query: string) => {
    setGuestQuery(query);
    if (query.length < 2) { setGuestResults([]); return; }
    setIsSearching(true);
    try {
      const results = await searchGuests(query);
      setGuestResults(results);
    } catch { /* ignore */ }
    setIsSearching(false);
  };

  const handleCreateGuest = async () => {
    // Basic validations
    if (!newGuest.name.trim()) { setError('Guest name is required'); return; }
    
    // Phone validation (10-15 digits, allowing leading +)
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (!phoneRegex.test(newGuest.phone)) {
      setError('Please enter a valid phone number (10-15 digits)');
      return;
    }

    // Email validation
    if (newGuest.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newGuest.email)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    // ID Proof validation
    if (newGuest.idProof.number) {
      if (newGuest.idProof.idType === 'aadhaar') {
        // Aadhaar should be 12 digits
        if (!/^\d{12}$/.test(newGuest.idProof.number)) {
          setError('Aadhaar number must be exactly 12 digits');
          return;
        }
      }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // Sanitize payload: only send idProof if a number is provided
      const payload: any = { 
        name: newGuest.name,
        phone: newGuest.phone,
        email: newGuest.email || undefined,
        nationality: newGuest.nationality
      };

      if (newGuest.idProof.number) {
        payload.idProof = {
          idType: newGuest.idProof.idType,
          number: newGuest.idProof.number
        };
      }

      const guest = await createGuest(payload);
      setSelectedGuest(guest);
      setStep('booking');
    } catch (err: any) {
      setError(err.message || 'Failed to create guest record');
    }
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuest || nights <= 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (initialBooking) {
        await updateBooking(initialBooking._id, bookingForm);
        onClose();
      } else {
        const finalData = { 
          ...bookingForm, 
          guestId: selectedGuest?._id,
          paymentMethod: bookingForm.advancePayment > 0 ? bookingForm.paymentMethod : undefined
        };
        await createBooking(finalData);
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="fixed left-0 top-0 translate-x-0 translate-y-0 h-full w-full max-w-none sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-[550px] sm:h-auto sm:max-h-[85vh] overflow-y-auto p-0 border-none shadow-2xl [&>button]:z-50 gap-0 rounded-none sm:rounded-3xl flex flex-col"
      >
        <div className="bg-muted/30 border-b p-5 relative flex-none">
          <DialogHeader className="pt-2 px-0">
          <DialogTitle className="text-3xl font-black tracking-tight text-slate-900 leading-none">
            {initialBooking ? 'Modify' : 'New'} Reservation
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            {step === 'guest' ? 'Identify guest from local records' : `Designing stay for ${selectedGuest?.name}`}
          </DialogDescription>
        </DialogHeader>
        </div>

        <div className="p-5 flex-1">
          {step === 'guest' && !showNewGuest && (
            <div className="space-y-4 py-0">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  className="pl-10 h-11 rounded-xl bg-muted/50 border-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="Search by name, phone, or email..."
                  value={guestQuery}
                  onChange={e => handleGuestSearch(e.target.value)}
                />
              </div>
              {isSearching && <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>}
              {guestResults.length > 0 && (
                <div className="border rounded-2xl divide-y overflow-hidden shadow-sm">
                  {guestResults.map((guest: any) => (
                    <button
                      key={guest._id}
                      className="w-full text-left px-4 py-3 hover:bg-primary/5 transition flex items-center justify-between group"
                      onClick={() => { setSelectedGuest(guest); setStep('booking'); }}
                    >
                      <div>
                        <div className="font-black text-sm group-hover:text-primary transition-colors">{guest.name}</div>
                        <div className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">{guest.phone} {guest.email && `· ${guest.email}`}</div>
                      </div>
                      <div className="p-1 px-2 rounded-full bg-muted text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Select</div>
                    </button>
                  ))}
                </div>
              )}
              {guestQuery.length >= 2 && guestResults.length === 0 && !isSearching && (
                <div className="text-center py-8 rounded-2xl bg-muted/30 border border-dashed">
                  <p className="text-sm font-bold text-muted-foreground">Guest not found in database</p>
                </div>
              )}
              <Button variant="outline" className="w-full h-11 rounded-xl border-2 font-bold" onClick={() => setShowNewGuest(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Register New Guest
              </Button>
            </div>
          )}

          {step === 'guest' && showNewGuest && (
            <div className="space-y-4 py-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-70">Guest Identity *</Label>
                  <Input required className="h-11 rounded-xl" value={newGuest.name} onChange={e => setNewGuest({ ...newGuest, name: e.target.value })} placeholder="Full name as per ID" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-70">Mobile *</Label>
                  <Input 
                    required 
                    type="tel"
                    pattern="^[0-9+]{10,15}$"
                    title="Please enter a valid phone number (10-15 digits)"
                    className="h-11 rounded-xl" 
                    value={newGuest.phone} 
                    onChange={e => setNewGuest({ ...newGuest, phone: e.target.value })} 
                    placeholder="+91..." 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-70">E-mail</Label>
                  <Input 
                    type="email"
                    className="h-11 rounded-xl" 
                    value={newGuest.email} 
                    onChange={e => setNewGuest({ ...newGuest, email: e.target.value })} 
                    placeholder="guest@domain.com" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-70">Document Type</Label>
                  <Select value={newGuest.idProof.idType} onValueChange={val => setNewGuest({ ...newGuest, idProof: { ...newGuest.idProof, idType: val } })}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="driving-license">Driving License</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-70">ID Number</Label>
                  <Input className="h-11 rounded-xl" value={newGuest.idProof.number} onChange={e => setNewGuest({ ...newGuest, idProof: { ...newGuest.idProof, number: e.target.value } })} placeholder="Document number" />
                </div>
              </div>
              {error && <p className="text-xs font-bold text-destructive bg-destructive/5 p-3 rounded-lg flex items-center gap-2"><Info className="h-4 w-4" /> {error}</p>}
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setShowNewGuest(false)} className="flex-1 font-bold">Cancel</Button>
                <Button onClick={handleCreateGuest} disabled={isSubmitting || !newGuest.name || !newGuest.phone} className="flex-1 h-11 rounded-xl font-black">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Register Guest'}
                </Button>
              </div>
            </div>
          )}

          {step === 'booking' && (
            <form onSubmit={handleSubmit} className="space-y-4 py-0">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest opacity-70">Inventory Selection *</Label>
                <div className="grid grid-cols-[1fr,120px] gap-2">
                  <Select value={bookingForm.roomId} onValueChange={val => setBookingForm({ ...bookingForm, roomId: val })}>
                    <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold">
                      <SelectValue placeholder="Which room are they staying in?" />
                    </SelectTrigger>
                     <SelectContent>
                      {initialBooking && (
                        <SelectItem value={bookingForm.roomId} className="font-medium">
                          Current: Room {selectedRoom?.roomNumber} — {selectedRoom?.roomType}
                        </SelectItem>
                      )}
                      {availableRooms.map(room => (
                        <SelectItem key={room._id} value={room._id} className="font-medium">
                          Room {room.roomNumber} — {room.roomType} (₹{room.price}/night) • Limit: {room.baseOccupancy}
                        </SelectItem>
                      ))}
                      {availableRooms.length === 0 && !initialBooking && (
                        <div className="p-4 text-center text-xs text-muted-foreground font-bold">No rooms available for these dates</div>
                      )}
                    </SelectContent>
                  </Select>
                  {/* Rate input removed as requested */}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-xs font-black uppercase tracking-widest opacity-70">Check-in</Label><Input type="date" className="h-11 rounded-xl" required value={bookingForm.checkin} onChange={e => setBookingForm({ ...bookingForm, checkin: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs font-black uppercase tracking-widest opacity-70">Check-out</Label><Input type="date" className="h-11 rounded-xl" required value={bookingForm.checkout} onChange={e => setBookingForm({ ...bookingForm, checkout: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-xs font-black uppercase tracking-widest opacity-70">Adults</Label>
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Base: {bookingForm.baseOccupancy}</span>
                  </div>
                  <Select value={bookingForm.adults.toString()} onValueChange={val => setBookingForm({ ...bookingForm, adults: Number(val) })}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7,8].map(n => (
                        <SelectItem key={n} value={n.toString()} disabled={selectedRoom && n > (selectedRoom.maxOccupancy || 6)}>
                          {n} Adult{n>1?'s':''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs font-black uppercase tracking-widest opacity-70">Source</Label>
                  <Select value={bookingForm.bookingSource} onValueChange={val => setBookingForm({ ...bookingForm, bookingSource: val })}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OTA_CHANNELS.map(ch => <SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-black uppercase tracking-widest opacity-70 flex items-center gap-2">
                       Payment Selection
                       {bookingForm.advancePayment > 0 && !bookingForm.paymentMethod && (
                          <span className="text-[9px] font-black text-red-500 animate-pulse bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100">Select Method</span>
                       )}
                    </Label>
                    <div className="flex bg-muted rounded-lg p-1 gap-1">
                      <button 
                        type="button"
                        onClick={() => setBookingForm({ ...bookingForm, advancePayment: 0 })}
                        className={cn(
                          "px-3 py-1 text-[10px] font-black uppercase rounded-md transition-all",
                          bookingForm.advancePayment === 0 ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Unpaid
                      </button>
                      <button 
                        type="button"
                        onClick={() => setBookingForm({ ...bookingForm, advancePayment: totalAmount })}
                        className={cn(
                          "px-3 py-1 text-[10px] font-black uppercase rounded-md transition-all",
                          bookingForm.advancePayment === totalAmount ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Full
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="number" 
                        step="any"
                        className="h-12 rounded-2xl pl-10 bg-slate-50 border-slate-200 font-bold" 
                        min="0" 
                        value={bookingForm.advancePayment || ''} 
                        onChange={e => setBookingForm({ ...bookingForm, advancePayment: parseFloat(e.target.value) || 0 })} 
                        placeholder="Advance Amount" 
                      />
                    </div>
                    {bookingForm.advancePayment > 0 && (
                      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1 border border-slate-200">
                        {['cash', 'card', 'upi'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setBookingForm({ ...bookingForm, paymentMethod: m as any })}
                            className={cn(
                              "h-10 px-3 text-[10px] font-black uppercase rounded-xl transition-all flex flex-col items-center justify-center min-w-[50px]",
                              bookingForm.paymentMethod === m 
                                ? "bg-white shadow-sm text-primary ring-1 ring-slate-200" 
                                : "text-slate-400 hover:text-slate-600"
                            )}
                          >
                            <span className="leading-none">{m}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedRoom && nights > 0 && (
                <div className="rounded-3xl bg-muted/30 border border-primary/5 p-5 space-y-3 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><IndianRupee className="h-16 w-16" /></div>
                  <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span>Base Fare ({nights} N × ₹{bookingForm.roomPrice.toLocaleString()})</span>
                    <span className="text-foreground">₹{baseSubtotal.toLocaleString()}</span>
                  </div>
                  {extraAdults > 0 && (
                    <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <span>Extra Person ({extraAdults} × ₹{bookingForm.extraPersonPrice})</span>
                      <span className="text-foreground">+ ₹{extraPersonCharge.toLocaleString()}</span>
                    </div>
                  )}
                  {taxConfig?.enabled && taxConfig.cgst !== undefined && taxConfig.sgst !== undefined && (
                    <div className="flex justify-between text-xs font-bold text-orange-600">
                      <span>GST (CGST {taxConfig.cgst}% + SGST {taxConfig.sgst}%)</span>
                      <span>+ ₹{taxAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {bookingForm.advancePayment > 0 && (
                    <div className="flex justify-between text-xs font-bold text-emerald-600">
                      <span>Advance Received</span>
                      <span>- ₹{bookingForm.advancePayment.toLocaleString()}</span>
                    </div>
                  )}
                  <Separator className="opacity-50" />
                  <div className="flex justify-between items-end pt-1">
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Total Payable at Property</p>
                      <p className="text-2xl font-black tracking-tighter text-primary">₹{balanceDue.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className="text-[8px] font-black uppercase bg-white/50 border-primary/20">{bookingForm.bookingSource.replace('_', '.')}</Badge>
                      <span className="text-[10px] font-medium text-muted-foreground">Incl. Taxes</span>
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-xs font-bold text-destructive bg-destructive/5 p-3 rounded-lg flex items-center gap-2"><Info className="h-4 w-4" /> {error}</p>}
              
              <DialogFooter className="pt-2 gap-3">
                <Button type="button" variant="ghost" onClick={() => setStep('guest')} className="font-bold">Back</Button>
                <Button type="submit" 
                  className={cn("h-12 rounded-2xl flex-1 font-black shadow-lg", showSuccess ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 text-white" : "shadow-primary/20")} 
                  disabled={isSubmitting || !bookingForm.roomId || nights <= 0 || showSuccess || (bookingForm.advancePayment > 0 && !bookingForm.paymentMethod)}
                >
                  {showSuccess ? <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Reserved!</span> : isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : initialBooking ? 'Update Stay' : 'Confirm Reservation'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
