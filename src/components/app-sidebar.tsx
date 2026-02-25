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
            const isActive = activeTab === item.id || item.items?.some(sub => sub.id === activeTab)
            
            if (!hasItems) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={activeTab === item.id}
                    onClick={() => item.id && handleTabChange(item.id)}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
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
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive}
                      onPointerDown={() => item.id && handleTabChange(item.id)}
                    >
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            isActive={activeTab === subItem.id}
                            onClick={() => subItem.id && handleTabChange(subItem.id)}
                          >
                            <span>{subItem.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
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
