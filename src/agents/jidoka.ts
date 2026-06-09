/**
 * Jidoka — output validation for agent runs.
 *
 * Pure validation functions. No I/O, no side effects.
 * server.ts calls these after a run completes to decide pass/fail.
 */

export interface ValidationConfig {
  maxTurns: number;
  requiredTools: string[];
  requiredArtifactType: string;
}

export interface UsageRecord {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  provider: string;
  model: string;
  turns: number;
}

export interface ValidationResult {
  pass: boolean;
  errors: string[];
  warnings: string[];
}

export function validateZeroOutput(usage: UsageRecord): ValidationResult {
  if (usage.outputTokens === 0) {
    return {
      pass: false,
      errors: [`zero output tokens — model returned empty response (model=${usage.model}, provider=${usage.provider}, turns=${usage.turns})`],
      warnings: [],
    };
  }
  return { pass: true, errors: [], warnings: [] };
}

export function validateRequiredTools(
  config: ValidationConfig,
  toolCalls: Record<string, number>,
): ValidationResult {
  if (config.requiredTools.length === 0) {
    return { pass: true, errors: [], warnings: [] };
  }

  const missing = config.requiredTools.filter(t => !toolCalls[t]);
  if (missing.length > 0) {
    return {
      pass: false,
      errors: [`required tools never called: ${missing.join(", ")}`],
      warnings: [],
    };
  }
  return { pass: true, errors: [], warnings: [] };
}

export function checkMidRunTools(
  config: ValidationConfig,
  toolCalls: Record<string, number>,
  turnCount: number,
): ValidationResult {
  if (config.requiredTools.length === 0 || turnCount === 0 || turnCount % 10 !== 0) {
    return { pass: true, errors: [], warnings: [] };
  }

  const missing = config.requiredTools.filter(t => !toolCalls[t]);
  if (missing.length > 0) {
    return {
      pass: true,
      errors: [],
      warnings: [`turn ${turnCount}: required tools not yet called: ${missing.join(", ")}`],
    };
  }
  return { pass: true, errors: [], warnings: [] };
}

export function checkMaxTurns(
  config: ValidationConfig,
  turnCount: number,
): ValidationResult {
  if (config.maxTurns > 0 && turnCount >= config.maxTurns) {
    return {
      pass: false,
      errors: [`turn limit reached: ${turnCount} >= ${config.maxTurns}`],
      warnings: [],
    };
  }
  return { pass: true, errors: [], warnings: [] };
}

export function validateRun(
  config: ValidationConfig,
  toolCalls: Record<string, number>,
  usage: UsageRecord,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const zero = validateZeroOutput(usage);
  errors.push(...zero.errors);

  const tools = validateRequiredTools(config, toolCalls);
  errors.push(...tools.errors);

  return {
    pass: errors.length === 0,
    errors,
    warnings,
  };
}
