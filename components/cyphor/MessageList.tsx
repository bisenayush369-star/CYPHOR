"use client";

import { useEffect, useRef } from "react";
import { Lightbulb, Bug, PenLine, Scale } from "lucide-react";
import { CyphorMark } from "./CyphorMark";
import { DecodeText } from "./DecodeText";
import { MessageBubble } from "./MessageBubble";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { SUGGESTED_PROMPTS } from "./data";
import type { DisplayMessage } from "./types";

const ICONS = [Lightbulb, Bug, PenLine, Scale];

interface MessageListProps {
  messages: DisplayMessage[];
  isThinking: boolean;
  onSuggestedPrompt: (text: string) => void;
}

export function MessageList({ messages, isThinking, onSuggestedPrompt }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastContent = messages[messages.length - 1]?.content;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking, lastContent]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(174_72%_42%/0.12)] text-primary">
              <CyphorMark className="h-7 w-7" />
            </span>
            <DecodeText
              as="h1"
              text="What are we decoding today?"
              duration={650}
              className="font-display text-[26px] font-semibold tracking-tight text-foreground sm:text-[30px]"
            />
            <p className="mt-2 text-[14px] text-muted-foreground">
              Ask anything — Cyphor keeps the full thread in context as you go.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SUGGESTED_PROMPTS.map((s, i) => {
              const Icon = ICONS[i % ICONS.length];
              return (
                <button
                  key={s.title}
                  onClick={() => onSuggestedPrompt(s.prompt)}
                  className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_hsl(174_72%_42%/0.35)]"
                >
                  <Icon className="h-4 w-4 text-primary/80" />
                  <span>
                    <span className="block text-[13.5px] font-medium text-foreground">
                      {s.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-muted-foreground">
                      {s.prompt}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cy-scroll flex-1 overflow-y-auto px-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} streaming={m.streaming} />
        ))}
      </div>
      {isThinking && (
        <div className="mx-auto flex w-full max-w-3xl gap-3 py-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(174_72%_42%/0.14)] text-primary">
            <CyphorMark className="h-4 w-4" />
          </span>
          <ThinkingIndicator />
        </div>
      )}
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
