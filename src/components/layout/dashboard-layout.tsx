import * as React from "react"
import { Bell, LogOut, Settings, Wrench, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/context/auth-context"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
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
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <SidebarProvider style={{ "--sidebar-width": "18.5rem" } as React.CSSProperties}>
      <AppSidebar activeTab={activeTab} onTabChange={onTabChange} />
      <SidebarInset className="flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-3 md:px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-4 min-w-0">
            <SidebarTrigger className="flex-shrink-0" />
            <Separator orientation="vertical" className="mr-1 h-4 flex-shrink-0" />
            <div className="flex flex-col">
              <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate leading-none mb-1">
                {activeTab === 'board' ? 'Calendar View' : 
                 activeTab === 'bookings' ? 'Registrations' :
                 activeTab === 'overview' ? 'Stats Overview' :
                 activeTab === 'rooms' ? 'Room List' :
                 activeTab === 'housekeeping' ? 'Housekeeping' :
                 activeTab === 'maintenance' ? 'Maintenance' :
                 activeTab === 'guests' ? 'Guest History' :
                 activeTab === 'folio' ? 'Payments & Folio' :
                 activeTab === 'reports' ? 'Performance Report' :
                 'Settings'}
              </h1>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate opacity-50">
                {hotel?.name || 'Hotel Management'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {['board', 'bookings'].includes(activeTab || '') && (
              <Button 
                size="sm" 
                onClick={() => onTabChange?.('new-booking')} 
                className="rounded-xl font-bold uppercase text-[10px] tracking-widest px-3 md:px-4 h-9 shadow-lg shadow-primary/10 transition-all active:scale-[0.95] mr-0.5 md:mr-2"
              >
                <Plus className="md:mr-1.5 h-3.5 w-3.5" /> 
                <span className="hidden sm:inline">Book</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
              <Bell className="h-4 w-4" />
            </Button>
            <ModeToggle />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                  <Avatar className="h-8 w-8 border border-white shadow-sm">
                    <AvatarFallback className="text-[10px] font-bold bg-slate-900 text-white">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mt-2" align="end" sideOffset={8}>
                <DropdownMenuLabel className="font-bold text-[10px] uppercase tracking-wider opacity-40">Command Center</DropdownMenuLabel>
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
        </header>
        <main className="flex-1 overflow-auto p-3 md:p-6 min-h-0">
          <div className={cn("mx-auto h-full", activeTab === 'board' ? "max-w-none" : "max-w-7xl")}>
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
