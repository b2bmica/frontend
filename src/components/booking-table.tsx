import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useBookings, type Booking } from '../context/booking-context';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ChevronRight, Eye, Globe, Loader2, LogIn, LogOut, Mail, MoreHorizontal, Pencil, Phone, Search, User, UserPlus, XCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { BookingDetailSheet } from './booking-detail-sheet';
import { BookingModal } from './booking-modal';
import { cn } from '../lib/utils';

export function BookingTable() {
  const { bookings, rooms, checkIn, checkOut, cancelBooking, loading } = useBookings();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
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
    const matchSearch = !search || 
      guestName.toLowerCase().includes(search.toLowerCase()) ||
      roomNumber.toLowerCase().includes(search.toLowerCase());
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
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search guest or room..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
            <SelectItem value="checked-in">Checked In</SelectItem>
            <SelectItem value="checked-out">Checked Out</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} bookings</span>
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
                  const amount = room?.price ? nights * room.price : 0;

                  return (
                    <TableRow key={booking._id} className="hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div className="font-medium">{guest?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{guest?.phone || ''}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{room?.roomNumber || '—'}</div>
                        <div className="text-xs text-muted-foreground">{room?.roomType || ''}</div>
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

      {/* Pagination Footer */}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-bold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, filtered.length)}</span> of <span className="font-bold text-foreground">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="font-bold"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  className="w-8 h-8 p-0 font-bold"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="font-bold"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Card View */}
      <div className="lg:hidden grid grid-cols-1 gap-4">
        {filtered.map(booking => {
          const guest = typeof booking.guestId === 'object' ? booking.guestId : null;
          const room = typeof booking.roomId === 'object' ? booking.roomId : rooms.find(r => r._id === booking.roomId);
          const nights = Math.max(1, Math.ceil((new Date(booking.checkout).getTime() - new Date(booking.checkin).getTime()) / (1000 * 60 * 60 * 24)));
          const amount = room?.price ? nights * room.price : 0;
          const status = booking.status;

          return (
            <div 
              key={booking._id} 
              className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow group cursor-pointer" 
              onClick={() => setSelectedBooking(booking)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-400 group-hover:text-primary transition-colors text-xs">
                    #{room?.roomNumber || '???'}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">{guest?.name || '—'}</p>
                    <p className="text-[9px] font-black uppercase text-muted-foreground/60 tracking-tighter">
                      {format(new Date(booking.checkin), 'dd MMM')} - {format(new Date(booking.checkout), 'dd MMM')} {format(new Date(booking.checkout), 'yyyy')} • {nights}N
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={cn(
                  "text-[8px] font-black uppercase tracking-tighter border-none h-5 px-2",
                  status === 'reserved' ? 'bg-emerald-500/10 text-emerald-600' :
                  status === 'checked-in' ? 'bg-blue-500/10 text-blue-600' :
                  status === 'checked-out' ? 'bg-orange-500/10 text-orange-600' :
                  'bg-red-500/10 text-red-600'
                )}>
                  {status.replace('-', ' ')}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <Globe className="h-3 w-3" /> {booking.bookingSource || 'direct'}
                </div>
                <div className="text-sm font-black text-primary tracking-tighter">
                  ₹{amount.toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed text-xs font-bold text-slate-400 uppercase tracking-widest">
            No bookings matching criteria
          </div>
        )}
      </div>

      <BookingDetailSheet booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      <BookingModal 
        isOpen={!!editingBooking} 
        onClose={() => setEditingBooking(null)} 
        initialBooking={editingBooking} 
      />
    </div>
  );
}
