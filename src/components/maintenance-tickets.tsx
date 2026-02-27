import { useState, useEffect } from 'react';
import { 
  Toolbox, 
  CheckCircle, 
  Construction,
  Plus,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Wrench,
  User,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Construction className="h-6 w-6 text-orange-500" />
            Engineering & Maintenance
          </h2>
          <p className="text-muted-foreground text-sm font-medium">Coordinate room repairs and technical asset maintenance.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-6 h-10 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-orange-500/20">
          <Plus className="mr-2 h-4 w-4" /> Log Deficiency
        </Button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {(['all', 'pending', 'in-progress', 'resolved'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              filter === f 
                ? "bg-slate-900 text-white shadow-md" 
                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            )}
          >
            {f.replace('-', ' ')}
          </button>
        ))}
      </div>

      <ScrollArea className="h-[calc(100vh-370px)] pr-4 scrollbar-hide">
        <div className="space-y-4">
          {tickets.filter(t => filter === 'all' || t.status === filter).length === 0 ? (
            <div className="py-24 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
               <div className="h-16 w-16 rounded-3xl bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                  <ShieldCheck className="h-8 w-8 text-emerald-500/40" />
               </div>
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Zero Deficiencies Found</h3>
               <p className="text-xs text-slate-300 mt-2">No tickets matching the current filter.</p>
            </div>
          ) : (
            tickets.filter(t => filter === 'all' || t.status === filter).map((ticket) => (
              <Card key={ticket._id} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white border border-transparent hover:border-orange-500/10 rounded-[32px]">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                    <div className="flex items-center gap-5 border-r-0 md:border-r border-slate-50 pr-4">
                      <div className="h-14 w-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 group-hover:scale-105 transition-transform">
                        <Toolbox className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-lg font-black italic text-slate-900 leading-none">RM {ticket.roomId?.roomNumber || '???'}</p>
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter mt-1.5 flex items-center gap-1">
                           <Clock className="h-3 w-3" /> {format(new Date(ticket.createdAt), 'dd MMM, HH:mm')}
                        </p>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <p className="font-bold text-sm text-slate-700 leading-relaxed font-mono">{ticket.issue}</p>
                      <div className="flex items-center gap-2">
                         <Badge className={cn(
                           "text-[8px] font-black uppercase tracking-tighter h-5 border-none",
                           ticket.priority === 'urgent' ? "bg-red-500 text-white" : 
                           ticket.priority === 'high' ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"
                         )}>
                           {ticket.priority} Priority
                         </Badge>
                         <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter h-5 border-slate-200 text-slate-400">
                           {ticket.status.replace('-', ' ')}
                         </Badge>
                         {ticket.reportedBy?.name && (
                            <div className="flex items-center gap-1 ml-4 opacity-40">
                               <User className="h-3 w-3" />
                               <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{ticket.reportedBy.name}</span>
                            </div>
                         )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      {ticket.status === 'pending' && (
                        <Button 
                          size="sm" 
                          onClick={() => handleUpdateStatus(ticket._id, 'in-progress')}
                          className="rounded-xl h-9 text-[9px] font-black uppercase tracking-widest bg-orange-50 text-orange-600 hover:bg-orange-100 border-none px-5"
                        >
                          Acknowledge
                        </Button>
                      )}
                      {(ticket.status === 'in-progress' || ticket.status === 'pending') && (
                        <Button 
                          size="sm" 
                          onClick={() => handleUpdateStatus(ticket._id, 'resolved')}
                          className="rounded-xl h-9 text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-600 px-5 shadow-lg shadow-emerald-500/20"
                        >
                          Mark Rectified
                        </Button>
                      )}
                      {ticket.status === 'resolved' && (
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100/50">
                           <CheckCircle className="h-4 w-4" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Fixed & Verified</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Log Request Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-[40px] p-0 border-none shadow-2xl overflow-hidden">
           <div className="bg-orange-500 p-8 text-white relative">
              <div className="absolute top-0 right-0 p-8 opacity-10"><Wrench className="h-24 w-24" /></div>
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tight italic">Log Deficiency</DialogTitle>
                <DialogDescription className="text-orange-100 text-[10px] font-black uppercase tracking-widest opacity-80">Creating internal audit for room repair</DialogDescription>
              </DialogHeader>
           </div>
           
           <form onSubmit={handleCreateTicket} className="p-8 space-y-6 bg-white">
              <div className="space-y-4">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Room Under Scrutiny</Label>
                    <Select value={newTicket.roomId} onValueChange={val => setNewTicket({...newTicket, roomId: val})}>
                       <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-black text-xs italic">
                          <SelectValue placeholder="Select Unit" />
                       </SelectTrigger>
                       <SelectContent>
                          {rooms.map(r => (
                             <SelectItem key={r._id} value={r._id}>Room {r.roomNumber} ({r.roomType})</SelectItem>
                          ))}
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Issue Description</Label>
                    <Input 
                       required 
                       placeholder="What needs fixing?"
                       className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-xs" 
                       value={newTicket.issue}
                       onChange={e => setNewTicket({...newTicket, issue: e.target.value})}
                    />
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Operational Priority</Label>
                    <div className="grid grid-cols-3 gap-2">
                       {['low', 'medium', 'urgent'].map(p => (
                          <button
                             key={p}
                             type="button"
                             onClick={() => setNewTicket({...newTicket, priority: p})}
                             className={cn(
                                "h-11 rounded-2xl text-[9px] font-black uppercase tracking-widest border-2 transition-all",
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

              <DialogFooter className="pt-2">
                 <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl bg-orange-500 text-white font-black uppercase tracking-widest text-[11px] shadow-xl shadow-orange-500/20">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Dispatch Engineer <ArrowRight className="ml-2 h-4 w-4" /></>}
                 </Button>
              </DialogFooter>
           </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
