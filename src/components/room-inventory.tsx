import { useState } from 'react';
import { Plus, Pencil, Trash2, Bed, Wifi, Tv, Coffee, Bath, Loader2, Sparkles, RefreshCw, Search } from 'lucide-react';
import { useBookings, type Room } from '../context/booking-context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { cn } from '../lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { HousekeepingBoard } from './housekeeping-board';

const ROOM_TYPES = [
  'Standard AC', 'Standard Non-AC', 
  'Deluxe AC', 'Deluxe Non-AC', 
  'Premium AC', 'Executive Suite', 
  'Penthouse', 'Presidential'
];
const AMENITIES_OPTIONS = [
  { id: 'wifi', label: 'WiFi', icon: Wifi },
  { id: 'tv', label: 'TV', icon: Tv },
  { id: 'coffee', label: 'Coffee Maker', icon: Coffee },
  { id: 'bath', label: 'Bathtub', icon: Bath },
  { id: 'minibar', label: 'Minibar', icon: Coffee },
];

const statusColors: Record<string, string> = {
  clean: 'bg-green-500',
  dirty: 'bg-yellow-500',
  occupied: 'bg-blue-500',
  maintenance: 'bg-red-500',
  'under-maintenance': 'bg-red-500',
};

const defaultForm = {
  roomNumber: '',
  roomType: 'Standard',
  price: 0,
  floor: 0,
  baseOccupancy: 2,
  maxOccupancy: 4,
  extraPersonPrice: 0,
  amenities: [] as string[],
};

export function RoomInventory() {
  const { rooms, bookings, createRoom, updateRoom, deleteRoom, loading } = useBookings();
  const [isOpen, setIsOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const filteredRooms = rooms.filter(r => {
    const matchesType = filterType === 'all' || r.roomType === filterType;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'repair' ? (r.status === 'maintenance' || r.status === 'under-maintenance') : r.status === statusFilter);
    return matchesType && matchesStatus;
  });

  const getBookingRoomId = (b: any): string => {
    if (!b.roomId) return '';
    return typeof b.roomId === 'object' ? b.roomId._id : b.roomId;
  };

  const openCreateModal = () => {
    setEditingRoom(null);
    setForm({ ...defaultForm });
    setError(null);
    setIsOpen(true);
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setForm({
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      price: room.price,
      floor: room.floor || 0,
      baseOccupancy: room.baseOccupancy || 2,
      maxOccupancy: room.maxOccupancy || 4,
      extraPersonPrice: room.extraPersonPrice || 0,
      amenities: room.amenities || [],
    });
    setError(null);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      if (editingRoom) {
        await updateRoom(editingRoom._id, form);
      } else {
        await createRoom(form);
      }
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const hasActiveBookings = bookings.some(b => 
      getBookingRoomId(b) === id && (b.status === 'reserved' || b.status === 'checked-in')
    );

    if (hasActiveBookings) {
      setError("Cannot delete room with active or upcoming bookings. Please cancel or move bookings first.");
      return;
    }

    try {
      await deleteRoom(id);
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleAmenity = (amenity: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const stats = {
    total: rooms.length,
    clean: rooms.filter(r => r.status === 'clean').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    dirty: rooms.filter(r => r.status === 'dirty').length,
    maintenance: rooms.filter(r => r.status === 'under-maintenance' || r.status === 'maintenance').length,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Shared Stats Header */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { key: 'all', label: 'Total Inventory', value: stats.total, color: 'text-slate-900' },
          { key: 'clean', label: 'Clean', value: stats.clean, color: 'text-emerald-600' },
          { key: 'dirty', label: 'Dirty', value: stats.dirty, color: 'text-orange-600' },
          { key: 'occupied', label: 'Occupied', value: stats.occupied, color: 'text-blue-600' },
          { key: 'repair', label: 'Repair', value: stats.maintenance, color: 'text-red-600' },
        ].map(s => (
          <button 
            key={s.label} 
            onClick={() => setStatusFilter(s.key)}
            className={cn(
              "bg-white border rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center group hover:border-primary/30 transition-all",
              statusFilter === s.key ? "ring-2 ring-primary border-transparent" : "border-slate-100"
            )}
          >
            <p className={cn("text-2xl font-bold tracking-tight", s.color)}>{s.value}</p>
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mt-1">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl bg-white border border-slate-200 font-bold text-[10px] uppercase tracking-wider">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreateModal} className="rounded-xl h-10 px-6 font-bold uppercase text-[11px] tracking-wider shadow-lg shadow-slate-900/10">
          <Plus className="h-4 w-4 mr-2" /> Add Asset
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" /></div>
      ) : filteredRooms.length === 0 ? (
        <div className="text-center py-24 bg-muted/20 rounded-3xl border border-dashed flex flex-col items-center">
          <Bed className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Inventory Empty</h3>
          <Button onClick={openCreateModal} variant="outline" className="mt-4 rounded-xl font-bold text-xs">Register First Unit</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredRooms.map(room => (
            <Card key={room._id} className="border-none shadow-sm hover:shadow-xl transition-all group overflow-hidden bg-white/50 backdrop-blur-sm border border-transparent hover:border-primary/10">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-xl tracking-tight text-slate-900">#{room.roomNumber}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{room.roomType}</p>
                  </div>
                  <Badge variant="secondary" className={cn(
                    "text-[9px] font-bold uppercase tracking-wider h-6 border-none px-3", 
                    statusColors[room.status] || 'bg-slate-100', 
                    'text-white'
                  )}>
                    {room.status === 'under-maintenance' ? 'Repair' : room.status}
                  </Badge>
                </div>
                
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-black text-foreground">₹{room.price.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">/ NT</span>
                </div>

                <div className="flex flex-col gap-1.5 mb-5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>Capacity</span>
                    <span className="text-slate-900">{room.baseOccupancy || 2} - {room.maxOccupancy || 4} Guests</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>Extra Person</span>
                    <span className="text-slate-900">₹{room.extraPersonPrice || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>Floor</span>
                    <span className="text-slate-900">{room.floor || '—'}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t mt-auto">
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl h-9 font-black text-[10px] uppercase tracking-widest bg-slate-50 border-none hover:bg-slate-100" onClick={() => openEditModal(room)}>
                    <Pencil className="h-3 w-3 mr-1.5 opacity-40" /> Edit Record
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl h-9 w-9 text-destructive hover:bg-destructive/5 border-none" onClick={() => setDeleteConfirm(room._id)}>
                    <Trash2 className="h-3.5 w-3.5 opacity-40" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Simplified Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 border-none shadow-2xl">
          <div className="border-b p-6 bg-muted/30">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">{editingRoom ? 'Update Specification' : 'New Registration'}</DialogTitle>
              <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Room Identity & Pricing Control</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 underline underline-offset-4">Room Number *</Label>
                <Input required className="h-11 rounded-xl font-bold" value={form.roomNumber} onChange={e => setForm({ ...form, roomNumber: e.target.value })} placeholder="402" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 underline underline-offset-4">Nightly Fee *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-sm">₹</span>
                  <Input required type="number" className="h-11 rounded-xl pl-7 font-black" value={form.price || ''} onChange={e => setForm({ ...form, price: Number(e.target.value) })} placeholder="5500" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 underline underline-offset-4">Floor</Label>
                <Input type="number" className="h-11 rounded-xl font-bold" value={form.floor} onChange={e => setForm({ ...form, floor: Number(e.target.value) })} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 underline underline-offset-4">Base Limit</Label>
                <Input type="number" className="h-11 rounded-xl font-bold" value={form.baseOccupancy} onChange={e => setForm({ ...form, baseOccupancy: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 underline underline-offset-4">Max Limit</Label>
                <Input type="number" className="h-11 rounded-xl font-bold" value={form.maxOccupancy} onChange={e => setForm({ ...form, maxOccupancy: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 underline underline-offset-4">Extra Guest Fee</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-sm">₹</span>
                  <Input type="number" className="h-11 rounded-xl pl-7 font-bold" value={form.extraPersonPrice} onChange={e => setForm({ ...form, extraPersonPrice: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 underline underline-offset-4">Room Type *</Label>
              <Select value={form.roomType} onValueChange={val => setForm({ ...form, roomType: val })}>
                <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 underline underline-offset-4">Amenities</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {AMENITIES_OPTIONS.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAmenity(a.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border transition-all",
                      form.amenities.includes(a.id)
                        ? "bg-primary text-white border-primary shadow-md shadow-primary/10"
                        : "border-input hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <a.icon className="h-3 w-3" />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-xs font-bold text-destructive bg-destructive/5 p-3 rounded-lg">{error}</p>}
            <DialogFooter className="pt-2 gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="font-bold text-xs uppercase tracking-widest">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="h-12 rounded-2xl flex-1 font-black shadow-lg shadow-primary/20">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingRoom ? 'Update Room' : 'Add Room'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-black text-lg">Delete Room?</DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground">This will permanently remove the asset and its history.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="font-bold text-xs">Cancel</Button>
            <Button variant="destructive" className="font-black rounded-xl text-xs" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
