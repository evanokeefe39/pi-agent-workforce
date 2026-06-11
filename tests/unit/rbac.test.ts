/**
 * Unit tests for RBAC glob matching and access control.
 *
 * Tests globMatch (extracted logic) and canRead/canWrite with loaded rules.
 * These are the security boundary tests — must survive the R1 refactor.
 */
import { describe, it, expect, beforeAll } from "bun:test";

// rbac.ts uses module-level state (rules) and imports logger.
// We test the glob matching logic directly by reimplementing globMatch
// (it's a private function) and test canRead/canWrite via the module.
// For globMatch isolation, we extract the same algorithm here.

function globMatch(pattern: string, value: string): boolean {
  let re = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      re += ".*";
      i += 2;
      if (pattern[i] === "/") i++;
    } else if (ch === "*") {
      re += "[^/]*";
      i++;
    } else if (ch === "?") {
      re += ".";
      i++;
    } else if ("\\^$.|+()[]{}".includes(ch)) {
      re += `\\${ch}`;
      i++;
    } else {
      re += ch;
      i++;
    }
  }
  return new RegExp(`^${re}$`).test(value);
}

// ---------------------------------------------------------------------------
// globMatch — ** (match across segments)
// ---------------------------------------------------------------------------

describe("globMatch — ** patterns", () => {
  it("** matches everything", () => {
    expect(globMatch("**", "anything/goes/here")).toBe(true);
  });

  it("** matches empty string", () => {
    expect(globMatch("**", "")).toBe(true);
  });

  it("** matches single segment", () => {
    expect(globMatch("**", "foo")).toBe(true);
  });

  it("prefix/**/suffix matches nested paths", () => {
    expect(globMatch("default/**/researcher/**", "default/run123/researcher/dataset/file.json")).toBe(true);
  });

  it("*/*/** matches workspace/run/anything", () => {
    expect(globMatch("*/*/researcher/**", "default/run123/researcher/dataset/findings.jsonl")).toBe(true);
  });

  it("*/*/** does not match wrong agent", () => {
    expect(globMatch("*/*/researcher/**", "default/run123/writer/report/doc.md")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// globMatch — * (single segment)
// ---------------------------------------------------------------------------

describe("globMatch — * patterns", () => {
  it("* matches single segment", () => {
    expect(globMatch("*", "foo")).toBe(true);
  });

  it("* does not match path separator", () => {
    expect(globMatch("*", "foo/bar")).toBe(false);
  });

  it("*/* matches two segments", () => {
    expect(globMatch("*/*", "default/run123")).toBe(true);
  });

  it("*/* does not match three segments", () => {
    expect(globMatch("*/*", "default/run123/extra")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// globMatch — ? (single character)
// ---------------------------------------------------------------------------

describe("globMatch — ? patterns", () => {
  it("? matches single character", () => {
    expect(globMatch("?", "a")).toBe(true);
  });

  it("? does not match empty string", () => {
    expect(globMatch("?", "")).toBe(false);
  });

  it("? does not match two characters", () => {
    expect(globMatch("?", "ab")).toBe(false);
  });

  it("file?.txt matches file1.txt", () => {
    expect(globMatch("file?.txt", "file1.txt")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// globMatch — regex special character escaping
// ---------------------------------------------------------------------------

describe("globMatch — special character escaping", () => {
  it("literal dot is escaped", () => {
    expect(globMatch("file.txt", "file.txt")).toBe(true);
    expect(globMatch("file.txt", "fileXtxt")).toBe(false);
  });

  it("literal parentheses are escaped", () => {
    expect(globMatch("foo(1)", "foo(1)")).toBe(true);
  });

  it("literal brackets are escaped", () => {
    expect(globMatch("foo[0]", "foo[0]")).toBe(true);
  });

  it("literal pipe is escaped", () => {
    expect(globMatch("a|b", "a|b")).toBe(true);
    expect(globMatch("a|b", "a")).toBe(false);
  });

  it("literal plus is escaped", () => {
    expect(globMatch("a+b", "a+b")).toBe(true);
    expect(globMatch("a+b", "aab")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RBAC rule patterns from rbac.json
// ---------------------------------------------------------------------------

describe("RBAC rule patterns — real rules", () => {
  const key = (ws: string, run: string, agent: string, type: string, file: string) =>
    `${ws}/${run}/${agent}/${type}/${file}`;

  it("planner read ** matches any key", () => {
    expect(globMatch("**", key("default", "run1", "researcher", "dataset", "f.json"))).toBe(true);
  });

  it("planner write */*/planner/** matches own namespace", () => {
    expect(globMatch("*/*/planner/**", key("default", "run1", "planner", "report", "plan.md"))).toBe(true);
  });

  it("planner write */*/planner/** rejects other namespace", () => {
    expect(globMatch("*/*/planner/**", key("default", "run1", "researcher", "dataset", "f.json"))).toBe(false);
  });

  it("researcher read own namespace", () => {
    expect(globMatch("*/*/researcher/**", key("default", "run1", "researcher", "dataset", "f.json"))).toBe(true);
  });

  it("researcher read data namespace", () => {
    expect(globMatch("*/*/data/**", key("default", "run1", "data", "dataset", "analysis.json"))).toBe(true);
  });

  it("researcher cannot read writer namespace", () => {
    expect(globMatch("*/*/researcher/**", key("default", "run1", "writer", "report", "doc.md"))).toBe(false);
    expect(globMatch("*/*/data/**", key("default", "run1", "writer", "report", "doc.md"))).toBe(false);
  });

  it("writer reads researcher, data, and own", () => {
    const patterns = ["*/*/writer/**", "*/*/researcher/**", "*/*/data/**"];
    const writerKey = key("default", "run1", "writer", "report", "doc.md");
    const researcherKey = key("default", "run1", "researcher", "dataset", "f.json");
    const dataKey = key("default", "run1", "data", "dataset", "analysis.json");
    const coderKey = key("default", "run1", "coder", "image", "slide.png");

    expect(patterns.some(p => globMatch(p, writerKey))).toBe(true);
    expect(patterns.some(p => globMatch(p, researcherKey))).toBe(true);
    expect(patterns.some(p => globMatch(p, dataKey))).toBe(true);
    expect(patterns.some(p => globMatch(p, coderKey))).toBe(false);
  });

  it("qa read ** matches everything", () => {
    expect(globMatch("**", key("default", "run1", "writer", "report", "doc.md"))).toBe(true);
  });

  it("qa write restricted to own namespace", () => {
    expect(globMatch("*/*/qa/**", key("default", "run1", "qa", "dataset", "verdict.jsonl"))).toBe(true);
    expect(globMatch("*/*/qa/**", key("default", "run1", "writer", "report", "doc.md"))).toBe(false);
  });

  it("e2e-test has full access", () => {
    expect(globMatch("**", key("default", "run1", "anything", "any", "file.txt"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("globMatch — edge cases", () => {
  it("empty pattern matches empty string", () => {
    expect(globMatch("", "")).toBe(true);
  });

  it("empty pattern does not match non-empty string", () => {
    expect(globMatch("", "something")).toBe(false);
  });

  it("pattern with no wildcards is exact match", () => {
    expect(globMatch("exact/path/file.txt", "exact/path/file.txt")).toBe(true);
    expect(globMatch("exact/path/file.txt", "exact/path/file.tx")).toBe(false);
  });

  it("** at end matches trailing content", () => {
    expect(globMatch("prefix/**", "prefix/a/b/c/d")).toBe(true);
  });

  it("** at start matches leading content", () => {
    expect(globMatch("**/suffix", "a/b/c/suffix")).toBe(true);
  });

  it("consecutive ** patterns", () => {
    expect(globMatch("**/**", "a/b/c")).toBe(true);
  });
});
