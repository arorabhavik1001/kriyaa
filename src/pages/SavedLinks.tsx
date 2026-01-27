import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ExternalLink, Trash2, Search, Link as LinkIcon, Edit2, Folder, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCategories } from "@/hooks/useCategories";

interface Bookmark {
  id: string;
  title: string;
  url: string;
  description?: string;
  category?: string;
  tags?: string[];
  userId: string;
  createdAt: any;
}

const SavedLinks = () => {
  const { user } = useAuth();
  const { categories } = useCategories();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  
  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formTags, setFormTags] = useState("");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "bookmarks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookmarksData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Bookmark));
      setBookmarks(bookmarksData);
    });
    return () => unsubscribe();
  }, [user]);

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  const handleAddBookmark = async () => {
    if (!formTitle.trim() || !formUrl.trim() || !user) return;
    
    let formattedUrl = formUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const tags = formTags.split(',').map(t => t.trim()).filter(t => t);

    await addDoc(collection(db, "bookmarks"), {
      title: formTitle,
      url: formattedUrl,
      description: formDescription,
      category: formCategory,
      tags: tags,
      userId: user.uid,
      createdAt: new Date()
    });

    toast.success("Link saved", { description: formTitle });
    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEditBookmark = async () => {
    if (!editingBookmark || !formTitle.trim() || !formUrl.trim()) return;

    let formattedUrl = formUrl;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const tags = formTags.split(',').map(t => t.trim()).filter(t => t);

    await updateDoc(doc(db, "bookmarks", editingBookmark.id), {
      title: formTitle,
      url: formattedUrl,
      description: formDescription,
      category: formCategory,
      tags: tags
    });

    toast.success("Link updated");
    resetForm();
    setIsEditDialogOpen(false);
    setEditingBookmark(null);
  };

  const openEditDialog = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setFormTitle(bookmark.title);
    setFormUrl(bookmark.url);
    setFormDescription(bookmark.description || "");
    setFormCategory(bookmark.category || "general");
    setFormTags(bookmark.tags?.join(", ") || "");
    setIsEditDialogOpen(true);
  };

  const deleteBookmark = async (id: string) => {
    await deleteDoc(doc(db, "bookmarks", id));
    toast.success("Link deleted");
  };

  const resetForm = () => {
    setFormTitle("");
    setFormUrl("");
    setFormDescription("");
    setFormCategory("general");
    setFormTags("");
  };

  const filteredBookmarks = bookmarks.filter((bookmark) => {
    const matchesSearch = 
      bookmark.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bookmark.description && bookmark.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (bookmark.tags && bookmark.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
    
    const matchesCategory = categoryFilter === "all" || bookmark.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <DashboardLayout>
      <div className="animate-fade-in max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Saved Links</h1>
          <p className="text-muted-foreground mt-1">Organize and manage your bookmarks</p>
        </div>

        {/* Filters & Actions */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search links..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Folder className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name.toLowerCase()}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm hover:shadow-md transition-shadow">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/40">
                  <Plus className="h-4 w-4" />
                </span>
                Add Link
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl">Add New Link</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title *</label>
                  <Input 
                    placeholder="e.g., Google Drive" 
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL *</label>
                  <Input 
                    placeholder="e.g., drive.google.com" 
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input 
                    placeholder="Optional description" 
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name.toLowerCase()}>
                            {cat.icon} {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tags</label>
                    <Input 
                      placeholder="tag1, tag2" 
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={handleAddBookmark} size="lg" className="mt-2">Save Link</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Bookmarks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="group rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/50"
            >
              <div className="flex items-start gap-3">
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 overflow-hidden hover:scale-105 transition-transform"
                >
                  {getFaviconUrl(bookmark.url) ? (
                    <img 
                      src={getFaviconUrl(bookmark.url)!} 
                      alt="" 
                      className="h-7 w-7 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) parent.innerHTML = `<svg class="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>`;
                      }}
                    />
                  ) : (
                    <LinkIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </a>
                <div className="flex-1 min-w-0">
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-foreground hover:text-primary transition-colors block truncate"
                  >
                    {bookmark.title}
                  </a>
                  {bookmark.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{bookmark.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {bookmark.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                        {bookmark.category}
                      </span>
                    )}
                    {bookmark.tags && bookmark.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => openEditDialog(bookmark)}
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => deleteBookmark(bookmark.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredBookmarks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <LinkIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No links found</p>
            <p className="text-sm mt-1">
              {searchQuery || categoryFilter !== "all" 
                ? "Try adjusting your filters" 
                : "Add your first link to get started"}
            </p>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl">Edit Link</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title *</label>
                <Input 
                  placeholder="e.g., Google Drive" 
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL *</label>
                <Input 
                  placeholder="e.g., drive.google.com" 
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input 
                  placeholder="Optional description" 
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name.toLowerCase()}>
                          {cat.icon} {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tags</label>
                  <Input 
                    placeholder="tag1, tag2" 
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleEditBookmark} size="lg" className="mt-2">Update Link</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default SavedLinks;
