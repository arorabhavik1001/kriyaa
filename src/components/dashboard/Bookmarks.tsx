import { useState, useEffect } from "react";
import { Plus, ExternalLink, Trash2, Link as LinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Bookmark {
  id: string;
  title: string;
  url: string;
  userId: string;
}

export function Bookmarks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "bookmarks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookmarksData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Bookmark));
      setBookmarks(bookmarksData);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAddBookmark = async () => {
    if (!newTitle.trim() || !newUrl.trim() || !user) return;
    
    let formattedUrl = newUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = 'https://' + formattedUrl;
    }

    await addDoc(collection(db, "bookmarks"), {
      title: newTitle,
      url: formattedUrl,
      userId: user.uid,
      createdAt: new Date()
    });
    setNewTitle("");
    setNewUrl("");
    setIsDialogOpen(false);
  };

  const deleteBookmark = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Prevent link click
    e.stopPropagation();
    await deleteDoc(doc(db, "bookmarks", id));
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/10">
        <h3 className="font-semibold text-foreground text-lg">Quick Links</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium bg-background px-2 py-1 rounded-full">
            {bookmarks.length} saved
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full border border-border/40 hover:bg-primary/10 hover:text-primary transition-colors"
            onClick={() => navigate("/links")}
            title="Go to Saved Links"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="hidden">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full border border-border/40">
                    <Plus className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Bookmark</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 mt-4">
                    <Input 
                        placeholder="Title (e.g., Google)" 
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                    />
                    <Input 
                        placeholder="URL (e.g., google.com)" 
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                    />
                    <Button onClick={handleAddBookmark}>Save Bookmark</Button>
                </div>
            </DialogContent>
        </Dialog>
      </div>
      <div className="p-4 grid grid-cols-1 gap-2">
        {bookmarks.map((bookmark) => (
          <a
            key={bookmark.id}
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-lg border border-border p-3 transition-all hover:bg-accent/50 hover:border-primary/50"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background border border-border/50 overflow-hidden">
                {getFaviconUrl(bookmark.url) ? (
                  <img 
                    src={getFaviconUrl(bookmark.url)!} 
                    alt="" 
                    className="h-5 w-5 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = `<svg class="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>`;
                    }}
                  />
                ) : (
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <span className="truncate font-medium text-sm">{bookmark.title}</span>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => deleteBookmark(e, bookmark.id)}
            >
                <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </a>
        ))}
        {bookmarks.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-4">
                No bookmarks yet.
            </div>
        )}
      </div>
    </div>
  );
}
