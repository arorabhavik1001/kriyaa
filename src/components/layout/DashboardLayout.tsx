import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (isMobile) setMobileSidebarOpen(false);
  }, [isMobile, location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      {isMobile ? (
        <>
          <div className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center border-b bg-background px-4">
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <Sidebar />
              </SheetContent>
            </Sheet>
            <span className="ml-4 font-semibold">Ekaagra</span>
          </div>
          <main className="pt-16">
            <div className="min-h-[calc(100vh-4rem)] p-4">
              {children}
            </div>
          </main>
        </>
      ) : (
        <div className="flex">
          <Sidebar />
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
