import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  X, 
  Check, 
  User, 
  CreditCard, 
  MapPin, 
  Phone, 
  Mail,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { cn } from '../lib/utils';

export function GuestProfileForm({ onSave, onCancel }: { onSave: (data: any) => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [idType, setIdType] = useState('aadhaar');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'application/pdf': ['.pdf'] },
    maxFiles: 1
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      onSave({ idType, file });
    }, 1500);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl border-t-4 border-t-primary">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex items-center">
          <User className="mr-2 h-6 w-6 text-primary" />
          Guest Registration
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* Identity Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="John Doe" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Input 
                  id="phone" 
                  type="tel"
                  pattern="^[0-9+]{10,15}$"
                  title="Please enter a valid phone number (10-15 digits)"
                  placeholder="+1..." 
                  className="pl-8" 
                  required 
                />
                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Input id="email" type="email" placeholder="john@example.com" className="pl-8" />
                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input id="nationality" placeholder="e.g. American" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Permanent Address</Label>
            <div className="relative">
              <Input id="address" placeholder="123 Street, City, Country" className="pl-8" />
              <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <Separator />

          {/* ID Proof Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold flex items-center">
                <CreditCard className="mr-2 h-5 w-5 text-primary" />
                ID Proof Verification
              </Label>
              <Select value={idType} onValueChange={setIdType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select ID Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="driving-license">Driving License</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="idNumber">ID Number</Label>
                <Input id="idNumber" placeholder={`Enter ${idType} number`} />
              </div>

              {/* Upload Area */}
              <div className="space-y-2">
                <Label>ID Document Copy</Label>
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer flex flex-col items-center justify-center text-center h-[120px]",
                    isDragActive ? "border-primary bg-primary/5 scale-[1.02]" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50",
                    preview ? "border-green-500/50 bg-green-500/5" : ""
                  )}
                >
                  <input {...getInputProps()} />
                  {preview ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center text-green-600 font-medium"
                    >
                      <Check className="mr-2 h-5 w-5" />
                      File Selected
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="ml-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setPreview(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
                      <p className="text-xs text-muted-foreground">
                        Drag & drop or <span className="text-primary font-medium">browse</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground/80">Support: JPG, PNG, PDF (Max 5MB)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Preview Popup */}
            <AnimatePresence>
              {preview && file?.type.startsWith('image/') && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="rounded-lg overflow-hidden border bg-black/5 flex justify-center"
                >
                  <img src={preview} alt="ID Preview" className="max-h-[200px] object-contain p-2" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3 bg-muted/30 pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={loading} className="min-w-[120px]">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Register Guest'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
