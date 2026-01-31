export interface Task {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  createdAt?: any; // Firestore timestamp or Date
  dueDate?: any; // Firestore timestamp or Date
  deletedAt?: any; // Firestore timestamp or Date (soft delete)
  completed: boolean;
  category: string;
  userId: string;
  reminder?: boolean;
  repeat?: "daily" | "weekly" | "monthly" | "none";
  parentId?: string | null;
  order?: number;
  subtasks?: Task[]; // For UI structure
}
