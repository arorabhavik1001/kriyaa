import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { 
  BarChart3, 
  Users, 
  FileSpreadsheet, 
  Settings, 
  Database,
  PieChart,
  ExternalLink
} from "lucide-react";

interface PRMSCard {
  title: string;
  description: string;
  icon: React.ElementType;
  url: string;
  color: string;
}

const prmsCards: PRMSCard[] = [
  {
    title: "Analytics Dashboard",
    description: "View detailed analytics and reports",
    icon: BarChart3,
    url: "https://analytics.google.com",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    title: "User Management",
    description: "Manage users and permissions",
    icon: Users,
    url: "https://admin.example.com/users",
    color: "bg-green-500/10 text-green-600",
  },
  {
    title: "Reports",
    description: "Access financial and operational reports",
    icon: FileSpreadsheet,
    url: "https://reports.example.com",
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    title: "Database Console",
    description: "Direct database access and queries",
    icon: Database,
    url: "https://database.example.com",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    title: "Performance Metrics",
    description: "Real-time performance monitoring",
    icon: PieChart,
    url: "https://metrics.example.com",
    color: "bg-pink-500/10 text-pink-600",
  },
  {
    title: "System Settings",
    description: "Configure system preferences",
    icon: Settings,
    url: "https://settings.example.com",
    color: "bg-slate-500/10 text-slate-600",
  },
];

const External = () => {
  const handleCardClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">PRMS</h1>
          <p className="mt-1 text-muted-foreground">
            Quick access to external management systems
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prmsCards.map((card) => (
            <Card
              key={card.title}
              className="group cursor-pointer border-border bg-card transition-all duration-200 hover:border-primary/50 hover:shadow-lg"
              onClick={() => handleCardClick(card.url)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`rounded-lg p-3 ${card.color}`}>
                    <card.icon className="h-6 w-6" />
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{card.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info */}
        <p className="mt-6 text-xs text-muted-foreground">
          Click on any card to open the external system in a new tab.
        </p>
      </div>
    </DashboardLayout>
  );
};

export default External;
