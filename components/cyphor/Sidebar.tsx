"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MessageSquarePlus,
  Search,
  MessageSquareText,
  Settings,
  LogOut,
  ChevronsUpDown,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CyphorMark } from "./CyphorMark";
import { DecodeText } from "./DecodeText";
import { groupConversations } from "./group-conversations";
import type { Conversation } from "./types";

/** Click once to arm, click again within 3s to actually delete. No modal. */
function DeleteConversationButton({
  id,
  title,
  onDelete,
}: {
  id: string;
  title: string;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!confirming) {
          setConfirming(true);
          timeoutRef.current = setTimeout(() => setConfirming(false), 3000);
          return;
        }
        clearTimeout(timeoutRef.current);
        setConfirming(false);
        onDelete(id);
      }}
      onBlur={() => setConfirming(false)}
      aria-label={confirming ? `Confirm delete "${title}"` : `Delete "${title}"`}
      title={confirming ? "Click again to delete" : "Delete"}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 transition-all duration-150 focus:opacity-100 group-hover/item:opacity-100",
        confirming
          ? "bg-destructive text-destructive-foreground opacity-100 hover:bg-destructive/90"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

interface SidebarProps {
  activeId: string | null;
  conversations: Conversation[];
  loading: boolean;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewChat: () => void;
}

export function SidebarContent({
  activeId,
  conversations,
  loading,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
}: SidebarProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-2 px-4 pt-5 pb-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-md text-primary">
          <CyphorMark className="h-6 w-6" />
        </span>
        <DecodeText
          text="Cyphor"
          as="span"
          className="font-display text-[17px] font-semibold tracking-tight text-foreground"
          duration={420}
        />
      </div>

      <div className="px-3">
        <Button
          onClick={onNewChat}
          className="mb-3 w-full justify-start gap-2 rounded-lg bg-secondary text-secondary-foreground shadow-none hover:bg-secondary/80"
          variant="secondary"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </Button>

        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="h-8 border-none bg-muted/60 pl-8 text-[13px] placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <ScrollArea className="cy-scroll flex-1 px-3">
        <nav className="flex flex-col gap-4 pb-4 pt-1">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((c) => {
                  const isActive = c.id === activeId;
                  return (
                    <li key={c.id} className="group/item">
                      <div
                        className={cn(
                          "flex items-center gap-0.5 rounded-lg pr-1 transition-colors duration-150",
                          isActive ? "bg-[hsl(174_72%_42%/0.14)]" : "hover:bg-accent"
                        )}
                      >
                        <button
                          onClick={() => onSelectConversation(c.id)}
                          className={cn(
                            "flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 text-left text-[13px]",
                            isActive ? "text-foreground" : "text-muted-foreground group-hover/item:text-foreground"
                          )}
                        >
                          <MessageSquareText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="truncate">{c.title}</span>
                        </button>
                        <DeleteConversationButton id={c.id} title={c.title} onDelete={onDeleteConversation} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {!loading && filtered.length === 0 && conversations.length > 0 && (
            <p className="px-2 text-[13px] text-muted-foreground">
              No chats match &ldquo;{query}&rdquo;.
            </p>
          )}
          {!loading && conversations.length === 0 && (
            <p className="px-2 text-[13px] text-muted-foreground">
              No chats yet — send a message to start one.
            </p>
          )}
        </nav>
      </ScrollArea>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 border-t border-border px-4 py-3 text-left transition-colors hover:bg-accent">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-secondary text-[12px] text-secondary-foreground">
                U
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 overflow-hidden">
              <span className="block truncate text-[13px] font-medium text-foreground">
                Guest
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                No account connected
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuItem
            onClick={() => toast("Settings", { description: "Not wired up yet." })}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => toast("No account connected", { description: "Auth isn't wired up yet — see the README." })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
