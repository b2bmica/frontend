import { useState, lazy, Suspense } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { NotificationProvider } from './context/notification-context'
import { Toaster } from 'sonner'
import { 
  Users, Calendar, Bed, TrendingUp, Plus, Download, LogOut,
  Building2, Loader2, AlertTriangle
} from 'lucide-react'
import { Badge } from './components/ui/badge'

import DashboardLayout from './components/layout/dashboard-layout'
import { BookingTable } from './components/booking-table'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { PageSkeleton } from './components/page-states'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'

import { AuthProvider, useAuth } from './context/auth-context'
import { BookingProvider, useBookings } from './context/booking-context'
import { BookingModal } from './components/booking-modal'
import { AuthPage } from './components/auth-page'
import { RoomInventory } from './components/room-inventory'
import { LandingPage } from './components/landing-page'

// Lazy Loading Components
const BookingBoard = lazy(() => import('./components/booking-board').then(module => ({ default: module.BookingBoard })))
const GuestTable = lazy(() => import('./components/guest-table').then(module => ({ default: module.GuestTable })))
const GuestProfileForm = lazy(() => import('./components/guest-profile-form').then(module => ({ default: module.GuestProfileForm })))
const FolioView = lazy(() => import('./components/folio-view').then(module => ({ default: module.FolioView })))
const CashierReport = lazy(() => import('./components/cashier-report').then(module => ({ default: module.CashierReport })))
const HousekeepingBoard = lazy(() => import('./components/housekeeping-board').then(module => ({ default: module.HousekeepingBoard })))
const MaintenanceTickets = lazy(() => import('./components/maintenance-tickets').then(module => ({ default: module.MaintenanceTickets })))
const ExecutiveAnalytics = lazy(() => import('./components/executive-analytics').then(module => ({ default: module.ExecutiveAnalytics })))
const DirectBookingEngine = lazy(() => import('./components/direct-booking').then(module => ({ default: module.DirectBookingEngine })))
const HotelSettings = lazy(() => import('./components/hotel-settings').then(module => ({ default: module.HotelSettings })))

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Dashboard', subtitle: 'Overview of operations and key metrics.' },
  board: { title: 'Booking Calendar', subtitle: 'Visual timeline of all room reservations.' },
  bookings: { title: 'All Bookings', subtitle: 'Complete list of current and past reservations.' },
  rooms: { title: 'Room Inventory', subtitle: 'Manage your rooms, types, rates and availability.' },
  guests: { title: 'Guest Directory', subtitle: 'Manage your visitor records and stay history.' },
  folio: { title: 'Billing & Folio', subtitle: 'Manage guest charges, payments and tax invoices.' },
  reports: { title: 'Reports & Analytics', subtitle: 'Detailed breakdown of financial collections.' },
  housekeeping: { title: 'Housekeeping', subtitle: 'Coordinate cleaning and maintenance tasks.' },
  settings: { title: 'Hotel Settings', subtitle: 'Configure hotel information and Indian tax settings.' },
}

function DashboardStats() {
  const { bookings, rooms } = useBookings()
  const activeBookings = bookings.filter(b => b.status !== 'cancelled')
  const checkedIn = bookings.filter(b => b.status === 'checked-in')
  
  // Calculate revenue from room price × nights
  const totalRevenue = activeBookings.reduce((sum, b) => {
    const room = typeof b.roomId === 'object' ? b.roomId : null
    const nights = Math.max(1, Math.ceil((new Date(b.checkout).getTime() - new Date(b.checkin).getTime()) / (1000 * 60 * 60 * 24)))
    const rate = b.roomPrice || room?.price || 0
    return sum + (rate * nights)
  }, 0)
  
  const occupancyRate = rooms.length > 0 ? Math.round((checkedIn.length / rooms.length) * 100) : 0

  const stats = [
    { title: "Total Bookings", value: activeBookings.length.toString(), change: `${bookings.filter(b => b.status === 'reserved').length} upcoming`, icon: Calendar, color: "text-blue-500" },
    { title: "Occupancy", value: `${occupancyRate}%`, change: `${checkedIn.length} of ${rooms.length} rooms`, icon: Bed, color: "text-green-500" },
    { title: "Checked In", value: checkedIn.length.toString(), change: "active guests", icon: Users, color: "text-purple-500" },
    { title: "Revenue", value: `₹${totalRevenue.toLocaleString()}`, change: "total bookings", icon: TrendingUp, color: "text-orange-500" },
  ]

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="hover:shadow-lg transition-all border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">{stat.title}</CardTitle>
             <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-black">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
               <span className="text-green-500 font-bold">{stat.change}</span>
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function DashboardContent() {
  const { hotel, logout } = useAuth()
  const { bookings } = useBookings()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Robustly extract active tab from URL (works for /dashboard/rooms, #/dashboard/rooms, etc)
  const pathSegments = location.pathname.split('/').filter(Boolean)
  const dashboardIndex = pathSegments.indexOf('dashboard')
  const activeTab = dashboardIndex !== -1 && pathSegments[dashboardIndex + 1] 
    ? pathSegments[dashboardIndex + 1] 
    : 'board'

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const [showPublicBooking, setShowPublicBooking] = useState(false)
  const [isRegisteringGuest, setIsRegisteringGuest] = useState(false)

  const setActiveTab = (tab: string) => {
    navigate(`/dashboard/${tab}`)
  }

  if (showPublicBooking) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <div className="relative">
          <Button variant="outline" size="sm" className="absolute top-4 right-4 z-50" onClick={() => setShowPublicBooking(false)}>
            ← Back to Dashboard
          </Button>
          <DirectBookingEngine />
        </div>
      </Suspense>
    )
  }

  const currentPage = pageTitles[activeTab] || pageTitles.board

  return (
    <>
      <BookingModal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} />
      <DashboardLayout activeTab={activeTab} onTabChange={(tab) => {
        if (tab === 'new-booking') {
          setIsBookingModalOpen(true);
        } else if (tab === 'booking-engine') {
          setShowPublicBooking(true);
        } else if (tab === 'register-new') {
          logout(); // Return to auth portal to establish new property
        } else {
          setActiveTab(tab);
        }
      }}>
        <div className="flex flex-col gap-4 md:gap-6">
          {/* Header */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">{hotel?.name || 'Hotel'}</span>
                {hotel?.status === 'deleted' && (
                  <Badge variant="outline" className="text-[9px] font-black uppercase bg-amber-50 text-amber-700 border-amber-200 py-0 h-5">Legacy / Deleted</Badge>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">{currentPage.title}</h1>
              <p className="text-muted-foreground text-xs md:text-sm font-medium">{currentPage.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={() => setIsBookingModalOpen(true)} 
                disabled={hotel?.status === 'deleted'}
                className="rounded-xl font-bold uppercase text-[11px] tracking-wider px-6 h-10 shadow-lg shadow-primary/10 transition-all active:scale-[0.98]"
              >
                <Plus className="mr-2 h-4 w-4" /> New Booking
              </Button>
            </div>
          </div>

          {hotel?.status === 'deleted' && (
             <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 text-amber-900">
                <div className="p-2 bg-white rounded-lg"><AlertTriangle className="h-4 w-4 text-amber-600" /></div>
                <div className="text-xs">
                   <p className="font-black uppercase tracking-widest text-[10px] mb-0.5">Legacy View Mode</p>
                   <p className="font-medium opacity-80">This property was deleted on {hotel.deletedAt ? new Date(hotel.deletedAt).toLocaleDateString() : 'N/A'}. All data is strictly Read-Only.</p>
                </div>
             </div>
          )}

          <Suspense fallback={<PageSkeleton />}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 md:space-y-6">
              {isRegisteringGuest ? (
                <GuestProfileForm onSave={() => setIsRegisteringGuest(false)} onCancel={() => setIsRegisteringGuest(false)} />
              ) : (
                <>
                    <AnimatePresence mode="wait">
                      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} className="space-y-6">
                        {activeTab === 'overview' && (
                           <>
                             <DashboardStats />
                             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                               <Card className="col-span-full lg:col-span-4 border-none shadow-md">
                                 <CardHeader><CardTitle>Live Operations</CardTitle></CardHeader>
                                 <CardContent><BookingTable /></CardContent>
                               </Card>
                               <Card className="col-span-full lg:col-span-3 border-none shadow-md">
                                 <CardHeader><CardTitle>Room Status</CardTitle></CardHeader>
                                 <CardContent className="space-y-6">
                                    <RoomStatusBars />
                                 </CardContent>
                               </Card>
                             </div>
                           </>
                        )}
                        
                        {activeTab === 'board' && <BookingBoard />}
                        {activeTab === 'bookings' && <BookingTable />}
                        {activeTab === 'rooms' && <RoomInventory />}
                        {activeTab === 'guests' && <Card className="border-none shadow-md"><CardContent className="pt-6"><GuestTable /></CardContent></Card>}
                        {activeTab === 'folio' && <FolioView bookingId={bookings[0]?._id} />}
                        
                        {activeTab === 'reports' && (
                           <Tabs defaultValue="cashier">
                             <TabsList className="mb-4"><TabsTrigger value="cashier">Cashier</TabsTrigger><TabsTrigger value="analytics">Executive</TabsTrigger></TabsList>
                             <TabsContent value="cashier"><CashierReport /></TabsContent>
                             <TabsContent value="analytics"><ExecutiveAnalytics /></TabsContent>
                           </Tabs>
                        )}

                        {activeTab === 'housekeeping' && (
                           <Tabs defaultValue="cleaning">
                             <TabsList className="mb-4"><TabsTrigger value="cleaning">Cleaning</TabsTrigger><TabsTrigger value="maintenance">Maintenance</TabsTrigger></TabsList>
                             <TabsContent value="cleaning"><HousekeepingBoard /></TabsContent>
                             <TabsContent value="maintenance"><MaintenanceTickets /></TabsContent>
                           </Tabs>
                        )}

                        {activeTab === 'settings' && <HotelSettings />}
                      </motion.div>
                    </AnimatePresence>
                </>
              )}
            </motion.div>
          </Suspense>
        </div>
      </DashboardLayout>
    </>
  )
}

function RoomStatusBars() {
  const { rooms } = useBookings()
  const types = ['Standard', 'Deluxe', 'Suite', 'Penthouse', 'Presidential']
  return (
    <>
      {types.map(type => {
        const typeRooms = rooms.filter(r => r.roomType === type)
        const occupied = typeRooms.filter(r => r.status === 'occupied').length
        const pct = typeRooms.length > 0 ? Math.round((occupied / typeRooms.length) * 100) : 0
        if (typeRooms.length === 0) return null
        return (
          <div key={type} className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span>{type} ({occupied}/{typeRooms.length})</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
      {rooms.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No rooms added yet</p>}
    </>
  )
}



function App() {
  const { isAuthenticated, isLoading } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="relative flex flex-col items-center">
          {/* Branded Icon Container */}
          <div className="relative mb-8">
            <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-white shadow-2xl shadow-primary/40 animate-bounce">
              <Building2 className="h-10 w-10" />
            </div>
            <div className="absolute -inset-4 border-2 border-primary/10 rounded-[2rem] animate-[spin_4s_linear_infinite]" />
            <div className="absolute -inset-8 border border-primary/5 rounded-[3rem] animate-[spin_8s_linear_infinite_reverse]" />
          </div>

          {/* Text & Loading Progress */}
          <div className="text-center space-y-4">
             <div className="flex flex-col items-center">
                <span className="text-sm font-black uppercase tracking-[0.4em] text-slate-900 mb-1">InnLogix Systems</span>
                <span className="h-0.5 w-12 bg-primary rounded-full" />
             </div>
             
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span>Synchronizing Environment</span>
             </div>

             <div className="w-48 h-1 bg-slate-50 rounded-full overflow-hidden mt-4">
                <div className="h-full bg-primary/30 animate-[loader-slide_2s_infinite_linear]" style={{ width: '40%' }} />
             </div>
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes loader-slide {
            0% { transform: translateX(-150%); }
            100% { transform: translateX(250%); }
          }
        `}} />
      </div>
    )
  }

  if (!isAuthenticated) {
    if (!showLogin) {
      return <LandingPage onGetStarted={() => setShowLogin(true)} />
    }
    return <AuthPage />
  }

  // Handle Root Redirects
  if (location.pathname === '/' || location.pathname === '/dashboard' || location.pathname === '/dashboard/') {
    return <Navigate to="/dashboard/board" replace />
  }

  return (
    <BookingProvider>
      <NotificationProvider>
        <div className="contents">
          <AnimatePresence mode="wait">
             {/* Simple router logic within dashboard */}
             <DashboardContent />
          </AnimatePresence>
        </div>
        <Toaster position="top-right" expand={true} richColors closeButton />
      </NotificationProvider>
    </BookingProvider>
  )
}

function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}

export default AppWrapper
