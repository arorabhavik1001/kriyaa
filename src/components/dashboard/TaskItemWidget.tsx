
import { useState } from "react";
import { Check, Clock, ChevronRight, ChevronDown, CornerDownRight, Trash2, MoreHorizontal, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Task } from "@/types";

const priorityColors = {
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
};

interface TaskItemProps {
  task: Task;
  level?: number;
  expandedTasks: Set<string>;
  completingTasks: Set<string>;
  onToggleExpand: (taskId: string) => void;
  onToggleTask: (task: Task) => void;
  onAddSubtask: (parentId: string, title: string) => Promise<void>;
  onEditTaskTitle: (taskId: string, title: string) => Promise<void>;
  onDeleteTask: (taskId: string) => void;
}

export const TaskItem = ({ 
  task, 
  level = 0,
  expandedTasks,
  completingTasks,
  onToggleExpand,
  onToggleTask,
  onAddSubtask,
  onEditTaskTitle,
  onDeleteTask
}: TaskItemProps) => {
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const isExpanded = expandedTasks.has(task.id);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  const openAddSubtask = () => {
    setIsAddingSubtask(true);
    // Ensure parent is expanded
    if (!expandedTasks.has(task.id)) {
      onToggleExpand(task.id);
    }
  };

  const handleAddSubtask = async () => {
    if (!subtaskTitle.trim()) return;
    await onAddSubtask(task.id, subtaskTitle);
    setSubtaskTitle("");
    setIsAddingSubtask(false);
  };

  const openEdit = () => {
    setIsEditing(true);
    setEditTitle(task.title ?? "");
  };

  const closeEdit = () => {
    setIsEditing(false);
    setEditTitle("");
  };

  const handleSaveEdit = async () => {
    const nextTitle = editTitle.trim();
    if (!nextTitle) return;
    await onEditTaskTitle(task.id, nextTitle);
    closeEdit();
  };

  return (
    <div className={cn("flex flex-col", level > 0 && "ml-3 sm:ml-4")}>
      <div
        className={cn(
          "group rounded-lg border-b border-transparent pl-1 pr-2 py-3 sm:px-4 transition-all duration-200 cursor-pointer flex items-start gap-2 sm:gap-3",
          task.completed && "opacity-60",
          completingTasks.has(task.id) && "opacity-0 translate-x-10 pointer-events-none"
        )}
      >
        {hasSubtasks ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(task.id);
            }}
            className="mt-0.5 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <div className="w-1 sm:w-3" />
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleTask(task);
          }}
          className={cn(
            "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
            task.completed
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground sm:hover:border-primary"
          )}
        >
          {task.completed && <Check className="h-3 w-3" />}
        </button>
        
        <div className="flex-1 min-w-0 pt-0.5" onClick={() => !isEditing && onToggleTask(task)}>
          {isEditing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") closeEdit();
                }}
                autoFocus
                aria-label="Edit task title"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-8" onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}>
                  Save
                </Button>
                <Button size="sm" variant="outline" className="h-8" onClick={(e) => { e.stopPropagation(); closeEdit(); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p
              className={cn(
                "font-medium text-sm text-foreground truncate transition-all",
                task.completed && "line-through text-muted-foreground",
              )}
            >
              {task.title}
            </p>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full border",
              priorityColors[task.priority as keyof typeof priorityColors]
            )}>
              {task.priority || "medium"}
            </span>
            {task.dueDate && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {typeof task.dueDate === 'object' && task.dueDate !== null && ((task.dueDate as any).seconds !== undefined)
                  ? format(new Date((task.dueDate as any).seconds * 1000), "MMM d")
                  : (typeof task.dueDate === 'string' ? task.dueDate : '')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openAddSubtask(); }}>
                <CornerDownRight className="mr-2 h-4 w-4" />
                Add Subtask
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditing) {
                    closeEdit();
                  } else {
                    openEdit();
                  }
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Task
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {(hasSubtasks && isExpanded) || isAddingSubtask ? (
        <div className="border-l ml-4 border-border/50 sm:ml-5">
          {hasSubtasks && isExpanded && (
            <>
              {task.subtasks!.map((subtask) => (
                <TaskItem 
                  key={subtask.id} 
                  task={subtask} 
                  level={level + 1}
                  expandedTasks={expandedTasks}
                  completingTasks={completingTasks}
                  onToggleExpand={onToggleExpand}
                  onToggleTask={onToggleTask}
                  onAddSubtask={onAddSubtask}
                  onEditTaskTitle={onEditTaskTitle}
                  onDeleteTask={onDeleteTask}
                />
              ))}
            </>
          )}

          {isAddingSubtask && (
            <div className="px-2 pb-3 sm:px-4">
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    placeholder="Subtask title..."
                    className="h-10 text-base sm:h-8 sm:text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                    autoFocus
                  />
                  <div className="flex gap-2 sm:justify-end">
                    <Button size="sm" onClick={handleAddSubtask} className="w-full sm:w-auto">
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsAddingSubtask(false);
                        setSubtaskTitle("");
                      }}
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
