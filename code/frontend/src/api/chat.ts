import { apiFetchJson } from "../lib/apiFetch";
import type { ChatMessage, ChatResponse } from "./types";

export const sendChatMessage = (
  message: string,
  extractionId?: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> =>
  apiFetchJson<ChatResponse>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      extraction_id: extractionId,
      history: history.map(({ role, content }) => ({ role, content })),
    }),
  });
