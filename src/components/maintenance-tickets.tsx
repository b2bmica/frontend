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

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.updateMaintenanceStatus(id, status);
      fetchTickets();
    } catch (err) {
      console.error(err);
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
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
          <Settings2 className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Asset Registry...</p>
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
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-1.5 w-8 bg-red-600 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600">Operations Control</span>
          </div>
          <h2 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
             Maintenance <span className="text-slate-300 font-light italic">&</span> Repair
          </h2>
          <p className="text-sm text-slate-500 font-bold max-w-md leading-relaxed">Manage room deficiencies, technical audits, and asset rectification workflows.</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-slate-900 text-white hover:bg-slate-800 rounded-2xl px-8 h-12 font-black uppercase text-[11px] tracking-widest shadow-xl shadow-slate-900/10 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="mr-2 h-4 w-4" /> Log Repair
        </Button>
      </div>

      {/* Filter Tabs - Premium Glass Style */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/50 rounded-2xl w-fit">
        {(['all', 'pending', 'in-progress', 'resolved'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative flex items-center gap-2",
              filter === f 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            {f.replace('-', ' ')}
            <span className={cn(
               "px-1.5 py-0.5 rounded-md text-[8px]",
               filter === f ? "bg-slate-100 text-slate-900" : "bg-slate-200/50 text-slate-400"
            )}>
               {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Tickets Feed */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <div className="py-32 text-center bg-white rounded-[40px] border border-dashed border-slate-200/60 shadow-inner">
             <div className="h-20 w-20 rounded-[32px] bg-slate-50 flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="h-10 w-10 text-slate-200" />
             </div>
             <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Inventory Secure</h3>
             <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2 px-8 max-w-xs mx-auto">No pending repairs found or reported for this category.</p>
          </div>
        ) : (
          filteredTickets.map((ticket, i) => (
            <Card key={ticket._id} className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] transition-all group overflow-hidden bg-white rounded-[32px] border border-transparent hover:border-slate-100">
              <CardContent className="p-0">
                <div className="flex flex-col md:row items-stretch">
                   {/* Status Indicator Bar (Responsive Side/Top) */}
                   <div className={cn(
                      "w-2 md:w-3 shrink-0",
                      ticket.status === 'resolved' ? "bg-emerald-500" : 
                      ticket.status === 'in-progress' ? "bg-amber-400" : "bg-red-500"
                   )} />
                   
                   <div className="flex-1 p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">
                      {/* Room Identity Section */}
                      <div className="flex-none flex items-center gap-6 md:w-48 text-center md:text-left">
                        <div className={cn(
                           "h-16 w-16 rounded-3xl flex items-center justify-center shrink-0 shadow-inner",
                           ticket.status === 'resolved' ? "bg-emerald-50 text-emerald-600" : 
                           ticket.status === 'in-progress' ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                        )}>
                           <Toolbox className="h-7 w-7" />
                        </div>
                        <div className="space-y-1">
                           <p className="text-2xl font-black italic tracking-tighter text-slate-900 leading-none">#{ticket.roomId?.roomNumber || '???'}</p>
                           <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest opacity-60">Unit Identity</p>
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="flex-1 space-y-4 text-center md:text-left">
                        <div className="space-y-1.5">
                           <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                              {ticket.priority === 'urgent' && (
                                 <Badge className="bg-red-600 text-white text-[8px] font-black uppercase tracking-widest h-5 hover:bg-red-600">
                                    <AlertTriangle className="h-3 w-3 mr-1" /> Urgent
                                 </Badge>
                              )}
                              <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest h-5 border-slate-200 text-slate-400">
                                 {ticket.status.replace('-', ' ')}
                              </Badge>
                              <span className="text-[9px] font-bold text-slate-300 flex items-center gap-1 ml-1 uppercase tracking-tighter">
                                 <Clock className="h-3 w-3" /> {format(new Date(ticket.createdAt), 'MMM dd · HH:mm')}
                              </span>
                           </div>
                           <h4 className="font-bold text-lg text-slate-900 leading-tight">
                              {ticket.issue}
                           </h4>
                        </div>
                        
                        {ticket.reportedBy?.name && (
                           <div className="flex items-center justify-center md:justify-start gap-2">
                              <span className="p-1 rounded-full bg-slate-100">
                                 <User className="h-3 w-3 text-slate-400" />
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reported by {ticket.reportedBy.name}</span>
                           </div>
                        )}
                      </div>

                      {/* Actions Section */}
                      <div className="flex-none flex items-center justify-center md:justify-end gap-3 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 md:pl-8">
                        {ticket.status === 'pending' && (
                          <Button 
                            size="sm" 
                            onClick={() => handleUpdateStatus(ticket._id, 'in-progress')}
                            className="rounded-2xl h-11 text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 px-6 shadow-lg shadow-slate-900/10"
                          >
                            Acknowledge
                          </Button>
                        )}
                        {(ticket.status === 'in-progress' || ticket.status === 'pending') && (
                          <Button 
                            size="sm" 
                            onClick={() => handleUpdateStatus(ticket._id, 'resolved')}
                            className="rounded-2xl h-11 text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 px-6 shadow-lg shadow-emerald-500/20"
                          >
                            Rectified
                          </Button>
                        )}
                        {ticket.status === 'resolved' && (
                          <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100/50">
                             <CheckCircle className="h-4 w-4" />
                             <span className="text-[10px] font-black uppercase tracking-widest">Closed Out</span>
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

      {/* Redesigned Request Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-[48px] p-0 border-none shadow-3xl overflow-hidden">
           <div className="bg-red-600 p-10 text-white relative h-40 flex flex-col justify-end">
              <div className="absolute top-0 right-0 p-8 opacity-20"><Settings2 className="h-28 w-28 -mr-10 -mt-10" /></div>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Deficiency Log</DialogTitle>
                <DialogDescription className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em]">Asset Internal Audit Request</DialogDescription>
              </DialogHeader>
           </div>
           
           <form onSubmit={handleCreateTicket} className="p-10 space-y-8 bg-white">
              <div className="space-y-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Source Unit</Label>
                    <Select value={newTicket.roomId} onValueChange={val => setNewTicket({...newTicket, roomId: val})}>
                       <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-black text-xs px-5 shadow-inner">
                          <SelectValue placeholder="Select Room" />
                       </SelectTrigger>
                       <SelectContent className="rounded-2xl border-none shadow-2xl">
                          {rooms.map(r => (
                             <SelectItem key={r._id} value={r._id} className="font-bold py-3 rounded-xl">#{r.roomNumber} — {r.roomType}</SelectItem>
                          ))}
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Issue Overview</Label>
                    <Input 
                       required 
                       placeholder="e.g. AC cooling insufficient, leaking tap..."
                       className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-xs px-5 shadow-inner" 
                       value={newTicket.issue}
                       onChange={e => setNewTicket({...newTicket, issue: e.target.value})}
                    />
                 </div>

                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Operational Gravity</Label>
                    <div className="grid grid-cols-3 gap-2">
                       {['low', 'medium', 'urgent'].map(p => (
                          <button
                             key={p}
                             type="button"
                             onClick={() => setNewTicket({...newTicket, priority: p})}
                             className={cn(
                                "h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                                newTicket.priority === p 
                                   ? "bg-slate-900 border-slate-900 text-white shadow-xl scale-105" 
                                   : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                             )}
                          >
                             {p}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

              <DialogFooter>
                 <Button type="submit" disabled={isSubmitting} className="w-full h-15 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]">
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin font-black" /> : <>Dispatch Service Request <ArrowRight className="ml-2 h-4 w-4" /></>}
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
