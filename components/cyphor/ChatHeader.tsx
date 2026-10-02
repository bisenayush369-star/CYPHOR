"use client";

import { Menu, ChevronDown, Share2, MoreHorizontal, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarContent } from "./Sidebar";
import { MODEL_OPTIONS } from "./data";
import type { Conversation, ModelOption } from "./types";

interface ChatHeaderProps {
  activeId: string | null;
  conversations: Conversation[];
  loading: boolean;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewChat: () => void;
  model: ModelOption;
  onModelChange: (m: ModelOption) => void;
  title: string | null;
}

export function ChatHeader({
  activeId,
  conversations,
  loading,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
  model,
  onModelChange,
  title,
}: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-1 border-b border-border bg-background/85 px-2 backdrop-blur-md sm:px-3">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 lg:hidden">
            <Menu className="h-[18px] w-[18px]" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-border p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            activeId={activeId}
            conversations={conversations}
            loading={loading}
            onSelectConversation={onSelectConversation}
            onDeleteConversation={onDeleteConversation}
            onNewChat={onNewChat}
          />
        </SheetContent>
      </Sheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 gap-1.5 rounded-full px-3 text-[13px] font-medium text-foreground hover:bg-accent"
          >
            {model.name}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {MODEL_OPTIONS.map((m) => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => onModelChange(m)}
              className="flex items-start gap-2 py-2"
            >
              <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${m.id === model.id ? "opacity-100 text-primary" : "opacity-0"}`} />
              <span className="flex flex-col">
                <span className="text-[13px] font-medium text-foreground">{m.name}</span>
                <span className="text-[12px] text-muted-foreground">{m.blurb}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {title && (
        <>
          <span className="hidden text-muted-foreground/40 sm:inline">/</span>
          <span className="hidden max-w-[240px] truncate text-[13px] text-muted-foreground sm:inline">
            {title}
          </span>
        </>
      )}

      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => toast("Link copied", { description: "Shareable link ready (demo)." })}
        >
          <Share2 className="h-[17px] w-[17px]" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toast("Rename", { description: "Not wired up yet." })}>
              Rename chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast("Exported", { description: "Would download a .md transcript." })}>
              Export transcript
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
