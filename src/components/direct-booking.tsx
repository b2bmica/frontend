import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Users, 
  ChevronRight, 
  CheckCircle2, 
  CreditCard,
  MapPin,
  Star,
  Wifi,
  Coffee,
  Wind
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

const mockAvailableRooms = [
  { id: '1', name: 'Premium Ocean Suite', price: 12500, type: 'Suite', amenities: ['WiFi', 'AC', 'Breakfast'] },
  { id: '2', name: 'Deluxe Garden View', price: 8500, type: 'Deluxe', amenities: ['WiFi', 'AC'] },
  { id: '3', name: 'Standard Comfort', price: 4500, type: 'Standard', amenities: ['WiFi'] },
];

export function DirectBookingEngine() {
  const [step, setStep] = useState(1); // 1: Search, 2: Select, 3: Details, 4: Confirm
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      {/* Public Header */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-white font-black text-xl">H</div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Grand Resort & Spa</h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> Beach Road, Goa
            </div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          <a href="#" className="text-primary border-b-2 border-primary pb-1">Rooms</a>
          <a href="#" className="hover:text-primary transition-colors">Amenities</a>
          <a href="#" className="hover:text-primary transition-colors">Contact</a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Step Indicator */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-4">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center font-bold transition-all border-2",
                  step >= s ? "bg-primary border-primary text-white" : "bg-white border-muted-foreground/20 text-muted-foreground"
                )}>
                  {s}
                </div>
                {s < 3 && <div className={cn("w-12 h-1 rounded-full", step > s ? "bg-primary" : "bg-muted")} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="search"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none px-4 py-1">Limited Availability</Badge>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight">Experience Luxury <br/> Like Never Before</h2>
                <p className="text-muted-foreground max-w-xl mx-auto">Book directly with us to get the best rates, free breakfast, and exclusive spa discounts.</p>
              </div>

              {/* Search Bar */}
              <Card className="max-w-4xl mx-auto border-none shadow-2xl p-2 rounded-3xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="p-4 rounded-2xl hover:bg-muted/50 transition-colors cursor-pointer group">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Check-in</label>
                       <div className="flex items-center gap-2 mt-1">
                          <CalendarIcon className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">March 24, 2024</span>
                       </div>
                    </div>
                    <div className="p-4 rounded-2xl hover:bg-muted/50 transition-colors cursor-pointer">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Check-out</label>
                       <div className="flex items-center gap-2 mt-1">
                          <CalendarIcon className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">March 28, 2024</span>
                       </div>
                    </div>
                    <div className="p-4 rounded-2xl hover:bg-muted/50 transition-colors cursor-pointer">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Guests</label>
                       <div className="flex items-center gap-2 mt-1">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">2 Adults, 0 Children</span>
                       </div>
                    </div>
                    <div className="p-2">
                       <Button onClick={() => setStep(2)} className="w-full h-full rounded-2xl bg-primary text-white hover:bg-primary/90 font-bold text-lg">
                          Check Rooms
                       </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Featured Amenities */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-12">
                 {[
                   { icon: Wifi, label: 'Free High-Speed WiFi' },
                   { icon: Coffee, label: 'Breakfast Included' },
                   { icon: Wind, label: 'Central Air Conditioning' },
                   { icon: Star, label: '5-Star Hospitality' },
                 ].map((item) => (
                   <div key={item.label} className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-3 rounded-2xl bg-primary/5 text-primary">
                         <item.icon className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-bold text-center tracking-tight">{item.label}</span>
                   </div>
                 ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="rooms"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-3xl font-black">Choose your sanctuary</h2>
                 <Button variant="ghost" onClick={() => setStep(1)}>change dates</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {mockAvailableRooms.map((room) => (
                  <Card key={room.id} className="border-none shadow-xl rounded-3xl overflow-hidden group hover:translate-y-[-8px] transition-all duration-300">
                    <div className="h-48 bg-muted relative overflow-hidden">
                       <img src={`https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&q=80&w=800`} alt={room.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                       <Badge className="absolute top-4 right-4 bg-white/90 text-[#0f172a] backdrop-blur-sm border-none">Available</Badge>
                    </div>
                    <CardHeader>
                      <CardTitle className="text-xl font-bold">{room.name}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        {room.amenities.map(a => <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between mt-4">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-black">Per night</p>
                          <p className="text-2xl font-black text-primary">₹{room.price.toLocaleString()}</p>
                        </div>
                        <Button 
                          onClick={() => { setSelectedRoom(room); setStep(3); }} 
                          className="rounded-xl px-6 bg-[#0f172a] hover:bg-[#1e293b] text-white"
                        >
                          Select <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="confirm"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="max-w-4xl mx-auto"
            >
               <div className="md:grid md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-6">
                     <Card className="border-none shadow-xl rounded-3xl">
                        <CardHeader>
                           <CardTitle className="text-2xl font-black px-2 pt-2">Complete your booking</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-6 pt-0">
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                 <label className="text-xs font-bold pl-1">Name</label>
                                 <Input placeholder="Full Name" className="rounded-xl h-12 bg-muted/30 border-none" />
                              </div>
                              <div className="space-y-2">
                                 <label className="text-xs font-bold pl-1">Phone</label>
                                 <Input placeholder="Mobile Number" className="rounded-xl h-12 bg-muted/30 border-none" />
                              </div>
                           </div>
                           <div className="space-y-2">
                              <label className="text-xs font-bold pl-1">Email</label>
                              <Input placeholder="Email Address" className="rounded-xl h-12 bg-muted/30 border-none" />
                           </div>
                           <div className="pt-6">
                              <Button onClick={() => setStep(4)} className="w-full h-14 bg-primary text-white rounded-2xl font-black text-lg shadow-lg shadow-primary/20">
                                 Confirm Reservation <ChevronRight className="ml-2 h-5 w-5" />
                              </Button>
                           </div>
                           <p className="text-[10px] text-center text-muted-foreground pt-4">By booking, you agree to our Terms and Cancellation Policy.</p>
                        </CardContent>
                     </Card>
                  </div>

                  <div className="space-y-6 mt-8 md:mt-0">
                      <Card className="border-none shadow-xl rounded-3xl bg-[#0f172a] text-white overflow-hidden">
                         <div className="p-6 space-y-4">
                            <h3 className="text-lg font-bold border-b border-white/10 pb-4">Order Summary</h3>
                            <div className="space-y-3">
                               <div className="flex justify-between text-sm">
                                  <span className="text-white/60">Room</span>
                                  <span className="font-medium">{selectedRoom?.name}</span>
                               </div>
                               <div className="flex justify-between text-sm">
                                  <span className="text-white/60">Duration</span>
                                  <span className="font-medium">4 Nights</span>
                               </div>
                               <div className="flex justify-between text-sm">
                                  <span className="text-white/60">Guests</span>
                                  <span className="font-medium">2 Adults</span>
                               </div>
                            </div>
                            <div className="pt-4 border-t border-white/10">
                               <div className="flex justify-between items-center">
                                  <span className="font-bold">Total</span>
                                  <span className="text-2xl font-black">₹{((selectedRoom?.price || 0) * 4).toLocaleString()}</span>
                               </div>
                            </div>
                         </div>
                         <div className="bg-white/5 p-4 flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                               <CreditCard className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] font-bold tracking-tight">No prepayment required. Pay at the hotel.</span>
                         </div>
                      </Card>
                  </div>
               </div>
            </motion.div>
          )}

          {step === 4 && (
             <motion.div 
               key="success"
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="max-w-md mx-auto text-center space-y-6 pt-12"
             >
                <div className="h-24 w-24 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto shadow-2xl shadow-green-500/40">
                   <CheckCircle2 className="h-12 w-12" />
                </div>
                <div className="space-y-2">
                   <h2 className="text-3xl font-black">Booking Confirmed!</h2>
                   <p className="text-muted-foreground">Your stay at Grand Resort & Spa is reserved. We've sent a confirmation to your email.</p>
                </div>
                <Card className="border-dashed border-2 bg-transparent p-6 space-y-2">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Registration ID</p>
                   <p className="text-2xl font-mono font-black">GRS-104829-X</p>
                </Card>
                <Button variant="outline" className="w-full h-12 rounded-xl font-bold" onClick={() => setStep(1)}>
                   Return to Home
                </Button>
             </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-24 bg-white border-t px-6 py-12 text-center text-muted-foreground text-sm">
         <div className="max-w-4xl mx-auto space-y-4">
            <p className="font-bold text-[#0f172a]">Grand Resort & Spa</p>
            <p>123 Luxury Avenue, North Goa, 403517</p>
            <div className="flex justify-center gap-8 pt-4">
               <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
               <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
               <a href="#" className="hover:text-primary transition-colors">Support</a>
            </div>
            <p className="pt-8 text-[10px] opacity-50">© 2024 Hotel SaaS Pro. All rights reserved.</p>
         </div>
      </footer>
    </div>
  );
}
