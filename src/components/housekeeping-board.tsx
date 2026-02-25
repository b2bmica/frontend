import { useState } from 'react';
import { Sparkles, Search, RefreshCw, Loader2, Bed, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { useBookings } from '../context/booking-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const STATUS_TABS = ['all', 'dirty', 'clean', 'occupied'] as const;

const STATUS_META: Record<string, { label: string; badge: string; bar: string }> = {
  clean:    { label: 'Clean',    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',  bar: 'bg-emerald-500' },
  occupied: { label: 'Occupied', badge: 'bg-blue-50 text-blue-700 border-blue-200/80',           bar: 'bg-blue-500'    },
  dirty:    { label: 'Dirty',    badge: 'bg-amber-50 text-amber-700 border-amber-200/80',        bar: 'bg-amber-400'   },
  repair:   { label: 'Repair',   badge: 'bg-red-50 text-red-700 border-red-200/80',              bar: 'bg-red-500'     },
};

const TRANSITIONS: Record<string, { label: string; newStatus: string }[]> = {
  dirty:    [{ label: 'Mark Clean',    newStatus: 'clean'    }, { label: 'Mark Occupied', newStatus: 'occupied' }],
  occupied: [{ label: 'Mark Dirty',    newStatus: 'dirty'    }, { label: 'Mark Clean',    newStatus: 'clean'    }],
  clean:    [{ label: 'Mark Occupied', newStatus: 'occupied' }, { label: 'Mark Dirty',    newStatus: 'dirty'    }],
  repair:   [{ label: 'Mark Clean',    newStatus: 'clean'    }, { label: 'Mark Dirty',    newStatus: 'dirty'    }],
};

export function HousekeepingBoard() {
  const { rooms, bookings, updateRoomStatus, loading, refreshRooms } = useBookings();
  const [filter, setFilter]       = useState<string>('all');
  const [search, setSearch]       = useState('');
  const [actioningId, setActioning] = useState<string | null>(null);

  const filtered = rooms.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.roomNumber.toLowerCase().includes(q) || r.roomType.toLowerCase().includes(q);
    }
    return true;
  });

  // Rooms with a live checked-in booking = truly occupied
  const checkedInRoomIds = new Set(
    bookings
      .filter(b => b.status === 'checked-in')
      .map(b => (typeof b.roomId === 'object' ? b.roomId._id : b.roomId))
  );

  const counts = rooms.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Override occupied with the booking-derived count
  counts['occupied'] = checkedInRoomIds.size;

  const handleStatusChange = async (roomId: string, newStatus: string) => {
    setActioning(roomId);
    try { await updateRoomStatus(roomId, newStatus); } catch { /* noop */ }
    setActioning(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed rounded-2xl">
        <Bed className="h-10 w-10 mx-auto text-slate-300 mb-4" />
        <h3 className="text-sm font-bold text-slate-500">No rooms registered</h3>
        <p className="text-xs text-muted-foreground mt-1">Add rooms in the Rooms section first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Housekeeping
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">Room status overview and cleaning assignments</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshRooms} className="h-9 rounded-xl font-bold text-xs border-slate-200 self-start sm:self-auto">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['clean', 'dirty', 'occupied', 'repair'] as const).map(s => {
          const m = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? 'all' : s)}
              className={cn(
                "text-left p-4 rounded-2xl border transition-all hover:shadow-sm",
                filter === s ? "ring-2 ring-primary ring-offset-1" : "",
                m.badge
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] opacity-70">{m.label}</span>
                <span className={cn("w-2 h-2 rounded-full", m.bar)} />
              </div>
              <div className="text-2xl font-black">{counts[s] || 0}</div>
            </button>
          );
        })}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search room number or type..."
            className="pl-9 h-9 rounded-xl bg-slate-50 border-none text-xs font-medium"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map(s => (
            <Button
              key={s}
              variant={filter === s ? 'default' : 'outline'}
              size="sm"
              className="h-9 capitalize text-xs rounded-xl font-bold border-slate-200"
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? `All (${rooms.length})` : `${STATUS_META[s]?.label} (${counts[s] || 0})`}
            </Button>
          ))}
        </div>
      </div>

      {/* Room Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        {/* Table head */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <div className="w-2 mr-3" />
          <div>Room</div>
          <div className="px-4 text-right hidden sm:block">Floor</div>
          <div className="px-4 text-right">Rate</div>
          <div className="pl-4 text-right">Action</div>
        </div>

        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm font-bold text-slate-400">No rooms match this filter.</div>
        )}

        <div className="divide-y divide-slate-100">
          {filtered.map((room, i) => {
            const meta = STATUS_META[room.status] || STATUS_META.dirty;
            const transitions = TRANSITIONS[room.status] || [];
            const isActioning = actioningId === room._id;

            return (
              <motion.div
                key={room._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 items-center px-4 py-3 hover:bg-slate-50/70 transition-colors"
              >
                {/* Status bar */}
                <div className={cn("w-1.5 h-8 rounded-full mr-3 flex-shrink-0", meta.bar)} />

                {/* Room info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">#{room.roomNumber}</span>
                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-tight border px-1.5 py-0", meta.badge)}>
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{room.roomType}</p>
                </div>

                {/* Floor */}
                <div className="px-4 text-xs font-bold text-slate-500 text-right hidden sm:block">
                  {room.floor ? `F${room.floor}` : '—'}
                </div>

                {/* Rate */}
                <div className="px-4 text-xs font-black text-slate-700 text-right">
                  ₹{room.price.toLocaleString()}
                </div>

                {/* Action dropdown */}
                <div className="pl-4">
                  {transitions.length > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActioning}
                          className="h-8 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200 hover:border-primary hover:text-primary transition-colors"
                        >
                          {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <>Update <ChevronDown className="h-2.5 w-2.5 ml-1 opacity-60" /></>}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[150px] rounded-xl shadow-lg border-slate-100">
                        {transitions.map(t => (
                          <DropdownMenuItem
                            key={t.newStatus}
                            className="text-xs font-bold cursor-pointer rounded-lg"
                            onClick={() => handleStatusChange(room._id, t.newStatus)}
                          >
                            {t.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-[10px] text-slate-300 font-bold">—</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
