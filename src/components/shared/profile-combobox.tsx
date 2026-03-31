"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileOption {
  id: string;
  name: string;
  profile_url: string | null;
  platform_id: string;
  platform_name: string;
}

interface ProfileComboboxProps {
  value: string;
  onChange: (profileId: string, profile: ProfileOption | null) => void;
  profiles: ProfileOption[];
  platformId?: string; // filter by platform
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ProfileCombobox({
  value,
  onChange,
  profiles,
  platformId,
  placeholder = "Search profile...",
  disabled = false,
  className,
}: ProfileComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const filteredByPlatform = useMemo(
    () => platformId ? profiles.filter((p) => p.platform_id === platformId) : profiles,
    [profiles, platformId]
  );

  const selectedProfile = useMemo(() => profiles.find((p) => p.id === value) || null, [profiles, value]);

  const updatePos = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setStyle({ position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => { window.removeEventListener("scroll", updatePos, true); window.removeEventListener("resize", updatePos); };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      const dd = document.getElementById("profile-combobox-dropdown");
      if (dd?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = search.trim()
    ? filteredByPlatform.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.platform_name.toLowerCase().includes(search.toLowerCase()))
    : filteredByPlatform;

  const handleSelect = useCallback((profile: ProfileOption) => {
    onChange(profile.id, profile);
    setSearch("");
    setOpen(false);
  }, [onChange]);

  if (selectedProfile && !open) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm", disabled && "opacity-50", className)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{selectedProfile.name}</span>
            <Badge variant="secondary" className="text-[10px] shrink-0">{selectedProfile.platform_name}</Badge>
          </div>
        </div>
        {!disabled && (
          <button type="button" onClick={() => { onChange("", null); setSearch(""); }} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input ref={inputRef} value={search} onChange={(e) => { setSearch(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); updatePos(); }} placeholder={placeholder} disabled={disabled} className="pl-8" />
      </div>
      {open && typeof document !== "undefined" && createPortal(
        <div id="profile-combobox-dropdown" style={style} className="rounded-lg border bg-popover shadow-xl max-h-60 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">No profiles found</div>
          ) : (
            filtered.map((profile) => (
              <button key={profile.id} type="button" className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                onClick={() => handleSelect(profile)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{profile.name}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{profile.platform_name}</Badge>
                  </div>
                  {profile.profile_url && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {profile.profile_url.replace(/https?:\/\/(www\.)?/, "")}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
