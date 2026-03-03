import { describe, expect, test } from "bun:test";
import { encodingForModel } from "js-tiktoken";
import { runLlm } from "../commands/llm.js";

describe("runLlm", () => {
  test("returns a string", () => {
    const out = runLlm();
    expect(typeof out).toBe("string");
  });

  test("contains workflow commands", () => {
    const out = runLlm();
    expect(out).toContain("cp list");
    expect(out).toContain("cp show");
    expect(out).toContain("cp resolve");
  });

  test("mentions --format json", () => {
    const out = runLlm();
    expect(out).toContain("--format json");
  });

  test("includes jq recipes", () => {
    const out = runLlm();
    expect(out).toContain("jq");
    expect(out).toContain(".callstack");
  });

  test("mentions prerequisites", () => {
    const out = runLlm();
    expect(out).toContain("firebase");
    expect(out).toContain("crashpull init");
    expect(out).toContain("npx -y crashpull@latest");
  });

  test("stays under 500 tokens (cl100k_base)", () => {
    const out = runLlm();
    const enc = encodingForModel("gpt-4");
    const tokens = enc.encode(out).length;
    expect(tokens).toBeLessThan(270);
  });
});
