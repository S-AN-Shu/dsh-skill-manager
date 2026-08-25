import { describe, expect, test } from "vitest";

import { parseSlashPrefix } from "../src/index.js";

const catalog = [
  { name: "review-helper", kind: "skill" as const },
  { name: "summarize", kind: "command" as const },
  { name: "settings", kind: "command" as const }
];

describe("leading slash prefix parsing", () => {
  test("parses chained leading segments and leaves later slashes in the body", () => {
    expect(parseSlashPrefix(
      "/review-helper /summarize Explain C:/work/file.ts and /not-a-command",
      catalog
    )).toEqual({
      state: "complete",
      segments: [
        { name: "review-helper", kind: "skill" },
        { name: "summarize", kind: "command" }
      ],
      body: "Explain C:/work/file.ts and /not-a-command",
      stoppedBy: "text"
    });
  });

  test("allows chainable commands and Skills to continue in either order", () => {
    expect(parseSlashPrefix(
      "/summarize /review-helper /summarize Final body",
      catalog
    )).toEqual({
      state: "complete",
      segments: [
        { name: "summarize", kind: "command" },
        { name: "review-helper", kind: "skill" },
        { name: "summarize", kind: "command" }
      ],
      body: "Final body",
      stoppedBy: "text"
    });
  });

  test("treats an unknown segment and everything after it as ordinary body text", () => {
    expect(parseSlashPrefix("/review-helper /unknown /again", catalog)).toEqual({
      state: "complete",
      segments: [{ name: "review-helper", kind: "skill" }],
      body: "/unknown /again",
      stoppedBy: "unknown"
    });
  });

  test("returns a query only while the leading prefix is still being typed", () => {
    expect(parseSlashPrefix("/review-helper /sum", catalog)).toEqual({
      state: "query",
      segments: [{ name: "review-helper", kind: "skill" }],
      body: "",
      query: "sum"
    });
  });

  test("does not enter command mode after normal text has started", () => {
    expect(parseSlashPrefix("Please use /review-helper", catalog)).toEqual({
      state: "text",
      segments: [],
      body: "Please use /review-helper"
    });
  });

  test("requires whitespace-bounded tokens for a chain", () => {
    expect(parseSlashPrefix("/review-helper/summarize body", catalog)).toEqual({
      state: "complete",
      segments: [{ name: "review-helper", kind: "skill" }],
      body: "/summarize body",
      stoppedBy: "text"
    });
  });

  test("allows every recognized command to continue before body text", () => {
    expect(parseSlashPrefix("/review-helper /settings /summarize", catalog)).toEqual({
      state: "complete",
      segments: [
        { name: "review-helper", kind: "skill" },
        { name: "settings", kind: "command" },
        { name: "summarize", kind: "command" }
      ],
      body: "",
      stoppedBy: "text"
    });
  });
});
