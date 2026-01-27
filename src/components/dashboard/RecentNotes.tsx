import { FileText, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: any;
}

export function RecentNotes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notes"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Note));
      setRecentNotes(notesData.slice(0, 3));
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="font-semibold text-foreground">Recent Notes</h3>
        <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{recentNotes.length} notes</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full border border-border/40 hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => navigate("/notes")}
              title="Go to Notes"
            >
              <Plus className="h-4 w-4" />
            </Button>
        </div>
      </div>
      <div className="divide-y divide-border">
        {recentNotes.map((note) => (
          <div
            key={note.id}
            onClick={() => navigate("/notes")}
            className="group cursor-pointer px-6 py-4 transition-all duration-200 hover:bg-accent/50 active:scale-[0.99]"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-secondary p-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {note.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: note.content }}>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {note.updatedAt?.toDate ? note.updatedAt.toDate().toLocaleDateString() : new Date(note.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        ))}
        {recentNotes.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
                No notes yet.
            </div>
        )}
      </div>
    </div>
  );
}
