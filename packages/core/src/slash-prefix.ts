export interface SlashCatalogEntry {
  name: string;
  kind: "skill" | "command";
}

export interface SlashPrefixSegment {
  name: string;
  kind: "skill" | "command";
}

export type SlashPrefixParseResult =
  | {
      state: "text";
      segments: [];
      body: string;
    }
  | {
      state: "query";
      segments: SlashPrefixSegment[];
      body: "";
      query: string;
    }
  | {
      state: "complete";
      segments: SlashPrefixSegment[];
      body: string;
      stoppedBy: "text" | "unknown";
    };

export function parseSlashPrefix(
  input: string,
  catalog: readonly SlashCatalogEntry[]
): SlashPrefixParseResult {
  const first = input.search(/\S/u);
  if (first < 0 || input[first] !== "/") {
    return { state: "text", segments: [], body: input };
  }

  const segments: SlashPrefixSegment[] = [];
  let cursor = first;

  while (cursor < input.length && input[cursor] === "/") {
    const segmentStart = cursor;
    const tokenStart = cursor + 1;
    const tokenEnd = findTokenEnd(input, tokenStart);
    const token = input.slice(tokenStart, tokenEnd);
    const delimiter = input[tokenEnd];
    const exact = findExact(catalog, token);

    if (exact === undefined) {
      const canComplete = tokenEnd === input.length
        && catalog.some((entry) => entry.name.startsWith(token));
      if (canComplete) {
        return { state: "query", segments, body: "", query: token };
      }
      return {
        state: "complete",
        segments,
        body: input.slice(segmentStart),
        stoppedBy: "unknown"
      };
    }

    segments.push({ name: exact.name, kind: exact.kind });

    if (delimiter !== undefined && /\s/u.test(delimiter)) {
      const next = skipWhitespace(input, tokenEnd);
      if (input[next] === "/") {
        cursor = next;
        continue;
      }
      return {
        state: "complete",
        segments,
        body: input.slice(next),
        stoppedBy: "text"
      };
    }

    if (delimiter === "/") {
      return {
        state: "complete",
        segments,
        body: input.slice(tokenEnd),
        stoppedBy: "text"
      };
    }

    return {
      state: "complete",
      segments,
      body: "",
      stoppedBy: "text"
    };
  }

  return { state: "query", segments, body: "", query: "" };
}

function skipWhitespace(input: string, start: number): number {
  let index = start;
  while (index < input.length && /\s/u.test(input[index] ?? "")) {
    index += 1;
  }
  return index;
}

function findTokenEnd(input: string, start: number): number {
  let index = start;
  while (index < input.length && input[index] !== "/" && !/\s/u.test(input[index] ?? "")) {
    index += 1;
  }
  return index;
}

function findExact(
  catalog: readonly SlashCatalogEntry[],
  name: string
): SlashCatalogEntry | undefined {
  const matches = catalog.filter((entry) => entry.name === name);
  return matches.find((entry) => entry.kind === "command") ?? matches[0];
}
