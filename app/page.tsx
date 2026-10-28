"use client";
import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Plus,
  Menu,
  X,
  Copy,
  Check,
  Bug,
  Code2,
  FileText,
  Lightbulb,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Square,
  ChevronDown,
  Paperclip,
  Search,
  LogOut,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// Warm, brass/cipher-machine palette. One accent, used consistently.
const C = {
  bg: '#15120f',
  surface: '#1c1712',
  border: 'rgba(240,233,220,0.09)',
  borderStrong: 'rgba(240,233,220,0.18)',
  text: '#f0e9dc',
  textDim: '#a89c8a',
  textFaint: '#6e6155',
  accent: '#c9a063',
  accentLight: '#ddbb82',
  accentDeep: '#8b6f3e',
  accentSoft: 'rgba(201,160,99,0.12)',
  success: '#8ea073',
};

const SCRAMBLE = '!<>-_\\/[]{}=+*^?#01';

const SUGGESTIONS = [
  { text: 'Explain this error message', icon: Bug },
  { text: 'Refactor a React component', icon: Code2 },
  { text: 'Draft a README section', icon: FileText },
  { text: 'Brainstorm project names', icon: Lightbulb },
];

const HISTORY = [
  { id: 'h1', title: 'React state management help' },
  { id: 'h2', title: 'API rate limiting strategies' },
  { id: 'h3', title: 'Component naming ideas' },
  { id: 'h4', title: 'Deploy checklist review' },
  { id: 'h5', title: 'Prisma schema design' },
];

const MODELS = [
  { id: 'cyphor', name: 'Cyphor', desc: 'Balanced for everyday coding' },
  { id: 'cyphor-mini', name: 'Cyphor Mini', desc: 'Faster, lighter answers' },
];

const RESPONSES = {
  default:
    "Happy to help with that. Give me a bit more detail on what you're working with (language, framework, what you've already tried) and I'll walk through it with you.",
  code:
    "Here's a clean way to handle that:\n\n```javascript\nfunction debounce(fn, delay = 300) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n}\n```\n\nWrap any expensive handler (search input, resize listener, autosave) and it only fires once things settle. Want me to adapt it for your specific case?",
  error:
    "That usually means the reference is undefined at the point it's read. Two common causes: the value hasn't loaded yet, or a typo in a prop or key name. Paste the exact message and the line it points to and I'll narrow it down.",
  readme:
    "A solid README needs three things: a one-line pitch, a quick-start block (install, run, done), and a short 'why this exists' section. Tell me the project name and its core feature and I'll draft the whole thing.",
  names:
    "A few directions: literal (what it does), metaphorical (how it feels to use), or a short invented word (brandable, easier to find as a domain). Tell me the category and I'll generate options in each style.",
};

// Contextual next-turn suggestions — Perplexity's "Related" pattern and
// Claude.ai's sparer version of the same idea. Shown only on the latest
// reply, and dismissible, so they nudge rather than nag.
const FOLLOWUPS = {
  default: ['Can you be more specific?', 'Show me an example', 'What should I try first?'],
  code: ['Explain how this works', 'Add error handling', 'Write a test for it'],
  error: ['Show me how to fix it', 'What causes this most often?', 'How do I prevent it?'],
  readme: ['Add a badges section', 'Write the install steps', 'Make it shorter'],
  names: ['Give me 5 more', 'Make them shorter', 'Check these against "Cyphor"'],
};

function categorize(text) {
  const t = text.toLowerCase();
  if (t.includes('error')) return 'error';
  if (t.includes('refactor') || t.includes('component') || t.includes('code')) return 'code';
  if (t.includes('readme')) return 'readme';
  if (t.includes('name')) return 'names';
  return 'default';
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// Cipher-decode reveal: characters resolve from scrambled symbols into real
// text as they stream in — the one signature motion in the interface.
// `stopped` freezes the reveal mid-way (for the stop-generating control)
// without jumping ahead to the full text.
function useDecodeReveal(target, reducedMotion, stopped) {
  const [revealCount, setRevealCount] = useState(0);

  useEffect(() => {
    setRevealCount(0);
  }, [target]);

  useEffect(() => {
    if (reducedMotion) {
      setRevealCount(target.length);
      return;
    }
    if (stopped) return;
    if (revealCount >= target.length) return;
    const id = setTimeout(() => {
      setRevealCount((c) => Math.min(target.length, c + 1 + Math.floor(Math.random() * 2)));
    }, 14 + Math.random() * 16);
    return () => clearTimeout(id);
  }, [revealCount, target, reducedMotion, stopped]);

  const naturalDone = revealCount >= target.length;
  const done = naturalDone || !!stopped;

  const windowLen = done ? 0 : Math.min(4, Math.max(0, target.length - revealCount));
  let tail = '';
  for (let i = 0; i < windowLen; i++) {
    tail += SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
  }

  return { settled: target.slice(0, revealCount), tail, done };
}

function renderInline(text, keyPrefix) {
  const nodes = [];
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(
        <strong key={keyPrefix + '-b' + i} style={{ fontWeight: 600, color: C.text }}>
          {m[2]}
        </strong>
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={keyPrefix + '-c' + i}
          className="cy-mono rounded px-1 py-0.5 text-sm"
          style={{ background: C.accentSoft, color: C.accentLight }}
        >
          {m[3]}
        </code>
      );
    }
    i++;
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Code blocks get their own header: language label + a copy button scoped
// to just that snippet. Always visible (not hover-gated) since it's a
// primary action, not an aside.
function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  }
  return (
    <div className="my-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
      <div
        className="flex items-center justify-between px-3.5 py-2"
        style={{ background: 'rgba(240,233,220,0.04)', borderBottom: `1px solid ${C.border}` }}
      >
        <span className="cy-mono text-xs" style={{ color: C.textFaint }}>
          {lang || 'text'}
        </span>
        <button onClick={handleCopy} className="cy-focus inline-flex items-center gap-1 text-xs" style={{ color: C.textDim }}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className="cy-mono overflow-x-auto p-3.5 text-sm leading-relaxed m-0"
        style={{ background: 'rgba(0,0,0,0.28)', color: '#d8cfc0' }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderMarkdownLite(text) {
  const nodes = [];
  const codeBlockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m;
  let idx = 0;
  while ((m = codeBlockRe.exec(text)) !== null) {
    if (m.index > last) {
      const k = idx++;
      nodes.push(
        <p key={'t' + k} className="whitespace-pre-wrap m-0">
          {renderInline(text.slice(last, m.index), 'p' + k)}
        </p>
      );
    }
    const k2 = idx++;
    nodes.push(<CodeBlock key={'code' + k2} lang={m[1]} code={m[2].replace(/\n$/, '')} />);
    last = codeBlockRe.lastIndex;
  }
  if (last < text.length) {
    const k = idx++;
    nodes.push(
      <p key={'t' + k} className="whitespace-pre-wrap m-0">
        {renderInline(text.slice(last), 'p' + k)}
      </p>
    );
  }
  return nodes;
}

// A pressed seal mark rather than a gradient app-icon tile.
function AiMark({ size = 28 }) {
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-full cy-mono select-none"
      style={{
        width: size,
        height: size,
        border: `1.5px solid ${C.accent}`,
        background: C.accentSoft,
        color: C.accent,
        fontSize: size * 0.42,
        fontWeight: 600,
        letterSpacing: '-0.02em',
      }}
      aria-hidden="true"
    >
      C
    </div>
  );
}

function Wordmark({ reducedMotion, size = 'text-xl' }) {
  const { settled, tail, done } = useDecodeReveal('Cyphor', reducedMotion, false);
  return (
    <span className={`cy-mono ${size} tracking-widest`} style={{ color: C.text }}>
      {settled}
      <span style={{ color: C.accent }}>{tail}</span>
      {!done && <span className="cy-cursor" aria-hidden="true" />}
    </span>
  );
}

function GrainOverlay() {
  return (
    <svg className="pointer-events-none fixed inset-0 z-30" style={{ opacity: 0.045, mixBlendMode: 'overlay' }} aria-hidden="true">
      <filter id="cyGrain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#cyGrain)" />
    </svg>
  );
}

function ModelPicker() {
  const [selected, setSelected] = useState(MODELS[0]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="cy-focus flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors duration-150"
          style={{ color: C.text }}
        >
          <span className="cy-mono">{selected.name}</span>
          <ChevronDown className="h-3.5 w-3.5" style={{ color: C.textFaint }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} style={{ background: C.surface, borderColor: C.borderStrong, color: C.text }}>
        {MODELS.map((m) => (
          <DropdownMenuItem key={m.id} onClick={() => setSelected(m)} className="cy-dropdown-item" style={{ color: C.text }}>
            <div>
              <div className="text-sm">{m.name}</div>
              <div className="text-xs" style={{ color: C.textFaint }}>
                {m.desc}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Cmd+K / Ctrl+K command palette — the one keyboard pattern shared across
// Claude, ChatGPT, and Cursor. Jump to a chat or start a new one without
// touching the mouse.
function CommandPalette({ open, onClose, onNewChat }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const filtered = HISTORY.filter((h) => h.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div
      className="fixed inset-0 flex items-start justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)', zIndex: 60, paddingTop: '18vh' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-2xl border overflow-hidden cy-msg-enter"
        style={{ maxWidth: 480, background: C.surface, borderColor: C.borderStrong, boxShadow: '0 20px 60px -12px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: C.border }}>
          <Search className="h-4 w-4 shrink-0" style={{ color: C.textFaint }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: C.text }}
          />
          <kbd className="cy-mono text-xs rounded px-1.5 py-0.5" style={{ color: C.textFaint, border: `1px solid ${C.border}` }}>
            esc
          </kbd>
        </div>
        <div className="max-h-72 overflow-y-auto cy-scroll py-1.5">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="cy-cmd-item w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left"
            style={{ color: C.text }}
          >
            <Plus className="h-4 w-4" style={{ color: C.accent }} />
            New chat
          </button>
          {filtered.length > 0 && (
            <p className="px-4 pt-2 pb-1 text-xs font-medium uppercase tracking-wider" style={{ color: C.textFaint }}>
              Chats
            </p>
          )}
          {filtered.map((h) => (
            <button
              key={h.id}
              onClick={onClose}
              className="cy-cmd-item w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left truncate"
              style={{ color: C.textDim }}
            >
              {h.title}
            </button>
          ))}
          {query && filtered.length === 0 && (
            <p className="px-4 py-3 text-sm" style={{ color: C.textFaint }}>
              No matches
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion, reducedMotion }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <AiMark size={48} />
      <h1 className="mt-6">
        <Wordmark reducedMotion={reducedMotion} size="text-4xl md:text-5xl" />
      </h1>
      <p className="mt-3 text-sm md:text-base max-w-sm" style={{ color: C.textDim }}>
        Paste a stack trace, sketch an idea, or just think out loud — Cyphor stays with the thread.
      </p>
      <div className="mt-9 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md">
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.text}
              onClick={() => onSuggestion(s.text)}
              className="cy-chip cy-focus flex items-center gap-2.5 text-left text-sm rounded-xl px-4 py-3 border"
              style={{ borderColor: C.border, background: 'rgba(240,233,220,0.02)', color: C.textDim }}
            >
              <Icon className="h-4 w-4 shrink-0" style={{ color: C.accent }} />
              {s.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UserMessage({ text, createdAt, isEditing, onStartEdit, onCancelEdit, onSaveEdit }) {
  const [draft, setDraft] = useState(text);
  const taRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(text);
      requestAnimationFrame(() => {
        const el = taRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }
  }, [isEditing, text]);

  function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSaveEdit(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setDraft(text);
      onCancelEdit();
    }
  }

  if (isEditing) {
    return (
      <div className="flex flex-col items-end cy-msg-enter">
        <div className="w-full rounded-2xl border p-2" style={{ borderColor: C.accent, background: 'rgba(201,160,99,0.06)', maxWidth: '80%' }}>
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className="w-full resize-y bg-transparent text-base leading-6 outline-none"
            style={{ color: C.text }}
          />
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => {
                setDraft(text);
                onCancelEdit();
              }}
              className="cy-focus rounded-lg px-3 py-1.5 text-xs"
              style={{ color: C.textDim }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="cy-focus rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: C.accentDeep, color: '#fbf6ec' }}
            >
              Save &amp; submit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end cy-msg-enter">
      <div
        className="rounded-2xl rounded-br-md px-4 py-2.5 text-base leading-6 whitespace-pre-wrap"
        style={{ background: C.accentDeep, color: '#fbf6ec', maxWidth: '80%', boxShadow: '0 6px 20px -8px rgba(139,111,62,0.55)' }}
      >
        {text}
      </div>
      <div className="cy-msg-actions mt-1.5 mr-1 flex items-center gap-2.5">
        <button onClick={onStartEdit} className="cy-focus" style={{ color: C.textFaint }} aria-label="Edit message">
          <Pencil className="h-3 w-3" />
        </button>
        <span className="text-xs" style={{ color: C.textFaint }}>
          {formatTime(createdAt)}
        </span>
      </div>
    </div>
  );
}

function AssistantMessageBody({ text, streaming, stopped, reducedMotion, onSettled }) {
  const { settled, tail, done } = useDecodeReveal(text, reducedMotion, stopped);

  useEffect(() => {
    if (streaming && done) onSettled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, streaming]);

  return (
    <div className="text-base leading-7" style={{ color: '#e9e1d3' }} aria-live="polite">
      {renderMarkdownLite(settled)}
      {tail && <span style={{ color: C.accentLight }}>{tail}</span>}
      {streaming && !done && <span className="cy-cursor" aria-hidden="true" />}
    </div>
  );
}

function AssistantMessage({
  text,
  streaming,
  stopped,
  reducedMotion,
  createdAt,
  feedback,
  category,
  isLast,
  onSettled,
  onRegenerate,
  onFeedback,
  onFollowup,
}) {
  const [copied, setCopied] = useState(false);
  const [followupsHidden, setFollowupsHidden] = useState(false);

  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  }

  const followups = FOLLOWUPS[category] || FOLLOWUPS.default;
  const showFollowups = isLast && !streaming && !followupsHidden;

  return (
    <div className="group flex gap-3 cy-msg-enter">
      <AiMark />
      <div className="flex-1 min-w-0 pt-0.5">
        <AssistantMessageBody text={text} streaming={streaming} stopped={stopped} reducedMotion={reducedMotion} onSettled={onSettled} />
        {!streaming && (
          <div className="cy-msg-actions mt-2 flex items-center gap-3">
            <button onClick={handleCopy} className="cy-focus inline-flex items-center gap-1.5 text-xs" style={{ color: C.textDim }}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={onRegenerate} className="cy-focus inline-flex items-center gap-1.5 text-xs" style={{ color: C.textDim }}>
              <RotateCcw className="h-3.5 w-3.5" />
              Regenerate
            </button>
            <span className="flex items-center gap-1">
              <button
                onClick={() => onFeedback('up')}
                className="cy-focus p-0.5"
                aria-label="Good response"
                style={{ color: feedback === 'up' ? C.accent : C.textDim }}
              >
                <ThumbsUp className="h-3.5 w-3.5" fill={feedback === 'up' ? C.accent : 'none'} />
              </button>
              <button
                onClick={() => onFeedback('down')}
                className="cy-focus p-0.5"
                aria-label="Bad response"
                style={{ color: feedback === 'down' ? C.accent : C.textDim }}
              >
                <ThumbsDown className="h-3.5 w-3.5" fill={feedback === 'down' ? C.accent : 'none'} />
              </button>
            </span>
            <span className="text-xs ml-auto" style={{ color: C.textFaint }}>
              {formatTime(createdAt)}
            </span>
          </div>
        )}
        {showFollowups && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {followups.map((f) => (
              <button
                key={f}
                onClick={() => onFollowup(f)}
                className="cy-followup-chip cy-focus text-sm rounded-full border px-3 py-1.5"
                style={{ borderColor: C.border, color: C.textDim }}
              >
                {f}
              </button>
            ))}
            <button
              onClick={() => setFollowupsHidden(true)}
              className="cy-focus p-1 rounded-full"
              style={{ color: C.textFaint }}
              aria-label="Dismiss suggestions"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3">
      <AiMark />
      <div className="flex items-center gap-1.5 h-7">
        <span className="cy-dot" style={{ animationDelay: '0ms' }} />
        <span className="cy-dot" style={{ animationDelay: '160ms' }} />
        <span className="cy-dot" style={{ animationDelay: '320ms' }} />
      </div>
    </div>
  );
}

function ChatInput({ onSend, onStop, onEditLast, busy, attachment, onAttach, onRemoveAttachment }) {
  const [value, setValue] = useState('');
  const taRef = useRef(null);

  function autoResize() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }

  useEffect(() => {
    autoResize();
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setValue('');
    requestAnimationFrame(autoResize);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp' && value === '' && !busy) {
      e.preventDefault();
      onEditLast();
    }
  }

  return (
    <div
      className="border-t px-3 pt-3 sm:px-4"
      style={{
        borderColor: C.border,
        background: 'rgba(21,18,15,0.9)',
        backdropFilter: 'blur(12px)',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
    >
      {attachment && (
        <div className="max-w-3xl mx-auto mb-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
            style={{ background: C.accentSoft, color: C.accentLight }}
          >
            <FileText className="h-3.5 w-3.5" />
            {attachment}
            <button onClick={onRemoveAttachment} className="cy-focus ml-1" aria-label="Remove attachment">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      <div
        className="cy-input-wrap max-w-3xl mx-auto flex items-end gap-1.5 rounded-2xl border px-2.5 py-2 transition-colors duration-200"
        style={{ borderColor: C.borderStrong, background: 'rgba(240,233,220,0.025)' }}
      >
        <button
          onClick={onAttach}
          className="cy-focus shrink-0 p-1.5 rounded-lg transition-colors duration-150"
          style={{ color: C.textFaint }}
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Cyphor..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-base leading-6 py-1.5 outline-none"
          style={{ maxHeight: 200, color: C.text }}
        />
        {busy ? (
          <Button
            onClick={onStop}
            size="icon"
            aria-label="Stop generating"
            className="cy-send-btn h-9 w-9 shrink-0 rounded-xl transition-all duration-200 active:scale-95"
            style={{ background: C.accentDeep }}
          >
            <Square className="h-3.5 w-3.5" style={{ color: C.text }} fill={C.text} />
          </Button>
        ) : (
          <Button
            onClick={submit}
            disabled={!value.trim()}
            size="icon"
            aria-label="Send message"
            className="cy-send-btn h-9 w-9 shrink-0 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-40"
            style={{ background: !value.trim() ? 'rgba(240,233,220,0.06)' : C.accentDeep }}
          >
            <Send className="h-4 w-4" style={{ color: C.text }} />
          </Button>
        )}
      </div>
      <p className="max-w-3xl mx-auto text-center text-xs mt-2 pb-1" style={{ color: C.textFaint }}>
        Cyphor can get things wrong — worth a second look on anything that matters.
      </p>
    </div>
  );
}

function Sidebar({ open, onClose, onNewChat, reducedMotion }) {
  const [filter, setFilter] = useState('');
  const filtered = HISTORY.filter((h) => h.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r transform transition-transform duration-300 ease-out lg:static lg:translate-x-0 lg:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: C.surface, borderColor: C.border }}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <AiMark size={26} />
            <Wordmark reducedMotion={reducedMotion} size="text-base" />
          </div>
          <button
            onClick={onClose}
            className="cy-focus lg:hidden p-1"
            style={{ color: C.textDim }}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={onNewChat}
            className="cy-focus w-full flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors duration-200"
            style={{ borderColor: C.borderStrong, background: 'rgba(240,233,220,0.03)', color: C.text }}
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
        </div>

        <div className="px-3 mt-3">
          <div
            className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
            style={{ borderColor: C.border, background: 'rgba(240,233,220,0.02)' }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: C.textFaint }} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search chats"
              className="cy-focus flex-1 bg-transparent text-sm outline-none"
              style={{ color: C.text }}
            />
            <kbd className="cy-mono text-xs shrink-0" style={{ color: C.textFaint }}>
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto cy-scroll mt-3 px-3 pb-3">
          <p className="px-2 pb-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: C.textFaint }}>
            Recent
          </p>
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-sm" style={{ color: C.textFaint }}>
              No matches
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filtered.map((h) => (
                <button
                  key={h.id}
                  className="cy-history-item cy-focus text-left truncate rounded-lg pl-4 pr-2.5 py-2 text-sm transition-colors duration-150"
                  style={{ color: C.textDim }}
                >
                  {h.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-3 py-3" style={{ borderColor: C.border }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="cy-focus w-full flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors duration-150"
                style={{ color: C.textDim }}
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs" style={{ background: '#3a2f1c', color: C.accentLight }}>
                    AK
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm" style={{ color: C.textDim }}>
                  Ayush
                </span>
                <ChevronDown className="h-3.5 w-3.5 ml-auto" style={{ color: C.textFaint }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={8} style={{ background: C.surface, borderColor: C.borderStrong, color: C.text }}>
              <DropdownMenuItem className="cy-dropdown-item" style={{ color: C.text }}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator style={{ background: C.border }} />
              <DropdownMenuItem className="cy-dropdown-item" style={{ color: C.text }}>
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}

export default function CyphorChat() {
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingId, setStreamingId] = useState(null);
  const [stoppedId, setStoppedId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [autoStick, setAutoStick] = useState(true);
  const [attachment, setAttachment] = useState(null);
  const reducedMotion = usePrefersReducedMotion();
  const listRef = useRef(null);
  const pendingCancelRef = useRef(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (autoStick) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoStick]);

  useEffect(() => {
    const el = listRef.current;
    if (el && autoStick) el.scrollTop = el.scrollHeight;
  }, [messages, autoStick]);

  const busy = isThinking || !!streamingId;

  function handleStop() {
    if (isThinking) {
      pendingCancelRef.current = true;
      setIsThinking(false);
      return;
    }
    if (streamingId) {
      setStoppedId(streamingId);
      setStreamingId(null);
    }
  }

  // Global shortcuts: Cmd/Ctrl+K opens the command palette, Escape closes
  // it or stops an in-flight response — the same two keys Claude, ChatGPT,
  // and Cursor all use.
  useEffect(() => {
    function handleGlobalKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (busy) handleStop();
      }
    }
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteOpen, busy, isThinking, streamingId]);

  function handleScroll(e) {
    const el = e.currentTarget;
    setAutoStick(el.scrollHeight - el.scrollTop - el.clientHeight < 96);
  }

  function respondTo(text, baseMessages) {
    const userMsg = { id: 'u' + Date.now() + Math.random(), role: 'user', content: text, createdAt: Date.now() };
    setMessages([...baseMessages, userMsg]);
    setAutoStick(true);
    setIsThinking(true);
    setStoppedId(null);
    pendingCancelRef.current = false;
    const category = categorize(text);
    const delay = 500 + Math.random() * 500;
    setTimeout(() => {
      if (pendingCancelRef.current) return;
      setIsThinking(false);
      const id = 'a' + Date.now() + Math.random();
      setStreamingId(id);
      setMessages((prev) => [
        ...prev,
        { id, role: 'assistant', content: RESPONSES[category], category, createdAt: Date.now(), feedback: null },
      ]);
    }, delay);
  }

  function handleSend(text) {
    setAttachment(null);
    respondTo(text, messages);
  }

  function handleSaveEdit(id, newText) {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1) return;
    setEditingMessageId(null);
    respondTo(newText, messages.slice(0, idx));
  }

  function handleEditLast() {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        setEditingMessageId(messages[i].id);
        break;
      }
    }
  }

  function handleRegenerate(assistantId) {
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx < 1) return;
    const userMsg = messages[idx - 1];
    respondTo(userMsg.content, messages.slice(0, idx - 1));
  }

  function handleFeedback(id, type) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback: m.feedback === type ? null : type } : m)));
  }

  function handleNewChat() {
    setMessages([]);
    setIsThinking(false);
    setStreamingId(null);
    setStoppedId(null);
    setEditingMessageId(null);
    setAttachment(null);
    setSidebarOpen(false);
  }

  return (
    <div className="cy-root cy-viewport flex w-full overflow-hidden" style={{ background: C.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap');
        .cy-root { font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif; }
        .cy-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .cy-viewport { height: 100vh; height: 100dvh; }

        .cy-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
        .cy-scroll::-webkit-scrollbar-track { background: transparent; }
        .cy-scroll::-webkit-scrollbar-thumb { background: rgba(240,233,220,0.12); border-radius: 9999px; }
        .cy-scroll::-webkit-scrollbar-thumb:hover { background: rgba(240,233,220,0.2); }
        .cy-scroll { scrollbar-width: thin; scrollbar-color: rgba(240,233,220,0.14) transparent; }

        .cy-focus:focus-visible { outline: none; box-shadow: 0 0 0 2px ${C.bg}, 0 0 0 4px ${C.accent}; border-radius: 6px; }
        .cy-input-wrap:focus-within { border-color: ${C.accent} !important; }

        /* Message actions: hover-reveal only on devices with real hover
           (mouse). Always visible on touch, and revealed on keyboard focus
           either way, so nothing is mouse-only. */
        .cy-msg-actions { opacity: 1; transition: opacity 0.2s; }
        @media (hover: hover) and (pointer: fine) {
          .cy-msg-actions { opacity: 0; }
          .group:hover .cy-msg-actions, .group:focus-within .cy-msg-actions { opacity: 1; }
        }

        .cy-history-item { position: relative; background: transparent; }
        .cy-history-item:hover { background: rgba(240,233,220,0.05); color: ${C.text} !important; }
        .cy-history-item::before { content: ''; position: absolute; left: 6px; top: 50%; bottom: 50%; width: 2px; background: ${C.accent}; border-radius: 2px; transition: top 0.2s ease, bottom 0.2s ease; }
        .cy-history-item:hover::before { top: 22%; bottom: 22%; }

        .cy-chip { transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease, color 0.2s ease; }
        .cy-chip:hover { transform: translateY(-2px); border-color: rgba(201,160,99,0.4); background: rgba(201,160,99,0.06); color: ${C.text}; }

        .cy-followup-chip { transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease; }
        .cy-followup-chip:hover { border-color: rgba(201,160,99,0.4); background: rgba(201,160,99,0.05); color: ${C.text}; }

        .cy-send-btn:not(:disabled):hover { box-shadow: 0 0 0 4px rgba(201,160,99,0.14), 0 10px 24px -6px rgba(139,111,62,0.6); }

        .cy-dropdown-item:hover, .cy-dropdown-item:focus { background: rgba(240,233,220,0.06) !important; cursor: pointer; }
        .cy-cmd-item:hover, .cy-cmd-item:focus { background: rgba(240,233,220,0.05); outline: none; }

        .cy-cursor { display: inline-block; width: 2px; height: 1em; background: ${C.accent}; margin-left: 2px; vertical-align: text-bottom; animation: cy-blink 0.9s steps(1) infinite; }
        @keyframes cy-blink { 50% { opacity: 0; } }
        .cy-dot { width: 6px; height: 6px; border-radius: 9999px; background: ${C.accent}; display: inline-block; animation: cy-bounce 1.1s ease-in-out infinite; }
        @keyframes cy-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.35; } 40% { transform: translateY(-5px); opacity: 1; } }
        .cy-msg-enter { animation: cy-rise 0.4s cubic-bezier(0.16,1,0.3,1); }
        @keyframes cy-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .cy-root textarea::placeholder, .cy-root input::placeholder { color: ${C.textFaint}; }

        @media (prefers-reduced-motion: reduce) {
          .cy-msg-enter, .cy-cursor, .cy-dot { animation: none !important; }
        }
      `}</style>

      <GrainOverlay />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNewChat={handleNewChat} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewChat={handleNewChat} reducedMotion={reducedMotion} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-3 sm:px-4 h-12 border-b shrink-0" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="cy-focus lg:hidden p-1.5 -ml-1.5 rounded-lg transition-colors duration-150"
              style={{ color: C.textDim }}
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="lg:hidden">
              <Wordmark reducedMotion={reducedMotion} size="text-sm" />
            </span>
            <span className="hidden lg:block">
              <ModelPicker />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.success }} />
            <span className="text-xs" style={{ color: C.textFaint }}>
              Connected
            </span>
          </div>
        </header>

        <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto cy-scroll">
          {messages.length === 0 ? (
            <EmptyState onSuggestion={handleSend} reducedMotion={reducedMotion} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
              {messages.map((m, idx) =>
                m.role === 'user' ? (
                  <UserMessage
                    key={m.id}
                    text={m.content}
                    createdAt={m.createdAt}
                    isEditing={m.id === editingMessageId}
                    onStartEdit={() => setEditingMessageId(m.id)}
                    onCancelEdit={() => setEditingMessageId(null)}
                    onSaveEdit={(newText) => handleSaveEdit(m.id, newText)}
                  />
                ) : (
                  <AssistantMessage
                    key={m.id}
                    text={m.content}
                    createdAt={m.createdAt}
                    feedback={m.feedback}
                    category={m.category}
                    isLast={idx === messages.length - 1}
                    streaming={m.id === streamingId}
                    stopped={m.id === stoppedId}
                    reducedMotion={reducedMotion}
                    onSettled={() => setStreamingId((cur) => (cur === m.id ? null : cur))}
                    onRegenerate={() => handleRegenerate(m.id)}
                    onFeedback={(type) => handleFeedback(m.id, type)}
                    onFollowup={handleSend}
                  />
                )
              )}
              {isThinking && <ThinkingIndicator />}
            </div>
          )}
        </div>

        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          onEditLast={handleEditLast}
          busy={busy}
          attachment={attachment}
          onAttach={() => setAttachment('screenshot.png')}
          onRemoveAttachment={() => setAttachment(null)}
        />
      </div>
    </div>
  );
}