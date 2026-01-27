import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Task } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const buildTaskTree = (tasks: Task[]) => {
    const taskMap = new Map<string, Task>();
    const roots: Task[] = [];

    tasks.forEach(task => {
      taskMap.set(task.id, { ...task, subtasks: [] });
    });

    tasks.forEach(task => {
      const taskWithSubtasks = taskMap.get(task.id)!;
      if (task.parentId && taskMap.has(task.parentId)) {
        taskMap.get(task.parentId)!.subtasks!.push(taskWithSubtasks);
      } else {
        roots.push(taskWithSubtasks);
      }
    });

    const sortTasks = (nodes: Task[]) => {
      nodes.sort((a, b) => (a.order || 0) - (b.order || 0));
      nodes.forEach(node => {
        if (node.subtasks && node.subtasks.length > 0) {
          sortTasks(node.subtasks);
        }
      });
    };

    sortTasks(roots);
    return roots;
};
