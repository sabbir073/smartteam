"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, ChevronDown, Pencil, Trash2, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";

interface ServiceLine {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  service_lines: ServiceLine[];
}

export default function ServicesPage() {
  const { hasPermission } = usePermissions();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"category" | "line">("category");
  const [editId, setEditId] = useState<string | null>(null);
  const [parentCategoryId, setParentCategoryId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "category" | "line"; id: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data || []);
      }
    } catch {
      toast.error("Failed to load services");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreateCategory() {
    setDialogType("category");
    setEditId(null);
    setParentCategoryId(null);
    setFormName("");
    setFormDesc("");
    setDialogOpen(true);
  }

  function openCreateLine(categoryId: string) {
    setDialogType("line");
    setEditId(null);
    setParentCategoryId(categoryId);
    setFormName("");
    setFormDesc("");
    setDialogOpen(true);
  }

  function openEdit(type: "category" | "line", id: string, name: string, desc: string) {
    setDialogType(type);
    setEditId(id);
    setFormName(name);
    setFormDesc(desc);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);

    try {
      let url: string;
      let method: string;
      let body: Record<string, unknown>;

      if (dialogType === "category") {
        url = editId ? `/api/services/${editId}` : "/api/services";
        method = editId ? "PATCH" : "POST";
        body = { name: formName, description: formDesc };
      } else {
        url = editId ? `/api/service-lines/${editId}` : "/api/service-lines";
        method = editId ? "PATCH" : "POST";
        body = { name: formName, description: formDesc, service_category_id: parentCategoryId };
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editId ? "Updated" : "Created");
        setDialogOpen(false);
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to save");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const url = deleteTarget.type === "category"
      ? `/api/services/${deleteTarget.id}`
      : `/api/service-lines/${deleteTarget.id}`;

    try {
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted");
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to delete");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setDeleteTarget(null);
    }
  }

  if (loading) {
    return (
      <RequirePermission module="services">
      <div className="space-y-6">
        <PageHeader title="Services" description="Manage service categories and lines" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-8 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
      </RequirePermission>
    );
  }

  return (
    <RequirePermission module="services">
    <div className="space-y-6">
      <PageHeader title="Services" description="Manage service categories and their service lines">
        {hasPermission("services", "create") && (
          <Button onClick={openCreateCategory}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        )}
      </PageHeader>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Layers className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No service categories yet. Create your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <Collapsible key={cat.id} defaultOpen>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary">
                        <ChevronDown className="h-4 w-4 transition-transform [[data-state=closed]_&]:-rotate-90" />
                        <CardTitle className="text-lg">{cat.name}</CardTitle>
                      </CollapsibleTrigger>
                      <Badge variant={cat.is_active ? "default" : "secondary"}>
                        {cat.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">{cat.service_lines?.length || 0} lines</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {hasPermission("services", "create") && (
                        <Button variant="ghost" size="sm" onClick={() => openCreateLine(cat.id)}>
                          <Plus className="mr-1 h-3 w-3" /> Add Line
                        </Button>
                      )}
                      {hasPermission("services", "edit") && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit("category", cat.id, cat.name, cat.description || "")}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {hasPermission("services", "delete") && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ type: "category", id: cat.id })} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {cat.description && <p className="text-sm text-muted-foreground ml-6">{cat.description}</p>}
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {(!cat.service_lines || cat.service_lines.length === 0) ? (
                      <p className="text-sm text-muted-foreground ml-6 py-2">No service lines. Add one to get started.</p>
                    ) : (
                      <div className="ml-6 space-y-2">
                        {cat.service_lines.map((line) => (
                          <div key={line.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                            <div>
                              <p className="font-medium text-sm">{line.name}</p>
                              {line.description && <p className="text-xs text-muted-foreground">{line.description}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant={line.is_active ? "outline" : "secondary"} className="text-xs">
                                {line.is_active ? "Active" : "Inactive"}
                              </Badge>
                              {hasPermission("services", "edit") && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit("line", line.id, line.name, line.description || "")}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                              {hasPermission("services", "delete") && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ type: "line", id: line.id })}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId ? "Edit" : "Create"} {dialogType === "category" ? "Service Category" : "Service Line"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={dialogType === "category" ? "e.g., FSD" : "e.g., Frontend"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description (optional)</Label>
              <Input id="desc" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Brief description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === "category" ? "Category" : "Service Line"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "category"
                ? "This will delete the category and all its service lines. This cannot be undone."
                : "This will delete the service line. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </RequirePermission>
  );
}
