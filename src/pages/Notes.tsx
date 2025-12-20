import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Search, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
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
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notes"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Note));
      setNotes(notesData);
      if (!selectedNote && notesData.length > 0) {
        setSelectedNote(notesData[0]);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const createNote = async () => {
    if (!user) return;
    const newNoteRef = await addDoc(collection(db, "notes"), {
      title: "Untitled Note",
      content: "",
      updatedAt: new Date(),
      category: "General",
      userId: user.uid
    });
    // Select the newly created note
    setSelectedNote({
      id: newNoteRef.id,
      title: "Untitled Note",
      content: "",
      updatedAt: new Date(),
      category: "General",
      userId: user.uid
    });
  };

  const updateNote = async (id: string, data: Partial<Note>) => {
    await updateDoc(doc(db, "notes", id), {
      ...data,
      updatedAt: new Date()
    });
  };

  const deleteNote = async (id: string) => {
    await deleteDoc(doc(db, "notes", id));
    if (selectedNote?.id === id) {
      setSelectedNote(null);
    }
  };

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-2rem)] gap-6 animate-fade-in">
        {/* Sidebar List */}
        <div className="flex w-80 flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-foreground">Notes</h1>
            <Button onClick={createNote} size="icon" className="h-8 w-8 rounded-full">
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
                onClick={() => setSelectedNote(note)}
                className={cn(
                  "cursor-pointer rounded-lg border p-4 transition-all hover:bg-accent/50",
                  selectedNote?.id === note.id
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

        {/* Editor Area */}
        <div className="flex flex-1 flex-col rounded-xl border border-border bg-card shadow-sm">
          {selectedNote ? (
            <>
              <div className="flex items-center justify-between border-b border-border p-4">
                <Input
                  value={selectedNote.title}
                  onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
                  className="border-none bg-transparent text-xl font-semibold focus-visible:ring-0 px-0"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last edited {selectedNote.updatedAt?.toDate ? selectedNote.updatedAt.toDate().toLocaleTimeString() : new Date(selectedNote.updatedAt).toLocaleTimeString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteNote(selectedNote.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 p-4">
                <ReactQuill 
                  theme="snow" 
                  value={selectedNote.content} 
                  onChange={(content) => updateNote(selectedNote.id, { content })}
                  className="h-full"
                />
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <FileText className="mb-4 h-12 w-12 opacity-20" />
              <p>Select a note or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Notes;
