import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useGoogleCalendar, CreateEventParams } from "@/hooks/useGoogleCalendar";
import { toast } from "sonner";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  eachDayOfInterval,
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, Plus, Loader2 } from "lucide-react";

type ScheduleView = "day" | "week" | "month" | "year";

type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink: string;
};

function getEventStart(event: CalendarEvent): Date {
  if (event.start.date) return new Date(event.start.date);
  if (event.start.dateTime) return new Date(event.start.dateTime);
  return new Date(0);
}

function getEventEnd(event: CalendarEvent): Date {
  if (event.end.date) return new Date(event.end.date);
  if (event.end.dateTime) return new Date(event.end.dateTime);
  return new Date(0);
}

function isAllDayEvent(event: CalendarEvent) {
  return !!event.start.date;
}

const HOUR_HEIGHT_PX = 56;
const MINUTE_PX = HOUR_HEIGHT_PX / 60;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function minutesSinceDayStart(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

type PositionedEvent = {
  event: CalendarEvent;
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
};

function positionEventsForDayTimeline(events: CalendarEvent[], day: Date): PositionedEvent[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  const items = events
    .filter((e) => !isAllDayEvent(e))
    .map((event) => {
      const rawStart = getEventStart(event);
      const rawEnd = getEventEnd(event);

      const start = rawStart < dayStart ? dayStart : rawStart;
      const end = rawEnd > dayEnd ? dayEnd : rawEnd;

      const startMin = clamp(minutesSinceDayStart(start), 0, 24 * 60);
      const endMin = clamp(minutesSinceDayStart(end), 0, 24 * 60);

      const minDuration = 15;
      const normalizedEnd = endMin <= startMin ? startMin + minDuration : endMin;

      return { event, startMin, endMin: clamp(normalizedEnd, 0, 24 * 60) };
    })
    .sort((a, b) => a.startMin - b.startMin);

  const positioned: PositionedEvent[] = [];
  let active: PositionedEvent[] = [];
  let group: PositionedEvent[] = [];

  const finalizeGroup = () => {
    if (group.length === 0) return;
    const cols = Math.max(...group.map((g) => g.col)) + 1;
    group.forEach((g) => (g.cols = cols));
    group = [];
  };

  items.forEach(({ event, startMin, endMin }) => {
    active = active.filter((a) => a.endMin > startMin);

    if (active.length === 0) {
      finalizeGroup();
    }

    const usedCols = new Set(active.map((a) => a.col));
    let col = 0;
    while (usedCols.has(col)) col += 1;

    const placed: PositionedEvent = { event, startMin, endMin, col, cols: 1 };
    positioned.push(placed);
    active.push(placed);
    group.push(placed);
  });

  finalizeGroup();
  return positioned;
}

function getRangeForView(view: ScheduleView, anchorDate: Date) {
  if (view === "day") {
    return {
      timeMin: startOfDay(anchorDate).toISOString(),
      timeMax: endOfDay(anchorDate).toISOString(),
      maxResults: 250,
    };
  }

  if (view === "week") {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const end = endOfWeek(anchorDate, { weekStartsOn: 1 });
    return {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: 1000,
    };
  }

  if (view === "month") {
    const start = startOfMonth(anchorDate);
    const end = endOfMonth(anchorDate);
    return {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: 2500,
    };
  }

  const start = startOfYear(anchorDate);
  const end = endOfYear(anchorDate);
  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    maxResults: 2500,
  };
}

function getNextAnchor(view: ScheduleView, date: Date, dir: -1 | 1) {
  if (view === "day") return addDays(date, dir);
  if (view === "week") return addWeeks(date, dir);
  if (view === "month") return addMonths(date, dir);
  return addYears(date, dir);
}

function formatRangeLabel(view: ScheduleView, date: Date) {
  if (view === "day") return format(date, "PPP");
  if (view === "week") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const end = endOfWeek(date, { weekStartsOn: 1 });
    return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
  }
  if (view === "month") return format(date, "MMMM yyyy");
  return format(date, "yyyy");
}

function EventRow({ event }: { event: CalendarEvent }) {
  const start = getEventStart(event);
  const end = getEventEnd(event);
  const allDay = isAllDayEvent(event);
  const timeLabel = allDay ? "All day" : `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;

  return (
    <a
      href={event.htmlLink}
      target="_blank"
      rel="noreferrer"
      className="group rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/40 text-muted-foreground">
          <Clock className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{timeLabel}</span>
            <span className="text-muted-foreground/60">•</span>
            <span className="min-w-0 flex-1 font-medium text-foreground break-words whitespace-normal">
              {event.summary || "No Title"}
            </span>
          </div>
          {(event.location || event.description) && (
            <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {event.location ? event.location : event.description?.replace(/<[^>]*>/g, "")}
            </div>
          )}
        </div>

        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </a>
  );
}

function TimelineEventCard({ positioned }: { positioned: PositionedEvent }) {
  const start = getEventStart(positioned.event);
  const end = getEventEnd(positioned.event);
  const title = positioned.event.summary || "No Title";

  const top = positioned.startMin * MINUTE_PX;
  const height = Math.max(18, (positioned.endMin - positioned.startMin) * MINUTE_PX);
  const colW = 100 / positioned.cols;
  const leftPct = positioned.col * colW;
  const rightPct = 100 - (positioned.col + 1) * colW;

  return (
    <a
      href={positioned.event.htmlLink}
      target="_blank"
      rel="noreferrer"
      className="absolute rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] leading-tight text-foreground hover:bg-primary/15"
      style={{ top, height, left: `${leftPct}%`, right: `${rightPct}%` }}
      title={title}
    >
      <div className="font-semibold line-clamp-2 break-words">{title}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">
        {format(start, "h:mm")}
        <span className="mx-1">–</span>
        {format(end, "h:mm")}
      </div>
    </a>
  );
}


export default function Schedule() {
  const [view, setView] = useState<ScheduleView>("month");
  const [activeDate, setActiveDate] = useState(() => new Date());
  const { calendarConnected } = useAuth();

  // Create event dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventDate, setNewEventDate] = useState<Date>(new Date());
  const [newEventStartTime, setNewEventStartTime] = useState("09:00");
  const [newEventEndTime, setNewEventEndTime] = useState("10:00");
  const [newEventAllDay, setNewEventAllDay] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);

  const query = useMemo(() => getRangeForView(view, activeDate), [view, activeDate]);
  const { events, loading, error, createEvent } = useGoogleCalendar(query);

  const normalizedEvents = useMemo(() => {
    const e = events as unknown as CalendarEvent[];
    return [...e].sort((a, b) => getEventStart(a).getTime() - getEventStart(b).getTime());
  }, [events]);

  const dayEvents = useMemo(() => {
    return normalizedEvents.filter((e) => isSameDay(getEventStart(e), activeDate));
  }, [normalizedEvents, activeDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(activeDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [activeDate]);

  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    normalizedEvents.forEach((e) => set.add(format(getEventStart(e), "yyyy-MM-dd")));
    return set;
  }, [normalizedEvents]);

  const monthDaysWithEvents = useMemo(() => {
    const monthStart = startOfMonth(activeDate);
    const monthEnd = endOfMonth(activeDate);
    const result: Date[] = [];

    let cursor = monthStart;
    while (cursor <= monthEnd) {
      if (daysWithEvents.has(format(cursor, "yyyy-MM-dd"))) result.push(cursor);
      cursor = addDays(cursor, 1);
    }

    return result;
  }, [activeDate, daysWithEvents]);

  const monthGridDays = useMemo(() => {
    const monthStart = startOfMonth(activeDate);
    const monthEnd = endOfMonth(activeDate);

    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [activeDate]);

  const monthEventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const addToDay = (d: Date, e: CalendarEvent) => {
      const key = format(d, "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    };

    normalizedEvents.forEach((e) => {
      const start = getEventStart(e);
      const end = getEventEnd(e);

      if (isAllDayEvent(e)) {
        // Google all-day events are end-exclusive. Expand across days.
        const s = startOfDay(start);
        const endExclusive = startOfDay(end);
        let cursor = s;
        while (cursor < endExclusive) {
          addToDay(cursor, e);
          cursor = addDays(cursor, 1);
        }
        return;
      }

      addToDay(startOfDay(start), e);
    });

    // Sort: all-day first, then timed
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const aAll = isAllDayEvent(a) ? 0 : 1;
        const bAll = isAllDayEvent(b) ? 0 : 1;
        if (aAll !== bAll) return aAll - bAll;
        return getEventStart(a).getTime() - getEventStart(b).getTime();
      });
      map.set(k, arr);
    }

    return map;
  }, [normalizedEvents]);

  const setDateAndGoToDay = (d: Date) => {
    setActiveDate(d);
    setView("day");
  };

  const weekAllDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    weekDays.forEach((d) => map.set(format(d, "yyyy-MM-dd"), []));

    normalizedEvents
      .filter((e) => isAllDayEvent(e))
      .forEach((e) => {
        const key = format(getEventStart(e), "yyyy-MM-dd");
        if (!map.has(key)) return;
        map.get(key)!.push(e);
      });

    return map;
  }, [normalizedEvents, weekDays]);

  const weekTimedPositioned = useMemo(() => {
    const map = new Map<string, PositionedEvent[]>();
    weekDays.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      const dayEventsForTimeline = normalizedEvents.filter((e) => isSameDay(getEventStart(e), d));
      map.set(key, positionEventsForDayTimeline(dayEventsForTimeline, d));
    });
    return map;
  }, [normalizedEvents, weekDays]);

  const dayAllDay = useMemo(() => dayEvents.filter((e) => isAllDayEvent(e)), [dayEvents]);
  const dayTimed = useMemo(() => dayEvents.filter((e) => !isAllDayEvent(e)), [dayEvents]);
  const dayPositioned = useMemo(
    () => positionEventsForDayTimeline(dayTimed as CalendarEvent[], activeDate),
    [dayTimed, activeDate],
  );

  return (
    <DashboardLayout>
      <div className="animate-fade-in max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" />
              Schedule
            </h1>
            <p className="text-muted-foreground mt-1">Calendar views for your Google events</p>
          </div>

          <div className="flex items-center gap-2">
            {calendarConnected && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      setNewEventDate(activeDate);
                      setNewEventTitle("");
                      setNewEventDescription("");
                      setNewEventLocation("");
                      setNewEventStartTime("09:00");
                      setNewEventEndTime("10:00");
                      setNewEventAllDay(false);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add Calendar Event</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="event-title">Title</Label>
                      <Input
                        id="event-title"
                        placeholder="Event title"
                        value={newEventTitle}
                        onChange={(e) => setNewEventTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-date">Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <Calendar className="mr-2 h-4 w-4" />
                            {format(newEventDate, "PPP")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={newEventDate}
                            onSelect={(d) => d && setNewEventDate(d)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="all-day"
                        checked={newEventAllDay}
                        onCheckedChange={setNewEventAllDay}
                      />
                      <Label htmlFor="all-day">All day event</Label>
                    </div>
                    {!newEventAllDay && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="start-time">Start Time</Label>
                          <Input
                            id="start-time"
                            type="time"
                            value={newEventStartTime}
                            onChange={(e) => setNewEventStartTime(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-time">End Time</Label>
                          <Input
                            id="end-time"
                            type="time"
                            value={newEventEndTime}
                            onChange={(e) => setNewEventEndTime(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="event-location">Location (optional)</Label>
                      <Input
                        id="event-location"
                        placeholder="Add location"
                        value={newEventLocation}
                        onChange={(e) => setNewEventLocation(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-description">Description (optional)</Label>
                      <Textarea
                        id="event-description"
                        placeholder="Add description"
                        value={newEventDescription}
                        onChange={(e) => setNewEventDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setCreateDialogOpen(false)}
                      disabled={creatingEvent}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!newEventTitle.trim()) {
                          toast.error("Please enter a title");
                          return;
                        }
                        setCreatingEvent(true);
                        try {
                          const [startH, startM] = newEventStartTime.split(":").map(Number);
                          const [endH, endM] = newEventEndTime.split(":").map(Number);
                          
                          const startDate = new Date(newEventDate);
                          startDate.setHours(startH, startM, 0, 0);
                          
                          const endDate = new Date(newEventDate);
                          endDate.setHours(endH, endM, 0, 0);
                          
                          if (endDate <= startDate && !newEventAllDay) {
                            endDate.setDate(endDate.getDate() + 1);
                          }

                          await createEvent({
                            summary: newEventTitle.trim(),
                            description: newEventDescription.trim() || undefined,
                            location: newEventLocation.trim() || undefined,
                            start: startDate,
                            end: endDate,
                            allDay: newEventAllDay,
                          });
                          
                          toast.success("Event created", {
                            description: newEventTitle.trim(),
                          });
                          setCreateDialogOpen(false);
                          // Reload page to refetch events
                          window.location.reload();
                        } catch (err) {
                          console.error(err);
                          toast.error("Failed to create event", {
                            description: err instanceof Error ? err.message : "Please try again",
                          });
                        } finally {
                          setCreatingEvent(false);
                        }
                      }}
                      disabled={creatingEvent || !newEventTitle.trim()}
                    >
                      {creatingEvent ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Event"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border border-border/40"
              onClick={() => setActiveDate((d) => getNextAnchor(view, d, -1))}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="rounded-full border border-border/40"
              onClick={() => setActiveDate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border border-border/40"
              onClick={() => setActiveDate((d) => getNextAnchor(view, d, 1))}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* ...existing code... */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-foreground">
            {formatRangeLabel(view, activeDate)}
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as ScheduleView)}>
            <TabsList className="rounded-full border border-border/40 bg-background">
              <TabsTrigger value="day" className="rounded-full">Day</TabsTrigger>
              <TabsTrigger value="week" className="rounded-full">Week</TabsTrigger>
              <TabsTrigger value="month" className="rounded-full">Month</TabsTrigger>
              <TabsTrigger value="year" className="rounded-full">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as ScheduleView)}>
          <TabsContent value="day">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Day</p>
                <p className="text-xs text-muted-foreground">Timeline + agenda</p>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
                <div className="rounded-xl border border-border bg-background overflow-hidden">
                  {dayAllDay.length > 0 && (
                    <div className="border-b border-border px-3 py-3">
                      <div className="mb-2 text-[11px] font-semibold text-muted-foreground">All-day</div>
                      <div className="flex flex-wrap gap-2">
                        {dayAllDay.map((e) => (
                          <a
                            key={e.id}
                            href={e.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-primary/25 bg-primary/15 px-2 py-1 text-[11px] text-foreground hover:bg-primary/20"
                            title={e.summary || "No Title"}
                          >
                            {e.summary || "No Title"}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="relative h-[720px] overflow-auto">
                    <div className="relative min-w-[520px]">
                      <div className="grid grid-cols-[64px_1fr]">
                        <div className="relative border-r border-border bg-muted/5" style={{ height: HOUR_HEIGHT_PX * 24 }}>
                          {Array.from({ length: 24 }, (_, h) => (
                            <div
                              key={h}
                              className="absolute left-0 right-0 pr-2 text-right text-[10px] text-muted-foreground"
                              style={{ top: h * HOUR_HEIGHT_PX - 6 }}
                            >
                              {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                            </div>
                          ))}
                        </div>

                        <div className="relative" style={{ height: HOUR_HEIGHT_PX * 24 }}>
                          {Array.from({ length: 24 }, (_, h) => (
                            <div
                              key={h}
                              className="absolute left-0 right-0 border-t border-border/60"
                              style={{ top: h * HOUR_HEIGHT_PX }}
                            />
                          ))}

                          {dayPositioned.map((p) => (
                            <TimelineEventCard key={p.event.id} positioned={p} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background overflow-hidden">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">Agenda</p>
                    <p className="text-xs text-muted-foreground">{format(activeDate, "PPP")}</p>
                  </div>
                  <ScrollArea className="h-[720px] p-4">
                    {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
                    {!loading && dayEvents.length === 0 && (
                      <div className="text-sm text-muted-foreground">No events for this day.</div>
                    )}
                    <div className="space-y-3">
                      {dayEvents.map((e) => (
                        <EventRow key={e.id} event={e} />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="week">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Week</p>
                <p className="text-xs text-muted-foreground">Google Calendar timeline</p>
              </div>

              <div className="h-[720px] overflow-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border bg-muted/10">
                    <div className="border-r border-border" />
                    {weekDays.map((d) => (
                      <button
                        key={format(d, "yyyy-MM-dd")}
                        onClick={() => setDateAndGoToDay(d)}
                        className={cn(
                          "px-3 py-2 text-left text-xs font-semibold hover:bg-accent/40",
                          isToday(d) && "text-primary",
                        )}
                      >
                        <div className="flex items-baseline justify-between">
                          <span>{format(d, "EEE")}</span>
                          <span className="text-muted-foreground">{format(d, "d")}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border">
                    <div className="border-r border-border bg-muted/5 px-2 py-2 text-[10px] font-semibold text-muted-foreground">
                      All-day
                    </div>
                    {weekDays.map((d) => {
                      const key = format(d, "yyyy-MM-dd");
                      const items = weekAllDay.get(key) ?? [];
                      return (
                        <div key={key} className="border-r last:border-r-0 border-border px-2 py-2">
                          <div className="flex flex-col gap-1">
                            {items.slice(0, 3).map((e) => (
                              <a
                                key={e.id}
                                href={e.htmlLink}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md border border-secondary-foreground/10 bg-secondary/40 px-2 py-1 text-[11px] text-foreground line-clamp-1"
                                title={e.summary || "No Title"}
                              >
                                {e.summary || "No Title"}
                              </a>
                            ))}
                            {items.length > 3 && (
                              <div className="text-[11px] text-muted-foreground">+{items.length - 3} more</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-[64px_repeat(7,1fr)]">
                    <div className="relative border-r border-border bg-muted/5" style={{ height: HOUR_HEIGHT_PX * 24 }}>
                      {Array.from({ length: 24 }, (_, h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 pr-2 text-right text-[10px] text-muted-foreground"
                          style={{ top: h * HOUR_HEIGHT_PX - 6 }}
                        >
                          {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                        </div>
                      ))}
                    </div>

                    {weekDays.map((d) => {
                      const key = format(d, "yyyy-MM-dd");
                      const positioned = weekTimedPositioned.get(key) ?? [];

                      return (
                        <div key={key} className="relative border-r last:border-r-0 border-border" style={{ height: HOUR_HEIGHT_PX * 24 }}>
                          {Array.from({ length: 24 }, (_, h) => (
                            <div
                              key={h}
                              className="absolute left-0 right-0 border-t border-border/60"
                              style={{ top: h * HOUR_HEIGHT_PX }}
                            />
                          ))}

                          {positioned.map((p) => (
                            <TimelineEventCard key={p.event.id} positioned={p} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="month">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Month</p>
                <p className="text-xs text-muted-foreground">Tap a day to open Day view</p>
              </div>

              <div className="p-3 sm:p-4">
                <div className="rounded-xl border border-border bg-background overflow-hidden">
                  <div className="grid grid-cols-7 border-b border-border bg-muted/10">
                    {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
                      <div
                        key={d}
                        className="px-2 py-2 text-[10px] font-semibold tracking-wide text-muted-foreground"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {monthGridDays.map((d) => {
                      const key = format(d, "yyyy-MM-dd");
                      const inMonth = isSameMonth(d, activeDate);
                      const isSelected = isSameDay(d, activeDate);
                      const isNow = isToday(d);
                      const items = monthEventsByDay.get(key) ?? [];
                      const maxToShow = 3;

                      return (
                        <div
                          key={key}
                          onClick={() => setDateAndGoToDay(d)}
                          className={cn(
                            "relative flex min-h-[92px] cursor-pointer flex-col gap-1 border-r border-b border-border px-2 py-2 text-left transition-colors hover:bg-accent/30",
                            !inMonth && "bg-muted/5 text-muted-foreground",
                            isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div
                              className={cn(
                                "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold",
                                isNow && "bg-primary text-primary-foreground",
                                !isNow && inMonth && "text-foreground",
                                !inMonth && "text-muted-foreground",
                              )}
                            >
                              {format(d, "d")}
                            </div>

                            {items.length > 0 && (
                              <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70" />
                            )}
                          </div>

                          <div className="flex flex-col gap-1">
                            {items.slice(0, maxToShow).map((e) => {
                              const allDay = isAllDayEvent(e);
                              const title = e.summary || "No Title";
                              return (
                                <a
                                  key={e.id}
                                  href={e.htmlLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(ev) => ev.stopPropagation()}
                                  className={cn(
                                    "rounded-sm border px-1.5 py-0.5 text-[11px] leading-tight transition-colors",
                                    allDay
                                      ? "border-primary/25 bg-primary/15 text-foreground hover:bg-primary/20"
                                      : "border-border/50 bg-muted/20 text-foreground hover:bg-muted/30",
                                  )}
                                  title={title}
                                >
                                  <div className="truncate font-medium">{title}</div>
                                </a>
                              );
                            })}

                            {items.length > maxToShow && (
                              <div className="text-[11px] text-muted-foreground">+{items.length - maxToShow} more</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  Click a day to drill into the Day timeline.
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="year">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Year</p>
                <p className="text-xs text-muted-foreground">Pick a date to open Day view</p>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 12 }, (_, i) => {
                  const m = new Date(activeDate.getFullYear(), i, 1);
                  const monthStart = startOfMonth(m);
                  const monthEnd = endOfMonth(m);

                  const monthHasEvents: Date[] = [];
                  let cursor = monthStart;
                  while (cursor <= monthEnd) {
                    if (daysWithEvents.has(format(cursor, "yyyy-MM-dd"))) monthHasEvents.push(cursor);
                    cursor = addDays(cursor, 1);
                  }

                  return (
                    <div key={i} className="rounded-xl border border-border bg-background">
                      <div className="px-3 pt-3 text-sm font-semibold text-foreground">
                        {format(m, "MMMM")}
                      </div>
                      <CalendarComponent
                        month={m}
                        mode="single"
                        selected={activeDate}
                        onSelect={(d) => d && setDateAndGoToDay(d)}
                        modifiers={{ hasEvents: monthHasEvents }}
                        modifiersClassNames={{ hasEvents: "bg-primary/10 text-primary" }}
                        classNames={{ nav: "hidden", nav_button: "hidden" }}
                        className="pt-1"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
