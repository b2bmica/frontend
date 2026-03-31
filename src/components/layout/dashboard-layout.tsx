import * as React from "react"
import { LogOut, Settings, Plus, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { Link, useLocation } from "react-router-dom"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function DashboardLayout({
  children,
  activeTab,
  onTabChange,
}: {
  children: React.ReactNode
  activeTab?: string
  onTabChange?: (tab: string) => void
}) {
  const { user, hotel, logout } = useAuth()
  const location = useLocation()
  
  const [isLandscapeMobile, setIsLandscapeMobile] = React.useState(false)

  React.useEffect(() => {
    const checkLandscape = () => {
      // Typically mobile landscape has height less than 500px
      setIsLandscapeMobile(window.innerHeight < 500 && window.innerWidth > window.innerHeight)
    }
    checkLandscape()
    window.addEventListener('resize', checkLandscape)
    return () => window.removeEventListener('resize', checkLandscape)
  }, [])

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  const pathSegments = location.pathname.split('/').filter(Boolean)
  const dashboardIndex = pathSegments.indexOf('dashboard')
  const currentTab = dashboardIndex !== -1 && pathSegments[dashboardIndex + 1]
    ? pathSegments[dashboardIndex + 1]
    : 'board'

  return (
    <SidebarProvider>
      <div className="flex w-full bg-background overflow-hidden h-screen">
        
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* ── Top Navigation Bar ── */}
          {!isLandscapeMobile && (
            <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm flex-shrink-0">
              <div className="flex items-center h-14 px-3 md:px-5 gap-3">

              {/* Sidebar Trigger for Mobile/Collapsed */}
              <SidebarTrigger className="hover:bg-slate-100 h-9 w-9 rounded-lg transition-colors border shadow-sm" />

              {/* Brand */}
              <Link to="/dashboard/board" className="flex items-center gap-2.5 shrink-0 mr-2 ml-1">
                <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-800 hidden sm:block truncate max-w-[120px]">
                  {hotel?.name || 'InnLogix'}
                </span>
              </Link>

              {/* Spacer on mobile, header desktop nav was removed as it's now in the sidebar */}
              <div className="flex-1" />

              {/* Right Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {['board', 'bookings', 'rooms', 'guests'].includes(activeTab || '') && (
                  <Button
                    size="sm"
                    onClick={() => onTabChange?.('new-booking')}
                    className="rounded-lg font-bold uppercase text-[10px] tracking-widest px-3 h-8 shadow-sm transition-all active:scale-[0.95]"
                  >
                    <Plus className="h-3.5 w-3.5 md:mr-1.5" />
                    <span className="hidden sm:inline">Add new</span>
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                      <Avatar className="h-8 w-8 border border-white shadow-sm">
                        <AvatarFallback className="text-[10px] font-bold bg-slate-900 text-white">{initials}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-52 mt-2" align="end" sideOffset={8}>
                    <DropdownMenuLabel className="font-bold text-[10px] uppercase tracking-wider opacity-40">
                      {user?.name || 'Account'}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="py-2.5 font-bold cursor-pointer" onClick={() => onTabChange?.('settings')}>
                      <Settings className="mr-2 h-4 w-4 opacity-50" /> Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="py-2.5 font-bold cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50" onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4 opacity-50" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              </div>
            </header>
          )}

          {/* ── Main Content ── */}
          <main className="flex-1 overflow-auto min-h-0 bg-slate-50/10">
            <div className={cn(
              "h-full",
              currentTab === 'board' || isLandscapeMobile ? "p-0" : "p-3 md:p-6"
            )}>
              <div className={cn("mx-auto h-full", currentTab === 'board' || isLandscapeMobile ? "max-w-none" : "max-w-7xl")}>
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
