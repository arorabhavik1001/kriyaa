import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  BarChart3, 
  ExternalLink
} from "lucide-react";

interface PRMSCard {
  title: string;
  description: string;
  icon: React.ElementType;
  url: string;
  color: string;
}

interface PRMSSection {
  title: string;
  cards: PRMSCard[];
}

const prmsSections: PRMSSection[] = [
  {
    title: "Sri Sri Radha Damodar Temple, Sec-67",
    cards: [
      {
        title: "PRMS-DYPH",
        description: "DYPH Preaching Management System",
        icon: BarChart3,
        url: "https://prms-dyph-sec67.web.app",
        color: "bg-blue-500/10 text-blue-600",
      },
      {
        title: "PRMS-Gita",
        description: "Gita Class Preaching Management System (Vidyanidhi Gaurang Prabhuji)",
        icon: BarChart3,
        url: "https://prms-gita.web.app",
        color: "bg-blue-500/10 text-blue-600",
      },
      {
        title: "PRMS-IYF-SOS",
        description: "IYF SOS Preaching Management System",
        icon: BarChart3,
        url: "https://prms-iyf.web.app",
        color: "bg-blue-500/10 text-blue-600",
      },
      {
        title: "PRMS-MHP",
        description: "IYF (Mangal Hari Prabhuji) Preaching Management System",
        icon: BarChart3,
        url: "https://prms-iyf-mhp.web.app",
        color: "bg-blue-500/10 text-blue-600",
      },
      {
        title: "PRMS-NITP",
        description: "NIT Patna Preaching Management System",
        icon: BarChart3,
        url: "https://prms-nitp.web.app",
        color: "bg-blue-500/10 text-blue-600",
      },
      {
        title: "PRMS-Bhishma",
        description: "Bhishma Dept. Preaching Management System",
        icon: BarChart3,
        url: "https://prms-bhishma.web.app",
        color: "bg-blue-500/10 text-blue-600",
      },
      {
        title: "PRMS-Aradhya",
        description: "Aradhya Gaur Prabhuji Preaching Management System",
        icon: BarChart3,
        url: "https://prms-aradhya.web.app",
        color: "bg-blue-500/10 text-blue-600",
      },
      {
        title: "PRMS-Sevya",
        description: "Sevya Giridhari Prabhuji Preaching Management System",
        icon: BarChart3,
        url: "https://prms-sevya.web.app",
        color: "bg-blue-500/10 text-blue-600",
      },
    ]
  },
  {
    title: "Sri Sri Radha Gopinath Temple, Sec-45",
    cards: [
      {
        title: "PRMS-Sec-45",
        description: "Sec-45 Preaching Management System",
        icon: BarChart3,
        url: "https://prms-sec45.web.app",
        color: "bg-blue-500/10 text-blue-600",
      },
    ]
  },
  {
    title: "Manesar Centre",
    cards: [
      {
        title: "PRMS-AND",
        description: "Manesar Preaching Management System",
        icon: BarChart3,
        url: "https://prms-and.web.app",
        color: "bg-blue-500/10 text-blue-600",
      },
    ]
  },
  {
    title: "Bhiwadi",
    cards: [
      {
        title: "PRMS-Bhiwadi",
        description: "Bhiwadi Preaching Management System",
        icon: BarChart3,
        url: "https://prms-bhiwadi.web.app",
        color: "bg-blue-500/10 text-blue-600",
      },
    ]
  }
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

        {/* Sections (Accordion) */}
        <Accordion
          type="single"
          collapsible
          defaultValue={prmsSections[0]?.title}
          className="space-y-4"
        >
          {prmsSections.map((section) => (
            <AccordionItem
              key={section.title}
              value={section.title}
              className="rounded-lg border border-primary/15 bg-primary/5 px-2 shadow-sm"
            >
              <AccordionTrigger className="px-2 py-3 text-left text-base font-semibold text-foreground/90 hover:no-underline">
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="truncate">{section.title}</span>
                  <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    {section.cards.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-4 pt-2">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.cards.map((card) => (
                    <Card
                      key={card.title}
                      className="group cursor-pointer border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
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
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </DashboardLayout>
  );
};

export default External;
