import { useState } from 'react';
import { Search, UserPlus, Phone, Mail, Globe, Eye, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useBookings } from '../context/booking-context';
import { GuestProfileSheet } from './guest-profile-sheet';

export function GuestTable() {
  const { guests, createGuest, loading } = useBookings();
  const [search, setSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', nationality: 'Indian',
    idProof: { idType: 'aadhaar', number: '' }
  });

  const filtered = guests.filter(g => {
    if (!search) return true;
    const q = search.toLowerCase();
    return g.name?.toLowerCase().includes(q) || g.phone?.includes(q) || g.email?.toLowerCase().includes(q);
  });

  const handleAddGuest = async () => {
    if (!form.name || !form.phone) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await createGuest(form);
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '', nationality: 'Indian', idProof: { idType: 'aadhaar', number: '' } });
    } catch (err: any) {
      setError(err.message);
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, phone or email..." className="pl-10"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Add Guest
        </Button>
        <span className="text-sm text-muted-foreground">{filtered.length} guest{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table & Cards */}
      <div className="border rounded-lg overflow-hidden lg:block hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Nationality</TableHead>
                <TableHead>ID Proof</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {guests.length === 0 ? 'No guests yet. Add your first guest!' : 'No guests match your search.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(guest => (
                  <TableRow key={guest._id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <div className="font-semibold">{guest.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {guest.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" /> {guest.phone}
                          </div>
                        )}
                        {guest.email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" /> {guest.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        {guest.nationality || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {guest.idProof?.idType ? (
                        <div className="capitalize">{guest.idProof.idType}: {guest.idProof.number}</div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setSelectedGuestId(guest._id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Guest Cards */}
      <div className="lg:hidden grid grid-cols-1 gap-3">
        {filtered.map(guest => (
          <div key={guest._id} className="bg-white rounded-2xl border p-4 shadow-sm active:scale-[0.98] transition-all" onClick={() => setSelectedGuestId(guest._id)}>
            <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                     {guest.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">{guest.name}</h3>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{guest.nationality || 'Nationality —'}</p>
                  </div>
               </div>
               <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <Eye className="h-4 w-4 text-slate-400" />
               </Button>
            </div>
            
            <div className="space-y-2 pt-2 border-t border-slate-50">
               {guest.phone && (
                 <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Phone className="h-3.5 w-3.5 text-slate-300" />
                    {guest.phone}
                 </div>
               )}
               {guest.email && (
                 <div className="flex items-center gap-2 text-xs text-slate-600 font-medium truncate">
                    <Mail className="h-3.5 w-3.5 text-slate-300" />
                    {guest.email}
                 </div>
               )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed text-xs font-bold text-slate-400 uppercase tracking-widest">
            No guests found
          </div>
        )}
      </div>

      {/* Add Guest Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Register New Guest</DialogTitle>
            <DialogDescription>Fill in the guest's details to register them.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1"><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Guest name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Phone *</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+91..." /></div>
              <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@..." /></div>
            </div>
            <div className="space-y-1"><Label>Nationality</Label><Input value={form.nationality} onChange={e => setForm({...form, nationality: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>ID Type</Label>
                <Select value={form.idProof.idType} onValueChange={val => setForm({...form, idProof: {...form.idProof, idType: val}})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aadhaar">Aadhaar</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="driving-license">Driving License</SelectItem>
                    <SelectItem value="voter-id">Voter ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>ID Number *</Label><Input value={form.idProof.number} onChange={e => setForm({...form, idProof: {...form.idProof, number: e.target.value}})} placeholder="XXXX XXXX XXXX" /></div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddGuest} disabled={isSubmitting || !form.name || !form.phone}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guest Profile Sheet */}
      <GuestProfileSheet guestId={selectedGuestId} onClose={() => setSelectedGuestId(null)} />
    </div>
  );
}
