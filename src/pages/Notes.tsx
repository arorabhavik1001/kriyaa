import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Search, Trash2, Clock, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: any; // Firestore timestamp
  category: string;
  userId: string;
}

const Notes = () => {
  const { user } = useAuth();
  const { categories } = useCategories();
  const isMobile = useIsMobile();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditorMobile, setShowEditorMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notes"), 
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Note));
      setNotes(notesData);
    });
    return () => unsubscribe();
  }, [user]);

  // Derived state for the currently selected note
  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;

  // Initial selection logic
  useEffect(() => {
    if (!selectedNoteId && notes.length > 0) {
      setSelectedNoteId(notes[0].id);
    }
  }, [notes, selectedNoteId]);

  const createNote = async () => {
    if (!user) return;
    const defaultCategory = categories[0]?.name || "General";
    try {
      const newNoteRef = await addDoc(collection(db, "notes"), {
        title: "Untitled Note",
        content: "",
        updatedAt: new Date(),
        category: defaultCategory,
        userId: user.uid
      });
      // Select the newly created note by ID
      setSelectedNoteId(newNoteRef.id);
      if (isMobile) {
        setShowEditorMobile(true);
      }
    } catch (error) {
      console.error("Error creating note:", error);
    }
  };

  const updateNote = async (id: string, data: Partial<Note>) => {
    try {
      await updateDoc(doc(db, "notes", id), {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error updating note:", error);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notes", id));
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
      }
      if (isMobile) {
        setShowEditorMobile(false);
      }
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      {/* Desktop Layout */}
      {!isMobile ? (
        <div className="flex h-[calc(100vh-2rem)] gap-4 animate-fade-in">
          {/* Collapsible Sidebar */}
          <div 
            className={cn(
              "flex flex-col gap-4 transition-all duration-300 ease-in-out",
              sidebarCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-80 opacity-100"
            )}
          >
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-foreground truncate">Notes</h1>
              <Button
                onClick={createNote}
                size="icon"
                className="h-9 w-9 rounded-full border border-border/40 shadow-sm hover:shadow-md transition-shadow"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => {
                    setSelectedNoteId(note.id);
                    setSidebarCollapsed(true);
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg border p-4 transition-all duration-200 hover:shadow-md active:scale-[0.98]",
                    selectedNoteId === note.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:bg-accent/30"
                  )}
                >
                  <h3 className={cn(
                    "font-semibold truncate transition-colors",
                    selectedNoteId === note.id ? "text-primary" : "text-foreground"
                  )}>{note.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: note.content }}></p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{note.updatedAt?.toDate ? note.updatedAt.toDate().toLocaleDateString() : new Date(note.updatedAt).toLocaleDateString()}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
                      {note.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex flex-1 flex-col rounded-xl border border-border bg-card shadow-md">
            {selectedNote ? (
              <>
                <div className="flex items-center justify-between border-b border-border p-4 bg-muted/20">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      className="shrink-0 hover:bg-primary/10"
                      title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                    >
                      {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                    </Button>
                    <Input
                      value={selectedNote.title}
                      onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
                      className="border-none bg-transparent text-xl font-semibold focus-visible:ring-0 px-0"
                    />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Select
                      value={selectedNote.category}
                      onValueChange={(value) => updateNote(selectedNote.id, { category: value })}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.icon} {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground flex items-center gap-1 bg-background/80 px-2 py-1 rounded-md">
                      <Clock className="h-3 w-3" />
                      {selectedNote.updatedAt?.toDate ? selectedNote.updatedAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date(selectedNote.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteNote(selectedNote.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-6 overflow-auto">
                  <ReactQuill 
                    key={selectedNote.id}
                    theme="snow" 
                    value={selectedNote.content} 
                    onChange={(content) => updateNote(selectedNote.id, { content })}
                    className="h-full"
                    placeholder="Start writing your note..."
                  />
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="absolute top-4 left-4 hover:bg-primary/10"
                  title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                >
                  {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
                <FileText className="mb-4 h-16 w-16 opacity-10" />
                <p className="text-lg font-medium">Select a note to start editing</p>
                <p className="text-sm mt-1">or create a new one</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Mobile Layout
        <div className="h-[calc(100vh-2rem)] animate-fade-in">
          {/* Show list or editor based on state */}
          {!showEditorMobile ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-foreground">Notes</h1>
                <Button
                  onClick={createNote}
                  size="icon"
                  className="h-8 w-8 rounded-full border border-border/40"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => {
                      setSelectedNoteId(note.id);
                      setShowEditorMobile(true);
                    }}
                    className={cn(
                      "cursor-pointer rounded-lg border p-4 transition-all hover:bg-accent/50",
                      selectedNoteId === note.id
                        ? "border-primary bg-accent"
                        : "border-border bg-card"
                    )}
                  >
                    <h3 className="font-medium text-foreground">{note.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: note.content }}></p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{note.updatedAt?.toDate ? note.updatedAt.toDate().toLocaleDateString() : new Date(note.updatedAt).toLocaleDateString()}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5">
                        {note.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex flex-col gap-2 border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShowEditorMobile(false)}>
                    {/* Simple back arrow */}
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  </Button>
                  <Input
                    value={selectedNote?.title || ""}
                    onChange={(e) => selectedNote && updateNote(selectedNote.id, { title: e.target.value })}
                    className="border-none bg-transparent text-xl font-semibold focus-visible:ring-0 px-0"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => selectedNote && deleteNote(selectedNote.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {selectedNote && (
                  <span className="flex items-center gap-1 rounded-full bg-secondary/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm w-fit mt-1">
                    <Clock className="h-4 w-4 text-primary/70" />
                    <span className="font-semibold text-foreground">
                      {(() => {
                        const d = selectedNote.updatedAt?.toDate ? selectedNote.updatedAt.toDate() : new Date(selectedNote.updatedAt);
                        const day = d.getDate().toString().padStart(2, '0');
                        const month = d.toLocaleString('default', { month: 'short' });
                        let hours = d.getHours();
                        const minutes = d.getMinutes().toString().padStart(2, '0');
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12;
                        hours = hours ? hours : 12;
                        return `Last Edited: ${day} ${month} ${hours}:${minutes} ${ampm}`;
                      })()}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex-1 p-4">
                <ReactQuill
                  key={selectedNote?.id}
                  theme="snow"
                  value={selectedNote?.content || ""}
                  onChange={(content) => selectedNote && updateNote(selectedNote.id, { content })}
                  className="h-full"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};

export default Notes;
