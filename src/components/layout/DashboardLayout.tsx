import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, CheckSquare, FileText, Link, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { user } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`${SIDEBAR_COLLAPSED_KEY}_${user?.uid}`);
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    if (isMobile) setMobileSidebarOpen(false);
  }, [isMobile, location.pathname]);

  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem(`${SIDEBAR_COLLAPSED_KEY}_${user.uid}`, String(sidebarCollapsed));
    }
  }, [sidebarCollapsed, user?.uid]);

  return (
    <div className="min-h-screen bg-background">
      {isMobile ? (
        <>
          <main className="pb-24">
            <div className="min-h-[calc(100vh-4rem)] p-4">
              {children}
            </div>
          </main>
          {/* Mobile Bottom Nav — Liquid Glass */}
          <nav className="fixed bottom-4 left-4 right-4 z-50 flex h-[60px] items-stretch rounded-2xl liquid-glass">
            {[
              { title: "Tasks", path: "/tasks", icon: CheckSquare },
              { title: "Notes", path: "/notes", icon: FileText },
              { title: "Links", path: "/links", icon: Link },
            ].map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide transition-all duration-300",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground/70 hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute inset-x-2 inset-y-1.5 rounded-xl bg-primary/10 dark:bg-primary/15 animate-in fade-in zoom-in-95 duration-200" />
                    )}
                    <item.icon className={cn("relative h-[18px] w-[18px] transition-transform duration-200", isActive && "scale-110")} />
                    <span className="relative">{item.title}</span>
                  </>
                )}
              </NavLink>
            ))}
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetTrigger asChild>
                <button
                  className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground/70 hover:text-foreground transition-all duration-300"
                >
                  <MoreHorizontal className="h-[18px] w-[18px]" />
                  <span>More</span>
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <Sidebar />
              </SheetContent>
            </Sheet>
          </nav>
        </>
      ) : (
        <div className="flex">
          <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
          <main className="flex-1">
            <div className="min-h-screen p-8">
              {children}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
