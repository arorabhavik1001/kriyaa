import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, FileText, Search, Trash2, Clock, RotateCcw, 
  Book, FolderOpen, File, ChevronDown, ChevronRight, 
  MoreHorizontal, Pencil, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight, GripVertical,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code
} from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactQuill from "react-quill";
import type { ReactQuillProps } from "react-quill";
import 'react-quill/dist/quill.snow.css';
import { ImageResize } from "quill-image-resize-module-ts";
import { ImageDrop } from "quill-image-drop-module";

const Quill = (ReactQuill as any).Quill;

const QUILL_SIZES = ["small", "normal", "large", "huge"] as const;

const QUILL_FONTS = [
  "sans",
  "inter",
  "arial",
  "verdana",
  "georgia",
  "times",
  "mono",
] as const;

// Register Quill modules
if (Quill) {
  const qAny = Quill as any;
  if (!qAny.__kriyaaQuillModulesRegistered) {
    qAny.__kriyaaQuillModulesRegistered = true;
    Quill.register("modules/imageResize", ImageResize);
    Quill.register("modules/imageDrop", ImageDrop);
  }

  if (!qAny.__kriyaaQuillImageFormatsRegistered) {
    qAny.__kriyaaQuillImageFormatsRegistered = true;
    const BaseImage = Quill.import("formats/image");
    class KriyaaImage extends BaseImage {
      static formats(domNode: HTMLElement) {
        const formats = (super.formats ? super.formats(domNode) : {}) as Record<string, any>;
        const width = domNode.getAttribute("width") || domNode.style.width;
        const height = domNode.getAttribute("height") || domNode.style.height;
        if (width) formats.width = width;
        if (height) formats.height = height;
        return formats;
      }

      format(name: string, value: any) {
        if (name === "width" || name === "height") {
          const cssProp = name as "width" | "height";
          if (value) {
            this.domNode.setAttribute(name, String(value));
            (this.domNode as HTMLElement).style[cssProp] = String(value);
          } else {
            this.domNode.removeAttribute(name);
            (this.domNode as HTMLElement).style[cssProp] = "";
          }
          return;
        }
        super.format(name, value);
      }
    }
    Quill.register(KriyaaImage, true);
  }

  const QuillFont = Quill.import("formats/font");
  QuillFont.whitelist = [...QUILL_FONTS];
  Quill.register(QuillFont, true);
}

const quillModules: ReactQuillProps["modules"] = {
  toolbar: [
    [{ font: [...QUILL_FONTS] }],
    [{ header: [1, 2, 3, false] }],
    [{ size: ["small", false, "large", "huge"] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    ["blockquote", "code-block"],
    ["link", "image", "video"],
    ["clean"],
  ],
  imageResize: { modules: ["Resize", "DisplaySize"] },
  imageDrop: true,
  keyboard: {
    bindings: {
      increaseFontSize: {
        key: 190,
        shortKey: true,
        shiftKey: true,
        handler: function () {
          const range = this.quill.getSelection();
          if (!range) return true;
          const fmt = this.quill.getFormat(range);
          const current = (fmt.size as string | undefined) ?? "normal";
          const idx = QUILL_SIZES.indexOf(current as any);
          const nextIdx = Math.min(QUILL_SIZES.length - 1, idx === -1 ? 1 : idx + 1);
          const next = QUILL_SIZES[nextIdx];
          this.quill.format("size", next === "normal" ? false : next);
          return false;
        },
      },
      decreaseFontSize: {
        key: 188,
        shortKey: true,
        shiftKey: true,
        handler: function () {
          const range = this.quill.getSelection();
          if (!range) return true;
          const fmt = this.quill.getFormat(range);
          const current = (fmt.size as string | undefined) ?? "normal";
          const idx = QUILL_SIZES.indexOf(current as any);
          const nextIdx = Math.max(0, idx === -1 ? 1 : idx - 1);
          const next = QUILL_SIZES[nextIdx];
          this.quill.format("size", next === "normal" ? false : next);
          return false;
        },
      },
    },
  },
};

const quillFormats: NonNullable<ReactQuillProps["formats"]> = [
  "header", "font", "size", "bold", "italic", "underline", "strike",
  "color", "background", "align", "list", "bullet", "indent",
  "blockquote", "code-block", "link", "image", "video", "width", "height",
];

function getNotePreview(html: string): string {
  if (!html) return "No content";
  if (/<img\b/i.test(html)) return "(Image)";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || "No content";
}

function getWordCount(html: string): number {
  if (!html) return 0;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Types for OneNote-style hierarchy
interface Notebook {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
}

interface Section {
  id: string;
  name: string;
  notebookId: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
}

interface Page {
  id: string;
  title: string;
  content: string;
  sectionId: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
  deletedAt?: any;
}

const NOTEBOOK_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", 
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280"
];

const STORAGE_KEYS = {
  sidebarExpanded: 'notes-sidebar-expanded',
  pagesListExpanded: 'notes-pages-list-expanded',
};

const Notes = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // Data states
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  
  // UI states - initialize from localStorage
  const [sidebarExpanded, setSidebarExpandedState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.sidebarExpanded);
    return stored !== null ? stored === 'true' : true;
  });
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [pagesListExpanded, setPagesListExpandedState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.pagesListExpanded);
    return stored !== null ? stored === 'true' : true;
  });
  const [pagesListHovered, setPagesListHovered] = useState(false);

  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverNotebookId, setDragOverNotebookId] = useState<string | null>(null);
  const [draggingPageId, setDraggingPageId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  // Wrapper functions to persist to localStorage
  const setSidebarExpanded = (value: boolean | ((prev: boolean) => boolean)) => {
    setSidebarExpandedState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      localStorage.setItem(STORAGE_KEYS.sidebarExpanded, String(newValue));
      return newValue;
    });
  };

  const setPagesListExpanded = (value: boolean | ((prev: boolean) => boolean)) => {
    setPagesListExpandedState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value;
      localStorage.setItem(STORAGE_KEYS.pagesListExpanded, String(newValue));
      return newValue;
    });
  };
  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set());
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [showBin, setShowBin] = useState(false);
  
  // Dialog states
  const [showNewNotebookDialog, setShowNewNotebookDialog] = useState(false);
  const [showNewSectionDialog, setShowNewSectionDialog] = useState(false);
  const [showNewPageDialog, setShowNewPageDialog] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [selectedColor, setSelectedColor] = useState(NOTEBOOK_COLORS[5]);
  const [dialogNotebookId, setDialogNotebookId] = useState<string | null>(null);
  
  // Rename states
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");
  
  // Editor states
  const [editorContent, setEditorContent] = useState("");
  const quillRef = useRef<ReactQuill | null>(null);
  const editorContentRef = useRef<string>("");
  const contentSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorDirtyRef = useRef(false);
  const activePageIdRef = useRef<string | null>(null);
  const pendingSaveRef = useRef<{ id: string; content: string } | null>(null);
  const domSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile states
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");

  // Slash command menu state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const slashStartRef = useRef<number | null>(null);

  const slashCommands = [
    { label: "Heading 1", icon: Heading1, action: () => applySlashCommand("header", 1) },
    { label: "Heading 2", icon: Heading2, action: () => applySlashCommand("header", 2) },
    { label: "Heading 3", icon: Heading3, action: () => applySlashCommand("header", 3) },
    { label: "Bullet List", icon: List, action: () => applySlashCommand("list", "bullet") },
    { label: "Numbered List", icon: ListOrdered, action: () => applySlashCommand("list", "ordered") },
    { label: "Quote", icon: Quote, action: () => applySlashCommand("blockquote", true) },
    { label: "Code Block", icon: Code, action: () => applySlashCommand("code-block", true) },
  ];

  const applySlashCommand = (format: string, value: any) => {
    if (!quillRef.current || slashStartRef.current === null) return;
    const quill = quillRef.current.getEditor();
    const range = quill.getSelection();
    if (!range) return;
    
    // Delete the "/" character
    quill.deleteText(slashStartRef.current, range.index - slashStartRef.current);
    quill.setSelection(slashStartRef.current, 0);
    quill.format(format, value);
    
    setShowSlashMenu(false);
    slashStartRef.current = null;
  };

  const handleSlashKey = useCallback(() => {
    if (!quillRef.current || isMobile) return;
    const quill = quillRef.current.getEditor();
    const range = quill.getSelection();
    if (!range) return;
    
    // Check if we're at the start of a line
    const text = quill.getText(0, range.index);
    const lastNewline = text.lastIndexOf('\n');
    const lineStart = lastNewline + 1;
    const textBeforeCursor = text.slice(lineStart, range.index);
    
    if (textBeforeCursor === "/") {
      slashStartRef.current = lineStart;
      
      // Get position for menu
      const bounds = quill.getBounds(range.index);
      setSlashMenuPosition({
        top: bounds.top + bounds.height + 8,
        left: bounds.left,
      });
      setSlashMenuIndex(0);
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
      slashStartRef.current = null;
    }
  }, [isMobile]);

  useEffect(() => {
    editorContentRef.current = editorContent;
  }, [editorContent]);

  // Subscribe to notebooks
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notebooks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Notebook));
      data.sort((a, b) => a.name.localeCompare(b.name));
      setNotebooks(data);
      // Auto-expand all notebooks on first load
      if (data.length > 0 && expandedNotebooks.size === 0) {
        setExpandedNotebooks(new Set(data.map(n => n.id)));
      }
    }, (error) => {
      console.error("Error fetching notebooks:", error);
      toast.error("Failed to load notebooks");
    });
    return () => unsubscribe();
  }, [user]);

  // Subscribe to sections
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "sections"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Section));
      data.sort((a, b) => a.name.localeCompare(b.name));
      setSections(data);
    }, (error) => {
      console.error("Error fetching sections:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Subscribe to pages
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "pages"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Page));
      data.sort((a, b) => {
        const aTime = a.updatedAt?.toDate?.() || new Date(a.updatedAt);
        const bTime = b.updatedAt?.toDate?.() || new Date(b.updatedAt);
        return bTime.getTime() - aTime.getTime();
      });
      setPages(data);
    }, (error) => {
      console.error("Error fetching pages:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // Derived states
  const selectedPage = useMemo(() => pages.find(p => p.id === selectedPageId) || null, [pages, selectedPageId]);
  const selectedSection = useMemo(() => sections.find(s => s.id === selectedSectionId) || null, [sections, selectedSectionId]);
  const selectedNotebook = useMemo(() => notebooks.find(n => n.id === selectedNotebookId) || null, [notebooks, selectedNotebookId]);

  const visiblePages = useMemo(() => {
    let filtered = pages.filter(p => showBin ? !!p.deletedAt : !p.deletedAt);
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else if (selectedSectionId && !showBin) {
      filtered = filtered.filter(p => p.sectionId === selectedSectionId);
    }
    return filtered;
  }, [pages, showBin, searchQuery, selectedSectionId]);

  // Global search results - searches across notebooks, sections, and pages
  const globalSearchResults = useMemo(() => {
    if (!globalSearchQuery.trim()) return null;
    
    const query = globalSearchQuery.toLowerCase();
    
    const matchedNotebooks = notebooks.filter(n => 
      n.name.toLowerCase().includes(query)
    );
    
    const matchedSections = sections.filter(s => 
      s.name.toLowerCase().includes(query)
    );
    
    const matchedPages = pages.filter(p => 
      !p.deletedAt && (
        p.title.toLowerCase().includes(query) ||
        p.content.toLowerCase().includes(query)
      )
    );
    
    const hasResults = matchedNotebooks.length > 0 || matchedSections.length > 0 || matchedPages.length > 0;
    
    return hasResults ? { notebooks: matchedNotebooks, sections: matchedSections, pages: matchedPages } : null;
  }, [globalSearchQuery, notebooks, sections, pages]);

  // Sync editor content with selected page
  useEffect(() => {
    const hasPageChanged = activePageIdRef.current !== selectedPageId;
    if (hasPageChanged) {
      activePageIdRef.current = selectedPageId;
      editorDirtyRef.current = false;
      pendingSaveRef.current = null;
      if (contentSaveTimerRef.current) {
        clearTimeout(contentSaveTimerRef.current);
        contentSaveTimerRef.current = null;
      }
    }

    if (!selectedPage) {
      setEditorContent("");
      return;
    }

    if (!editorDirtyRef.current || hasPageChanged) {
      setEditorContent(selectedPage.content || "");
    }
  }, [selectedPageId, selectedPage?.content]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (contentSaveTimerRef.current) clearTimeout(contentSaveTimerRef.current);
      if (domSyncTimerRef.current) clearTimeout(domSyncTimerRef.current);
    };
  }, []);

  // CRUD Operations
  const createNotebook = async (name: string, color: string) => {
    if (!user || !name.trim()) return;
    try {
      const docRef = await addDoc(collection(db, "notebooks"), {
        name: name.trim(),
        color,
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setExpandedNotebooks(prev => new Set([...prev, docRef.id]));
      toast.success("Notebook created");
    } catch (error) {
      console.error("Error creating notebook:", error);
      toast.error("Failed to create notebook");
    }
  };

  const createSection = async (name: string, notebookId: string) => {
    if (!user || !name.trim() || !notebookId) return;
    try {
      const docRef = await addDoc(collection(db, "sections"), {
        name: name.trim(),
        notebookId,
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setSelectedSectionId(docRef.id);
      setSelectedNotebookId(notebookId);
      toast.success("Section created");
    } catch (error) {
      console.error("Error creating section:", error);
      toast.error("Failed to create section");
    }
  };

  const createPage = async (title: string, sectionId: string) => {
    if (!user || !title.trim() || !sectionId) return;
    try {
      const docRef = await addDoc(collection(db, "pages"), {
        title: title.trim(),
        content: "",
        sectionId,
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setSelectedPageId(docRef.id);
      if (isMobile) setMobileView("editor");
      toast.success("Page created");
    } catch (error) {
      console.error("Error creating page:", error);
      toast.error("Failed to create page");
    }
  };

  const updatePage = async (id: string, data: Partial<Page>) => {
    try {
      await updateDoc(doc(db, "pages", id), {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error updating page:", error);
    }
  };

  const scheduleContentSave = useCallback((id: string, content: string) => {
    editorDirtyRef.current = true;
    pendingSaveRef.current = { id, content };
    if (contentSaveTimerRef.current) clearTimeout(contentSaveTimerRef.current);
    contentSaveTimerRef.current = setTimeout(async () => {
      contentSaveTimerRef.current = null;
      const pending = pendingSaveRef.current;
      if (!pending || pending.id !== id) return;
      await updatePage(pending.id, { content: pending.content });
      editorDirtyRef.current = false;
      pendingSaveRef.current = null;
    }, 600);
  }, []);

  const deletePage = async (id: string) => {
    try {
      await updateDoc(doc(db, "pages", id), { deletedAt: new Date() });
      if (selectedPageId === id) setSelectedPageId(null);
      toast("Page deleted", {
        action: {
          label: "Undo",
          onClick: () => restorePage(id),
        },
      });
    } catch (error) {
      console.error("Error deleting page:", error);
    }
  };

  const restorePage = async (id: string) => {
    try {
      await updateDoc(doc(db, "pages", id), { deletedAt: null });
      toast.success("Page restored");
    } catch (error) {
      console.error("Error restoring page:", error);
    }
  };

  const deletePageForever = async (id: string) => {
    try {
      await deleteDoc(doc(db, "pages", id));
      if (selectedPageId === id) setSelectedPageId(null);
    } catch (error) {
      console.error("Error deleting page:", error);
    }
  };

  const renameItem = async (type: "notebook" | "section" | "page", id: string, name: string) => {
    if (!name.trim()) return;
    try {
      const collectionName = type === "notebook" ? "notebooks" : type === "section" ? "sections" : "pages";
      const fieldName = type === "page" ? "title" : "name";
      await updateDoc(doc(db, collectionName, id), {
        [fieldName]: name.trim(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error(`Error renaming ${type}:`, error);
    }
  };

  const deleteNotebook = async (id: string) => {
    try {
      // Delete all sections and pages in this notebook
      const notebookSections = sections.filter(s => s.notebookId === id);
      for (const section of notebookSections) {
        const sectionPages = pages.filter(p => p.sectionId === section.id);
        for (const page of sectionPages) {
          await deleteDoc(doc(db, "pages", page.id));
        }
        await deleteDoc(doc(db, "sections", section.id));
      }
      await deleteDoc(doc(db, "notebooks", id));
      if (selectedNotebookId === id) {
        setSelectedNotebookId(null);
        setSelectedSectionId(null);
        setSelectedPageId(null);
      }
      toast.success("Notebook deleted");
    } catch (error) {
      console.error("Error deleting notebook:", error);
    }
  };

  const deleteSection = async (id: string) => {
    try {
      const sectionPages = pages.filter(p => p.sectionId === id);
      for (const page of sectionPages) {
        await deleteDoc(doc(db, "pages", page.id));
      }
      await deleteDoc(doc(db, "sections", id));
      if (selectedSectionId === id) {
        setSelectedSectionId(null);
        setSelectedPageId(null);
      }
      toast.success("Section deleted");
    } catch (error) {
      console.error("Error deleting section:", error);
    }
  };

  const toggleNotebook = (id: string) => {
    setExpandedNotebooks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moveSectionToNotebook = async (sectionId: string, targetNotebookId: string) => {
    try {
      await updateDoc(doc(db, "sections", sectionId), {
        notebookId: targetNotebookId,
        updatedAt: new Date(),
      });
      if (selectedSectionId === sectionId) {
        setSelectedNotebookId(targetNotebookId);
      }
      setExpandedNotebooks(prev => {
        const next = new Set(prev);
        next.add(targetNotebookId);
        return next;
      });
      toast.success("Section moved");
    } catch (error) {
      console.error("Error moving section:", error);
      toast.error("Failed to move section");
    }
  };

  const movePageToSection = async (pageId: string, targetSectionId: string) => {
    try {
      await updateDoc(doc(db, "pages", pageId), {
        sectionId: targetSectionId,
        updatedAt: new Date(),
      });
      toast.success("Page moved");
    } catch (error) {
      console.error("Error moving page:", error);
      toast.error("Failed to move page");
    }
  };

  const handleSectionDragStart = (sectionId: string, fromNotebookId: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/x-kriyaa-section",
      JSON.stringify({ sectionId, fromNotebookId })
    );
    setDraggingSectionId(sectionId);
  };

  const handleSectionDragEnd = () => {
    setDraggingSectionId(null);
    setDragOverNotebookId(null);
  };

  const handlePageDragStart = (pageId: string, fromSectionId: string) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/x-kriyaa-page",
      JSON.stringify({ pageId, fromSectionId })
    );
    setDraggingPageId(pageId);
  };

  const handlePageDragEnd = () => {
    setDraggingPageId(null);
    setDragOverSectionId(null);
  };

  const handleNotebookDragOver = (notebookId: string) => (e: React.DragEvent) => {
    // Allow drop
    e.preventDefault();
    setDragOverNotebookId(notebookId);
  };

  const handleNotebookDrop = (targetNotebookId: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverNotebookId(null);
    setDraggingSectionId(null);

    const raw =
      e.dataTransfer.getData("application/x-kriyaa-section") ||
      e.dataTransfer.getData("text/plain");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { sectionId?: string; fromNotebookId?: string };
      if (!parsed.sectionId) return;
      if (parsed.fromNotebookId === targetNotebookId) return;
      await moveSectionToNotebook(parsed.sectionId, targetNotebookId);
    } catch {
      // Ignore drops that aren't our payload
    }
  };

  const handleSectionDragOverForPage = (sectionId: string) => (e: React.DragEvent) => {
    // Allow dropping pages onto sections
    e.preventDefault();
    setDragOverSectionId(sectionId);
  };

  const handleSectionDragLeaveForPage = (sectionId: string) => () => {
    setDragOverSectionId(prev => (prev === sectionId ? null : prev));
  };

  const handleSectionDropForPage = (targetSectionId: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSectionId(null);
    setDraggingPageId(null);

    const raw =
      e.dataTransfer.getData("application/x-kriyaa-page") ||
      e.dataTransfer.getData("text/plain");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { pageId?: string; fromSectionId?: string };
      if (!parsed.pageId) return;
      if (parsed.fromSectionId === targetSectionId) return;
      await movePageToSection(parsed.pageId, targetSectionId);
    } catch {
      // Ignore drops that aren't our payload
    }
  };

  const selectSection = (sectionId: string, notebookId: string) => {
    setSelectedSectionId(sectionId);
    setSelectedNotebookId(notebookId);
    setSelectedPageId(null);
    setShowBin(false);
    setSearchQuery("");
  };

  const selectPage = (pageId: string) => {
    setSelectedPageId(pageId);
    if (isMobile) setMobileView("editor");
  };

  const isSidebarPinnedOpen = sidebarExpanded;
  const isSidebarTemporarilyOpen = !sidebarExpanded && sidebarHovered;
  const shouldShowExpanded = isSidebarPinnedOpen || isSidebarTemporarilyOpen;

  const isPagesPinnedOpen = pagesListExpanded;
  const isPagesTemporarilyOpen = !pagesListExpanded && pagesListHovered;
  const shouldShowPagesList = isPagesPinnedOpen || isPagesTemporarilyOpen;

  // Render notebook tree item
  const renderNotebook = (notebook: Notebook) => {
    const isExpanded = expandedNotebooks.has(notebook.id);
    const notebookSections = sections.filter(s => s.notebookId === notebook.id);
    const isNotebookSelected = selectedNotebookId === notebook.id && !selectedSectionId;

    return (
      <div
        key={notebook.id}
        className={cn(
          "group",
          dragOverNotebookId === notebook.id && "rounded-md outline outline-2 outline-primary/30"
        )}
        onDragOver={handleNotebookDragOver(notebook.id)}
        onDrop={handleNotebookDrop(notebook.id)}
      >
        <div 
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-opacity",
            isNotebookSelected ? "ring-1 ring-primary/20" : "hover:opacity-90"
          )}
          style={{ backgroundColor: hexToRgba(notebook.color, isNotebookSelected ? 0.18 : 0.10) }}
        >
          <button
            onClick={() => toggleNotebook(notebook.id)}
            className="p-0.5 hover:bg-accent rounded shrink-0"
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <div 
            className="flex items-center gap-2 flex-1 min-w-0"
            onClick={() => {
              setSelectedNotebookId(notebook.id);
              setSelectedSectionId(null);
              if (!isExpanded) toggleNotebook(notebook.id);
            }}
          >
            <Book className="h-4 w-4 shrink-0" style={{ color: notebook.color }} />
            {shouldShowExpanded && (
              renamingId === notebook.id ? (
                <Input
                  autoFocus
                  value={renamingName}
                  onChange={(e) => setRenamingName(e.target.value)}
                  onBlur={() => { renameItem("notebook", notebook.id, renamingName); setRenamingId(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { renameItem("notebook", notebook.id, renamingName); setRenamingId(null); }
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="h-6 text-sm py-0"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate text-sm font-medium">{notebook.name}</span>
              )
            )}
          </div>
          {shouldShowExpanded && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDialogNotebookId(notebook.id);
                      setNewItemName("");
                      setShowNewSectionDialog(true);
                      if (!expandedNotebooks.has(notebook.id)) toggleNotebook(notebook.id);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Section</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setRenamingId(notebook.id); setRenamingName(notebook.name); }}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => deleteNotebook(notebook.id)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Sections */}
        {isExpanded && shouldShowExpanded && (
          <div className="ml-4 mt-1 space-y-0.5">
            {notebookSections.map((section) => (
              <div
                key={section.id}
                className={cn(
                  "group/section flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                  selectedSectionId === section.id ? "bg-primary/10 text-primary" : "hover:bg-accent/50",
                  dragOverSectionId === section.id && "bg-primary/10 ring-1 ring-primary/20"
                )}
                onClick={() => selectSection(section.id, notebook.id)}
                draggable
                onDragStart={handleSectionDragStart(section.id, notebook.id)}
                onDragEnd={handleSectionDragEnd}
                onDragOver={handleSectionDragOverForPage(section.id)}
                onDragLeave={handleSectionDragLeaveForPage(section.id)}
                onDrop={handleSectionDropForPage(section.id)}
                style={{ opacity: draggingSectionId === section.id ? 0.6 : 1 }}
                title="Drag section to another notebook. Drop pages here to move to this section."
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/section:opacity-100 shrink-0" />
                <FolderOpen className="h-4 w-4 shrink-0" style={{ color: notebook.color }} />
                {renamingId === section.id ? (
                  <Input
                    autoFocus
                    value={renamingName}
                    onChange={(e) => setRenamingName(e.target.value)}
                    onBlur={() => { renameItem("section", section.id, renamingName); setRenamingId(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { renameItem("section", section.id, renamingName); setRenamingId(null); }
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="h-6 text-sm py-0 flex-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate text-sm flex-1">{section.name}</span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover/section:opacity-100 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setRenamingId(section.id); setRenamingName(section.name); }}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => deleteSection(section.id)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            {notebookSections.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1 italic">No sections yet</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Desktop Layout
  if (!isMobile) {
    return (
      <DashboardLayout>
        <TooltipProvider>
          <div className="flex h-[calc(100vh-2rem)] gap-0 animate-fade-in">
            {/* Sidebar */}
            <div
              className={cn(
                "flex flex-col border-r border-border bg-card/50 transition-all duration-300 ease-in-out shrink-0",
                shouldShowExpanded ? "w-64" : "w-12"
              )}
              onMouseEnter={() => !sidebarExpanded && setSidebarHovered(true)}
              onMouseLeave={() => setSidebarHovered(false)}
            >
              {/* Sidebar Header */}
              <div className={cn(
                "flex flex-col border-b border-border p-2 gap-2",
                shouldShowExpanded ? "" : "items-center"
              )}>
                {shouldShowExpanded ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-sm">Notebooks</h2>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setShowNewNotebookDialog(true)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>New Notebook</TooltipContent>
                        </Tooltip>
                        {isSidebarPinnedOpen ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setSidebarExpanded(false)}
                              >
                                <PanelLeftClose className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Collapse Panel</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setSidebarExpanded(true)}
                              >
                                <PanelLeft className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Pin Panel Open</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    {/* Global Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search all notes..."
                        value={globalSearchQuery}
                        onChange={(e) => setGlobalSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setSidebarExpanded(true)}
                      >
                        <PanelLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Expand Notebooks</TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Notebooks Tree / Global Search Results */}
              <ScrollArea className="flex-1 p-2">
                {shouldShowExpanded ? (
                  globalSearchQuery.trim() ? (
                    // Global search results
                    <div className="space-y-4">
                      {globalSearchResults ? (
                        <>
                          {/* Notebooks section */}
                          {globalSearchResults.notebooks.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                                Notebooks ({globalSearchResults.notebooks.length})
                              </h4>
                              <div className="space-y-1">
                                {globalSearchResults.notebooks.map((notebook) => (
                                    <div
                                      key={notebook.id}
                                      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:opacity-90"
                                      style={{ backgroundColor: hexToRgba(notebook.color, 0.10) }}
                                    onClick={() => {
                                      setSelectedNotebookId(notebook.id);
                                      setGlobalSearchQuery("");
                                      if (!expandedNotebooks.has(notebook.id)) toggleNotebook(notebook.id);
                                    }}
                                  >
                                    <Book className="h-4 w-4 shrink-0" style={{ color: notebook.color }} />
                                    <span className="truncate text-sm">{notebook.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Sections section */}
                          {globalSearchResults.sections.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                                Sections ({globalSearchResults.sections.length})
                              </h4>
                              <div className="space-y-1">
                                {globalSearchResults.sections.map((section) => {
                                  const parentNotebook = notebooks.find(n => n.id === section.notebookId);
                                  return (
                                    <div
                                      key={section.id}
                                      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50"
                                      onClick={() => {
                                        selectSection(section.id, section.notebookId);
                                        setGlobalSearchQuery("");
                                      }}
                                    >
                                      <FolderOpen className="h-4 w-4 shrink-0" style={{ color: parentNotebook?.color }} />
                                      <div className="min-w-0 flex-1">
                                        <span className="truncate text-sm block">{section.name}</span>
                                        {parentNotebook && (
                                          <span className="text-xs text-muted-foreground truncate block">{parentNotebook.name}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Pages section */}
                          {globalSearchResults.pages.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                                Pages ({globalSearchResults.pages.length})
                              </h4>
                              <div className="space-y-1">
                                {globalSearchResults.pages.map((page) => {
                                  const parentSection = sections.find(s => s.id === page.sectionId);
                                  const parentNotebook = parentSection ? notebooks.find(n => n.id === parentSection.notebookId) : null;
                                  return (
                                    <div
                                      key={page.id}
                                      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50"
                                      onClick={() => {
                                        if (parentSection) {
                                          selectSection(parentSection.id, parentSection.notebookId);
                                        }
                                        selectPage(page.id);
                                        setGlobalSearchQuery("");
                                      }}
                                    >
                                      <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      <div className="min-w-0 flex-1">
                                        <span className="truncate text-sm block">{page.title}</span>
                                        <span className="text-xs text-muted-foreground truncate block">
                                          {parentNotebook?.name}{parentSection ? ` / ${parentSection.name}` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm text-muted-foreground">No results found</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Normal notebook tree
                    <div className="space-y-1">
                      {notebooks.map(renderNotebook)}
                      {notebooks.length === 0 && (
                        <div className="text-center py-8">
                          <Book className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm text-muted-foreground">No notebooks yet</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => setShowNewNotebookDialog(true)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Create Notebook
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-1">
                    {notebooks.map((notebook) => (
                      <Tooltip key={notebook.id}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={selectedNotebookId === notebook.id ? "secondary" : "ghost"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedNotebookId(notebook.id);
                              setSidebarExpanded(true);
                              if (!expandedNotebooks.has(notebook.id)) toggleNotebook(notebook.id);
                            }}
                          >
                            <Book className="h-4 w-4" style={{ color: notebook.color }} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">{notebook.name}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Sidebar Footer */}
              {shouldShowExpanded && (
                <div className="border-t border-border p-2">
                  <Button
                    variant={showBin ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      setShowBin(!showBin);
                      setSelectedSectionId(null);
                      setSelectedPageId(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Bin
                  </Button>
                </div>
              )}
            </div>

            {/* Pages List */}
            <div 
              className={cn(
                "flex flex-col border-r border-border bg-background shrink-0 transition-all duration-300 ease-in-out",
                shouldShowPagesList ? "w-72" : "w-12"
              )}
              onMouseEnter={() => !pagesListExpanded && setPagesListHovered(true)}
              onMouseLeave={() => setPagesListHovered(false)}
            >
              <div className={cn(
                "border-b border-border",
                shouldShowPagesList ? "p-3 space-y-2" : "p-2"
              )}>
                {shouldShowPagesList ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm truncate">
                        {showBin ? "Bin" : selectedSection?.name || "Select a section"}
                      </h3>
                      <div className="flex items-center gap-1">
                        {selectedSectionId && !showBin && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => {
                                  setNewItemName("");
                                  setShowNewPageDialog(true);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>New Page</TooltipContent>
                          </Tooltip>
                        )}
                        {isPagesPinnedOpen ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setPagesListExpanded(false)}
                              >
                                <PanelRightClose className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Collapse Panel</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setPagesListExpanded(true)}
                              >
                                <PanelRight className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Pin Panel Open</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search pages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPagesListExpanded(true)}
                      >
                        <PanelRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Expand Pages</TooltipContent>
                  </Tooltip>
                )}
              </div>
              
              <ScrollArea className="flex-1">
                {shouldShowPagesList ? (
                  <div className="p-2 space-y-1">
                    {visiblePages.map((page) => (
                      <div
                        key={page.id}
                        onClick={() => !showBin && selectPage(page.id)}
                        className={cn(
                          "p-2.5 rounded-md cursor-pointer transition-colors group",
                          !showBin && "cursor-grab active:cursor-grabbing",
                          draggingPageId === page.id && "opacity-60",
                          selectedPageId === page.id
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-accent border border-transparent"
                        )}
                        draggable={!showBin}
                        onDragStart={handlePageDragStart(page.id, page.sectionId)}
                        onDragEnd={handlePageDragEnd}
                        title={!showBin ? "Drag to move to another section" : undefined}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium text-sm truncate">{page.title}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {getNotePreview(page.content)}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {page.updatedAt?.toDate ? 
                                page.updatedAt.toDate().toLocaleDateString() : 
                                new Date(page.updatedAt).toLocaleDateString()
                              }
                            </p>
                          </div>
                          {showBin ? (
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={(e) => { e.stopPropagation(); restorePage(page.id); }}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive"
                                onClick={(e) => { e.stopPropagation(); deletePageForever(page.id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                              onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {visiblePages.length === 0 && (
                      <div className="text-center py-8">
                        <File className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm text-muted-foreground">
                          {showBin ? "No deleted pages" : searchQuery ? "No pages found" : "No pages yet"}
                        </p>
                        {selectedSectionId && !showBin && !searchQuery && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => setShowNewPageDialog(true)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Create Page
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {visiblePages.map((page) => (
                      <Tooltip key={page.id}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={selectedPageId === page.id ? "secondary" : "ghost"}
                            size="icon"
                            className={cn(
                              "h-8 w-8",
                              !showBin && "cursor-grab active:cursor-grabbing",
                              draggingPageId === page.id && "opacity-60"
                            )}
                            onClick={() => !showBin && selectPage(page.id)}
                            draggable={!showBin}
                            onDragStart={handlePageDragStart(page.id, page.sectionId)}
                            onDragEnd={handlePageDragEnd}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">{page.title}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Editor */}
            <div className="flex-1 flex flex-col bg-background min-w-0">
              {selectedPage && !showBin ? (
                <>
                  <div className="flex items-center gap-3 p-3 border-b border-border bg-muted/30">
                    <Input
                      value={selectedPage.title}
                      onChange={(e) => updatePage(selectedPage.id, { title: e.target.value })}
                      className="border-none bg-transparent text-lg font-semibold focus-visible:ring-0 px-0 h-auto"
                      placeholder="Page title..."
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-1 bg-background px-2 py-1 rounded">
                        <Clock className="h-3 w-3" />
                        {selectedPage.updatedAt?.toDate ? 
                          selectedPage.updatedAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
                          new Date(selectedPage.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                        }
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deletePage(selectedPage.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto kriyaa-quill-editor relative">
                    <ReactQuill
                      key={selectedPage.id}
                      theme="snow"
                      ref={quillRef as any}
                      value={editorContent}
                      onChange={(content) => {
                        setEditorContent(content);
                        scheduleContentSave(selectedPage.id, content);
                        handleSlashKey();
                      }}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (showSlashMenu) {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setSlashMenuIndex((prev) => (prev + 1) % slashCommands.length);
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setSlashMenuIndex((prev) => (prev - 1 + slashCommands.length) % slashCommands.length);
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            slashCommands[slashMenuIndex].action();
                          } else if (e.key === "Escape" || e.key === "Backspace") {
                            setShowSlashMenu(false);
                            slashStartRef.current = null;
                          }
                        }
                      }}
                      modules={quillModules}
                      formats={quillFormats}
                      className="h-full"
                      placeholder="Start writing... (Type / for commands)"
                    />
                    
                    {/* Slash Command Menu */}
                    {showSlashMenu && (
                      <div
                        className="absolute z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
                        style={{ top: slashMenuPosition.top, left: slashMenuPosition.left }}
                      >
                        <p className="px-3 py-1 text-xs text-muted-foreground font-medium">Format</p>
                        {slashCommands.map((cmd, idx) => (
                          <button
                            key={cmd.label}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                              idx === slashMenuIndex && "bg-accent"
                            )}
                            onClick={() => cmd.action()}
                            onMouseEnter={() => setSlashMenuIndex(idx)}
                          >
                            <cmd.icon className="h-4 w-4 text-muted-foreground" />
                            {cmd.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-border px-4 py-1 bg-muted/10 text-[11px] text-muted-foreground">
                    <span>{getWordCount(editorContent)} words</span>
                    <span className="opacity-60">⌘+Shift+&gt; / &lt; to resize text</span>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                  <FileText className="mb-4 h-16 w-16 opacity-10" />
                  <p className="text-lg font-medium">
                    {showBin ? "Select a page to preview" : "Select a page to start editing"}
                  </p>
                  <p className="text-sm mt-1">
                    {!selectedSectionId && !showBin && "Choose a section from the sidebar first"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Dialogs */}
          <Dialog open={showNewNotebookDialog} onOpenChange={setShowNewNotebookDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Notebook</DialogTitle>
                <DialogDescription>
                  Notebooks contain sections, which contain pages.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Notebook name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newItemName.trim()) {
                      createNotebook(newItemName, selectedColor);
                      setNewItemName("");
                      setShowNewNotebookDialog(false);
                    }
                  }}
                  autoFocus
                />
                <div>
                  <label className="text-sm font-medium mb-2 block">Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {NOTEBOOK_COLORS.map((color) => (
                      <button
                        key={color}
                        className={cn(
                          "w-8 h-8 rounded-full transition-all",
                          selectedColor === color ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setSelectedColor(color)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowNewNotebookDialog(false); setNewItemName(""); }}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    createNotebook(newItemName, selectedColor);
                    setNewItemName("");
                    setShowNewNotebookDialog(false);
                  }}
                  disabled={!newItemName.trim()}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showNewSectionDialog} onOpenChange={setShowNewSectionDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Section</DialogTitle>
                <DialogDescription>
                  Sections organize your pages within a notebook.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Section name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newItemName.trim() && dialogNotebookId) {
                    createSection(newItemName, dialogNotebookId);
                    setNewItemName("");
                    setShowNewSectionDialog(false);
                  }
                }}
                autoFocus
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowNewSectionDialog(false); setNewItemName(""); }}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (dialogNotebookId) {
                      createSection(newItemName, dialogNotebookId);
                      setNewItemName("");
                      setShowNewSectionDialog(false);
                    }
                  }}
                  disabled={!newItemName.trim()}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showNewPageDialog} onOpenChange={setShowNewPageDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Page</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Page title"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newItemName.trim() && selectedSectionId) {
                    createPage(newItemName, selectedSectionId);
                    setNewItemName("");
                    setShowNewPageDialog(false);
                  }
                }}
                autoFocus
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowNewPageDialog(false); setNewItemName(""); }}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedSectionId) {
                      createPage(newItemName, selectedSectionId);
                      setNewItemName("");
                      setShowNewPageDialog(false);
                    }
                  }}
                  disabled={!newItemName.trim()}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TooltipProvider>
      </DashboardLayout>
    );
  }

  // Mobile Layout
  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-2rem)] animate-fade-in flex flex-col">
        {mobileView === "list" ? (
          <>
            {/* Mobile Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h1 className="text-xl font-semibold">Notes</h1>
              <div className="flex gap-2">
                <Button
                  variant={showBin ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowBin(!showBin)}
                  className="text-xs"
                >
                  Bin
                </Button>
                <Button
                  size="icon"
                  onClick={() => setShowNewNotebookDialog(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Global Search */}
            <div className="p-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search all notes..."
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-4">
              {showBin ? (
                // Bin view
                <div className="space-y-2 pb-4">
                  {visiblePages.map((page) => (
                    <div key={page.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{page.title}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-2">{getNotePreview(page.content)}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => restorePage(page.id)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePageForever(page.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {visiblePages.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No deleted pages</p>
                  )}
                </div>
              ) : globalSearchQuery.trim() ? (
                // Global search results
                <div className="space-y-4 pb-4">
                  {globalSearchResults ? (
                    <>
                      {/* Notebooks */}
                      {globalSearchResults.notebooks.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notebooks</h4>
                          <div className="space-y-1">
                            {globalSearchResults.notebooks.map((notebook) => (
                              <div
                                key={notebook.id}
                                className="flex items-center gap-2 p-3 rounded-lg border bg-card cursor-pointer"
                                onClick={() => {
                                  setSelectedNotebookId(notebook.id);
                                  setGlobalSearchQuery("");
                                  if (!expandedNotebooks.has(notebook.id)) toggleNotebook(notebook.id);
                                }}
                              >
                                <Book className="h-5 w-5" style={{ color: notebook.color }} />
                                <span className="font-medium">{notebook.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Sections */}
                      {globalSearchResults.sections.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Sections</h4>
                          <div className="space-y-1">
                            {globalSearchResults.sections.map((section) => {
                              const parentNotebook = notebooks.find(n => n.id === section.notebookId);
                              return (
                                <div
                                  key={section.id}
                                  className="flex items-center gap-2 p-3 rounded-lg border bg-card cursor-pointer"
                                  onClick={() => {
                                    selectSection(section.id, section.notebookId);
                                    setGlobalSearchQuery("");
                                  }}
                                >
                                  <FolderOpen className="h-5 w-5" style={{ color: parentNotebook?.color }} />
                                  <div>
                                    <span className="font-medium block">{section.name}</span>
                                    {parentNotebook && <span className="text-xs text-muted-foreground">{parentNotebook.name}</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {/* Pages */}
                      {globalSearchResults.pages.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pages</h4>
                          <div className="space-y-1">
                            {globalSearchResults.pages.map((page) => {
                              const parentSection = sections.find(s => s.id === page.sectionId);
                              const parentNotebook = parentSection ? notebooks.find(n => n.id === parentSection.notebookId) : null;
                              return (
                                <div
                                  key={page.id}
                                  className="p-3 rounded-lg border bg-card cursor-pointer"
                                  onClick={() => {
                                    if (parentSection) selectSection(parentSection.id, parentSection.notebookId);
                                    selectPage(page.id);
                                    setGlobalSearchQuery("");
                                  }}
                                >
                                  <h4 className="font-medium">{page.title}</h4>
                                  <p className="text-sm text-muted-foreground line-clamp-2">{getNotePreview(page.content)}</p>
                                  <span className="text-xs text-muted-foreground">
                                    {parentNotebook?.name}{parentSection ? ` / ${parentSection.name}` : ''}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p className="text-muted-foreground">No results found</p>
                    </div>
                  )}
                </div>
              ) : (
                // Notebook tree
                <div className="space-y-4 pb-4">
                  {notebooks.map((notebook) => {
                    const notebookSections = sections.filter(s => s.notebookId === notebook.id);
                    const isExpanded = expandedNotebooks.has(notebook.id);
                    
                    return (
                      <div key={notebook.id} className="rounded-lg border bg-card overflow-hidden">
                        <div 
                          className="flex items-center gap-2 p-3 cursor-pointer"
                          onClick={() => toggleNotebook(notebook.id)}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <Book className="h-5 w-5" style={{ color: notebook.color }} />
                          <span className="font-medium flex-1">{notebook.name}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDialogNotebookId(notebook.id); setShowNewSectionDialog(true); }}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Section
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingId(notebook.id); setRenamingName(notebook.name); }}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteNotebook(notebook.id); }} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        {isExpanded && (
                          <div className="border-t">
                            {notebookSections.map((section) => {
                              const sectionPages = pages.filter(p => p.sectionId === section.id && !p.deletedAt);
                              const isSectionExpanded = selectedSectionId === section.id;
                              
                              return (
                                <div key={section.id}>
                                  <div 
                                    className={cn(
                                      "flex items-center gap-2 p-3 pl-8 cursor-pointer border-b last:border-0",
                                      isSectionExpanded && "bg-accent"
                                    )}
                                    onClick={() => {
                                      if (selectedSectionId === section.id) {
                                        setSelectedSectionId(null);
                                      } else {
                                        selectSection(section.id, notebook.id);
                                      }
                                    }}
                                  >
                                    {isSectionExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    <FolderOpen className="h-4 w-4" style={{ color: notebook.color }} />
                                    <span className="flex-1">{section.name}</span>
                                    <span className="text-xs text-muted-foreground">{sectionPages.length}</span>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <MoreHorizontal className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setSelectedSectionId(section.id);
                                          setShowNewPageDialog(true); 
                                        }}>
                                          <Plus className="mr-2 h-4 w-4" />
                                          Add Page
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenamingId(section.id); setRenamingName(section.name); }}>
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }} className="text-destructive">
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  
                                  {isSectionExpanded && (
                                    <div className="bg-muted/30">
                                      {sectionPages.map((page) => (
                                        <div
                                          key={page.id}
                                          className="flex items-center gap-2 p-2 pl-12 cursor-pointer hover:bg-accent border-b last:border-0"
                                          onClick={() => selectPage(page.id)}
                                        >
                                          <File className="h-4 w-4 text-muted-foreground" />
                                          <span className="text-sm truncate">{page.title}</span>
                                        </div>
                                      ))}
                                      {sectionPages.length === 0 && (
                                        <p className="text-sm text-muted-foreground p-2 pl-12 italic">No pages</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {notebookSections.length === 0 && (
                              <p className="text-sm text-muted-foreground p-3 pl-8 italic">No sections</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {notebooks.length === 0 && (
                    <div className="text-center py-8">
                      <Book className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-muted-foreground mb-3">No notebooks yet</p>
                      <Button onClick={() => setShowNewNotebookDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Notebook
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          // Mobile Editor
          <>
            <div className="flex items-center gap-2 p-4 border-b border-border">
              <Button variant="ghost" size="icon" onClick={() => setMobileView("list")}>
                <ChevronRight className="h-5 w-5 rotate-180" />
              </Button>
              <Input
                value={selectedPage?.title || ""}
                onChange={(e) => selectedPage && updatePage(selectedPage.id, { title: e.target.value })}
                className="border-none bg-transparent text-lg font-semibold focus-visible:ring-0 px-0"
                placeholder="Page title..."
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Search className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="end">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search in page..."
                      className="pl-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && quillRef.current) {
                          const quill = quillRef.current.getEditor();
                          const text = quill.getText();
                          const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
                          if (searchTerm) {
                            const index = text.toLowerCase().indexOf(searchTerm);
                            if (index !== -1) {
                              quill.setSelection(index, searchTerm.length);
                              toast.success(`Found "${searchTerm}"`);
                            } else {
                              toast.error("Text not found");
                            }
                          }
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Press Enter to search</p>
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => {
                  if (selectedPage) {
                    deletePage(selectedPage.id);
                    setMobileView("list");
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto kriyaa-quill-editor">
              <ReactQuill
                key={selectedPage?.id}
                theme="snow"
                ref={quillRef as any}
                value={editorContent}
                onChange={(content) => {
                  setEditorContent(content);
                  if (selectedPage) scheduleContentSave(selectedPage.id, content);
                }}
                modules={quillModules}
                formats={quillFormats}
                className="h-full"
                placeholder="Start writing..."
              />
            </div>
          </>
        )}
      </div>

      {/* Mobile Dialogs */}
      <Dialog open={showNewNotebookDialog} onOpenChange={setShowNewNotebookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Notebook</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Notebook name"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2 flex-wrap">
            {NOTEBOOK_COLORS.map((color) => (
              <button
                key={color}
                className={cn(
                  "w-8 h-8 rounded-full",
                  selectedColor === color && "ring-2 ring-offset-2 ring-primary"
                )}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewNotebookDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                createNotebook(newItemName, selectedColor);
                setNewItemName("");
                setShowNewNotebookDialog(false);
              }}
              disabled={!newItemName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewSectionDialog} onOpenChange={setShowNewSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Section</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Section name"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSectionDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (dialogNotebookId) {
                  createSection(newItemName, dialogNotebookId);
                  setNewItemName("");
                  setShowNewSectionDialog(false);
                }
              }}
              disabled={!newItemName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewPageDialog} onOpenChange={setShowNewPageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Page</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Page title"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPageDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedSectionId) {
                  createPage(newItemName, selectedSectionId);
                  setNewItemName("");
                  setShowNewPageDialog(false);
                }
              }}
              disabled={!newItemName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Notes;
