import { useState, useEffect } from "react";
import { Check, Circle, Clock, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

interface Task {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  dueDate?: string;
  completed: boolean;
}

const priorityColors = {
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
};

export function QuickTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Task));
      // Sort by priority or date if needed, taking top 5
      setTasks(tasksData.slice(0, 5));
    });
    return () => unsubscribe();
  }, [user]);

  const toggleTask = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, "tasks", id), {
      completed: !currentStatus
    });
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
              onClick={() => toggleTask(task.id, task.completed)}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                task.completed
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground hover:border-primary"
              )}
            >
              {task.completed && <Check className="h-3 w-3" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-medium text-sm text-foreground truncate transition-all",
                task.completed && "line-through text-muted-foreground"
              )}>
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full border",
                  // @ts-ignore
                  priorityColors[task.priority]
                )}>
                  {task.priority}
                </span>
                {task.dueDate && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {task.dueDate}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
                No tasks yet.
            </div>
        )}
      </div>
    </div>
  );
}
