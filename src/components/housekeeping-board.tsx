import { useState } from 'react';
import { Sparkles, Clock, AlertTriangle, RefreshCw, Search, CheckCircle, Wrench, Bed, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { useBookings } from '../context/booking-context';

const STATUS_TABS = ['all', 'dirty', 'clean', 'occupied'] as const;

const statusConfig: Record<string, { label: string; color: string; barColor: string; icon: any }> = {
  clean:               { label: 'Clean',       color: 'bg-green-500/10 text-green-700 border-green-200',   barColor: 'bg-green-500',  icon: CheckCircle },
  occupied:            { label: 'Occupied',    color: 'bg-blue-500/10 text-blue-700 border-blue-200',     barColor: 'bg-blue-500',   icon: Bed },
  dirty:               { label: 'Dirty',       color: 'bg-orange-500/10 text-orange-700 border-orange-200', barColor: 'bg-orange-400', icon: Sparkles },
};

export function HousekeepingBoard() {
  const { rooms, updateRoomStatus, loading, refreshRooms } = useBookings();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  const filtered = rooms.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.roomNumber.toLowerCase().includes(q) || r.roomType.toLowerCase().includes(q);
    }
    return true;
  });

  // Count by status
  const counts = rooms.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleStatusChange = async (roomId: string, newStatus: string) => {
    setActioningId(roomId);
    try {
      await updateRoomStatus(roomId, newStatus);
    } catch (err) {
      console.error(err);
    }
    setActioningId(null);
  };

  const getActions = (status: string, roomId: string): { label: string; newStatus: string; className: string }[] => {
    switch (status) {
      case 'dirty':       return [
        { label: 'Start Cleaning', newStatus: 'clean',     className: 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/10' },
        { label: 'Mark Occupied',  newStatus: 'occupied',  className: 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/10' },
      ];
      case 'occupied':    return [
        { label: 'Mark Dirty',     newStatus: 'dirty',     className: 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/10' },
        { label: 'Mark Clean',     newStatus: 'clean',     className: 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/10' },
      ];
      case 'clean':       return [
        { label: 'Mark Occupied',  newStatus: 'occupied',  className: 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/10' },
        { label: 'Mark Dirty',     newStatus: 'dirty',     className: 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/10' },
      ];
      default: return [];
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/20 rounded-xl border">
        <Bed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-bold">No rooms yet</h3>
        <p className="text-muted-foreground text-sm">Add rooms in the Rooms tab to track housekeeping.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Housekeeping Board
          </h2>
          <p className="text-sm text-muted-foreground">Track and update room cleaning status.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshRooms}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['clean', 'dirty', 'occupied'] as const).map(s => {
          const cfg = statusConfig[s];
          const Icon = cfg.icon;
          return (
            <div key={s} className={cn("rounded-lg border p-3 cursor-pointer transition-all", cfg.color, filter === s && 'ring-2 ring-primary')}
              onClick={() => setFilter(filter === s ? 'all' : s)}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">{cfg.label}</span>
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-2xl font-black mt-1">{counts[s] || 0}</div>
            </div>
          );
        })}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search room..." className="pl-10 h-9"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map(s => (
            <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm"
              className="h-8 capitalize text-xs" onClick={() => setFilter(s)}>
              {s === 'all' ? `All (${rooms.length})` : s.replace('-', ' ')}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence>
          {filtered.map((room, i) => {
            const cfg = statusConfig[room.status] || statusConfig.clean;
            const isActioning = actioningId === room._id;
            return (
              <motion.div key={room._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="relative border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className={cn("absolute top-0 left-0 w-1.5 h-full", cfg.barColor)} />
                  <CardHeader className="pb-2 pl-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-2xl font-black text-primary">#{room.roomNumber}</div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{room.roomType}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] px-2 capitalize", cfg.color)}>
                        {cfg.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pl-5">
                    <div className="text-xs text-muted-foreground whitespace-nowrap mb-1">
                      ₹{room.price.toLocaleString()}/night · Floor {room.floor || '—'}
                    </div>
                    <div className="flex flex-col gap-2">
                      {getActions(room.status, room._id).map((action) => (
                        <Button 
                          key={action.label}
                          size="sm" 
                          className={cn("w-full h-10 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all", action.className)}
                          disabled={isActioning}
                          onClick={() => handleStatusChange(room._id, action.newStatus)}
                        >
                          {isActioning && actioningId === room._id ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : null}
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">No rooms match this filter.</div>
      )}
    </div>
  );
}
