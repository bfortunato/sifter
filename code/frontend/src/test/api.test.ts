/**
 * Frontend API layer tests.
 * Tests the fetch functions in src/api/ using vi.stubGlobal to mock fetch.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchExtractions,
  fetchExtraction,
  createExtraction,
  deleteExtraction,
  fetchExtractionRecords,
  queryExtraction,
} from "../api/extractions";
import {
  fetchAggregations,
  createAggregation,
  fetchAggregationResult,
} from "../api/aggregations";
import { sendChatMessage } from "../api/chat";

// ---- Helpers ----

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers({ "content-type": "application/json" }),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---- Extractions ----

describe("fetchExtractions", () => {
  it("returns list of extractions", async () => {
    const data = [
      { id: "1", name: "Invoices", status: "active", processed_documents: 5 },
    ];
    vi.stubGlobal("fetch", mockFetch(200, data));
    const result = await fetchExtractions();
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith("/api/extractions");
  });

  it("throws on error response", async () => {
    vi.stubGlobal("fetch", mockFetch(500, { detail: "Server error" }));
    await expect(fetchExtractions()).rejects.toThrow();
  });
});

describe("fetchExtraction", () => {
  it("fetches a single extraction by id", async () => {
    const data = { id: "abc123", name: "Test", status: "active" };
    vi.stubGlobal("fetch", mockFetch(200, data));
    const result = await fetchExtraction("abc123");
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith("/api/extractions/abc123");
  });

  it("throws on 404", async () => {
    vi.stubGlobal("fetch", mockFetch(404, { detail: "Not found" }));
    await expect(fetchExtraction("missing")).rejects.toThrow();
  });
});

describe("createExtraction", () => {
  it("posts to /api/extractions with correct body", async () => {
    const created = { id: "new1", name: "New", status: "active" };
    vi.stubGlobal("fetch", mockFetch(200, created));

    const result = await createExtraction({
      name: "New",
      extraction_instructions: "Extract: client",
    });

    expect(result).toEqual(created);
    expect(fetch).toHaveBeenCalledWith(
      "/api/extractions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New", extraction_instructions: "Extract: client" }),
      })
    );
  });
});

describe("deleteExtraction", () => {
  it("sends DELETE request", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { deleted: true }));
    await deleteExtraction("abc");
    expect(fetch).toHaveBeenCalledWith("/api/extractions/abc", { method: "DELETE" });
  });
});

describe("fetchExtractionRecords", () => {
  it("fetches records for an extraction", async () => {
    const records = [
      {
        id: "r1",
        document_id: "doc.pdf",
        document_type: "invoice",
        confidence: 0.95,
        extracted_data: { client: "Acme", amount: 100 },
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    vi.stubGlobal("fetch", mockFetch(200, records));
    const result = await fetchExtractionRecords("ext1");
    expect(result).toEqual(records);
    expect(fetch).toHaveBeenCalledWith("/api/extractions/ext1/records");
  });
});

describe("queryExtraction", () => {
  it("posts a natural language query", async () => {
    const response = {
      results: [{ _id: "Acme", total: 1500 }],
      pipeline: '[{"$group": {...}}]',
    };
    vi.stubGlobal("fetch", mockFetch(200, response));

    const result = await queryExtraction("ext1", "Total by client");
    expect(result.results).toEqual([{ _id: "Acme", total: 1500 }]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/extractions/ext1/query",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "Total by client" }),
      })
    );
  });
});

// ---- Aggregations ----

describe("fetchAggregations", () => {
  it("fetches all aggregations", async () => {
    const data = [{ id: "a1", name: "My Agg", status: "active" }];
    vi.stubGlobal("fetch", mockFetch(200, data));
    const result = await fetchAggregations();
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledWith("/api/aggregations");
  });

  it("filters by extraction_id when provided", async () => {
    vi.stubGlobal("fetch", mockFetch(200, []));
    await fetchAggregations("ext42");
    expect(fetch).toHaveBeenCalledWith("/api/aggregations?extraction_id=ext42");
  });
});

describe("createAggregation", () => {
  it("creates aggregation with correct body", async () => {
    const created = { id: "a1", name: "Test Agg", status: "generating" };
    vi.stubGlobal("fetch", mockFetch(200, created));

    await createAggregation({
      name: "Test Agg",
      extraction_id: "ext1",
      aggregation_query: "total by client",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/aggregations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Test Agg",
          extraction_id: "ext1",
          aggregation_query: "total by client",
        }),
      })
    );
  });
});

describe("fetchAggregationResult", () => {
  it("executes aggregation and returns results", async () => {
    const response = { results: [{ _id: "Acme", total: 5000 }] };
    vi.stubGlobal("fetch", mockFetch(200, response));

    const result = await fetchAggregationResult("agg1");
    expect(result.results).toEqual([{ _id: "Acme", total: 5000 }]);
    expect(fetch).toHaveBeenCalledWith("/api/aggregations/agg1/result");
  });
});

// ---- Chat ----

describe("sendChatMessage", () => {
  it("sends a message and returns response", async () => {
    const response = {
      response: "Total is 1500.",
      data: [{ total: 1500 }],
      query: "total amount",
    };
    vi.stubGlobal("fetch", mockFetch(200, response));

    const result = await sendChatMessage("What is the total?", "ext1");
    expect(result.response).toBe("Total is 1500.");
    expect(result.data).toEqual([{ total: 1500 }]);
  });

  it("sends message history", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { response: "ok", data: null }));
    const history = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi!" },
    ];
    await sendChatMessage("Follow up", undefined, history);
    expect(fetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        body: JSON.stringify({
          message: "Follow up",
          extraction_id: undefined,
          history: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi!" },
          ],
        }),
      })
    );
  });

  it("throws on error response", async () => {
    vi.stubGlobal("fetch", mockFetch(500, "Internal Server Error"));
    await expect(sendChatMessage("test")).rejects.toThrow();
  });
});
