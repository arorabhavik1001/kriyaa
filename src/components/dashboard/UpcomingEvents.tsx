import { useMemo } from "react";
import { Calendar, Clock, Loader2, MapPin, AlignLeft } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { format, differenceInMinutes, isToday, isTomorrow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function UpcomingEvents() {
  const { events, loading, error } = useGoogleCalendar();
  const { user } = useAuth();
  const navigate = useNavigate();

  const getDuration = (start: any, end: any) => {
    if (start.date || end.date) return "All day";
    const startDate = new Date(start.dateTime);
    const endDate = new Date(end.dateTime);
    const diff = differenceInMinutes(endDate, startDate);
    
    if (diff >= 60) {
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${diff} min`;
  };

  const getDayDisplay = (dateObj: any) => {
    const date = dateObj.date ? new Date(dateObj.date) : new Date(dateObj.dateTime);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  const getEventStartDate = (event: any) => {
    const start = event?.start;
    if (!start) return new Date(0);
    if (start.date) return new Date(start.date);
    if (start.dateTime) return new Date(start.dateTime);
    return new Date(0);
  };

  const groupedEvents = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => getEventStartDate(a).getTime() - getEventStartDate(b).getTime(),
    );

    const groups = new Map<string, { label: string; kind: "today" | "tomorrow" | "other"; items: any[] }>();

    sorted.forEach((event) => {
      const startDate = getEventStartDate(event);
      const key = format(startDate, "yyyy-MM-dd");
      if (!groups.has(key)) {
        const label = getDayDisplay(event.start);
        const kind: "today" | "tomorrow" | "other" = isToday(startDate)
          ? "today"
          : isTomorrow(startDate)
            ? "tomorrow"
            : "other";
        groups.set(key, { label, kind, items: [] });
      }
      groups.get(key)!.items.push(event);
    });

    return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
  }, [events]);

  const getEventType = (summary: string) => {
    const s = summary.toLowerCase();
    if (s.includes("call") || s.includes("sync")) return "call";
    if (s.includes("review") || s.includes("planning")) return "review";
    return "meeting";
  };

  const typeColors = {
    meeting: "bg-primary/10 text-primary border-primary/20",
    call: "bg-success/10 text-success border-success/20",
    review: "bg-warning/10 text-warning border-warning/20",
  };

  return (
    <div className="rounded-xl border border-border bg-card flex flex-col h-[500px] shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0 bg-muted/20 rounded-t-xl">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-background">
              <Calendar className="h-4 w-4 text-primary" />
            </span>
            <span className="truncate">Schedule</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Your upcoming agenda</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full border border-border/40 px-3 text-xs"
          onClick={() => navigate("/schedule")}
        >
          View all
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        {loading && (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && !user && (
           <div className="flex h-full flex-col items-center justify-center p-4 min-h-[200px]">
              <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground text-center">Sign in to sync your Google Calendar</p>
           </div>
        )}

        {!loading && user && events.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center min-h-[200px]">
             <div className="bg-muted/50 p-4 rounded-full mb-3">
                <Calendar className="h-6 w-6 text-muted-foreground" />
             </div>
             <p className="text-sm font-medium text-foreground">No upcoming events</p>
             <p className="text-xs text-muted-foreground mt-1">Enjoy your free time!</p>
          </div>
        )}

        <div className="space-y-5">
          {!loading &&
            groupedEvents.map((group) => (
              <div key={group.key} className="space-y-3">
                <div
                  className={
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold tracking-wide " +
                    (group.kind === "today"
                      ? "border-primary/20 bg-primary/5 text-primary"
                      : group.kind === "tomorrow"
                        ? "border-secondary-foreground/10 bg-secondary/40 text-foreground"
                        : "border-border bg-muted/20 text-muted-foreground")
                  }
                >
                  <span className="uppercase">{group.label}</span>
                </div>

                <div className="space-y-0.5 relative pl-4">
                  <div className="absolute left-[23px] top-2 bottom-4 w-px bg-border/40" />
                  {group.items.map((event) => {
                    const type = getEventType(event.summary || "Event");
                    const isAllDay = !!event.start.date;
                    const timeLabel = isAllDay
                      ? "All day"
                      : format(new Date(event.start.dateTime!), "h:mm a");

                    return (
                      <a
                        key={event.id}
                        href={event.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative flex gap-3 rounded-lg py-3 px-2 transition-colors hover:bg-accent/40"
                      >
                        <div className="flex flex-col items-center">
                          <div
                            className={
                              "mt-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background " +
                              (type === "meeting"
                                ? "bg-primary"
                                : type === "call"
                                  ? "bg-success"
                                  : "bg-warning")
                            }
                            aria-hidden
                          />
                          <div className="w-px flex-1 bg-border/50 my-1 last:hidden" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
                            <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                              {timeLabel}
                            </span>
                            <span className="text-muted-foreground/60 hidden sm:inline">•</span>
                            <h4 className="min-w-0 flex-1 font-medium text-foreground leading-snug break-words whitespace-normal line-clamp-1 group-hover:text-primary transition-colors">
                              {event.summary || "No Title"}
                            </h4>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {getDuration(event.start, event.end)}
                            </span>
                          </div>

                          {event.location && (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
}
