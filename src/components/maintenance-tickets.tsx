import { useState, useEffect } from 'react';
import { 
  Toolbox, 
  CheckCircle, 
  Construction,
  Plus,
  Loader2,
  ShieldCheck,
  Wrench,
  User,
  Clock,
  ArrowRight,
  AlertTriangle,
  Settings2
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { format } from 'date-fns';
import { useBookings } from '../context/booking-context';

export function MaintenanceTickets() {
  const { rooms } = useBookings();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'resolved'>('all');
  
  const [newTicket, setNewTicket] = useState({
    roomId: '',
    issue: '',
    priority: 'medium'
  });

  const fetchTickets = async () => {
    try {
      const data = await api.getMaintenanceTickets();
      setTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const handleUpdateStatus = async (id: string, status: string) => {
    setStatusLoading(id);
    try {
      await api.updateMaintenanceStatus(id, status);
      await fetchTickets();
    } catch (err) {
      console.error(err);
    } finally {
      setStatusLoading(null);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.roomId || !newTicket.issue) return;
    
    setIsSubmitting(true);
    try {
      await api.createMaintenanceTicket(newTicket);
      setIsModalOpen(false);
      setNewTicket({ roomId: '', issue: '', priority: 'medium' });
      fetchTickets();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="relative">
          <Loader2 className="h-8 w-8 animate-spin text-primary/20" />
          <Settings2 className="h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
        </div>
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Registry...</p>
      </div>
    );
  }

  const counts = {
    all: tickets.length,
    pending: tickets.filter(t => t.status === 'pending').length,
    'in-progress': tickets.filter(t => t.status === 'in-progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  const filteredTickets = tickets.filter(t => filter === 'all' || t.status === filter);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Refined Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-1 w-6 bg-red-600 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-600">Assets</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
             Maintenance & Repair
          </h2>
          <p className="text-xs text-slate-500 font-bold max-w-md leading-relaxed">Technical audits and deficiency rectification.</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-6 h-10 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-900/10"
        >
          <Plus className="mr-2 h-3.5 w-3.5" /> Log Repair
        </Button>
      </div>

      {/* Filter Tabs - Compact */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
        {(['all', 'pending', 'in-progress', 'resolved'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
              filter === f 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
            )}
          >
            {f.replace('-', ' ')}
            <span className={cn(
               "px-1 py-0.5 rounded-md text-[7px] leading-none",
               filter === f ? "bg-slate-100 text-slate-900" : "bg-slate-200/50 text-slate-400"
            )}>
               {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Tickets Feed - More Compact Cards */}
      <div className="space-y-3">
        {filteredTickets.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200/60 shadow-inner">
             <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="h-7 w-7 text-slate-200" />
             </div>
             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inventory Secure</h3>
             <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1 px-8 max-w-xs mx-auto">No pending repairs found.</p>
          </div>
        ) : (
          filteredTickets.map((ticket, i) => (
            <Card key={ticket._id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white rounded-[24px] border border-transparent hover:border-slate-100">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row items-stretch">
                   {/* Status Indicator Bar */}
                   <div className={cn(
                      "w-full h-1 md:w-1.5 md:h-auto shrink-0",
                      ticket.status === 'resolved' ? "bg-emerald-500" : 
                      ticket.status === 'in-progress' ? "bg-amber-400" : "bg-red-500"
                   )} />
                   
                   <div className="flex-1 p-4 md:p-5 flex flex-col md:flex-row items-center gap-4 md:gap-8">
                      {/* Room Identity Section - Smaller */}
                      <div className="flex-none flex items-center gap-4 md:w-36">
                        <div className={cn(
                           "h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                           ticket.status === 'resolved' ? "bg-emerald-50 text-emerald-600" : 
                           ticket.status === 'in-progress' ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                        )}>
                           <Toolbox className="h-5 w-5 md:h-6 md:h-6" />
                        </div>
                        <div className="space-y-0.5">
                           <p className="text-lg md:text-xl font-black italic tracking-tighter text-slate-900 leading-none">#{ticket.roomId?.roomNumber || '???'}</p>
                           <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest opacity-60">Unit Identity</p>
                        </div>
                      </div>

                      {/* Content Section - better visibility */}
                      <div className="flex-1 space-y-2 text-center md:text-left min-w-0">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mb-1">
                            {ticket.priority === 'urgent' && (
                                <Badge className="bg-red-600 text-white text-[9px] font-black uppercase tracking-widest h-5 hover:bg-red-600">
                                  <AlertTriangle className="h-3 w-3 mr-0.5" /> Urgent
                                </Badge>
                            )}
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest h-5 border-slate-200 text-slate-400">
                                {ticket.status.replace('-', ' ')}
                            </Badge>
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 ml-1 uppercase tracking-tighter">
                                <Clock className="h-3 w-3" /> {format(new Date(ticket.createdAt), 'MMM dd · HH:mm')}
                            </span>
                        </div>
                        <h4 className="font-bold text-sm md:text-base text-slate-900 leading-snug break-words">
                            {ticket.issue}
                        </h4>
                        
                        {ticket.reportedBy?.name && (
                           <div className="flex items-center justify-center md:justify-start gap-1.5 opacity-80 mt-1">
                              <User className="h-3 w-3 text-slate-400" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">By {ticket.reportedBy.name}</span>
                           </div>
                        )}
                      </div>

                      {/* Actions Section - Compact Buttons */}
                      <div className="flex-none flex items-center justify-center md:justify-end gap-2 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 md:pl-6">
                        {ticket.status === 'pending' && (
                          <Button 
                            size="sm" 
                            disabled={statusLoading === ticket._id}
                            onClick={() => handleUpdateStatus(ticket._id, 'in-progress')}
                            className="rounded-lg h-9 text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 px-5 transition-all active:scale-95"
                          >
                            {statusLoading === ticket._id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                            Acknowledge
                          </Button>
                        )}
                        {(ticket.status === 'in-progress' || ticket.status === 'pending') && (
                          <Button 
                            size="sm" 
                            disabled={statusLoading === ticket._id}
                            onClick={() => handleUpdateStatus(ticket._id, 'resolved')}
                            className="rounded-lg h-9 text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 px-5 shadow-lg shadow-emerald-500/10 transition-all active:scale-95"
                          >
                            {statusLoading === ticket._id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                            Rectified
                          </Button>
                        )}
                        {ticket.status === 'resolved' && (
                          <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100/30">
                             <CheckCircle className="h-4 w-4" />
                             <span className="text-[10px] font-black uppercase tracking-widest">Closed</span>
                          </div>
                        )}
                      </div>
                   </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Redesigned Request Modal - Smaller */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[32px] p-0 border-none shadow-3xl overflow-hidden">
           <div className="bg-red-600 p-8 text-white relative flex flex-col justify-end">
              <div className="absolute top-0 right-0 p-6 opacity-20"><Settings2 className="h-20 w-20 -mr-6 -mt-6" /></div>
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Deficiency Log</DialogTitle>
                <DialogDescription className="text-white/60 text-[9px] font-black uppercase tracking-widest">Internal Audit Request</DialogDescription>
              </DialogHeader>
           </div>
           
           <form onSubmit={handleCreateTicket} className="p-8 space-y-6 bg-white">
              <div className="space-y-5">
                 <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Source Unit</Label>
                    <Select value={newTicket.roomId} onValueChange={val => setNewTicket({...newTicket, roomId: val})}>
                       <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none font-black text-xs px-4">
                          <SelectValue placeholder="Select Room" />
                       </SelectTrigger>
                       <SelectContent className="rounded-xl border-none shadow-2xl">
                          {rooms.map(r => (
                             <SelectItem key={r._id} value={r._id} className="font-bold py-2 rounded-lg text-xs">#{r.roomNumber} — {r.roomType}</SelectItem>
                          ))}
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Issue Overview</Label>
                    <Input 
                       required 
                       placeholder="e.g. AC cooling insufficient..."
                       className="h-11 rounded-xl bg-slate-50 border-none font-bold text-xs px-4 shadow-inner" 
                       value={newTicket.issue}
                       onChange={e => setNewTicket({...newTicket, issue: e.target.value})}
                    />
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Gravity</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                       {['low', 'medium', 'urgent'].map(p => (
                          <button
                             key={p}
                             type="button"
                             onClick={() => setNewTicket({...newTicket, priority: p})}
                             className={cn(
                                "h-11 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                                newTicket.priority === p 
                                   ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                                   : "bg-white border-slate-50 text-slate-400 hover:border-slate-100"
                             )}
                          >
                             {p}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

              <DialogFooter>
                 <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-red-600/20 transition-all active:scale-[0.98]">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Log Request <ArrowRight className="ml-2 h-4 w-4" /></>}
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
