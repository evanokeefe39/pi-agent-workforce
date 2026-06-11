import { describe, it, expect } from "bun:test";
import {
  validateZeroOutput,
  validateRequiredTools,
  checkMidRunTools,
  checkMaxTurns,
  validateRun,
  type ValidationConfig,
  type UsageRecord,
} from "../../src/agents/jidoka";

const baseUsage: UsageRecord = {
  inputTokens: 1000,
  outputTokens: 500,
  cachedInputTokens: 0,
  provider: "deepseek",
  model: "deepseek-v4-flash",
  turns: 10,
};

const baseConfig: ValidationConfig = {
  maxTurns: 60,
  requiredTools: ["record_finding", "write_artifact"],
  requiredArtifactType: "dataset",
};

// ---------------------------------------------------------------------------
// validateZeroOutput
// ---------------------------------------------------------------------------

describe("validateZeroOutput", () => {
  it("fails when output tokens are zero", () => {
    const result = validateZeroOutput({ ...baseUsage, outputTokens: 0 });
    expect(result.pass).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain("zero output tokens");
  });

  it("includes model and provider in error message", () => {
    const result = validateZeroOutput({ ...baseUsage, outputTokens: 0, model: "test-model", provider: "test-provider" });
    expect(result.errors[0]).toContain("test-model");
    expect(result.errors[0]).toContain("test-provider");
  });

  it("passes when output tokens are positive", () => {
    const result = validateZeroOutput({ ...baseUsage, outputTokens: 1 });
    expect(result.pass).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("passes with large output token count", () => {
    const result = validateZeroOutput({ ...baseUsage, outputTokens: 100000 });
    expect(result.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateRequiredTools
// ---------------------------------------------------------------------------

describe("validateRequiredTools", () => {
  it("passes when all required tools were called", () => {
    const result = validateRequiredTools(baseConfig, {
      record_finding: 5,
      write_artifact: 1,
      web_search: 3,
    });
    expect(result.pass).toBe(true);
  });

  it("fails when a required tool was never called", () => {
    const result = validateRequiredTools(baseConfig, {
      record_finding: 5,
    });
    expect(result.pass).toBe(false);
    expect(result.errors[0]).toContain("write_artifact");
  });

  it("fails when no tools were called at all", () => {
    const result = validateRequiredTools(baseConfig, {});
    expect(result.pass).toBe(false);
    expect(result.errors[0]).toContain("record_finding");
    expect(result.errors[0]).toContain("write_artifact");
  });

  it("passes when requiredTools is empty", () => {
    const result = validateRequiredTools(
      { ...baseConfig, requiredTools: [] },
      {},
    );
    expect(result.pass).toBe(true);
  });

  it("treats zero call count as missing", () => {
    const result = validateRequiredTools(baseConfig, {
      record_finding: 0,
      write_artifact: 1,
    });
    expect(result.pass).toBe(false);
    expect(result.errors[0]).toContain("record_finding");
  });
});

// ---------------------------------------------------------------------------
// checkMidRunTools
// ---------------------------------------------------------------------------

describe("checkMidRunTools", () => {
  it("warns at turn 10 when required tools not called", () => {
    const result = checkMidRunTools(baseConfig, {}, 10);
    expect(result.pass).toBe(true); // warnings don't fail
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("turn 10");
  });

  it("warns at turn 20", () => {
    const result = checkMidRunTools(baseConfig, {}, 20);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("turn 20");
  });

  it("no warning at non-multiple-of-10 turns", () => {
    const result = checkMidRunTools(baseConfig, {}, 7);
    expect(result.warnings.length).toBe(0);
  });

  it("no warning at turn 0", () => {
    const result = checkMidRunTools(baseConfig, {}, 0);
    expect(result.warnings.length).toBe(0);
  });

  it("no warning when tools have been called", () => {
    const result = checkMidRunTools(baseConfig, {
      record_finding: 1,
      write_artifact: 1,
    }, 10);
    expect(result.warnings.length).toBe(0);
  });

  it("warns when only some required tools called", () => {
    const result = checkMidRunTools(baseConfig, {
      record_finding: 3,
    }, 10);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("write_artifact");
    expect(result.warnings[0]).not.toContain("record_finding");
  });

  it("no warning when requiredTools is empty", () => {
    const result = checkMidRunTools(
      { ...baseConfig, requiredTools: [] },
      {},
      10,
    );
    expect(result.warnings.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkMaxTurns
// ---------------------------------------------------------------------------

describe("checkMaxTurns", () => {
  it("fails when turn count equals maxTurns", () => {
    const result = checkMaxTurns(baseConfig, 60);
    expect(result.pass).toBe(false);
    expect(result.errors[0]).toContain("60 >= 60");
  });

  it("fails when turn count exceeds maxTurns", () => {
    const result = checkMaxTurns(baseConfig, 100);
    expect(result.pass).toBe(false);
  });

  it("passes when turn count is below maxTurns", () => {
    const result = checkMaxTurns(baseConfig, 59);
    expect(result.pass).toBe(true);
  });

  it("passes when maxTurns is 0 (disabled)", () => {
    const result = checkMaxTurns({ ...baseConfig, maxTurns: 0 }, 999);
    expect(result.pass).toBe(true);
  });

  it("passes at turn 0", () => {
    const result = checkMaxTurns(baseConfig, 0);
    expect(result.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateRun (composite)
// ---------------------------------------------------------------------------

describe("validateRun", () => {
  it("passes when everything is valid", () => {
    const result = validateRun(baseConfig, {
      record_finding: 5,
      write_artifact: 1,
    }, baseUsage);
    expect(result.pass).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("fails with zero output AND missing tools", () => {
    const result = validateRun(baseConfig, {}, {
      ...baseUsage,
      outputTokens: 0,
    });
    expect(result.pass).toBe(false);
    expect(result.errors.length).toBe(2);
  });

  it("fails with zero output even when tools are present", () => {
    const result = validateRun(baseConfig, {
      record_finding: 5,
      write_artifact: 1,
    }, { ...baseUsage, outputTokens: 0 });
    expect(result.pass).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain("zero output");
  });

  it("fails with missing tools even when output is present", () => {
    const result = validateRun(baseConfig, {}, baseUsage);
    expect(result.pass).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain("required tools");
  });
});
