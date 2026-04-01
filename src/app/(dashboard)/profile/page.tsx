"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/shared/page-header";
import { AvatarUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, User, Mail, Shield, Hash, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setProfile(j.data);
          setName(j.data.name || "");
          setAvatarUrl(j.data.avatar_url || "");
        }
      })
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile() {
    if (!name.trim()) { toast.error("Name is required"); return; }

    setSaving(true);
    try {
      const payload: Record<string, string> = { name };

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Profile updated");
        // Update session name
        await updateSession({ name });
      } else {
        const j = await res.json();
        toast.error(j.error || "Failed to update");
      }
    } catch { toast.error("An error occurred"); }
    finally { setSaving(false); }
  }

  async function handleChangePassword() {
    if (!currentPassword) { toast.error("Enter your current password"); return; }
    if (!newPassword || newPassword.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });

      if (res.ok) {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const j = await res.json();
        toast.error(j.error || "Failed to change password");
      }
    } catch { toast.error("An error occurred"); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile" description="Manage your account settings" />
        <div className="max-w-2xl space-y-6">
          <div className="h-48 bg-muted animate-pulse rounded-xl" />
          <div className="h-64 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your account settings" />

      <div className="max-w-2xl space-y-6">
        {/* Account Info (read-only) */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Account Information</CardTitle>
            <CardDescription>Your account details managed by admin</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium truncate">{profile?.email as string}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <Badge variant="outline" className="mt-0.5">{profile?.role_name as string}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Company ID</p>
                  <p className="text-sm font-medium">{(profile?.company_id as string) || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="text-sm font-medium">{profile?.created_at ? new Date(profile.created_at as string).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Picture */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Profile Picture</CardTitle>
          </CardHeader>
          <CardContent>
            <AvatarUpload
              currentUrl={avatarUrl}
              uploadUrl={`/api/users/${session?.user?.id}/avatar`}
              onSuccess={(url) => { setAvatarUrl(url); toast.success("Photo updated"); }}
              onError={(msg) => toast.error(msg)}
            />
          </CardContent>
        </Card>

        {/* Edit Name */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Personal Information</CardTitle>
            <CardDescription>Update your display name</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-sm">
              <Label>Full Name</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={saving || name === (profile?.name as string)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Update Name
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Change Password</CardTitle>
            <CardDescription>Update your login password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4 max-w-sm">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
            </div>
            <Button onClick={handleChangePassword} disabled={saving || !currentPassword || !newPassword || newPassword !== confirmPassword}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
