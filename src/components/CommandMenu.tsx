import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  FileText,
  Link as LinkIcon,
  Tag,
  Plus,
  Search,
  Timer,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { toast } from "sonner";

const NAV_ITEMS = [
  { label: "Overview", path: "/", icon: LayoutDashboard, keywords: "home dashboard summary" },
  { label: "Schedule", path: "/schedule", icon: CalendarDays, keywords: "calendar events" },
  { label: "Tasks", path: "/tasks", icon: CheckSquare, keywords: "todo list" },
  { label: "Notes", path: "/notes", icon: FileText, keywords: "editor write" },
  { label: "Saved Links", path: "/links", icon: LinkIcon, keywords: "bookmarks urls" },
  { label: "Categories", path: "/categories", icon: Tag, keywords: "tags labels" },
];

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runAndClose = useCallback((fn: () => void) => {
    fn();
    setOpen(false);
    setInputValue("");
  }, []);

  const quickAddTask = useCallback(async () => {
    if (!user || !inputValue.trim()) return;
    try {
      await addDoc(collection(db, "tasks"), {
        title: inputValue.trim(),
        priority: "medium",
        completed: false,
        category: "General",
        userId: user.uid,
        createdAt: new Date(),
        parentId: null,
        order: 0,
      });
      toast.success("Task added", { description: inputValue.trim() });
      setOpen(false);
      setInputValue("");
    } catch {
      toast.error("Failed to add task");
    }
  }, [user, inputValue]);

  const quickAddNote = useCallback(async () => {
    if (!user) return;
    try {
      const noteRef = await addDoc(collection(db, "notes"), {
        title: inputValue.trim() || "Untitled Note",
        content: "",
        updatedAt: new Date(),
        category: "General",
        userId: user.uid,
      });
      toast.success("Note created", { description: inputValue.trim() || "Untitled Note" });
      setOpen(false);
      setInputValue("");
      navigate("/notes");
    } catch {
      toast.error("Failed to create note");
    }
  }, [user, inputValue, navigate]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type a command or search…"
        value={inputValue}
        onValueChange={setInputValue}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No results found</p>
          </div>
        </CommandEmpty>

        {/* Quick Actions – only show when there's typed text */}
        {inputValue.trim() && (
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={quickAddTask}>
              <Plus className="mr-2 h-4 w-4 text-primary" />
              <span>
                Add task: <span className="font-medium">{inputValue.trim()}</span>
              </span>
            </CommandItem>
            <CommandItem onSelect={quickAddNote}>
              <FileText className="mr-2 h-4 w-4 text-primary" />
              <span>
                Create note: <span className="font-medium">{inputValue.trim() || "Untitled"}</span>
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.path}
              value={`${item.label} ${item.keywords}`}
              onSelect={() => runAndClose(() => navigate(item.path))}
            >
              <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Create">
          <CommandItem
            value="new task add task"
            onSelect={() => runAndClose(() => navigate("/tasks"))}
          >
            <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />
            New Task
          </CommandItem>
          <CommandItem
            value="new note create note"
            onSelect={quickAddNote}
          >
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
            New Note
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
