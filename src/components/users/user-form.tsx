"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AvatarUpload, AVATAR_ACCEPT } from "@/components/shared/file-upload";

interface UserFormProps {
  initialData?: {
    id?: string;
    name: string;
    email: string;
    is_active: boolean;
    department_id: string | null;
    company_id?: string | null;
    avatar_url?: string | null;
    user_roles?: { role_id: string }[];
  };
}

interface RoleOption { id: string; name: string; level: number; }
interface DeptOption { id: string; name: string; }

export function UserForm({ initialData }: UserFormProps) {
  const router = useRouter();
  const isEditing = !!initialData?.id;

  const [name, setName] = useState(initialData?.name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(initialData?.user_roles?.[0]?.role_id || "");
  const [departmentId, setDepartmentId] = useState(initialData?.department_id || "");
  const [companyId, setCompanyId] = useState(initialData?.company_id || "");
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);
  const [avatarUrl, setAvatarUrl] = useState(initialData?.avatar_url || "");
  const [saving, setSaving] = useState(false);

  // For new user: store pending avatar file
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/roles").then((r) => r.json()),
      fetch("/api/departments").then((r) => r.json()).catch(() => null),
    ]).then(([rolesRes, deptsRes]) => {
      if (rolesRes?.data) setRoles(rolesRes.data);
      if (deptsRes?.data) setDepartments(deptsRes.data);
    });
  }, []);

  function handlePendingAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setPendingAvatar(file);
    const reader = new FileReader();
    reader.onload = () => setPendingAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roleId) { toast.error("Please select a role"); return; }
    if (!isEditing && !password) { toast.error("Password is required"); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name, email, role_id: roleId,
        department_id: departmentId || null,
        company_id: companyId || null,
        is_active: isActive,
      };
      if (password) payload.password = password;

      const url = isEditing ? `/api/users/${initialData.id}` : "/api/users";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        const userId = isEditing ? initialData.id : json.data?.id;

        // Upload pending avatar for new users
        if (!isEditing && pendingAvatar && userId) {
          const fd = new FormData();
          fd.append("file", pendingAvatar);
          await fetch(`/api/users/${userId}/avatar`, { method: "POST", body: fd }).catch(() => {});
        }

        toast.success(isEditing ? "User updated" : "User created");
        router.push("/users");
        router.refresh();
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to save user");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  }

  const avatarPreviewSrc = isEditing ? avatarUrl : (pendingAvatarPreview || undefined);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile Picture */}
      <Card>
        <CardHeader><CardTitle>Profile Picture</CardTitle></CardHeader>
        <CardContent>
          {isEditing ? (
            <AvatarUpload
              currentUrl={avatarUrl}
              uploadUrl={`/api/users/${initialData.id}/avatar`}
              onSuccess={(url) => { setAvatarUrl(url); toast.success("Profile picture updated"); }}
              onError={(msg) => toast.error(msg)}
            />
          ) : (
            <div className="flex items-center gap-4">
              <div
                className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/25 cursor-pointer group hover:border-primary/50"
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarPreviewSrc ? (
                  <img src={avatarPreviewSrc} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-muted">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <input ref={avatarInputRef} type="file" className="hidden" accept={AVATAR_ACCEPT} onChange={handlePendingAvatarSelect} />
              </div>
              <div className="space-y-1">
                <Button variant="outline" size="sm" type="button" onClick={() => avatarInputRef.current?.click()}>
                  {pendingAvatar ? "Change Photo" : "Upload Photo"}
                </Button>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP. Max 5MB.</p>
                {pendingAvatar && <p className="text-xs text-success">{pendingAvatar.name}</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>User Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="company_id">Company ID</Label>
              <Input id="company_id" value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="SL-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@smartlab.com" required />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">{isEditing ? "New Password (leave empty to keep)" : "Password"}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEditing ? "Leave empty to keep current" : "Min 6 characters"} minLength={6} required={!isEditing} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleId} onValueChange={(v) => setRoleId(v || "")} items={Object.fromEntries(roles.map(role => [role.id, `${role.name} (Level ${role.level})`]))}>
                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id} label={`${role.name} (Level ${role.level})`}>
                      {role.name} (Level {role.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Department (Optional)</Label>
              <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v === "none" ? "" : (v || ""))} items={{ none: "No Department", ...Object.fromEntries(departments.map(dept => [dept.id, dept.name])) }}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id} label={dept.name}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <span className="text-sm">{isActive ? "Active" : "Inactive"}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Update User" : "Create User"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/users")}>Cancel</Button>
      </div>
    </form>
  );
}
