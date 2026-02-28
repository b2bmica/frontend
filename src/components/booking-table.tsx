import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useBookings, type Booking } from '../context/booking-context';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Calendar, ChevronRight, Eye, Globe, Loader2, LogIn, LogOut, Mail, MoreHorizontal, Pencil, Phone, Search, User, UserPlus, XCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { BookingDetailSheet } from './booking-detail-sheet';
import { BookingModal } from './booking-modal';
import { GuestProfileSheet } from './guest-profile-sheet';
import { cn } from '../lib/utils';

export function BookingTable() {
  const { bookings, rooms, checkIn, checkOut, cancelBooking, loading } = useBookings();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset page on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const filtered = bookings.filter(b => {
    const guestName = typeof b.guestId === 'object' ? b.guestId?.name || '' : '';
    const roomNumber = typeof b.roomId === 'object' ? b.roomId?.roomNumber || '' : '';
    const bookingId = b._id || '';
    const matchSearch = !search || 
      guestName.toLowerCase().includes(search.toLowerCase()) ||
      roomNumber.toLowerCase().includes(search.toLowerCase()) ||
      bookingId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedData = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const statusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      'reserved': { label: 'Reserved', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
      'checked-in': { label: 'Checked In', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      'checked-out': { label: 'Checked Out', className: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
      'cancelled': { label: 'Cancelled', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
    };
    const c = config[status] || { label: status, className: '' };
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  const handleAction = async (id: string, action: (id: string) => Promise<void>) => {
    setActioningId(id);
    try {
      await action(id);
    } catch (err) {
      console.error(err);
    }
    setActioningId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter - Compact Mobile Row */}
      <div className="flex items-center gap-2 w-full overflow-hidden">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input 
            className="pl-8 h-9 text-xs border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white transition-all shadow-none" 
            placeholder="Guest, Room or ID..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[110px] sm:w-[140px] h-9 text-[10px] sm:text-xs rounded-xl border-slate-200 shadow-none bg-slate-50/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-none shadow-2xl">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
            <SelectItem value="checked-in">In House</SelectItem>
            <SelectItem value="checked-out">Departure</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="hidden sm:flex items-center px-3 h-9 rounded-xl bg-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {filtered.length}
        </div>
      </div>

      {/* Table & Cards */}
      <div className="border rounded-lg overflow-hidden lg:block hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No bookings found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map(booking => {
                  const guest = typeof booking.guestId === 'object' ? booking.guestId : null;
                  const room = typeof booking.roomId === 'object' ? booking.roomId : rooms.find(r => r._id === booking.roomId);
                  const nights = Math.max(1, Math.ceil((new Date(booking.checkout).getTime() - new Date(booking.checkin).getTime()) / (1000 * 60 * 60 * 24)));
                  const roomRate = booking.roomPrice || room?.price || 0;
                  const amount = roomRate * nights;

                  return (
                    <TableRow key={booking._id} className="hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <button 
                          className="font-medium hover:text-primary transition-colors text-left"
                          onClick={() => guest?._id && setSelectedGuestId(guest._id)}
                        >
                          {guest?.name || '—'}
                        </button>
                        <div className="text-xs text-muted-foreground">{guest?.phone || ''}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{room?.roomNumber || '[Deleted]'}</div>
                        <div className="text-xs text-muted-foreground">{room?.roomType || 'Asset Removed'}</div>
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(booking.checkin), 'dd MMM yy')}</TableCell>
                      <TableCell className="text-sm">{format(new Date(booking.checkout), 'dd MMM yy')}</TableCell>
                      <TableCell>{statusBadge(booking.status)}</TableCell>
                      <TableCell className="text-right font-medium">₹{amount.toLocaleString()}</TableCell>
                      <TableCell>
                        {actioningId === booking._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setSelectedBooking(booking)}>
                                <Eye className="h-4 w-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {(booking.status === 'reserved' || booking.status === 'checked-in') && (
                                <DropdownMenuItem onClick={() => setEditingBooking(booking)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Edit Reservation
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {booking.status === 'reserved' && (
                                <DropdownMenuItem onClick={() => handleAction(booking._id, checkIn)}>
                                  <LogIn className="h-4 w-4 mr-2" /> Check In
                                </DropdownMenuItem>
                              )}
                              {booking.status === 'checked-in' && (
                                <DropdownMenuItem onClick={() => handleAction(booking._id, checkOut)}>
                                  <LogOut className="h-4 w-4 mr-2" /> Check Out
                                </DropdownMenuItem>
                              )}
                              {(booking.status === 'reserved' || booking.status === 'checked-in') && (
                                <DropdownMenuItem className="text-destructive" onClick={() => handleAction(booking._id, cancelBooking)}>
                                  <XCircle className="h-4 w-4 mr-2" /> Cancel Booking
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Footer - Compact */}
      {filtered.length > pageSize && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-6 border-t border-slate-50 mt-4">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] order-2 sm:order-1">
            <span className="text-slate-900 font-black">{(currentPage - 1) * pageSize + 1}—{Math.min(currentPage * pageSize, filtered.length)}</span> of {filtered.length} Records
          </div>
          <div className="flex items-center gap-1.5 order-1 sm:order-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 rounded-lg border-slate-200 text-[10px] font-black uppercase tracking-widest px-3 shadow-none disabled:opacity-30"
            >
              Prev
            </Button>
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const p = i + 1;
                // Show first, last, current, and one around current
                if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                  return (
                    <Button
                      key={p}
                      variant={currentPage === p ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "w-8 h-8 rounded-lg text-[10px] font-black transition-all shadow-none",
                        currentPage === p ? "bg-slate-900 text-white" : "border-slate-200 text-slate-400 hover:bg-slate-50"
                      )}
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </Button>
                  );
                }
                if (p === 2 || p === totalPages - 1) return <span key={p} className="text-slate-300 mx-0.5">•</span>;
                return null;
              })}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 rounded-lg border-slate-200 text-[10px] font-black uppercase tracking-widest px-3 shadow-none disabled:opacity-30"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Feed View */}
      <div className="lg:hidden space-y-3">
        {paginatedData.map(booking => {
          const guest = typeof booking.guestId === 'object' ? booking.guestId : null;
          const room = typeof booking.roomId === 'object' ? booking.roomId : rooms.find(r => r._id === booking.roomId);
          const nights = Math.max(1, Math.ceil((new Date(booking.checkout).getTime() - new Date(booking.checkin).getTime()) / (1000 * 60 * 60 * 24)));
          const roomRate = booking.roomPrice || room?.price || 0;
          const amount = roomRate * nights;
          const status = booking.status;

          return (
            <div 
              key={booking._id} 
              className="bg-white rounded-[24px] border border-slate-100 p-5 shadow-sm active:scale-[0.98] transition-all group flex flex-col gap-4 relative overflow-hidden" 
              onClick={() => setSelectedBooking(booking)}
            >
              {/* Vertical accent bar based on status */}
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1",
                status === 'reserved' ? 'bg-emerald-500' :
                status === 'checked-in' ? 'bg-blue-500' :
                status === 'checked-out' ? 'bg-orange-500' :
                'bg-red-500'
              )} />

              <div className="flex items-start justify-between">
                <div className="space-y-1 overflow-hidden pr-2">
                  <div className="flex items-center gap-2">
                     <button 
                        className="text-sm font-black text-slate-900 tracking-tight hover:text-primary transition-colors truncate"
                        onClick={(e) => {
                           e.stopPropagation();
                           if (guest?._id) setSelectedGuestId(guest._id);
                        }}
                     >
                        {guest?.name || 'Unknown Guest'}
                     </button>
                     <button 
                        className="h-6 w-6 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors flex-shrink-0"
                        onClick={(e) => {
                           e.stopPropagation();
                           if (guest?._id) setSelectedGuestId(guest._id);
                        }}
                        title="View Guest Profile"
                     >
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                     </button>
                    <Badge variant="outline" className={cn(
                      "text-[8px] font-black uppercase tracking-widest border-none h-4.5 px-1.5 rounded-md",
                      status === 'reserved' ? 'bg-emerald-50 text-emerald-600' :
                      status === 'checked-in' ? 'bg-blue-50 text-blue-600' :
                      status === 'checked-out' ? 'bg-orange-50 text-orange-600' :
                      'bg-red-50 text-red-600'
                    )}>
                      {status.replace('-', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-tighter">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(booking.checkin), 'dd MMM')}</span>
                    <ChevronRight className="h-2 w-2 opacity-30" />
                    <span>{format(new Date(booking.checkout), 'dd MMM')}</span>
                    <span className="ml-1 opacity-40 px-1 py-0.5 bg-slate-50 rounded italic">{nights}N</span>
                  </div>
                </div>
                <div className="text-right">
                   <div className="text-xs font-black text-slate-800">RM {room?.roomNumber || '??'}</div>
                   <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{room?.roomType?.split(' ')[0] || 'Asset'}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex flex-col gap-0.5">
                   <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                     {booking.bookingSource === 'ota' ? <Globe className="h-2.5 w-2.5" /> : <UserPlus className="h-2.5 w-2.5" />} 
                     {booking.bookingSource || 'direct'}
                   </div>
                </div>
                <div className="flex flex-col items-end">
                   <span className="text-[9px] font-bold text-slate-300 uppercase leading-none mb-0.5">Total Revenue</span>
                   <span className="text-base font-black text-slate-900 tracking-tighter">
                      ₹{amount.toLocaleString()}
                   </span>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200/60">
             <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Search className="h-5 w-5 text-slate-200" />
             </div>
             <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">No Records Matching Search</p>
          </div>
        )}
      </div>

      <BookingDetailSheet booking={selectedBooking} onClose={() => setSelectedBooking(null)} onOpenGuest={(id) => setSelectedGuestId(id)} />
      <BookingModal 
        isOpen={!!editingBooking} 
        onClose={() => setEditingBooking(null)} 
        initialBooking={editingBooking} 
      />
      <GuestProfileSheet guestId={selectedGuestId} onClose={() => setSelectedGuestId(null)} onBookingClick={(b) => setSelectedBooking(b)} />
    </div>
  );
}
