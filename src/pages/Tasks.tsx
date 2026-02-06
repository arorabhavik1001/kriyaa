import { useMemo, useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus, Flag, Trash2, Calendar, Bell, Repeat, ChevronRight, ChevronDown, GripVertical, Pencil, CornerDownRight, Search, ListFilter, ArrowUpDown, RotateCcw } from "lucide-react";
import { cn, buildTaskTree } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";
import { useCategories } from "@/hooks/useCategories";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Task } from "@/types";

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

const priorityColors = {
  high: "text-destructive border-destructive",
  medium: "text-warning border-warning",
  low: "text-muted-foreground border-muted",
};

const MAX_SUBTASK_DEPTH = 2;

const BinTaskRow = ({
  task,
  onRestore,
  onDeleteForever,
}: {
  task: Task;
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
}) => {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium whitespace-normal break-words">{task.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {task.deletedAt
              ? `Deleted: ${task.deletedAt.toDate ? task.deletedAt.toDate().toLocaleString() : new Date(task.deletedAt).toLocaleString()}`
              : "Deleted"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRestore(task.id)} title="Restore">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDeleteForever(task.id)}
            title="Delete forever"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const SortableTaskRow = ({
  task,
  render,
}: {
  task: Task;
  render: (args: {
    setActivatorNodeRef: (element: HTMLElement | null) => void;
    listeners: any;
    attributes: any;
    isDragging: boolean;
  }) => ReactNode;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-60")}>
      {render({ setActivatorNodeRef, listeners, attributes, isDragging })}
    </div>
  );
};

const TaskItem = ({
  task,
  level = 0,
  sortBy,
  expandedTasks,
  setExpandedTasks,
  toggleExpand,
  completingTasks,
  toggleTask,
  deleteTask,
  editingTasks,
  setEditingTasks,
  editDrafts,
  setEditDrafts,
  saveTaskTitle,
  subtaskEditors,
  setSubtaskEditors,
  subtaskDrafts,
  setSubtaskDrafts,
  addSubtask,
}: {
  task: Task;
  level?: number;
  sortBy: "manual" | "dueDate-asc" | "dueDate-desc" | "created-desc";
  expandedTasks: Set<string>;
  setExpandedTasks: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleExpand: (taskId: string) => void;
  completingTasks: Set<string>;
  toggleTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  editingTasks: Set<string>;
  setEditingTasks: React.Dispatch<React.SetStateAction<Set<string>>>;
  editDrafts: Record<string, string>;
  setEditDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saveTaskTitle: (taskId: string, title: string) => Promise<void>;
  subtaskEditors: Set<string>;
  setSubtaskEditors: React.Dispatch<React.SetStateAction<Set<string>>>;
  subtaskDrafts: Record<string, string>;
  setSubtaskDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  addSubtask: (parentId: string, title: string) => Promise<void>;
}) => {
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const isExpanded = expandedTasks.has(task.id);
  const isEditing = editingTasks.has(task.id);
  const draft = editDrafts[task.id] ?? task.title;
  const isAddingSubtask = subtaskEditors.has(task.id);
  const canAddSubtask = level < MAX_SUBTASK_DEPTH;

  // Recursive subtask progress
  const getSubtaskProgress = (t: Task): { done: number; total: number } => {
    if (!t.subtasks || t.subtasks.length === 0) return { done: 0, total: 0 };
    let done = 0;
    let total = 0;
    for (const sub of t.subtasks) {
      total++;
      if (sub.completed) done++;
      const nested = getSubtaskProgress(sub);
      done += nested.done;
      total += nested.total;
    }
    return { done, total };
  };
  const subtaskProgress = hasSubtasks ? getSubtaskProgress(task) : null;

  const openAddSubtask = () => {
    if (!canAddSubtask) {
      toast.error("Subtask limit reached", {
        description: "You can only nest subtasks up to 2 levels.",
      });
      return;
    }
    setSubtaskEditors((prev) => new Set(prev).add(task.id));
    setExpandedTasks((prevExpanded) => new Set(prevExpanded).add(task.id));
    setSubtaskDrafts((prev) => ({ ...prev, [task.id]: prev[task.id] ?? "" }));
  };

  const closeAddSubtask = () => {
    setSubtaskEditors((prev) => {
      const next = new Set(prev);
      next.delete(task.id);
      return next;
    });
    setSubtaskDrafts((prev) => {
      const { [task.id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleAddSubtask = async () => {
    const title = (subtaskDrafts[task.id] ?? "").trim();
    if (!title) return;
    if (!canAddSubtask) return;
    try {
      await addSubtask(task.id, title);
      closeAddSubtask();
      toast.success("Subtask added", { description: title });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't add subtask", { description: "Please try again." });
    }
  };

  const openEdit = () => {
    setEditingTasks((prev) => new Set(prev).add(task.id));
    setEditDrafts((prev) => ({ ...prev, [task.id]: task.title }));
  };

  const closeEdit = () => {
    setEditingTasks((prev) => {
      const next = new Set(prev);
      next.delete(task.id);
      return next;
    });
    setEditDrafts((prev) => {
      const { [task.id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleSaveEdit = async () => {
    const nextTitle = (editDrafts[task.id] ?? "").trim();
    if (!nextTitle) return;
    try {
      await saveTaskTitle(task.id, nextTitle);
      closeEdit();
      toast.success("Task updated", { description: nextTitle });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't update task", { description: "Please try again." });
    }
  };

  return (
    <div className="flex flex-col">
      <SortableTaskRow
        task={task}
        render={({ setActivatorNodeRef, listeners, attributes }) => (
          <div
            className={cn(
              "group rounded-lg border border-border bg-card p-3 transition-all duration-200 mb-1 sm:hover:shadow-md",
              task.completed && "opacity-60 bg-muted/50",
              completingTasks.has(task.id) && "opacity-0 translate-x-10 pointer-events-none",
            )}
          >
            <div className="flex items-start gap-2 min-w-0">
              <div className="flex items-center pt-0.5 gap-1.5">
                {sortBy === "manual" ? (
                  <button
                    ref={setActivatorNodeRef}
                    {...listeners}
                    {...attributes}
                    className="cursor-grab text-muted-foreground sm:hover:text-foreground"
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="w-4" />
                )}

                {hasSubtasks ? (
                  <button
                    onClick={() => toggleExpand(task.id)}
                    className="text-muted-foreground sm:hover:text-foreground"
                    aria-label={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <div className="w-4" />
                )}

                <button
                  onClick={() => toggleTask(task)}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                    task.completed
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground sm:hover:border-primary",
                  )}
                  aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
                >
                  {task.completed && <Check className="h-3 w-3" />}
                </button>
              </div>

              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={draft}
                      onChange={(e) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [task.id]: e.target.value,
                        }))
                      }
                      className="h-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit();
                        if (e.key === "Escape") closeEdit();
                      }}
                      aria-label="Edit task title"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit} className="h-8">
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={closeEdit} className="h-8">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p
                    className={cn(
                      "font-medium whitespace-normal break-words transition-all",
                      task.completed && "line-through text-muted-foreground",
                    )}
                  >
                    {task.title}
                  </p>
                )}

                {/* Subtask progress bar */}
                {subtaskProgress && subtaskProgress.total > 0 && !isEditing && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-1.5 flex-1 max-w-[120px] rounded-full bg-border overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          subtaskProgress.done === subtaskProgress.total
                            ? "bg-success"
                            : "bg-primary",
                        )}
                        style={{
                          width: `${Math.round((subtaskProgress.done / subtaskProgress.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {subtaskProgress.done}/{subtaskProgress.total}
                    </span>
                  </div>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-2">
                {!isEditing ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
                        priorityColors[task.priority],
                      )}
                    >
                      {task.priority}
                    </span>
                    {task.category ? (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                        {task.category}
                      </span>
                    ) : null}
                    {task.dueDate ? (
                      <span className="flex items-center gap-1 whitespace-nowrap text-[10px]">
                        <Calendar className="h-3 w-3" />
                        {task.dueDate.toDate
                          ? format(task.dueDate.toDate(), "MMM d")
                          : format(new Date(task.dueDate), "MMM d")}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex items-center gap-1 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (isEditing) {
                        closeEdit();
                      } else {
                        openEdit();
                      }
                    }}
                    aria-label="Edit task"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {canAddSubtask ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openAddSubtask();
                      }}
                      aria-label="Add subtask"
                    >
                      <CornerDownRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteTask(task.id);
                    }}
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 sm:hidden">
              {!isEditing ? (
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
                      priorityColors[task.priority],
                    )}
                  >
                    {task.priority}
                  </span>
                  {task.category ? (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                      {task.category}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div />
              )}

              <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isEditing) {
                    closeEdit();
                  } else {
                    openEdit();
                  }
                }}
                aria-label="Edit task"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {canAddSubtask ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openAddSubtask();
                  }}
                  aria-label="Add subtask"
                >
                  <CornerDownRight className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteTask(task.id);
                }}
                aria-label="Delete task"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              </div>
            </div>

          </div>
        )}
      />

      {/* Flowchart-style subtask tree */}
      {((hasSubtasks && isExpanded) || isAddingSubtask) && !isEditing ? (
        <div className="ml-5 sm:ml-7 mt-0.5">
          <SortableContext
            items={(hasSubtasks && isExpanded ? task.subtasks! : []).map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {hasSubtasks && isExpanded && task.subtasks!.map((subtask, index) => {
              const isLastChild = index === task.subtasks!.length - 1 && !isAddingSubtask;
              return (
                <div key={subtask.id} className="relative pl-5">
                  <div className={cn(
                    "absolute left-[7px] top-0 w-px bg-border",
                    isLastChild ? "h-[18px]" : "h-full"
                  )} />
                  <div className="absolute left-[7px] top-[18px] w-[14px] h-px bg-border" />
                  <div className="absolute left-[4px] top-[15px] h-[7px] w-[7px] rounded-full border-[1.5px] border-primary/50 bg-background z-[1]" />
                  <TaskItem
                    task={subtask}
                    level={level + 1}
                    sortBy={sortBy}
                    expandedTasks={expandedTasks}
                    setExpandedTasks={setExpandedTasks}
                    toggleExpand={toggleExpand}
                    completingTasks={completingTasks}
                    toggleTask={toggleTask}
                    deleteTask={deleteTask}
                    editingTasks={editingTasks}
                    setEditingTasks={setEditingTasks}
                    editDrafts={editDrafts}
                    setEditDrafts={setEditDrafts}
                    saveTaskTitle={saveTaskTitle}
                    subtaskEditors={subtaskEditors}
                    setSubtaskEditors={setSubtaskEditors}
                    subtaskDrafts={subtaskDrafts}
                    setSubtaskDrafts={setSubtaskDrafts}
                    addSubtask={addSubtask}
                  />
                </div>
              );
            })}
          </SortableContext>

          {isAddingSubtask && (
            <div className="relative pl-5">
              <div className="absolute left-[7px] top-0 h-[20px] w-px bg-border" />
              <div className="absolute left-[7px] top-[20px] w-[14px] h-px bg-border" />
              <div className="absolute left-[4px] top-[17px] h-[7px] w-[7px] rounded-full border-[1.5px] border-primary/50 bg-background z-[1]" />
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={subtaskDrafts[task.id] ?? ""}
                    onChange={(e) =>
                      setSubtaskDrafts((prev) => ({
                        ...prev,
                        [task.id]: e.target.value,
                      }))
                    }
                    placeholder="Subtask title..."
                    className="h-10 text-base sm:h-8 sm:text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddSubtask();
                      if (e.key === "Escape") closeAddSubtask();
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2 sm:justify-end">
                    <Button size="sm" onClick={handleAddSubtask} className="w-full sm:w-auto">
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={closeAddSubtask}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

const Tasks = () => {
  const { user } = useAuth();
  const { categories } = useCategories();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active"); // Renamed for clarity, though original was filter
  
  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"manual" | "dueDate-asc" | "dueDate-desc" | "created-desc">("manual");

  // New Task State
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newCategory, setNewCategory] = useState<string>("General");
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);
  const [newReminder, setNewReminder] = useState(false);
  const [newRepeat, setNewRepeat] = useState<"daily" | "weekly" | "monthly" | "none">("none");

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const newTaskInputRef = useRef<HTMLInputElement | null>(null);
  const [editingTasks, setEditingTasks] = useState<Set<string>>(new Set());
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const [subtaskEditors, setSubtaskEditors] = useState<Set<string>>(new Set());
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  useEffect(() => {
    if (!user) return;
    if (window.Notification && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(tasksData);
      
      // Reminder logic (simplified)
      tasksData.forEach(task => {
        if (task.reminder && !task.completed && task.dueDate) {
          const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
          const now = new Date();
          const timeDiff = dueDate.getTime() - now.getTime();
          if (timeDiff > 0 && timeDiff < 60 * 60 * 1000) {
             // Notification logic here
          }
        }
      });
    });
    return () => unsubscribe();
  }, [user]);


  const addTask = async (parentId: string | null = null) => {
    if (!newTask.trim() && !parentId) return; // Allow empty if adding subtask via dialog? No, let's stick to input.
    
    // If adding a subtask, we might need a prompt or a different UI. 
    // For now, the main input adds top-level tasks.
    // We will add a separate function for subtasks.
    
    if (!user) return;

    const currentTasks = tasks.filter(t => t.parentId === parentId);
    const siblingOrders = currentTasks.map((t) => (typeof t.order === "number" ? t.order : 0));
    const minOrder = siblingOrders.length > 0 ? Math.min(...siblingOrders) : 0;
    const nextOrder = siblingOrders.length > 0 ? minOrder - 1 : 0;

    await addDoc(collection(db, "tasks"), {
      title: newTask,
      priority: newPriority,
      completed: false,
      category: newCategory,
      userId: user.uid,
      createdAt: new Date(),
      dueDate: newDueDate ? newDueDate : null,
      reminder: newReminder,
      repeat: newRepeat,
      parentId: parentId ?? null,
      order: nextOrder
    });
    setNewTask("");
    setNewPriority("medium");
    setNewCategory(categories[0]?.name || "General");
    setNewDueDate(undefined);
    setNewReminder(false);
    setNewRepeat("none");
  };

  const saveTaskTitle = async (taskId: string, title: string) => {
    if (!title.trim()) return;
    await updateDoc(doc(db, "tasks", taskId), { title: title.trim() });
  };

  const addSubtask = async (parentId: string, title: string) => {
    if (!user || !title.trim()) return;

    const siblingTasks = tasks.filter((t) => t.parentId === parentId);
    const siblingOrders = siblingTasks.map((t) => (typeof t.order === "number" ? t.order : 0));
    // Subtasks should append to the bottom by default.
    const maxOrder = siblingOrders.length > 0 ? Math.max(...siblingOrders) : -1;
    const nextOrder = maxOrder + 1;

    const defaultCategory = categories[0]?.name || "General";

    await addDoc(collection(db, "tasks"), {
      title: title.trim(),
      priority: "medium",
      completed: false,
      category: defaultCategory,
      userId: user.uid,
      createdAt: new Date(),
      parentId,
      order: nextOrder,
    });

    setExpandedTasks((prev) => new Set(prev).add(parentId));
  };

  const toggleTask = async (task: Task) => {
    const newStatus = !task.completed;
    
    if (newStatus) {
        // Completing with animation + confetti
        setCompletingTasks(prev => new Set(prev).add(task.id));
        toast.success("Task Completed", {
            description: task.title,
        });

        // Fire confetti for root tasks 🎉
        if (!task.parentId) {
          confetti({
            particleCount: 60,
            spread: 55,
            origin: { y: 0.7 },
            colors: ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"],
            disableForReducedMotion: true,
          });
        }

        setTimeout(async () => {
            await updateDoc(doc(db, "tasks", task.id), {
                completed: true
            });
            
            // Check parent completion
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
        // Un-completing (immediate)
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

  const deleteTask = async (id: string) => {
    // Recursively move task + subtasks to Bin (soft delete)
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
      batch.update(doc(db, "tasks", taskId), { deletedAt: new Date() });
    });
    await batch.commit();
  };

  const restoreTask = async (id: string) => {
    const tasksToRestore = [id];
    const findSubtasks = (parentId: string) => {
      const subtasks = tasks.filter((t) => t.parentId === parentId);
      subtasks.forEach((t) => {
        tasksToRestore.push(t.id);
        findSubtasks(t.id);
      });
    };
    findSubtasks(id);

    const batch = writeBatch(db);
    tasksToRestore.forEach((taskId) => {
      batch.update(doc(db, "tasks", taskId), { deletedAt: null });
    });
    await batch.commit();
  };

  const deleteTaskForever = async (id: string) => {
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

  const getTaskById = (id: string) => tasks.find((t) => t.id === id);

  const persistSiblingOrders = async (parentId: string | null, orderedIds: string[]) => {
    const batch = writeBatch(db);
    orderedIds.forEach((id, index) => {
      batch.update(doc(db, "tasks", id), { order: index, parentId: parentId ?? null });
    });
    await batch.commit();
  };

  const reorderWithinParent = async (parentId: string | null, activeId: string, overId: string) => {
    const siblings = tasks
      .filter((t) => (t.parentId ?? null) === parentId)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const oldIndex = siblings.findIndex((t) => t.id === activeId);
    const newIndex = siblings.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(siblings, oldIndex, newIndex);
    const newOrderById = new Map(reordered.map((t, index) => [t.id, index] as const));

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => {
        if ((t.parentId ?? null) !== parentId) return t;
        const nextOrder = newOrderById.get(t.id);
        if (nextOrder === undefined) return t;
        return { ...t, order: nextOrder };
      }),
    );

    await persistSiblingOrders(parentId, reordered.map((t) => t.id));
  };

  const handleDndDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDndDragEnd = async (event: DragEndEvent) => {
    if (sortBy !== "manual") return;
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeTask = getTaskById(activeId);
    const overTask = getTaskById(overId);
    if (!activeTask || !overTask) return;

    const activeParent = (activeTask.parentId ?? null) as string | null;
    const overParent = (overTask.parentId ?? null) as string | null;
    if (activeParent !== overParent) return; // keep reordering within same level

    try {
      await reorderWithinParent(activeParent, activeId, overId);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't reorder tasks", { description: "Please try again." });
    }
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

  

  const processedTasks = useMemo(() => {
    // 1. Filter
    let filtered = tasks.filter((t) => {
      if (t.deletedAt) return false;
      const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = filterCategory === "all" || t.category === filterCategory;
      const matchPriority = filterPriority === "all" || t.priority === filterPriority;
      return matchSearch && matchCategory && matchPriority;
    });

    // 2. Build Tree (Orphans become roots if parents filtered out)
    const tree = buildTaskTree(filtered);

    // 3. Sort
    if (sortBy !== "manual") {
      const getDate = (d: any) => d ? (d.toDate ? d.toDate() : new Date(d)) : new Date(0);
      
      const sortFn = (a: Task, b: Task) => {
        if (sortBy === "dueDate-asc") {
            const dateA = getDate(a.dueDate).getTime();
            const dateB = getDate(b.dueDate).getTime();
            if (dateA === 0 && dateB !== 0) return 1; // No due date at bottom
            if (dateA !== 0 && dateB === 0) return -1;
            return dateA - dateB;
        }
        if (sortBy === "dueDate-desc") {
            const dateA = getDate(a.dueDate).getTime();
            const dateB = getDate(b.dueDate).getTime();
            return dateB - dateA;
        }
        if (sortBy === "created-desc") {
           return getDate(b.createdAt || b.id).getTime() - getDate(a.createdAt || a.id).getTime();
        }
        return 0;
      };

      const recursiveSort = (nodes: Task[]) => {
        nodes.sort(sortFn);
        nodes.forEach(node => {
          if (node.subtasks && node.subtasks.length > 0) {
            recursiveSort(node.subtasks);
          }
        });
      };
      
      recursiveSort(tree);
    }
    
    return tree;
  }, [tasks, searchQuery, filterPriority, filterCategory, sortBy]);

  const deletedTasksTree = useMemo(() => {
    let filtered = tasks.filter((t) => {
      if (!t.deletedAt) return false;
      const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = filterCategory === "all" || t.category === filterCategory;
      const matchPriority = filterPriority === "all" || t.priority === filterPriority;
      return matchSearch && matchCategory && matchPriority;
    });
    return buildTaskTree(filtered);
  }, [tasks, searchQuery, filterPriority, filterCategory]);

  const activeRootTasks = useMemo(() => processedTasks.filter((t) => !t.completed), [processedTasks]);
  const completedRootTasks = useMemo(() => processedTasks.filter((t) => t.completed), [processedTasks]);

  const overlayTask = activeDragId ? getTaskById(activeDragId) : undefined;

  return (
    <DashboardLayout>
      <div className="animate-fade-in max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">Organize and track your daily priorities</p>
        </div>

        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Input
              ref={newTaskInputRef}
              placeholder="Add a new task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="flex-1"
            />
            <Button onClick={() => addTask()} className="w-full sm:w-auto">
              Add Task
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center">
             <Select value={newPriority} onValueChange={(v: any) => setNewPriority(v)}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>

            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.icon} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal",
                    !newDueDate && "text-muted-foreground",
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {newDueDate ? format(newDueDate, "PPP") : <span>Pick a due date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={newDueDate}
                  onSelect={setNewDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Filters & Sorting */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
           <div className="relative flex-1 w-full md:w-auto">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
           </div>
           <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
             <Select value={filterPriority} onValueChange={setFilterPriority}>
               <SelectTrigger className="w-[130px]">
                 <ListFilter className="mr-2 h-4 w-4" />
                 <SelectValue placeholder="Priority" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Priorities</SelectItem>
                 <SelectItem value="high">High</SelectItem>
                 <SelectItem value="medium">Medium</SelectItem>
                 <SelectItem value="low">Low</SelectItem>
               </SelectContent>
             </Select>

             <Select value={filterCategory} onValueChange={setFilterCategory}>
               <SelectTrigger className="w-[140px]">
                 <SelectValue placeholder="Category" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Categories</SelectItem>
                 {categories.map((cat) => (
                   <SelectItem key={cat.id} value={cat.name}>
                     {cat.icon} {cat.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>

             <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
               <SelectTrigger className="w-[160px]">
                 <ArrowUpDown className="mr-2 h-4 w-4" />
                 <SelectValue placeholder="Sort by" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="manual">Manual Order</SelectItem>
                 <SelectItem value="dueDate-asc">Date: Earliest</SelectItem>
                 <SelectItem value="dueDate-desc">Date: Latest</SelectItem>
                 <SelectItem value="created-desc">Created: Newest</SelectItem>
               </SelectContent>
             </Select>
           </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDndDragStart}
          onDragEnd={handleDndDragEnd}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <SortableContext items={activeRootTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {activeRootTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    sortBy={sortBy}
                    expandedTasks={expandedTasks}
                    setExpandedTasks={setExpandedTasks}
                    toggleExpand={toggleExpand}
                    completingTasks={completingTasks}
                    toggleTask={toggleTask}
                    deleteTask={deleteTask}
                    editingTasks={editingTasks}
                    setEditingTasks={setEditingTasks}
                    editDrafts={editDrafts}
                    setEditDrafts={setEditDrafts}
                    saveTaskTitle={saveTaskTitle}
                    subtaskEditors={subtaskEditors}
                    setSubtaskEditors={setSubtaskEditors}
                    subtaskDrafts={subtaskDrafts}
                    setSubtaskDrafts={setSubtaskDrafts}
                    addSubtask={addSubtask}
                  />
                ))}
              </SortableContext>
              {activeRootTasks.length === 0 && (
                <div className="text-center text-muted-foreground py-8">No active tasks</div>
              )}
            </div>

            {completedRootTasks.length > 0 && (
              <Accordion type="single" collapsible className="w-full border rounded-lg bg-card">
                <AccordionItem value="completed-tasks" className="border-none">
                  <AccordionTrigger className="px-4 py-2 hover:no-underline">
                    <span className="text-sm font-medium text-muted-foreground">
                      Completed Tasks ({completedRootTasks.length})
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2 pt-2">
                      {/* Completed list is not sortable */}
                      {completedRootTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          sortBy={sortBy}
                          expandedTasks={expandedTasks}
                          setExpandedTasks={setExpandedTasks}
                          toggleExpand={toggleExpand}
                          completingTasks={completingTasks}
                          toggleTask={toggleTask}
                          deleteTask={deleteTask}
                          editingTasks={editingTasks}
                          setEditingTasks={setEditingTasks}
                          editDrafts={editDrafts}
                          setEditDrafts={setEditDrafts}
                          saveTaskTitle={saveTaskTitle}
                          subtaskEditors={subtaskEditors}
                          setSubtaskEditors={setSubtaskEditors}
                          subtaskDrafts={subtaskDrafts}
                          setSubtaskDrafts={setSubtaskDrafts}
                          addSubtask={addSubtask}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {deletedTasksTree.length > 0 && (
              <Accordion type="single" collapsible className="w-full border rounded-lg bg-card">
                <AccordionItem value="bin" className="border-none">
                  <AccordionTrigger className="px-4 py-2 hover:no-underline">
                    <span className="text-sm font-medium text-muted-foreground">Bin ({deletedTasksTree.length})</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2 pt-2">
                      {deletedTasksTree.map((task) => (
                        <BinTaskRow
                          key={task.id}
                          task={task}
                          onRestore={(id) => restoreTask(id)}
                          onDeleteForever={(id) => deleteTaskForever(id)}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>

          <DragOverlay>
            {overlayTask ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-md">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{overlayTask.title}</p>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <Button
          className="fixed bottom-8 right-8 z-50 h-14 w-14 rounded-full border border-border/40 shadow-xl hover:shadow-2xl transition-all duration-200"
          size="icon"
          onClick={() => {
            newTaskInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => newTaskInputRef.current?.focus(), 200);
          }}
          aria-label="Add task"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
