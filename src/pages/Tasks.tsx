import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus, Flag, Trash2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  dueDate?: string;
  completed: boolean;
  category: string;
}

const initialTasks: Task[] = [
  { id: "1", title: "Review Q4 budget proposal", priority: "high", dueDate: "2024-01-15", completed: false, category: "Finance" },
  { id: "2", title: "Prepare board presentation", priority: "high", dueDate: "2024-01-16", completed: false, category: "Strategy" },
  { id: "3", title: "Team 1:1 with Sarah", priority: "medium", dueDate: "2024-01-17", completed: false, category: "People" },
  { id: "4", title: "Sign off on marketing campaign", priority: "medium", dueDate: "2024-01-18", completed: true, category: "Marketing" },
  { id: "5", title: "Review hiring pipeline", priority: "low", dueDate: "2024-01-19", completed: false, category: "People" },
  { id: "6", title: "Update company handbook", priority: "low", dueDate: "2024-01-20", completed: false, category: "Operations" },
];

const priorityColors = {
  high: "text-destructive border-destructive",
  medium: "text-warning border-warning",
  low: "text-muted-foreground border-muted",
};

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTask, setNewTask] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const addTask = () => {
    if (!newTask.trim()) return;
    const task: Task = {
      id: Date.now().toString(),
      title: newTask,
      priority: "medium",
      completed: false,
      category: "General",
    };
    setTasks([task, ...tasks]);
    setNewTask("");
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="animate-fade-in max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
          <p className="mt-1 text-muted-foreground">Manage your to-dos and priorities</p>
        </div>

        {/* Add Task */}
        <div className="mb-6 flex gap-3">
          <Input
            placeholder="Add a new task..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            className="bg-card border-border"
          />
          <Button onClick={addTask} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {(["all", "active", "completed"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "secondary"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>

        {/* Task List */}
        <div className="rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {filteredTasks.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-muted-foreground">No tasks found</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
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
                      "font-medium text-foreground",
                      task.completed && "line-through"
                    )}>
                      {task.title}
                    </p>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{task.category}</span>
                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Flag className={cn("h-4 w-4", priorityColors[task.priority])} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTask(task.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
