import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Search, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: Date;
  category: string;
}

const initialNotes: Note[] = [
  {
    id: "1",
    title: "Strategic Planning 2025",
    content: "Key initiatives for next year:\n\n1. Expand into APAC markets\n2. Launch enterprise tier\n3. Improve customer retention by 15%\n4. Hire 50 new engineers\n\nNeed to discuss budget allocation with CFO.",
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    category: "Strategy",
  },
  {
    id: "2",
    title: "Product Roadmap Q1",
    content: "Feature prioritization based on customer feedback:\n\n- Real-time collaboration (P0)\n- Advanced analytics dashboard (P1)\n- Mobile app improvements (P1)\n- API v2 launch (P2)",
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    category: "Product",
  },
  {
    id: "3",
    title: "Team Restructure Ideas",
    content: "Considerations for engineering team growth:\n\n- Split into platform and product teams\n- Add dedicated DevOps team\n- Create new engineering manager role\n- Review compensation bands",
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    category: "People",
  },
];

const Notes = () => {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [selectedNote, setSelectedNote] = useState<Note | null>(notes[0]);
  const [searchQuery, setSearchQuery] = useState("");

  const createNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: "Untitled Note",
      content: "",
      updatedAt: new Date(),
      category: "General",
    };
    setNotes([newNote, ...notes]);
    setSelectedNote(newNote);
  };

  const updateNote = (field: "title" | "content", value: string) => {
    if (!selectedNote) return;
    const updated = { ...selectedNote, [field]: value, updatedAt: new Date() };
    setSelectedNote(updated);
    setNotes(notes.map(n => n.id === updated.id ? updated : n));
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
    if (selectedNote?.id === id) {
      setSelectedNote(notes.find(n => n.id !== id) || null);
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in h-[calc(100vh-8rem)]">
        <div className="flex h-full gap-6">
          {/* Notes List */}
          <div className="w-80 shrink-0 flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-foreground">Notes</h1>
              <Button size="sm" onClick={createNote}>
                <Plus className="mr-1 h-4 w-4" />
                New
              </Button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>

            <div className="flex-1 space-y-2 overflow-auto rounded-xl border border-border bg-card p-2">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={cn(
                    "group cursor-pointer rounded-lg p-3 transition-all duration-200",
                    selectedNote?.id === note.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium text-foreground line-clamp-1">{note.title}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNote(note.id);
                      }}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{note.category}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(note.updatedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note Editor */}
          <div className="flex-1 rounded-xl border border-border bg-card p-6">
            {selectedNote ? (
              <div className="flex h-full flex-col">
                <Input
                  value={selectedNote.title}
                  onChange={(e) => updateNote("title", e.target.value)}
                  className="mb-4 border-0 bg-transparent px-0 text-xl font-semibold focus-visible:ring-0"
                  placeholder="Note title..."
                />
                <Textarea
                  value={selectedNote.content}
                  onChange={(e) => updateNote("content", e.target.value)}
                  className="flex-1 resize-none border-0 bg-transparent px-0 focus-visible:ring-0"
                  placeholder="Start writing..."
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground">Select a note or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Notes;
