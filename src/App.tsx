import { useState, lazy, Suspense } from 'react'
import { useNavigate, useLocation, Navigate, Routes, Route } from 'react-router-dom'
import { NotificationProvider } from './context/notification-context'
import { Toaster } from 'sonner'
import { 
  Users, Calendar, Bed, TrendingUp, Building2, Loader2, AlertTriangle
} from 'lucide-react'
import DashboardLayout from './components/layout/dashboard-layout'
import { BookingTable } from './components/booking-table'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { PageSkeleton } from './components/page-states'

import { cn } from './lib/utils'
import { AuthProvider, useAuth } from './context/auth-context'
import { BookingProvider, useBookings } from './context/booking-context'
import { BookingModal } from './components/booking-modal'
import { AuthPage } from './components/auth-page'
import { RoomInventory } from './components/room-inventory'
import { LandingPage } from './components/landing-page'

// Lazy Loading Components
const GuestTable = lazy(() => import('./components/guest-table').then(module => ({ default: module.GuestTable })))
const GuestProfileForm = lazy(() => import('./components/guest-profile-form').then(module => ({ default: module.GuestProfileForm })))
const BookingBoard = lazy(() => import('./components/booking-board-v2').then(module => ({ default: module.BookingBoard })))
const HousekeepingBoard = lazy(() => import('./components/housekeeping-board').then(module => ({ default: module.HousekeepingBoard })))
const MaintenanceTickets = lazy(() => import('./components/maintenance-tickets').then(module => ({ default: module.MaintenanceTickets })))
const DirectBookingEngine = lazy(() => import('./components/direct-booking').then(module => ({ default: module.DirectBookingEngine })))
const HotelSettings = lazy(() => import('./components/hotel-settings').then(module => ({ default: module.HotelSettings })))
const AnalyticsDashboard = lazy(() => import('./components/analytics-dashboard').then(module => ({ default: module.AnalyticsDashboard })))

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  board: { title: 'Calendar View', subtitle: 'Visual timeline of all room reservations.' },
  bookings: { title: 'Registrations', subtitle: 'Complete list of current and past reservations.' },
  rooms: { title: 'Room List', subtitle: 'Manage your rooms, types, rates and availability.' },
  guests: { title: 'Guest History', subtitle: 'Manage your visitor records and stay history.' },
  housekeeping: { title: 'Housekeeping', subtitle: 'Coordinate cleaning tasks and room status.' },
  maintenance: { title: 'Maintenance', subtitle: 'Manage repair tickets and facility upkeep.' },
  analytics: { title: 'Analytics', subtitle: 'Advanced performance insights and financial reports.' },
  settings: { title: 'Hotel Settings', subtitle: 'Configure hotel information and Indian tax settings.' },
}



function DashboardContent() {
  const { hotel, logout } = useAuth()
  const { bookings } = useBookings()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Extract active tab from URL for UI highlighting only
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

  const currentPage = pageTitles[activeTab] || pageTitles.board;

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
        <div className={cn("flex flex-col", activeTab === 'board' ? "h-full p-0" : "gap-4 md:gap-6 pt-4 md:pt-6 pb-20")}>
          {activeTab !== 'board' && activeTab !== 'maintenance' && activeTab !== 'housekeeping' && (
            <div className="mb-2 px-4 md:px-6">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">{currentPage.title}</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{currentPage.subtitle}</p>
            </div>
          )}

          {hotel?.status === 'deleted' && (
             <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 text-amber-900 mb-4">
                <div className="p-2 bg-white rounded-lg"><AlertTriangle className="h-4 w-4 text-amber-600" /></div>
                <div className="text-xs">
                   <p className="font-black uppercase tracking-widest text-[10px] mb-0.5">Legacy View Mode</p>
                   <p className="font-medium opacity-80">This property was deleted on {hotel.deletedAt ? new Date(hotel.deletedAt).toLocaleDateString() : 'N/A'}. All data is strictly Read-Only.</p>
                </div>
             </div>
          )}

          <Suspense fallback={<PageSkeleton />}>
            <div className={activeTab === 'board' ? "h-full" : "space-y-4 md:space-y-6"}>
              {isRegisteringGuest ? (
                <GuestProfileForm onSave={() => setIsRegisteringGuest(false)} onCancel={() => setIsRegisteringGuest(false)} />
              ) : (
                <div className={activeTab === 'board' ? "h-full" : "space-y-6"}>
                  <Routes>
                      
                      <Route path="board" element={<BookingBoard />} />
                      <Route path="bookings" element={<BookingTable />} />
                      <Route path="rooms" element={<RoomInventory />} />
                      <Route path="guests" element={<Card className="border-none shadow-md"><CardContent className="pt-6"><GuestTable /></CardContent></Card>} />
                      <Route path="maintenance" element={<MaintenanceTickets />} />
                      <Route path="housekeeping" element={<HousekeepingBoard />} />
                      <Route path="analytics" element={<AnalyticsDashboard />} />
                      <Route path="settings" element={<HotelSettings />} />
                      <Route path="*" element={<Navigate to="/dashboard/board" replace />} />
                  </Routes>
                </div>
              )}
            </div>
          </Suspense>
        </div>
      </DashboardLayout>
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
          <Routes>
            <Route path="dashboard/*" element={<DashboardContent />} />
            <Route path="*" element={<DashboardContent />} />
          </Routes>
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
