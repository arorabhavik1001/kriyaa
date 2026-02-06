import { useEffect, useMemo, useState } from "react";
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
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Command } from "lucide-react";

const BASE_NAV_ITEMS = [
  { title: "Overview", path: "/", icon: LayoutDashboard },
  { title: "Schedule", path: "/schedule", icon: CalendarDays },
  { title: "Tasks", path: "/tasks", icon: CheckSquare },
  { title: "Notes", path: "/notes", icon: FileText },
  { title: "Saved Links", path: "/links", icon: Link },
  { title: "Categories", path: "/categories", icon: Tag },
];

const PRMS_NAV_ITEM = { title: "PRMS", path: "/external", icon: ExternalLink };

const bottomItems = [
  { title: "Settings", path: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { logout } = useAuth();
  const [showPrms, setShowPrms] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const coerceBool = (value: unknown) => {
      if (value === true) return true;
      if (value === false) return false;
      if (typeof value === "string") return value.toLowerCase() === "true";
      if (typeof value === "number") return value === 1;
      return false;
    };

    (async () => {
      try {
        const primary = await getDoc(doc(db, "showPRMS", "showPrms"));
        const snap = primary;
        const data = snap.data()
        const raw = data.showPrms
        if (!cancelled) setShowPrms(coerceBool(raw));
      } catch {
        if (!cancelled) setShowPrms(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = useMemo(
    () => (showPrms ? [...BASE_NAV_ITEMS, PRMS_NAV_ITEM] : BASE_NAV_ITEMS),
    [showPrms],
  );

  return (
    <aside className="h-[100dvh] w-64 flex-shrink-0 overflow-hidden bg-sidebar border-r border-sidebar-border flex flex-col lg:h-screen lg:sticky lg:top-0">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <User className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Ekaagra</h1>
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
          <button
            onClick={() => {
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
            }}
            className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          >
            <Command className="h-3.5 w-3.5" />
            Quick Add
            <kbd className="ml-auto inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </button>
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
