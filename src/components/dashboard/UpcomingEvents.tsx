import { Calendar, Clock, Users } from "lucide-react";

interface Event {
  id: string;
  title: string;
  time: string;
  duration: string;
  attendees?: number;
  type: "meeting" | "call" | "review";
}

const upcomingEvents: Event[] = [
  { id: "1", title: "Executive Standup", time: "9:00 AM", duration: "30 min", attendees: 5, type: "meeting" },
  { id: "2", title: "Investor Call", time: "11:00 AM", duration: "1 hour", type: "call" },
  { id: "3", title: "Product Review", time: "2:00 PM", duration: "45 min", attendees: 8, type: "review" },
  { id: "4", title: "Marketing Sync", time: "4:00 PM", duration: "30 min", attendees: 3, type: "meeting" },
];

const typeColors = {
  meeting: "bg-primary/20 text-primary",
  call: "bg-success/20 text-success",
  review: "bg-warning/20 text-warning",
};

export function UpcomingEvents() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="font-semibold text-foreground">Today's Schedule</h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>
      <div className="space-y-1 p-3">
        {upcomingEvents.map((event) => (
          <div
            key={event.id}
            className="group flex items-center gap-4 rounded-lg px-3 py-3 transition-all duration-200 hover:bg-accent/50"
          >
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{event.time}</p>
              <p className="text-xs text-muted-foreground">{event.duration}</p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{event.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[event.type]}`}>
                  {event.type}
                </span>
                {event.attendees && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {event.attendees}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
