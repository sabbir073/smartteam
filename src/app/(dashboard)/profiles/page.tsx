"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { RequirePermission } from "@/components/shared/require-permission";

interface Platform { id: string; name: string; }
interface Profile {
  id: string;
  name: string;
  profile_url: string | null;
  description: string | null;
  is_active: boolean;
  platform_id: string;
  platforms: Platform | Platform[];
  created_at: string;
  [key: string]: unknown;
}

export default function ProfilesPage() {
  const { hasPermission } = usePermissions();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPlatformId, setFormPlatformId] = useState("");
  const [formProfileUrl, setFormProfileUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [profRes, platRes] = await Promise.all([
        fetch("/api/platform-profiles").then((r) => r.json()),
        fetch("/api/platforms").then((r) => r.json()),
      ]);
      setProfiles(profRes.data || []);
      setPlatforms(platRes.data || []);
    } catch { toast.error("Failed to load data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditId(null);
    setFormName("");
    setFormPlatformId(platforms[0]?.id || "");
    setFormProfileUrl("");
    setFormDescription("");
    setFormIsActive(true);
    setDialogOpen(true);
  }

  function openEdit(p: Profile) {
    setEditId(p.id);
    setFormName(p.name);
    setFormPlatformId(p.platform_id);
    setFormProfileUrl(p.profile_url || "");
    setFormDescription(p.description || "");
    setFormIsActive(p.is_active);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formPlatformId) {
      toast.error("Name and platform are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        platform_id: formPlatformId,
        name: formName,
        profile_url: formProfileUrl || null,
        description: formDescription || null,
        is_active: formIsActive,
      };

      const url = editId ? `/api/platform-profiles/${editId}` : "/api/platform-profiles";
      const method = editId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editId ? "Profile updated" : "Profile created");
        setDialogOpen(false);
        fetchData();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed");
      }
    } catch { toast.error("An error occurred"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/platform-profiles/${deleteId}`, { method: "DELETE" });
      if (res.ok) { toast.success("Profile deleted"); fetchData(); }
      else toast.error("Failed to delete");
    } catch { toast.error("An error occurred"); }
    finally { setDeleteId(null); }
  }

  async function toggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/platform-profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !isActive }),
    });
    if (res.ok) { fetchData(); toast.success(`Profile ${isActive ? "disabled" : "enabled"}`); }
    else toast.error("Failed");
  }

  const columns: Column<Profile>[] = [
    {
      key: "name", header: "Profile Name",
      render: (p) => (
        <div>
          <span className="font-medium">{p.name}</span>
          {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
        </div>
      ),
    },
    {
      key: "platform", header: "Platform",
      render: (p) => {
        const plat = Array.isArray(p.platforms) ? p.platforms[0] : p.platforms;
        return plat ? <Badge variant="outline">{plat.name}</Badge> : <span>-</span>;
      },
    },
    {
      key: "url", header: "URL",
      render: (p) => p.profile_url ? (
        <a href={p.profile_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 max-w-[200px] truncate">
          <ExternalLink className="h-3 w-3 shrink-0" />
          {p.profile_url.replace(/https?:\/\/(www\.)?/, "")}
        </a>
      ) : <span className="text-muted-foreground text-sm">-</span>,
    },
    {
      key: "status", header: "Status",
      render: (p) => (
        <Badge variant={p.is_active ? "default" : "secondary"} className="cursor-pointer" onClick={() => hasPermission("profiles", "edit") && toggleActive(p.id, p.is_active)}>
          {p.is_active ? "Active" : "Disabled"}
        </Badge>
      ),
    },
    {
      key: "actions", header: "",
      className: "w-20",
      render: (p) => (
        <div className="flex items-center gap-1">
          {hasPermission("profiles", "edit") && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {hasPermission("profiles", "delete") && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <RequirePermission module="profiles">
    <div className="space-y-6">
      <PageHeader title="Platform Profiles" description="Manage your platform profiles and accounts">
        {hasPermission("profiles", "create") && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Profile</Button>
        )}
      </PageHeader>

      <DataTable columns={columns} data={profiles} loading={loading} emptyMessage="No platform profiles yet." />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Profile" : "Add Profile"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={formPlatformId} onValueChange={(v) => setFormPlatformId(v || "")} items={Object.fromEntries(platforms.map(p => [p.id, p.name]))}>
                <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => <SelectItem key={p.id} value={p.id} label={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Profile Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., SmartLab Studio" />
            </div>
            <div className="space-y-2">
              <Label>Profile URL</Label>
              <Input value={formProfileUrl} onChange={(e) => setFormProfileUrl(e.target.value)} placeholder="https://www.fiverr.com/username" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Brief description" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
              <Label>{formIsActive ? "Active" : "Disabled"}</Label>
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

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Profile</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this platform profile.</AlertDialogDescription>
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
