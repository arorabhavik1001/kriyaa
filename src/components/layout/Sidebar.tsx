import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  CheckSquare, 
  FileText,
  Link,
  Tag,
  CalendarDays,
  ExternalLink,
  Settings,
  User,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Overview", path: "/", icon: LayoutDashboard },
  { title: "Schedule", path: "/schedule", icon: CalendarDays },
  { title: "Tasks", path: "/tasks", icon: CheckSquare },
  { title: "Notes", path: "/notes", icon: FileText },
  { title: "Saved Links", path: "/links", icon: Link },
  { title: "Categories", path: "/categories", icon: Tag },
  { title: "PRMS", path: "/external", icon: ExternalLink },
];

const bottomItems = [
  { title: "Settings", path: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { logout } = useAuth();

  return (
    <aside className="h-[100dvh] w-64 flex-shrink-0 overflow-hidden bg-sidebar border-r border-sidebar-border flex flex-col lg:h-screen lg:sticky lg:top-0">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <User className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Self-Management</h1>
            <p className="text-xs text-muted-foreground">Dashboard</p>
          </div>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.title}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Nav */}
        <div className="border-t border-sidebar-border p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {/* {bottomItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                location.pathname === item.path && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              {item.title}
            </NavLink>
          ))} */}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
