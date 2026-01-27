import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag, Plus, Edit2, Trash2 } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const Categories = () => {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#6366f1");
  const [categoryIcon, setCategoryIcon] = useState("📋");

  const handleAddCategory = async () => {
    if (!categoryName.trim()) return;
    await addCategory(categoryName, categoryColor, categoryIcon);
    toast.success("Category added");
    resetCategoryForm();
    setIsCategoryDialogOpen(false);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !categoryName.trim()) return;
    await updateCategory(editingCategory.id, categoryName, categoryColor, categoryIcon);
    toast.success("Category updated");
    resetCategoryForm();
    setIsCategoryDialogOpen(false);
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id);
    toast.success("Category deleted");
  };

  const openEditDialog = (category: any) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryColor(category.color);
    setCategoryIcon(category.icon || "📋");
    setIsCategoryDialogOpen(true);
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryColor("#6366f1");
    setCategoryIcon("📋");
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Categories</h1>
            <p className="mt-1 text-muted-foreground">Organize your notes, tasks, and links</p>
          </div>
          <Dialog open={isCategoryDialogOpen} onOpenChange={(open) => {
            setIsCategoryDialogOpen(open);
            if (!open) resetCategoryForm();
          }}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/40">
                  <Plus className="h-4 w-4" />
                </span>
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Edit Category" : "Add New Category"}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input 
                    placeholder="e.g., Work, Personal" 
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Icon (Emoji)</Label>
                    <Input 
                      placeholder="📋" 
                      value={categoryIcon}
                      onChange={(e) => setCategoryIcon(e.target.value)}
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input 
                      type="color" 
                      value={categoryColor}
                      onChange={(e) => setCategoryColor(e.target.value)}
                      className="h-10 cursor-pointer"
                    />
                  </div>
                </div>
                <Button 
                  onClick={editingCategory ? handleUpdateCategory : handleAddCategory} 
                  className="w-full"
                >
                  {editingCategory ? "Update Category" : "Add Category"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div 
              key={category.id}
              className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="text-2xl flex items-center justify-center w-12 h-12 rounded-lg"
                    style={{ backgroundColor: `${category.color}20` }}
                  >
                    {category.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{category.name}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-xs text-muted-foreground">{category.color}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => openEditDialog(category)}
                  className="flex-1"
                >
                  <Edit2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleDeleteCategory(category.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="text-center py-12">
            <Tag className="h-16 w-16 mx-auto text-muted-foreground opacity-20 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No categories yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first category to get started</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Categories;
