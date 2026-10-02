import type { Conversation, ConversationGroup } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function groupConversations(conversations: Conversation[]): ConversationGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const buckets: Record<ConversationGroup["label"], Conversation[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    Older: [],
  };

  for (const c of conversations) {
    const t = new Date(c.updatedAt).getTime();
    if (t >= startOfToday) buckets.Today.push(c);
    else if (t >= startOfToday - DAY_MS) buckets.Yesterday.push(c);
    else if (t >= startOfToday - 7 * DAY_MS) buckets["Previous 7 Days"].push(c);
    else buckets.Older.push(c);
  }

  return (Object.keys(buckets) as ConversationGroup["label"][])
    .map((label) => ({ label, items: buckets[label] }))
    .filter((group) => group.items.length > 0);
}
