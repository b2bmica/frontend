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

const navItems = [
  {
    title: "Bookings",
    id: "board",
    icon: Calendar,
    items: [
      { title: "Calendar View", id: "board" },
      { title: "All Bookings", id: "bookings" },
    ],
  },
  {
    title: "Dashboard",
    id: "overview",
    icon: LayoutDashboard,
  },
  {
    title: "Rooms",
    id: "rooms",
    icon: Bed,
    items: [
      { title: "Room Inventory", id: "rooms" },
      { title: "Housekeeping", id: "housekeeping" },
    ],
  },
  {
    title: "Guests",
    id: "guests",
    icon: Users,
  },
  {
    title: "Finance",
    id: "folio",
    icon: Wallet,
    items: [
      { title: "Billing & Folio", id: "folio" },
      { title: "Financial Reports", id: "reports" },
    ],
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
            const hasItems = item.items && item.items.length > 0
            const isActive = currentPathSegment === item.id || item.items?.some(sub => sub.id === currentPathSegment)
            
            if (!hasItems) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={currentPathSegment === item.id}
                  >
                    <Link to={`/dashboard/${item.id}`} onClick={() => setOpenMobile(false)}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }
            return (
              <Collapsible
                key={item.title}
                open={isActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isActive}
                    className="w-full"
                  >
                    <Link 
                      to={`/dashboard/${item.id}`} 
                      onClick={() => setOpenMobile(false)}
                      className="flex items-center w-full"
                    >
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      {hasItems && (
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                  
                  {hasItems && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={currentPathSegment === subItem.id}
                            >
                              <Link to={`/dashboard/${subItem.id}`} onClick={() => setOpenMobile(false)}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
