export type TokenUsageSnapshot = {
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  toolUsePromptTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

export function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function readTokenUsage(response: unknown): TokenUsageSnapshot | null {
  if (!response || typeof response !== 'object' || !('usageMetadata' in response)) return null;
  const usage = (response as { usageMetadata?: Record<string, unknown> }).usageMetadata;
  if (!usage || typeof usage !== 'object') return null;

  const promptTokens = readNumber(usage.promptTokenCount);
  const candidatesTokens = readNumber(usage.candidatesTokenCount);
  const thoughtsTokens = readNumber(usage.thoughtsTokenCount);
  const toolUsePromptTokens = readNumber(usage.toolUsePromptTokenCount);
  const cachedTokens = readNumber(usage.cachedContentTokenCount);
  const totalTokens =
    readNumber(usage.totalTokenCount) ||
    promptTokens + candidatesTokens + thoughtsTokens + toolUsePromptTokens;

  return {
    promptTokens,
    candidatesTokens,
    thoughtsTokens,
    toolUsePromptTokens,
    cachedTokens,
    totalTokens,
  };
}

export function logGeminiTokenUsage(input: {
  logTag: string;
  ticker: string;
  callLabel: string;
  model: string;
  usage: TokenUsageSnapshot | null;
}): TokenUsageSnapshot {
  const usage = input.usage ?? {
    promptTokens: 0,
    candidatesTokens: 0,
    thoughtsTokens: 0,
    toolUsePromptTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
  };

  console.info(
    `${input.logTag} token-usage ticker=${input.ticker} call=${input.callLabel} model=${input.model} ` +
      `prompt=${usage.promptTokens} output=${usage.candidatesTokens} thoughts=${usage.thoughtsTokens} ` +
      `toolInput=${usage.toolUsePromptTokens} cached=${usage.cachedTokens} total=${usage.totalTokens}`,
  );

  return usage;
}

export function sumTokenUsage(usages: TokenUsageSnapshot[]): TokenUsageSnapshot {
  return usages.reduce(
    (acc, usage) => ({
      promptTokens: acc.promptTokens + usage.promptTokens,
      candidatesTokens: acc.candidatesTokens + usage.candidatesTokens,
      thoughtsTokens: acc.thoughtsTokens + usage.thoughtsTokens,
      toolUsePromptTokens: acc.toolUsePromptTokens + usage.toolUsePromptTokens,
      cachedTokens: acc.cachedTokens + usage.cachedTokens,
      totalTokens: acc.totalTokens + usage.totalTokens,
    }),
    {
      promptTokens: 0,
      candidatesTokens: 0,
      thoughtsTokens: 0,
      toolUsePromptTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
    },
  );
}

export function extractModelText(response: unknown): string {
  if (
    response &&
    typeof response === 'object' &&
    'text' in response &&
    typeof response.text === 'string' &&
    response.text.trim()
  ) {
    return response.text.trim();
  }

  if (!response || typeof response !== 'object' || !('candidates' in response)) {
    return '';
  }

  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  const parts = candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    if (!('content' in candidate) || !candidate.content || typeof candidate.content !== 'object') {
      return [];
    }
    if (!('parts' in candidate.content) || !Array.isArray(candidate.content.parts)) return [];
    return candidate.content.parts;
  });

  return parts
    .map((part) => {
      if (!part || typeof part !== 'object' || !('text' in part) || typeof part.text !== 'string') {
        return '';
      }
      return part.text;
    })
    .join('\n')
    .trim();
}
