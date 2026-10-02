export type Role = "user" | "assistant";

/** Flattened, display-ready view of an AI SDK UIMessage (parts joined to text). */
export interface DisplayMessage {
  id: string;
  role: Role;
  content: string;
  /** true while this is the in-flight assistant message still streaming */
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  /** ISO timestamp string as returned by the API */
  updatedAt: string;
}

export interface ConversationGroup {
  label: "Today" | "Yesterday" | "Previous 7 Days" | "Older";
  items: Conversation[];
}

export interface ModelOption {
  id: string;
  name: string;
  blurb: string;
}
