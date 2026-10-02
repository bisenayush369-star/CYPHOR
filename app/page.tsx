"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { SidebarContent } from "@/components/cyphor/Sidebar";
import { ChatHeader } from "@/components/cyphor/ChatHeader";
import { MessageList } from "@/components/cyphor/MessageList";
import { Composer } from "@/components/cyphor/Composer";
import { MODEL_OPTIONS } from "@/components/cyphor/data";
import type { Conversation, DisplayMessage, ModelOption } from "@/components/cyphor/types";

interface ChatSessionProps {
  conversationId: string;
  initialMessages: UIMessage[];
  model: ModelOption;
  onExchangeComplete: () => void;
}

/**
 * Owns the live useChat session for one conversation. Mounted with
 * `key={conversationId}` by the parent, so switching conversations (or
 * starting a new one) is a clean remount instead of manually resetting the
 * hook's internal state.
 */
function ChatSession({ conversationId, initialMessages, model, onExchangeComplete }: ChatSessionProps) {
  const { messages, sendMessage, status, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages: currentMessages, id }) {
        return { body: { message: currentMessages[currentMessages.length - 1], id } };
      },
    }),
  });

  useEffect(() => {
    if (error) {
      toast("Couldn't reach Cyphor", {
        description: error.message || "Something went wrong. Please try again.",
      });
    }
  }, [error]);

  // Fires once per finished exchange so the parent can refresh the sidebar
  // and mark this conversation active.
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "streaming" && status === "ready") {
      onExchangeComplete();
    }
    prevStatus.current = status;
  }, [status, onExchangeComplete]);

  const displayMessages: DisplayMessage[] = messages.map((m, i) => {
    const content = m.parts
      .filter((p) => p.type === "text")
      .map((p) => ("text" in p ? p.text : ""))
      .join("");
    const isLast = i === messages.length - 1;
    return {
      id: m.id,
      role: m.role === "user" ? "user" : "assistant",
      content,
      streaming: isLast && m.role === "assistant" && status === "streaming",
    };
  });

  const send = useCallback((text: string) => sendMessage({ text }), [sendMessage]);

  return (
    <>
      <MessageList
        messages={displayMessages}
        isThinking={status === "submitted"}
        onSuggestedPrompt={send}
      />
      <Composer onSend={send} busy={status !== "ready"} modelName={model.name} />
    </>
  );
}

export default function Page() {
  const [model, setModel] = useState<ModelOption>(MODEL_OPTIONS[1]);
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      // sidebar just stays as-is; not worth a toast for a background refresh
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshConversations();
  }, [refreshConversations]);

  const handleNewChat = useCallback(() => {
    setConversationId(crypto.randomUUID());
    setInitialMessages([]);
    setActiveId(null);
  }, []);

  const handleSelectConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error("Conversation not found");
      const data = await res.json();
      setConversationId(id);
      setInitialMessages(data.messages ?? []);
      setActiveId(id);
    } catch {
      toast("Couldn't load that conversation");
    }
  }, []);

  const handleExchangeComplete = useCallback(() => {
    setActiveId(conversationId);
    refreshConversations();
  }, [conversationId, refreshConversations]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        toast("Conversation deleted");
        if (id === conversationId) {
          setConversationId(crypto.randomUUID());
          setInitialMessages([]);
          setActiveId(null);
        }
        refreshConversations();
      } catch {
        toast("Couldn't delete that conversation");
      }
    },
    [conversationId, refreshConversations]
  );

  const activeTitle = activeId
    ? conversations.find((c) => c.id === activeId)?.title ?? null
    : null;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <aside className="hidden w-[272px] shrink-0 border-r border-border lg:flex">
        <SidebarContent
          activeId={activeId}
          conversations={conversations}
          loading={loadingConversations}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onNewChat={handleNewChat}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          activeId={activeId}
          conversations={conversations}
          loading={loadingConversations}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onNewChat={handleNewChat}
          model={model}
          onModelChange={setModel}
          title={activeTitle}
        />
        <ChatSession
          key={conversationId}
          conversationId={conversationId}
          initialMessages={initialMessages}
          model={model}
          onExchangeComplete={handleExchangeComplete}
        />
      </div>

      <Sonner position="bottom-center" />
    </div>
  );
}
