import { useState } from "react";
import { Check, Circle, Clock, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  dueDate?: string;
  completed: boolean;
}

const initialTasks: Task[] = [
  { id: "1", title: "Review Q4 budget proposal", priority: "high", dueDate: "Today", completed: false },
  { id: "2", title: "Prepare board presentation", priority: "high", dueDate: "Tomorrow", completed: false },
  { id: "3", title: "Team 1:1 with Sarah", priority: "medium", dueDate: "Wed", completed: false },
  { id: "4", title: "Sign off on marketing campaign", priority: "medium", dueDate: "Thu", completed: true },
  { id: "5", title: "Review hiring pipeline", priority: "low", dueDate: "Fri", completed: false },
];

const priorityColors = {
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
};

export function QuickTasks() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="font-semibold text-foreground">Priority Tasks</h3>
        <span className="text-xs text-muted-foreground">
          {tasks.filter(t => !t.completed).length} remaining
        </span>
      </div>
      <div className="divide-y divide-border">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "flex items-center gap-4 px-6 py-4 transition-all duration-200 hover:bg-accent/50",
              task.completed && "opacity-50"
            )}
          >
            <button
              onClick={() => toggleTask(task.id)}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                task.completed
                  ? "border-success bg-success text-success-foreground"
                  : "border-muted-foreground hover:border-primary"
              )}
            >
              {task.completed && <Check className="h-3 w-3" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium text-foreground truncate",
                task.completed && "line-through"
              )}>
                {task.title}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Flag className={cn("h-3.5 w-3.5", priorityColors[task.priority])} />
              {task.dueDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {task.dueDate}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
