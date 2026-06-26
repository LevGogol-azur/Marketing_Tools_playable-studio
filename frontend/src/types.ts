// Shared domain types for the Playable Studio frontend.

// A builder/playable entry as returned by the backend.
export interface Page {
  file: string;
  title?: string;
  folder?: string;
  uploaded?: boolean;
}

// A distinct folder derived from page entries, with its page count.
export interface FolderEntry {
  name: string;
  count: number;
}

// One message in the AI chat panel; `page` is set on the agent's final result.
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  page?: Page;
}

// State of the iframe playable viewer.
export interface ViewerState {
  open: boolean;
  title: string;
  blobUrl: string;
  loading: boolean;
}

// Discriminated union for the rename dialog: a builder or a folder.
export type RenameState =
  | { kind: "file"; page: Page; heading: string; label: string; initial: string }
  | { kind: "folder"; folder: string; heading: string; label: string; initial: string };

// Payload for uploading a new page.
export interface UploadInput {
  filename: string;
  title: string;
  folder: string;
  contentBase64: string;
}

// Options for streaming an agent run.
export interface RunAgentOptions {
  onTextCallback?: (text: string) => void;
  signal?: AbortSignal;
}
