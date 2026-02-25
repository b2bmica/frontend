import * as React from "react"
import { Bell, LogOut, Settings, Wrench } from "lucide-react"
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
    <SidebarProvider>
      <AppSidebar activeTab={activeTab} onTabChange={onTabChange} />
      <SidebarInset className="flex flex-col min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-3 md:px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger className="flex-shrink-0" />
            <Separator orientation="vertical" className="mr-1 h-4 flex-shrink-0" />
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate hidden sm:block opacity-60">
              {hotel?.name || 'Hotel Management'}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
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
        <main className="flex-1 overflow-auto p-3 md:p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
