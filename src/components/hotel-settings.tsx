import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { TimePicker, generateTimeIntervals } from './ui/time-picker';
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
  Utensils,
  Timer,
  Trash2,
  Plus
} from 'lucide-react';
import { motion } from 'framer-motion';

export function HotelSettings() {
  const { hotel, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getNextAvailableTime = (currentTimes: string[], defaultTime: string) => {
    const allIntervals = generateTimeIntervals();
    const available = allIntervals.find(t => !currentTimes.includes(t.value));
    return available ? available.value : defaultTime;
  };

  const [form, setForm] = useState({
    name: hotel?.name || '',
    address: hotel?.address || '',
    phone: hotel?.phone || '',
    email: hotel?.email || '',
    gstin: hotel?.gstin || '',
    settings: {
      checkinTimes: hotel?.settings?.checkinTimes?.length ? hotel.settings.checkinTimes : ['14:00'],
      checkoutTimes: hotel?.settings?.checkoutTimes?.length ? hotel.settings.checkoutTimes : ['11:00'],
      earlyCheckinBuffer: hotel?.settings?.earlyCheckinBuffer ?? 0,
      lateCheckoutBuffer: hotel?.settings?.lateCheckoutBuffer ?? 0,
      defaultEnquiryHold: hotel?.settings?.defaultEnquiryHold ?? 240,
      defaultBlockDuration: hotel?.settings?.defaultBlockDuration ?? 1440,
      currency: hotel?.settings?.currency || 'INR',
      taxConfig: {
        enabled: hotel?.settings?.taxConfig?.enabled ?? true,
        cgst: hotel?.settings?.taxConfig?.cgst ?? 6,
        sgst: hotel?.settings?.taxConfig?.sgst ?? 6,
        igst: hotel?.settings?.taxConfig?.igst ?? 12,
        hsnCode: hotel?.settings?.taxConfig?.hsnCode || '9963'
      },
      mealRates: hotel?.settings?.mealRates || { CP: 350, MAP: 650, AP: 950 },
      stayPlans: hotel?.settings?.stayPlans?.length ? hotel.settings.stayPlans : [
        { key: 'EP', label: 'Room Only', description: 'No meals included' },
        { key: 'CP', label: 'Continental Plan', description: 'Room + Breakfast' },
        { key: 'MAP', label: 'Modified American', description: 'Room + Breakfast + Dinner' },
        { key: 'AP', label: 'American Plan', description: 'Room + All Meals (B+L+D)' },
        { key: 'custom', label: 'Custom Inclusions', description: 'Specify your own package' }
      ]
    }
  });

  const handleAddPlan = () => {
    const newKey = `PLAN-${Date.now().toString().slice(-4)}`;
    setForm({
      ...form,
      settings: {
        ...form.settings,
        stayPlans: [...form.settings.stayPlans, { key: newKey, label: 'New Plan', description: 'Description' }],
        mealRates: { ...form.settings.mealRates, [newKey]: 0 }
      }
    });
  };

  const handleRemovePlan = (key: string) => {
    const newPlans = form.settings.stayPlans.filter(p => p.key !== key);
    const newRates = { ...form.settings.mealRates };
    delete newRates[key];
    setForm({
      ...form,
      settings: {
        ...form.settings,
        stayPlans: newPlans,
        mealRates: newRates
      }
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await api.updateHotel(form);
      await refreshUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    }
    setLoading(false);
  };



  return (
    <div className="space-y-6 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Panel with Tabs */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="general">General Information</TabsTrigger>
              <TabsTrigger value="operations">Operations & Policies</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6 mt-0">
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
                      <Input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gstin">GSTIN (India)</Label>
                      <Input id="gstin" value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} placeholder="29XXXXX..." />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Full Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="address" className="pl-10" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
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
                          onChange={e => setForm({ ...form, phone: e.target.value })}
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
                          onChange={e => setForm({ ...form, email: e.target.value })}
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
            </TabsContent>

            <TabsContent value="operations" className="space-y-6 mt-0">
              <Card className="border-none shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <CardTitle>Stay Policy & Timings</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <Label>Allowed Check-in Times</Label>
                      <div className="space-y-2">
                        {form.settings.checkinTimes.map((time, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <TimePicker
                              value={time}
                              disabledValues={form.settings.checkinTimes}
                              onChange={v => {
                                const newArr = [...form.settings.checkinTimes];
                                newArr[idx] = v;
                                setForm({ ...form, settings: { ...form.settings, checkinTimes: newArr } });
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (form.settings.checkinTimes.length > 1) {
                                  setForm({
                                    ...form,
                                    settings: {
                                      ...form.settings,
                                      checkinTimes: form.settings.checkinTimes.filter((_, i) => i !== idx)
                                    }
                                  });
                                }
                              }}
                              disabled={form.settings.checkinTimes.length === 1}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => setForm({
                            ...form,
                            settings: {
                              ...form.settings,
                              checkinTimes: [...form.settings.checkinTimes, getNextAvailableTime(form.settings.checkinTimes, '14:00')]
                            }
                          })}
                        >
                          <Plus className="w-4 h-4 mr-2" /> Add Time
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Label>Allowed Check-out Times</Label>
                      <div className="space-y-2">
                        {form.settings.checkoutTimes.map((time, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <TimePicker
                              value={time}
                              disabledValues={form.settings.checkoutTimes}
                              onChange={v => {
                                const newArr = [...form.settings.checkoutTimes];
                                newArr[idx] = v;
                                setForm({ ...form, settings: { ...form.settings, checkoutTimes: newArr } });
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (form.settings.checkoutTimes.length > 1) {
                                  setForm({
                                    ...form,
                                    settings: {
                                      ...form.settings,
                                      checkoutTimes: form.settings.checkoutTimes.filter((_, i) => i !== idx)
                                    }
                                  });
                                }
                              }}
                              disabled={form.settings.checkoutTimes.length === 1}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => setForm({
                            ...form,
                            settings: {
                              ...form.settings,
                              checkoutTimes: [...form.settings.checkoutTimes, getNextAvailableTime(form.settings.checkoutTimes, '11:00')]
                            }
                          })}
                        >
                          <Plus className="w-4 h-4 mr-2" /> Add Time
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-5 w-5 text-primary" />
                      <CardTitle>Stay Plans & Meal Rates</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleAddPlan} className="h-8 gap-1 font-bold">
                      <Plus className="h-3.5 w-3.5" /> Add Plan
                    </Button>
                  </div>
                  <CardDescription>Configure packages like EP/CP/MAP and their per-person pricing.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y border-t">
                    {form.settings.stayPlans.map((plan, idx) => (
                      <div key={plan.key} className="p-4 hover:bg-slate-50/50 transition-colors">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                          <div className="md:col-span-2 space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Code (Slug)</Label>
                            <Input
                              value={plan.key}
                              disabled={['EP', 'CP', 'MAP', 'AP', 'custom'].includes(plan.key)}
                              onChange={e => {
                                const newKey = e.target.value.toUpperCase().replace(/\s+/g, '-');
                                const updatedPlans = [...form.settings.stayPlans];
                                updatedPlans[idx] = { ...plan, key: newKey };
                                const updatedRates = { ...form.settings.mealRates };
                                updatedRates[newKey] = updatedRates[plan.key] || 0;
                                if (newKey !== plan.key) delete updatedRates[plan.key];
                                setForm({ ...form, settings: { ...form.settings, stayPlans: updatedPlans, mealRates: updatedRates } });
                              }}
                              className="h-9 font-bold text-xs"
                            />
                          </div>
                          <div className="md:col-span-4 space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Label</Label>
                            <Input
                              value={plan.label}
                              onChange={e => {
                                const updatedPlans = [...form.settings.stayPlans];
                                updatedPlans[idx] = { ...plan, label: e.target.value };
                                setForm({ ...form, settings: { ...form.settings, stayPlans: updatedPlans } });
                              }}
                              className="h-9 font-bold"
                            />
                          </div>
                          <div className="md:col-span-3 space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Meal Charge (PP)</Label>
                            <div className="relative">
                              <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                              <Input
                                type="number"
                                disabled={plan.key === 'EP'}
                                value={form.settings.mealRates[plan.key] || 0}
                                onChange={e => {
                                  const updatedRates = { ...form.settings.mealRates, [plan.key]: parseFloat(e.target.value) || 0 };
                                  setForm({ ...form, settings: { ...form.settings, mealRates: updatedRates } });
                                }}
                                className="h-9 pl-7 font-bold"
                              />
                            </div>
                          </div>
                          <div className="md:col-span-1 flex items-center justify-end">
                            <Button variant="ghost" size="icon" onClick={() => handleRemovePlan(plan.key)} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-9 w-9">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>



              <Card className="border-none shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-primary" />
                    <CardTitle>Enquiry / Block Auto-Release</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Default Enquiry Hold Time</Label>
                      <Select value={form.settings.defaultEnquiryHold.toString()} onValueChange={v => setForm({ ...form, settings: { ...form.settings, defaultEnquiryHold: Number(v) } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="60">1 Hour</SelectItem>
                          <SelectItem value="120">2 Hours</SelectItem>
                          <SelectItem value="240">4 Hours</SelectItem>
                          <SelectItem value="480">8 Hours</SelectItem>
                          <SelectItem value="720">12 Hours</SelectItem>
                          <SelectItem value="1440">24 Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Default Block Duration</Label>
                      <Select value={form.settings.defaultBlockDuration.toString()} onValueChange={v => setForm({ ...form, settings: { ...form.settings, defaultBlockDuration: Number(v) } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1440">1 Day</SelectItem>
                          <SelectItem value="4320">3 Days</SelectItem>
                          <SelectItem value="10080">7 Days</SelectItem>
                          <SelectItem value="0">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side panels */}
        <div className="space-y-6">

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
