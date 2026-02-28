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

const sections = [
  {
    title: "Front Office",
    items: [
      { title: "Calendar View", id: "board", icon: Calendar },
      { title: "Booking List", id: "bookings", icon: BookOpen },
      { title: "Guest History", id: "guests", icon: Users },
    ]
  },
  {
    title: "Property",
    items: [
      { title: "Housekeeping", id: "housekeeping", icon: Home },
      { title: "Repair Control", id: "maintenance", icon: Wrench },
      { title: "Room List", id: "rooms", icon: Bed },
    ]
  },
  {
    title: "Insights",
    items: [
      { title: "Performance & Dues", id: "reports", icon: BarChart3 },
      { title: "Stats Overview", id: "overview", icon: LayoutDashboard },
      { title: "Payments & Folio", id: "folio", icon: Wallet },
    ]
  },
  {
    title: "Settings",
    items: [
      { title: "Hotel Setup", id: "settings", icon: Settings },
    ]
  }
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

      <SidebarContent className="px-2">
        {sections.filter(s => s.title !== "Settings").map((section) => (
            <div key={section.title} className="mb-4">
               <h4 className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-80 group-data-[collapsible=icon]:hidden">
                  {section.title}
               </h4>
               <SidebarMenu>
                 {section.items.map((item) => {
                   const isActive = currentPathSegment === item.id;
                   return (
                     <SidebarMenuItem key={item.title}>
                       <SidebarMenuButton
                         asChild
                         tooltip={item.title}
                         isActive={isActive}
                         className="w-full h-11 px-4 text-[13px] font-bold tracking-tight data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:shadow-sm transition-all duration-200 rounded-xl mb-0.5"
                       >
                         <Link to={`/dashboard/${item.id}`} onClick={() => setOpenMobile(false)} className="flex items-center gap-3">
                           <div className={cn(
                             "flex items-center justify-center size-7 rounded-lg transition-colors shadow-xs shrink-0",
                             isActive ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-500"
                           )}>
                             {item.icon && <item.icon className="size-3.5" />}
                           </div>
                           <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                         </Link>
                       </SidebarMenuButton>
                     </SidebarMenuItem>
                   )
               })}
             </SidebarMenu>
          </div>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
