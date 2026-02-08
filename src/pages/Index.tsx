import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickTasks } from "@/components/dashboard/QuickTasks";
import { RecentNotes } from "@/components/dashboard/RecentNotes";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { Bookmarks } from "@/components/dashboard/Bookmarks";
import { FocusTimer } from "@/components/dashboard/FocusTimer";
import { CheckSquare, FileText, Clock, SlidersHorizontal, GripVertical, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { differenceInMinutes, endOfDay, startOfDay } from "date-fns";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type WidgetId = "events" | "bookmarks" | "tasks" | "notes" | "focus";

const DEFAULT_LAYOUT = {
  left: ["tasks", "notes"] as WidgetId[],
  right: ["events", "focus", "bookmarks"] as WidgetId[],
  panelSizes: [67, 33] as [number, number],
};

const widgetNodes: Record<WidgetId, React.ReactNode> = {
  tasks: <QuickTasks />,
  notes: <RecentNotes />,
  events: <UpcomingEvents />,
  bookmarks: <Bookmarks />,
  focus: <FocusTimer />,
};

function findContainer(layout: { left: WidgetId[]; right: WidgetId[] }, id: string) {
  if (layout.left.includes(id as WidgetId)) return "left";
  if (layout.right.includes(id as WidgetId)) return "right";
  return null;
}

function SortableWidget({
  id,
  customizeMode,
}: {
  id: WidgetId;
  customizeMode: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("relative", isDragging && "opacity-60")}
    >
      {customizeMode && (
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur hover:text-foreground"
          title="Drag to rearrange"
        >
          <GripVertical className="h-3.5 w-3.5" />
          Move
        </button>
      )}
      {widgetNodes[id]}
    </div>
  );
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
};

const getMotivation = () => {
  const lines = [
    "Let's make today count!",
    "One task at a time, you've got this.",
    "Small steps lead to big results.",
    "Focus, plan, execute.",
    "Great things never come from comfort zones.",
    "You're doing amazing, keep it up!",
    "Today's efforts are tomorrow's rewards.",
    "Stay sharp, stay productive.",
  ];
  const dayIndex = Math.floor(Date.now() / 86400000) % lines.length;
  return lines[dayIndex];
};

const Index = () => {
  const { user, calendarConnected } = useAuth();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState({
    openTasks: 0,
    notesCount: 0
  });

  const todayQuery = useMemo(() => {
    const now = new Date();
    return {
      timeMin: startOfDay(now).toISOString(),
      timeMax: endOfDay(now).toISOString(),
      maxResults: 250,
    };
  }, []);

  const {
    events: todaysEvents,
    loading: todaysEventsLoading,
  } = useGoogleCalendar(todayQuery);

  const eventsScheduledCount = calendarConnected ? todaysEvents.length : 0;

  const nextEventSubtitle = useMemo(() => {
    if (!calendarConnected) return "Connect Google Calendar";
    if (todaysEventsLoading) return "Loading…";

    const now = new Date();
    const upcoming = todaysEvents
      .map((e) => {
        const start = e.start?.dateTime
          ? new Date(e.start.dateTime)
          : e.start?.date
            ? new Date(e.start.date)
            : null;
        return start ? { start, e } : null;
      })
      .filter((x): x is { start: Date; e: (typeof todaysEvents)[number] } => !!x)
      .filter((x) => x.start.getTime() > now.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (upcoming.length === 0) return "No more today";

    const mins = Math.max(0, differenceInMinutes(upcoming[0].start, now));
    return mins <= 0 ? "Starting now" : `Next in ${mins} min`;
  }, [calendarConnected, todaysEvents, todaysEventsLoading]);

  const [customizeMode, setCustomizeMode] = useState(false);
  const [layout, setLayout] = useState(() => DEFAULT_LAYOUT);
  const [activeDragId, setActiveDragId] = useState<WidgetId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  useEffect(() => {
    if (!user) return;
    const key = `dashboard_layout_${user.uid}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      setLayout(DEFAULT_LAYOUT);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const next = {
        left: Array.isArray(parsed.left) ? parsed.left : DEFAULT_LAYOUT.left,
        right: Array.isArray(parsed.right) ? parsed.right : DEFAULT_LAYOUT.right,
        panelSizes: Array.isArray(parsed.panelSizes) && parsed.panelSizes.length === 2
          ? parsed.panelSizes
          : DEFAULT_LAYOUT.panelSizes,
      };
      setLayout(next);
    } catch {
      setLayout(DEFAULT_LAYOUT);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const key = `dashboard_layout_${user.uid}`;
    localStorage.setItem(key, JSON.stringify(layout));
  }, [layout, user]);

  useEffect(() => {
    if (!user) return;

    const tasksQuery = query(
      collection(db, "tasks"),
      where("userId", "==", user.uid),
      where("completed", "==", false),
    );
    const notesQuery = query(collection(db, "notes"), where("userId", "==", user.uid));

    const unsubTasks = onSnapshot(tasksQuery, (snap) => {
      const openRootTasks = snap.docs.reduce((count, d) => {
        const data = d.data() as { parentId?: string | null };
        return data.parentId ? count : count + 1;
      }, 0);

      setStats(prev => ({ ...prev, openTasks: openRootTasks }));
    });

    const unsubNotes = onSnapshot(notesQuery, (snap) => {
      setStats(prev => ({ ...prev, notesCount: snap.size }));
    });

    return () => {
      unsubTasks();
      unsubNotes();
    };
  }, [user]);

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {getGreeting()}, {user?.displayName?.split(" ")[0] || "User"} 👋
            </h1>
            <p className="mt-1 text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary/60" />
              {getMotivation()}
            </p>
          </div>
          <Button
            variant={customizeMode ? "default" : "outline"}
            size="sm"
            onClick={() => setCustomizeMode((v) => !v)}
            className="hidden shrink-0 sm:inline-flex"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            {customizeMode ? "Done" : "Customize"}
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Open Tasks"
            value={stats.openTasks}
            subtitle="Active tasks"
            icon={CheckSquare}
            trend="neutral"
          />
          <StatCard
            title="Notes"
            value={stats.notesCount}
            subtitle="Total notes"
            icon={FileText}
            trend="neutral"
          />
          <StatCard
            title="Events scheduled"
            value={eventsScheduledCount}
            subtitle={nextEventSubtitle}
            icon={Clock}
            trend="neutral"
          />
        </div>

        {/* Main Content (Customizable) */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(event: DragStartEvent) => {
            if (!customizeMode) return;
            setActiveDragId(String(event.active.id) as WidgetId);
          }}
          onDragOver={(event) => {
            if (!customizeMode) return;
            const { active, over } = event;
            if (!over) return;
            const activeId = String(active.id) as WidgetId;
            const overId = String(over.id) as WidgetId;

            const activeContainer = findContainer(layout, activeId);
            const overContainer = findContainer(layout, overId);
            if (!activeContainer || !overContainer) return;
            if (activeContainer === overContainer) return;

            setLayout((prev) => {
              const from = activeContainer === "left" ? prev.left : prev.right;
              const to = overContainer === "left" ? prev.left : prev.right;
              const fromIndex = from.indexOf(activeId);
              const toIndex = to.indexOf(overId);
              if (fromIndex === -1 || toIndex === -1) return prev;

              const nextFrom = [...from];
              nextFrom.splice(fromIndex, 1);
              const nextTo = [...to];
              nextTo.splice(toIndex, 0, activeId);

              return {
                ...prev,
                left: activeContainer === "left" ? nextFrom : nextTo,
                right: activeContainer === "left" ? nextTo : nextFrom,
              };
            });
          }}
          onDragEnd={(event: DragEndEvent) => {
            if (!customizeMode) return;
            const { active, over } = event;
            setActiveDragId(null);
            if (!over) return;

            const activeId = String(active.id) as WidgetId;
            const overId = String(over.id) as WidgetId;
            if (activeId === overId) return;

            const activeContainer = findContainer(layout, activeId);
            const overContainer = findContainer(layout, overId);
            if (!activeContainer || !overContainer) return;
            if (activeContainer !== overContainer) return;

            setLayout((prev) => {
              const items = activeContainer === "left" ? prev.left : prev.right;
              const oldIndex = items.indexOf(activeId);
              const newIndex = items.indexOf(overId);
              if (oldIndex === -1 || newIndex === -1) return prev;
              const next = arrayMove(items, oldIndex, newIndex);
              return {
                ...prev,
                left: activeContainer === "left" ? next : prev.left,
                right: activeContainer === "right" ? next : prev.right,
              };
            });
          }}
        >
          {isMobile ? (
            <div className="space-y-6">
              <div className="space-y-6">
                <SortableContext items={layout.left} strategy={verticalListSortingStrategy}>
                  {layout.left.map((id) => (
                    <SortableWidget key={id} id={id} customizeMode={customizeMode} />
                  ))}
                </SortableContext>
              </div>
              <div className="space-y-6">
                <SortableContext items={layout.right} strategy={verticalListSortingStrategy}>
                  {layout.right.map((id) => (
                    <SortableWidget key={id} id={id} customizeMode={customizeMode} />
                  ))}
                </SortableContext>
              </div>
            </div>
          ) : (
            <ResizablePanelGroup
              key={`panel-group-${user?.uid}`}
              direction="horizontal"
              onLayout={(sizes) => {
                if (!Array.isArray(sizes) || sizes.length !== 2) return;
                setLayout((prev) => ({ ...prev, panelSizes: [sizes[0], sizes[1]] as [number, number] }));
              }}
              className="h-full"
            >
              <ResizablePanel 
                defaultSize={layout.panelSizes[0]} 
                minSize={35}
                id="left-panel"
              >
                <div className="space-y-6 pr-3">
                  <SortableContext items={layout.left} strategy={verticalListSortingStrategy}>
                    {layout.left.map((id) => (
                      <SortableWidget key={id} id={id} customizeMode={customizeMode} />
                    ))}
                  </SortableContext>
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel 
                defaultSize={layout.panelSizes[1]} 
                minSize={20}
                id="right-panel"
              >
                <div className="space-y-6 pl-3">
                  <SortableContext items={layout.right} strategy={verticalListSortingStrategy}>
                    {layout.right.map((id) => (
                      <SortableWidget key={id} id={id} customizeMode={customizeMode} />
                    ))}
                  </SortableContext>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}

          <DragOverlay>
            {activeDragId ? (
              <div className="rounded-xl border border-border bg-card shadow-lg">
                {widgetNodes[activeDragId]}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </DashboardLayout>
  );
};

export default Index;
