import { useState, useEffect } from "react";
import { Check, Clock, Plus, ChevronRight, ChevronDown, CornerDownRight, Trash2, MoreHorizontal } from "lucide-react";
import { cn, buildTaskTree } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Calendar, Repeat } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Task } from "@/types";
import { toast } from "sonner";
import { useCategories } from "@/hooks/useCategories";
import { TaskItem } from "./TaskItemWidget";

export function QuickTasks() {
  const { user } = useAuth();
  const { categories } = useCategories();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [newReminder, setNewReminder] = useState(false);
  const [newRepeat, setNewRepeat] = useState<"daily" | "weekly" | "monthly" | "none">("none");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const MAX_SUBTASK_DEPTH = 2;

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Task))
        .filter((t) => !t.deletedAt);
      setTasks(tasksData);
    });
    return () => unsubscribe();
  }, [user]);

  const toggleTask = async (task: Task) => {
    const newStatus = !task.completed;
    
    if (newStatus) {
        setCompletingTasks(prev => new Set(prev).add(task.id));
        toast.success("Task Completed", {
            description: task.title,
        });

        setTimeout(async () => {
            await updateDoc(doc(db, "tasks", task.id), {
                completed: true
            });

            if (task.parentId) {
                const siblings = tasks.filter(t => t.parentId === task.parentId && t.id !== task.id);
                const allSiblingsCompleted = siblings.every(t => t.completed);
                if (allSiblingsCompleted) {
                    await updateDoc(doc(db, "tasks", task.parentId), {
                        completed: true
                    });
                }
            }
            
            setCompletingTasks(prev => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
        }, 500);
    } else {
        await updateDoc(doc(db, "tasks", task.id), {
            completed: false
        });
        
        if (task.parentId) {
            await updateDoc(doc(db, "tasks", task.parentId), {
                completed: false
            });
        }
    }
  };

  const handleAddTask = async () => {
      if (!newTaskTitle.trim() || !user) return;

      const topLevelTasks = tasks.filter(t => !t.parentId);
      const maxOrder = topLevelTasks.length > 0 ? Math.max(...topLevelTasks.map(t => t.order || 0)) : 0;
      const defaultCategory = categories[0]?.name || "General";

      await addDoc(collection(db, "tasks"), {
          title: newTaskTitle,
          priority: newPriority,
          completed: false,
          category: defaultCategory,
          userId: user.uid,
          createdAt: new Date(),
          dueDate: newDueDate ? newDueDate : null,
          reminder: newReminder,
          repeat: newRepeat,
          parentId: null,
          order: maxOrder + 1
      });

      setNewTaskTitle("");
      setNewPriority("medium");
      setNewDueDate(null);
      setNewReminder(false);
      setNewRepeat("none");
      setIsDialogOpen(false);
  };

  const getTaskDepth = (taskId: string | null) => {
    if (!taskId) return 0;
    let depth = 0;
    let currentId: string | null | undefined = taskId;
    const seen = new Set<string>();

    while (currentId) {
      if (seen.has(currentId)) break;
      seen.add(currentId);
      const current = tasks.find((t) => t.id === currentId);
      const parentId = current?.parentId ?? null;
      if (!parentId) return depth;
      depth += 1;
      currentId = parentId;
    }

    return depth;
  };

  const addSubtask = async (parentId: string, title: string) => {
    if (!user || !title.trim()) return;
    const parentDepth = getTaskDepth(parentId);
    if (parentDepth >= MAX_SUBTASK_DEPTH) {
      toast.error("Subtask limit reached", {
        description: "You can only nest subtasks up to 2 levels.",
      });
      return;
    }
    const siblingTasks = tasks.filter((t) => t.parentId === parentId);
    const maxOrder = siblingTasks.length > 0 ? Math.max(...siblingTasks.map((t) => t.order || 0)) : 0;
    const defaultCategory = categories[0]?.name || "General";

    await addDoc(collection(db, "tasks"), {
      title: title,
      priority: "medium",
      completed: false,
      category: defaultCategory,
      userId: user.uid,
      createdAt: new Date(),
      parentId: parentId,
      order: maxOrder + 1,
    });

    setExpandedTasks((prev) => new Set(prev).add(parentId));
  };

  const editTaskTitle = async (taskId: string, title: string) => {
    if (!user || !title.trim()) return;
    await updateDoc(doc(db, "tasks", taskId), { title: title.trim() });
    toast.success("Task updated", { description: title.trim() });
  };

  const deleteTask = async (id: string) => {
    const tasksToDelete = [id];
    const findSubtasks = (parentId: string) => {
      const subtasks = tasks.filter((t) => t.parentId === parentId);
      subtasks.forEach((t) => {
        tasksToDelete.push(t.id);
        findSubtasks(t.id);
      });
    };
    findSubtasks(id);

    const batch = writeBatch(db);
    tasksToDelete.forEach((taskId) => {
      batch.delete(doc(db, "tasks", taskId));
    });
    await batch.commit();
  };

  const toggleExpand = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const rootTasks = buildTaskTree(tasks);

  const getTaskCreatedAtMs = (task: Task) => {
    const createdAt = (task as Task & { createdAt?: unknown }).createdAt;
    if (!createdAt) return null;
    if (createdAt instanceof Date) return createdAt.getTime();
    if (typeof createdAt === "number") return createdAt;
    if (typeof createdAt === "string") {
      const ms = new Date(createdAt).getTime();
      return Number.isFinite(ms) ? ms : null;
    }

    if (typeof createdAt === "object" && createdAt !== null) {
      const maybeTimestamp = createdAt as { seconds?: unknown };
      if (typeof maybeTimestamp.seconds === "number") return maybeTimestamp.seconds * 1000;
    }

    return null;
  };

  const rootTasksNewestFirst = [...rootTasks].sort((a, b) => {
    const aCreated = getTaskCreatedAtMs(a);
    const bCreated = getTaskCreatedAtMs(b);
    if (aCreated != null && bCreated != null) return bCreated - aCreated;
    if (aCreated != null) return -1;
    if (bCreated != null) return 1;
    return (b.order || 0) - (a.order || 0);
  });

  const activeRootTasks = rootTasksNewestFirst.filter(t => !t.completed).slice(0, 5);
  const completedRootTasks = rootTasksNewestFirst.filter(t => t.completed).slice(0, 5);
  const activeRootCount = rootTasksNewestFirst.filter((t) => !t.completed).length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow duration-200 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-4 bg-muted/10 sm:px-6">
        <h3 className="font-semibold text-foreground text-lg">Priority Tasks</h3>
        <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium bg-background px-2 py-1 rounded-full">
            {activeRootCount} active
            </span>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full border border-border/40 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
                <DialogContent
                  className={cn(
                    "m-0.5 w-[calc(100vw-4px)] max-h-[calc(100dvh-4px)] overflow-y-auto overscroll-contain rounded-xl pb-[calc(env(safe-area-inset-bottom)+8px)]",
                    "top-0.5 left-0.5 translate-x-0 translate-y-0",
                    "sm:m-0 sm:w-full sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-[500px] sm:max-h-[85vh]",
                  )}
                >
                    <DialogHeader>
                        <DialogTitle className="text-xl">Add New Task</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 mt-4">
                        <Input 
                            placeholder="What needs to be done?" 
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                            className="text-base"
                        />
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Priority</label>
                            <Select value={newPriority} onValueChange={(v) => setNewPriority(v as "high" | "medium" | "low")}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newDueDate && "text-muted-foreground")}> 
                                  <Calendar className="mr-2 h-4 w-4" />
                                  {newDueDate ? format(newDueDate, "MMM d") : <span>Select</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={newDueDate ?? undefined}
                                  onSelect={setNewDueDate}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="reminder-toggle"
                              checked={newReminder}
                              onChange={(e) => setNewReminder(e.target.checked)}
                              className="h-4 w-4 rounded border-muted-foreground"
                            />
                            <label htmlFor="reminder-toggle" className="text-sm text-muted-foreground cursor-pointer">
                              Set reminder
                            </label>
                          </div>

                          <div className="flex-1" />

                          <Select value={newRepeat} onValueChange={(v) => setNewRepeat(v as "daily" | "weekly" | "monthly" | "none")}>
                            <SelectTrigger className="w-[140px]">
                              <div className="flex items-center gap-2">
                                <Repeat className="h-4 w-4" />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Repeat</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Button onClick={handleAddTask} className="mt-2" size="lg">Add Task</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
      </div>
      <div className="divide-y divide-border">
        {activeRootTasks.map((task) => (
          <TaskItem 
            key={task.id} 
            task={task}
            expandedTasks={expandedTasks}
            completingTasks={completingTasks}
            onToggleExpand={toggleExpand}
            onToggleTask={toggleTask}
            onAddSubtask={addSubtask}
            onEditTaskTitle={editTaskTitle}
            onDeleteTask={deleteTask}
          />
        ))}
        {activeRootTasks.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm sm:p-6">
                No active tasks.
            </div>
        )}
      </div>
      
      {completedRootTasks.length > 0 && (
        <div className="border-t border-border">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="completed-tasks" className="border-none">
                <AccordionTrigger className="px-4 py-3 hover:no-underline sm:px-6">
                  <span className="text-xs font-medium text-muted-foreground">
                    Completed ({completedRootTasks.length})
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  <div className="divide-y divide-border">
                    {completedRootTasks.map((task) => (
                      <TaskItem 
                        key={task.id} 
                        task={task}
                        expandedTasks={expandedTasks}
                        completingTasks={completingTasks}
                        onToggleExpand={toggleExpand}
                        onToggleTask={toggleTask}
                        onAddSubtask={addSubtask}
                        onEditTaskTitle={editTaskTitle}
                        onDeleteTask={deleteTask}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
        </div>
      )}
    </div>
  );
}
