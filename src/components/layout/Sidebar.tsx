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
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Command
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const BASE_NAV_ITEMS = [
  { title: "Overview", path: "/", icon: LayoutDashboard },
  { title: "Schedule", path: "/schedule", icon: CalendarDays },
  { title: "Tasks", path: "/tasks", icon: CheckSquare },
  { title: "Notes", path: "/notes", icon: FileText },
  { title: "Saved Links", path: "/links", icon: Link },
  { title: "Categories", path: "/categories", icon: Tag },
];

const PRMS_NAV_ITEM = { title: "PRMS", path: "/external", icon: ExternalLink };

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const location = useLocation();
  const { logout } = useAuth();
  const [showPrms, setShowPrms] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isPinnedOpen = !collapsed;
  const isTemporarilyOpen = collapsed && isHovered;
  const shouldExpand = isPinnedOpen || isTemporarilyOpen;

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
        const data = snap.data();
        const raw = data?.showPrms;
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

  const handleToggle = () => {
    onCollapsedChange?.(!collapsed);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "h-[100dvh] flex-shrink-0 overflow-hidden bg-sidebar border-r border-sidebar-border flex flex-col lg:h-screen lg:sticky lg:top-0 transition-all duration-300 ease-in-out",
          shouldExpand ? "w-64" : "w-16"
        )}
        onMouseEnter={() => collapsed && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className={cn(
            "flex h-16 items-center border-b border-sidebar-border transition-all duration-300",
            shouldExpand ? "gap-3 px-6" : "justify-center px-2"
          )}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shrink-0">
              <User className="h-5 w-5 text-primary-foreground" />
            </div>
            {shouldExpand && (
              <div className="min-w-0 flex-1 overflow-hidden">
                <h1 className="text-sm font-semibold text-foreground truncate">Ekaagra</h1>
                <p className="text-xs text-muted-foreground">Dashboard</p>
              </div>
            )}
          </div>

          {/* Main Nav */}
          <nav className={cn(
            "flex-1 min-h-0 overflow-y-auto space-y-1 py-4 transition-all duration-300",
            shouldExpand ? "px-3" : "px-2"
          )}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              
              const navContent = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                    shouldExpand ? "gap-3 px-3 py-2.5" : "justify-center p-2.5",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  {shouldExpand && <span className="truncate">{item.title}</span>}
                </NavLink>
              );

              if (!shouldExpand) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>{navContent}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10}>
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return navContent;
            })}
          </nav>

          {/* Bottom Nav */}
          <div className={cn(
            "border-t border-sidebar-border pb-[calc(env(safe-area-inset-bottom)+0.75rem)] transition-all duration-300",
            shouldExpand ? "p-3" : "p-2"
          )}>
            {/* Quick Add */}
            {shouldExpand ? (
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
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
                    }}
                    className="mb-2 flex w-full items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-all hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  >
                    <Command className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  Quick Add (⌘K)
                </TooltipContent>
              </Tooltip>
            )}

            {/* Collapse Toggle */}
              {shouldExpand ? (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground mb-2"
                onClick={handleToggle}
              >
                  {isPinnedOpen ? (
                    <>
                      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      Pin open
                    </>
                  )}
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full mb-2"
                    onClick={handleToggle}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  Expand Sidebar
                </TooltipContent>
              </Tooltip>
            )}

            {/* Logout */}
            {shouldExpand ? (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                onClick={logout}
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                Logout
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  Logout
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
