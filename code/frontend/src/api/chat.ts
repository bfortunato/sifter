import type { ChatMessage, ChatResponse } from "./types";

export const sendChatMessage = (
  message: string,
  extractionId?: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> =>
  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      extraction_id: extractionId,
      history: history.map(({ role, content }) => ({ role, content })),
    }),
  }).then(async (r) => {
    if (!r.ok) {
      const text = await r.text().catch(() => r.statusText);
      throw new Error(text || `HTTP ${r.status}`);
    }
    return r.json() as Promise<ChatResponse>;
  });
