import * as React from "react"
import {
  Bed, Calendar, ChevronRight, Hotel, LayoutDashboard,
  Settings, Users, Wallet, Home, Wrench, BookOpen, BarChart3,
  Building2, LogOut, User,
} from "lucide-react"

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useAuth } from "../context/auth-context"
import { useSidebar } from "@/components/ui/sidebar"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"

const navItems = [
  {
    title: "Calendar",
    id: "board",
    icon: Calendar,
  },
  {
    title: "Registrations",
    id: "bookings",
    icon: BookOpen,
  },
  {
    title: "Stats & Overview",
    id: "overview",
    icon: LayoutDashboard,
  },
  {
    title: "Room List",
    id: "rooms",
    icon: Bed,
  },
  {
    title: "Housekeeping",
    id: "housekeeping",
    icon: Home,
  },
  {
    title: "Maintenance",
    id: "maintenance",
    icon: Wrench,
  },
  {
    title: "Guest History",
    id: "guests",
    icon: Users,
  },
  {
    title: "Payments & Folio",
    id: "folio",
    icon: Wallet,
  },
  {
    title: "Performance Report",
    id: "reports",
    icon: BarChart3,
  },
  {
    title: "Hotel Settings",
    id: "settings",
    icon: Settings,
  },
]

export function AppSidebar({ 
  activeTab, 
  onTabChange, 
  ...props 
}: React.ComponentProps<typeof Sidebar> & { 
  activeTab?: string, 
  onTabChange?: (tab: string) => void 
}) {
  const { user, hotel, logout } = useAuth()
  const { setOpenMobile } = useSidebar()
  const location = useLocation()
  const pathSegments = location.pathname.split('/').filter(Boolean)
  const dashboardIndex = pathSegments.indexOf('dashboard')
  const currentPathSegment = dashboardIndex !== -1 && pathSegments[dashboardIndex + 1] 
    ? pathSegments[dashboardIndex + 1] 
    : 'board'

  const handleTabChange = (id: string) => {
    onTabChange?.(id)
    setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{hotel?.name || 'Hotel'}</span>
                <span className="truncate text-xs text-muted-foreground capitalize">{user?.role || 'Staff'}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = currentPathSegment === item.id
            
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isActive}
                  className="w-full h-12 px-4 text-[14px] font-bold tracking-tight data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:border-r-4 data-[active=true]:border-primary transition-all duration-200 rounded-xl"
                >
                  <Link to={`/dashboard/${item.id}`} onClick={() => setOpenMobile(false)} className="flex items-center gap-3">
                    <div className={cn(
                      "flex items-center justify-center size-8 rounded-lg transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-500"
                    )}>
                      {item.icon && <item.icon className="size-4" />}
                    </div>
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarRail />
      <SidebarFooter className="p-4 border-t border-slate-50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={logout}
              className="w-full h-11 px-4 text-xs font-bold uppercase tracking-widest text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl"
            >
              <LogOut className="mr-3 size-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
