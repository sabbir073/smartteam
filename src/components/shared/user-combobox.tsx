"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { X, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserOption {
  id: string;
  name: string;
  email: string;
  company_id: string | null;
  avatar_url: string | null;
}

interface UserComboboxProps {
  value: string;
  onChange: (userId: string, user: UserOption | null) => void;
  users: UserOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function UserCombobox({
  value,
  onChange,
  users,
  placeholder = "Search by name or ID...",
  disabled = false,
  className,
}: UserComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const selectedUser = useMemo(() => users.find((u) => u.id === value) || null, [users, value]);

  // Position dropdown relative to input using portal
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      // Check if clicking on the portal dropdown
      const dropdown = document.getElementById("user-combobox-dropdown");
      if (dropdown?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.company_id && u.company_id.toLowerCase().includes(q))
        );
      })
    : users;

  const handleSelect = useCallback(
    (user: UserOption) => {
      onChange(user.id, user);
      setSearch("");
      setOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange("", null);
    setSearch("");
  }, [onChange]);

  // Selected state — show chip
  if (selectedUser && !open) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm",
          disabled && "opacity-50",
          className
        )}
      >
        <Avatar className="h-7 w-7">
          <AvatarImage src={selectedUser.avatar_url || undefined} />
          <AvatarFallback className="text-[9px]">
            {selectedUser.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{selectedUser.name}</span>
            {selectedUser.company_id && (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {selectedUser.company_id}
              </Badge>
            )}
          </div>
        </div>
        {!disabled && (
          <button type="button" onClick={handleClear} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // Search state
  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            updatePosition();
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-8"
        />
      </div>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id="user-combobox-dropdown"
            style={dropdownStyle}
            className="rounded-lg border bg-popover shadow-xl max-h-60 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                No users found
              </div>
            ) : (
              filtered.slice(0, 20).map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                  onClick={() => handleSelect(user)}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-[9px]">
                      {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{user.name}</span>
                      {user.company_id && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {user.company_id}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
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
