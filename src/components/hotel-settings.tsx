import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from '../lib/utils';
import { useAuth } from '../context/auth-context';
import { api } from '../lib/api';
import { 
  Building, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  IndianRupee, 
  Percent, 
  ShieldCheck,
  Save,
  Loader2,
  CheckCircle2,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';

export function HotelSettings() {
  const { hotel, refreshUser, logout, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');

  const [form, setForm] = useState({
    name: hotel?.name || '',
    address: hotel?.address || '',
    phone: hotel?.phone || '',
    email: hotel?.email || '',
    gstin: hotel?.gstin || '',
    settings: {
      checkinTime: hotel?.settings?.checkinTime || '12:00 PM',
      checkoutTime: hotel?.settings?.checkoutTime || '11:00 AM',
      currency: hotel?.settings?.currency || 'INR',
      taxConfig: {
        enabled: hotel?.settings?.taxConfig?.enabled ?? true,
        cgst: hotel?.settings?.taxConfig?.cgst ?? 6,
        sgst: hotel?.settings?.taxConfig?.sgst ?? 6,
        igst: hotel?.settings?.taxConfig?.igst ?? 12,
        hsnCode: hotel?.settings?.taxConfig?.hsnCode || '9963'
      }
    }
  });

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await api.updateHotel(form);
      await refreshUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    }
    setLoading(false);
  };

  const handleDeleteProperty = async () => {
    if (confirmDelete !== hotel?.name) return;
    setLoading(true);
    try {
      await api.deleteHotel();
      logout();
    } catch (err: any) {
      setError(err.message || 'Deletion failed');
      setLoading(false);
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <CardTitle>Hotel Information</CardTitle>
              </div>
              <CardDescription>Primary details displayed on booking engine and invoices.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Hotel Name</Label>
                  <Input id="name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gstin">GSTIN (India)</Label>
                  <Input id="gstin" value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} placeholder="29XXXXX..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Full Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="address" className="pl-10" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="phone" 
                      type="tel"
                      pattern="^[0-9+]{10,15}$"
                      title="Please enter a valid phone number (10-15 digits)"
                      className="pl-10" 
                      value={form.phone} 
                      onChange={e => setForm({...form, phone: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Public Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email"
                      className="pl-10" 
                      value={form.email} 
                      onChange={e => setForm({...form, email: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                <CardTitle>Taxes & GST (Indian Compliance)</CardTitle>
              </div>
              <CardDescription>Configure SGST, CGST and HSN codes for automatic invoice calculation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div className="space-y-0.5">
                  <Label className="text-base">Calculate Taxes Automatically</Label>
                  <p className="text-sm text-muted-foreground">Enabled taxes will be added to the room price during billing.</p>
                </div>
                <div className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors opacity-50 cursor-not-allowed",
                  form.settings.taxConfig.enabled ? "bg-primary" : "bg-muted"
                )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    form.settings.taxConfig.enabled ? "translate-x-6" : "translate-x-1"
                  )} />
                </div>
              </div>

              <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity", !form.settings.taxConfig.enabled && "opacity-50 pointer-events-none")}>
                <div className="space-y-2">
                  <Label className="flex justify-between">
                    SGST (%) <span className="text-[10px] text-primary">State Tax</span>
                  </Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      value={form.settings.taxConfig.sgst} 
                      readOnly
                      className="bg-slate-50 border-none cursor-not-allowed font-bold"
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex justify-between">
                    CGST (%) <span className="text-[10px] text-primary">Central Tax</span>
                  </Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      value={form.settings.taxConfig.cgst} 
                      readOnly
                      className="bg-slate-50 border-none cursor-not-allowed font-bold"
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex justify-between">
                    IGST (%) <span className="text-[10px] text-primary">Inter-state</span>
                  </Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      value={form.settings.taxConfig.igst} 
                      readOnly
                      className="bg-slate-50 border-none cursor-not-allowed font-bold"
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>HSN/SAC Code</Label>
                  <Input 
                    value={form.settings.taxConfig.hsnCode} 
                    readOnly
                    className="bg-slate-50 border-none cursor-not-allowed font-bold"
                    placeholder="9963" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side panels */}
        <div className="space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle>Stay Policy</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Check-in Time</Label>
                <Input value={form.settings.checkinTime} onChange={e => setForm({...form, settings: {...form.settings, checkinTime: e.target.value}})} />
              </div>
              <div className="space-y-2">
                <Label>Check-out Time</Label>
                <Input value={form.settings.checkoutTime} onChange={e => setForm({...form, settings: {...form.settings, checkoutTime: e.target.value}})} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-10" value={form.settings.currency} readOnly />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary text-white shadow-xl border-none">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <CardTitle className="text-white">Review Changes</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <p className="opacity-80">Make sure all details are accurate. These will reflect on your invoices and public booking engine.</p>
              {error && <p className="text-red-200 bg-red-900/30 p-2 rounded text-xs">{error}</p>}
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full bg-white text-primary hover:bg-white/90 font-bold"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {success ? "Settings Saved!" : "Save All Changes"}
              </Button>
            </CardFooter>
          </Card>

        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={success ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        className="fixed bottom-10 right-10 bg-green-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 pointer-events-none"
      >
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-bold">Settings updated successfully!</span>
      </motion.div>
    </div>
  );
}
