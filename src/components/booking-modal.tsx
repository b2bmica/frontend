import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBookings } from '../context/booking-context';
import { useAuth } from '../context/auth-context';
import { differenceInDays, format, addDays } from 'date-fns';
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
    advancePayment: 0, bookingSource: 'direct', paymentMethod: 'cash',
    baseOccupancy: 2, extraPersonPrice: 0, roomPrice: 0
  });

  // Derived State
  const selectedRoom = rooms.find(r => r._id === bookingForm.roomId);
  const nights = bookingForm.checkin && bookingForm.checkout
    ? differenceInDays(new Date(bookingForm.checkout), new Date(bookingForm.checkin))
    : 0;
  
  const roomPrice = initialBooking ? bookingForm.roomPrice : (selectedRoom?.price || 0);
  const baseSubtotal = nights * roomPrice;
  
  // Extra person logic
  const extraAdults = Math.max(0, bookingForm.adults - (bookingForm.baseOccupancy || 2));
  const extraPersonCharge = extraAdults * (bookingForm.extraPersonPrice || 0) * nights;
  
  const subtotal = baseSubtotal + extraPersonCharge;
  
  // Tax logic
  const taxConfig = hotel?.settings?.taxConfig || { enabled: false, cgst: 0, sgst: 0 };
  let taxAmount = 0;
  if (taxConfig.enabled && subtotal > 0) {
    const cgst = (subtotal * (taxConfig.cgst || 0)) / 100;
    const sgst = (subtotal * (taxConfig.sgst || 0)) / 100;
    taxAmount = cgst + sgst;
  }
  
  const totalAmount = subtotal + taxAmount;
  const balanceDue = totalAmount - (bookingForm.advancePayment || 0);

  // Available rooms calculation
  const availableRooms = useMemo(() => {
    if (!bookingForm.checkin || !bookingForm.checkout) return rooms;
    
    const start = new Date(bookingForm.checkin);
    const end = new Date(bookingForm.checkout);

    return rooms.filter(room => {
      // Check for overlapping active bookings
      const hasConflict = bookings.some(b => {
        if (!b.roomId) return false;
        const bRoomId = typeof b.roomId === 'object' ? b.roomId._id : b.roomId;
        if (bRoomId !== room._id) return false;
        if (b.status === 'cancelled' || b.status === 'checked-out') return false;

        const bStart = new Date(b.checkin);
        const bEnd = new Date(b.checkout);

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
          paymentMethod: 'cash',
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
        setBookingForm({
          roomId: selectedRoomId || '',
          checkin: selectedDate || format(new Date(), 'yyyy-MM-dd'),
          checkout: selectedDate ? format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd'),
          adults: 2, children: 0,
          advancePayment: 0,
          paymentMethod: 'cash',
          bookingSource: 'direct',
          baseOccupancy: 2,
          extraPersonPrice: 0,
          roomPrice: 0
        });
      }
    }
  }, [isOpen, selectedRoomId, selectedDate, initialBooking]);

  useEffect(() => {
    if (selectedRoom && !initialBooking) {
      setBookingForm(prev => ({
        ...prev,
        baseOccupancy: selectedRoom.baseOccupancy || 2,
        extraPersonPrice: selectedRoom.extraPersonPrice || 0,
        roomPrice: selectedRoom.price || 0
      }));
    }
  }, [selectedRoom, initialBooking]);

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
    setIsSubmitting(true);
    setError(null);
    try {
      const guest = await createGuest(newGuest);
      setSelectedGuest(guest);
      setStep('booking');
    } catch (err: any) {
      setError(err.message);
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
      <DialogContent className="sm:max-w-[550px] max-h-[90dvh] overflow-y-auto p-0 border-none shadow-2xl [&>button]:z-50">
        <div className="bg-muted/30 border-b p-6 relative">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
              <span className="p-1 px-2 rounded-lg bg-slate-900 text-white text-[10px] font-bold">{initialBooking ? 'EDIT' : 'NEW'}</span>
              {step === 'guest' ? 'Select Traveler' : initialBooking ? 'Modify Stay' : 'Finalize Reservation'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium text-[11px]">
              {step === 'guest' ? 'Every great stay starts with a profile.' : `Securing room for ${selectedGuest?.name}`}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6">
          {step === 'guest' && !showNewGuest && (
            <div className="space-y-4 py-2">
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
            <div className="space-y-6 py-2">
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
            <form onSubmit={handleSubmit} className="space-y-6 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest opacity-70">Inventory Selection *</Label>
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <Label className="text-xs font-black uppercase tracking-widest opacity-70">Advance Payment Received</Label>
                  {totalAmount > 0 && balanceDue > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                      <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">Settle Full:</span>
                      <div className="flex bg-primary/10 rounded-lg p-0.5 gap-0.5 border border-primary/20 shadow-sm">
                        {['cash', 'card', 'upi'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setBookingForm({ ...bookingForm, advancePayment: totalAmount, paymentMethod: m as any })}
                            className={cn(
                              "h-6 px-2 text-[8px] font-black uppercase rounded transition-all active:scale-90",
                              bookingForm.advancePayment === totalAmount && bookingForm.paymentMethod === m 
                                ? "bg-primary text-white" 
                                : isSubmitting ? "opacity-50 cursor-not-allowed" : "text-primary hover:bg-primary/10"
                            )}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="number" 
                    step="any"
                    className="h-11 rounded-xl pl-10" 
                    min="0" 
                    value={bookingForm.advancePayment || ''} 
                    onChange={e => setBookingForm({ ...bookingForm, advancePayment: parseFloat(e.target.value) || 0 })} 
                    placeholder="Amount in INR" 
                  />
                </div>
              </div>

              {selectedRoom && nights > 0 && (
                <div className="rounded-3xl bg-muted/30 border border-primary/5 p-5 space-y-3 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><IndianRupee className="h-16 w-16" /></div>
                  <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <span>Base Fare ({nights} N × ₹{roomPrice.toLocaleString()})</span>
                    <span className="text-foreground">₹{baseSubtotal.toLocaleString()}</span>
                  </div>
                  {extraAdults > 0 && (
                    <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <span>Extra Person ({extraAdults} × ₹{bookingForm.extraPersonPrice})</span>
                      <span className="text-foreground">+ ₹{extraPersonCharge.toLocaleString()}</span>
                    </div>
                  )}
                  {taxConfig.enabled && (
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
                <Button type="submit" className={cn("h-12 rounded-2xl flex-1 font-black shadow-lg", showSuccess ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 text-white" : "shadow-primary/20")} disabled={isSubmitting || !bookingForm.roomId || nights <= 0 || showSuccess}>
                  {showSuccess ? <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Confirmed!</span> : isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : initialBooking ? 'Update Stay' : 'Confirm Reservation'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
