"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ComposerProps {
  onSend: (text: string) => void;
  busy: boolean;
  modelName: string;
}

const MAX_HEIGHT = 208;
const MAX_LENGTH = 24_000; // keep in sync with MAX_MESSAGE_LENGTH in api/chat/route.ts

export function Composer({ onSend, busy, modelName }: ComposerProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    if (text.length > MAX_LENGTH) {
      toast("Message too long", {
        description: `${text.length.toLocaleString()} / ${MAX_LENGTH.toLocaleString()} characters — trim it down a bit.`,
      });
      return;
    }
    onSend(text);
    setValue("");
    requestAnimationFrame(resize);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 px-3 pb-3 pt-1 sm:px-4 sm:pb-5">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-col rounded-[26px] border border-border bg-card shadow-[0_12px_40px_-24px_hsl(174_72%_42%/0.5)] transition-colors focus-within:border-primary/50">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              resize();
            }}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Message ${modelName}…`}
            className="max-h-52 w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[14.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1">
            <button
              onClick={() =>
                toast("Attachments", { description: "File uploads aren't wired up in this demo." })
              }
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <button
              onClick={submit}
              disabled={!value.trim() || busy}
              aria-label="Send message"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
                value.trim() && !busy
                  ? "bg-primary text-primary-foreground shadow-[0_4px_16px_-4px_hsl(174_72%_42%/0.7)] hover:brightness-110 active:scale-95"
                  : "bg-muted text-muted-foreground/60"
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[11.5px] text-muted-foreground/70">
          Cyphor can make mistakes. Verify important information.
          {value.length > MAX_LENGTH * 0.8 && (
            <span className={value.length > MAX_LENGTH ? "ml-2 text-destructive" : "ml-2"}>
              {value.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
