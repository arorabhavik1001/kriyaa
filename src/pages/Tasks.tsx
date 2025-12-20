import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus, Flag, Trash2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

interface Task {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  dueDate?: string;
  completed: boolean;
  category: string;
  userId: string;
}

const priorityColors = {
  high: "text-destructive border-destructive",
  medium: "text-warning border-warning",
  low: "text-muted-foreground border-muted",
};

const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(tasksData);
    });
    return () => unsubscribe();
  }, [user]);

  const addTask = async () => {
    if (!newTask.trim() || !user) return;
    await addDoc(collection(db, "tasks"), {
      title: newTask,
      priority: "medium",
      completed: false,
      category: "General",
      userId: user.uid,
      createdAt: new Date()
    });
    setNewTask("");
  };

  const toggleTask = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, "tasks", id), {
      completed: !currentStatus
    });
  };

  const deleteTask = async (id: string) => {
    await deleteDoc(doc(db, "tasks", id));
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
            <p className="text-muted-foreground">Manage your daily tasks and priorities</p>
          </div>
          <Button onClick={addTask} size="icon" className="h-10 w-10 rounded-full shadow-lg">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Add a new task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="pl-4 pr-12"
            />
            <Button 
              onClick={addTask}
              size="sm" 
              className="absolute right-1 top-1 h-8"
              variant="ghost"
            >
              Add
            </Button>
          </div>
          <div className="flex rounded-lg border border-border bg-card p-1">
            {(["all", "active", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium transition-colors rounded-md",
                  filter === f
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:shadow-md",
                task.completed && "opacity-60"
              )}
            >
              <button
                onClick={() => toggleTask(task.id, task.completed)}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
                  task.completed
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground hover:border-primary"
                )}
              >
                {task.completed && <Check className="h-4 w-4" />}
              </button>
              
              <div className="flex-1">
                <p className={cn(
                  "font-medium transition-all",
                  task.completed && "line-through text-muted-foreground"
                )}>
                  {task.title}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5",
                    priorityColors[task.priority]
                  )}>
                    <Flag className="h-3 w-3" />
                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                  </span>
                  {task.dueDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {task.dueDate}
                    </span>
                  )}
                  <span className="rounded-full bg-secondary px-2 py-0.5">
                    {task.category}
                  </span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => deleteTask(task.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {filteredTasks.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <p>No tasks found</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
