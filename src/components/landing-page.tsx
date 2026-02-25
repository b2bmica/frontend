import { motion } from 'framer-motion';
import { 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  Globe, 
  Zap, 
  Layers, 
  ShieldCheck, 
  IndianRupee,
  LayoutDashboard,
  Calendar,
  Users
} from 'lucide-react';
import { Button } from './ui/button';

export function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 uppercase">InnLogix</span>
          </div>
          
          <div className="hidden md:flex items-center gap-10">
            <a href="#features" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors">Features</a>
            <a href="#intelligence" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors">Intelligence</a>
            <a href="#pricing" className="text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors">Network</a>
          </div>

          <Button onClick={onGetStarted} className="rounded-xl px-8 h-12 font-bold uppercase text-[11px] tracking-wider shadow-lg shadow-slate-900/10">
            Access Portal
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 lg:pt-56 lg:pb-40">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0,transparent_100%)] opacity-50" />
        
        <div className="max-w-7xl mx-auto px-6 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200/60 text-[10px] font-black uppercase tracking-[0.2em] text-primary"
          >
            <Zap className="h-3 w-3" /> Next-Gen PMS Infrastructure
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-slate-900 mx-auto"
          >
            The Operating System <br /> for <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500">Modern Hospitality.</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed"
          >
            Streamline reservations, optimize room inventories, and scale your hospitality business with the world's most intuitive hotel management framework.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6"
          >
            <Button onClick={onGetStarted} size="lg" className="h-16 px-10 rounded-2xl font-bold uppercase tracking-wider text-xs shadow-xl shadow-slate-900/10 group">
              Register Your Property
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="ghost" size="lg" className="h-16 px-10 rounded-2xl font-bold uppercase tracking-wider text-xs text-slate-400">
              Explore Demo
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-32 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-20 text-center lg:text-left lg:max-w-xl">
             <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary mb-6">Core Modules</h2>
             <h3 className="text-4xl font-black tracking-tight text-slate-900 leading-none">Everything you need to run a 5-star operation.</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { title: 'Global Reservation Engine', desc: 'Manage bookings across all OTA channels in a single real-time calendar view.', icon: Calendar, color: 'text-blue-500' },
              { title: 'Smart Inventory Control', desc: 'Automated room assignments and dynamic pricing capabilities for maximum occupancy.', icon: Layers, color: 'text-emerald-500' },
              { title: 'Executive Analytics', desc: 'Predictive revenue modeling and deep business intelligence at your fingertips.', icon: LayoutDashboard, color: 'text-purple-500' },
              { title: 'Guest Relationship OS', desc: 'Unified profiles with deep stay history and preference tracking.', icon: Users, color: 'text-orange-500' },
              { title: 'Financial Settlement', desc: 'Complex billing, folio management, and localized Indian tax (GST) compliance.', icon: IndianRupee, color: 'text-blue-600' },
              { title: 'Secure Infrastructure', desc: 'Enterprise-grade encryption and 99.99% uptime for MISSION CRITICAL tasks.', icon: ShieldCheck, color: 'text-slate-900' },
            ].map((f, i) => (
              <motion.div 
                key={f.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 bg-white rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className={`h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-primary/5 transition-colors ${f.color}`}>
                  <f.icon className="h-7 w-7" />
                </div>
                <h4 className="text-lg font-black text-slate-900 mb-3">{f.title}</h4>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Quote */}
      <section className="py-40 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
           <div className="max-w-4xl mx-auto">
              <p className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.1] mb-12 italic">
                "We transitioned 4 boutique locations to InnLogix in a single weekend. The impact on our operational velocity was immediate."
              </p>
              <div className="flex flex-col items-center gap-4">
                 <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 font-black text-xl">RA</div>
                 <div>
                    <p className="font-black uppercase tracking-widest text-slate-900">Rajesh Agarwal</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Proprietor, Heritage Collection</p>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t bg-white">
         <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-white">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-sm font-black tracking-tighter text-slate-900 uppercase">InnLogix Systems</span>
            </div>

            <div className="flex gap-10 text-[10px] font-black uppercase tracking-widest text-slate-400">
               <a href="#" className="hover:text-primary transition-colors">Documentation</a>
               <a href="#" className="hover:text-primary transition-colors">API Reference</a>
               <a href="#" className="hover:text-primary transition-colors">Compliance</a>
            </div>

            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">Built for the future of travel.</p>
         </div>
      </footer>
    </div>
  );
}
