import { GoogleGenAI } from '@google/genai';
import { getApiKey } from '../domainUtils';
import { 
  Psb4ConsoleEntry, 
  CapturePromptParams, 
  CaptureAssemblyParams, 
  CaptureSynthesisParams,
  ConversationTurn
} from './types';
import { 
  writeConsoleEntry, 
  updateConsoleEntry, 
  getRun 
} from './storage';

// ----------------------------------------------------------------------------
// CROCKFORD'S BASE32 ULID GENERATOR
// Lexicographically sortable 26-character unique identifier.
// ----------------------------------------------------------------------------
export function generateUlid(): string {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let now = Date.now();
  let timeChars = '';
  for (let i = 9; i >= 0; i--) {
    timeChars = ENCODING[now % 32] + timeChars;
    now = Math.floor(now / 32);
  }
  let randChars = '';
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * 32);
    randChars += ENCODING[rand];
  }
  return timeChars + randChars;
}

// Helper to resolve showId from a runId
async function resolveShowId(runId: string): Promise<string> {
  const run = await getRun(runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }
  return run.showId;
}

const GEMINI_TIMEOUT_MS = 120_000; // 2 minutes

// Helper representing standard call to Gemini with Retry
export async function callGemini({
  model, temperature, maxOutputTokens, prompt, history
}: {
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  prompt: string;
  history?: ConversationTurn[];
}) {
  // Normalize legacy/unsupported model names to active modern models
  let activeModel = model;
  if (model === 'gemini-flash' || model === 'gemini-2.5-flash' || model === 'models/gemini-flash') {
    activeModel = 'gemini-flash-latest';
  } else if (model === 'gemini-pro' || model === 'gemini-2.5-pro' || model === 'models/gemini-pro') {
    activeModel = 'gemini-3.1-pro-preview';
  }

  const ai = new GoogleGenAI({ 
    apiKey: getApiKey(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
  
  const config: any = {};
  if (temperature !== undefined) {
    config.temperature = temperature;
  }
  if (maxOutputTokens !== undefined) {
    config.maxOutputTokens = maxOutputTokens;
  }

  const currentTurn: ConversationTurn = {
    role: 'user', parts: [{ text: prompt }]
  };

  const contents = history && history.length > 0
    ? [...history, currentTurn]
    : prompt;  // string shorthand when no history
  
  const callPromise = ai.models.generateContent({
    model: activeModel,
    contents,
    config,
  }) as Promise<any>;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Gemini timeout after ${GEMINI_TIMEOUT_MS}ms`)), GEMINI_TIMEOUT_MS)
  );

  const response = await Promise.race([callPromise, timeoutPromise]);
  
  return {
    text: (response as any).text || '',
    usage: (response as any).usage,
    finishReason: (response as any).candidates?.[0]?.finishReason,
  };
}

// ----------------------------------------------------------------------------
// CAPTURE GLOBALS & PRIMITIVES
// ----------------------------------------------------------------------------

export async function capturePrompt<T>({
  runId, phase, pass, step,
  model, temperature, maxOutputTokens, prompt, parser, parentEntryId, history, executionSequence
}: CapturePromptParams<T>): Promise<{ result: T; entryId: string; responseText: string }> {
  const startedAt = Date.now();
  const entryId = generateUlid();
  const showId = await resolveShowId(runId);

  // Pre-write a placeholder so partial state is visible if the call fails
  await writeConsoleEntry({
    id: entryId,
    runId,
    showId,
    eventType: 'prompt',
    phase,
    pass,
    step: step ?? null,
    input: { prompt, model, temperature, maxOutputTokens },
    output: { pending: true },
    error: null,
    parentEntryId: parentEntryId ?? null,
    producedArtifactId: null,
    producedCorpusId: null,
    metadata: { model, temperature, maxOutputTokens, executionSequence: executionSequence ?? undefined },
    createdAt: startedAt,
    schemaVersion: 1,
  });

  try {
    const response = await callGemini({ model, temperature, maxOutputTokens, prompt, history });
    
    let parsed: T;
    try {
      parsed = parser ? parser(response.text) : (response.text as unknown as T);
    } catch (parseErr) {
      // Parse failures populate error and rethrow, preserving duration on metadata
      const parseErrMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      await updateConsoleEntry(entryId, {
        error: `Parser Error: ${parseErrMsg}`,
        output: { raw: response.text },
        metadata: {
          model,
          temperature,
          tokensIn: response.usage?.inputTokens,
          tokensOut: response.usage?.outputTokens,
          durationMs: Date.now() - startedAt,
          finishReason: response.finishReason,
          parser: parser?.name ?? 'anonymous',
          executionSequence: executionSequence ?? undefined,
        },
      });
      throw parseErr;
    }

    await updateConsoleEntry(entryId, {
      output: { raw: response.text, parsed },
      metadata: {
        model,
        temperature,
        tokensIn: response.usage?.inputTokens,
        tokensOut: response.usage?.outputTokens,
        durationMs: Date.now() - startedAt,
        finishReason: response.finishReason,
        parser: parser?.name ?? undefined,
        executionSequence: executionSequence ?? undefined,
      },
    });

    return { result: parsed, entryId, responseText: response.text };
  } catch (err) {
    await updateConsoleEntry(entryId, {
      error: String(err),
      metadata: { durationMs: Date.now() - startedAt, executionSequence: executionSequence ?? undefined },
    });
    throw err;
  }
}

export async function captureAssembly(
  params: CaptureAssemblyParams
): Promise<{ assembled: string; entryId: string }> {
  const startedAt = Date.now();
  const entryId = generateUlid();
  const showId = await resolveShowId(params.runId);

  const MAX_STORAGE_CHARS = 48_000;  // ~48KB per fragment
  const TRUNCATION_NOTE = '\n... [TRUNCATED FOR STORAGE — FULL CONTENT SENT TO MODEL]';

  const storageFragments = (params.inputs.fragments || []).map(f => ({
    ...f,
    content: f.content.length > MAX_STORAGE_CHARS
      ? f.content.slice(0, MAX_STORAGE_CHARS) + TRUNCATION_NOTE
      : f.content,
  }));

  const storageOutput = typeof params.output === 'string' && params.output.length > MAX_STORAGE_CHARS
    ? params.output.slice(0, MAX_STORAGE_CHARS) + TRUNCATION_NOTE
    : params.output;

  const entry: Psb4ConsoleEntry = {
    id: entryId,
    runId: params.runId,
    showId,
    eventType: 'assembly',
    phase: params.phase,
    pass: params.pass,
    step: params.step ?? null,
    input: {
      ...params.inputs,
      fragments: storageFragments
    },
    output: { assembled: storageOutput },
    error: null,
    parentEntryId: params.parentEntryId ?? null,
    producedArtifactId: null,
    producedCorpusId: null,
    metadata: {
      fragmentCount: params.inputs.fragments?.length ?? 0,
      inputChars: JSON.stringify(params.inputs).length,
      outputChars: params.output.length,
      durationMs: Date.now() - startedAt,
      executionSequence: params.executionSequence ?? undefined,
    },
    createdAt: startedAt,
    schemaVersion: 1,
  };

  await writeConsoleEntry(entry);
  return { assembled: params.output, entryId };
}

export async function captureSynthesis<T>(
  params: CaptureSynthesisParams<T>
): Promise<{ synthesized: T; entryId: string }> {
  const startedAt = Date.now();
  const entryId = generateUlid();
  const showId = await resolveShowId(params.runId);

  const entry: Psb4ConsoleEntry = {
    id: entryId,
    runId: params.runId,
    showId,
    eventType: 'synthesis',
    phase: params.phase,
    pass: params.pass,
    step: params.step ?? null,
    input: params.input,
    output: { synthesized: params.synthesized },
    error: params.error ?? null,
    parentEntryId: params.parentEntryId ?? null,
    producedArtifactId: null,
    producedCorpusId: null,
    metadata: {
      parser: params.parserName ?? undefined,
      inputChars: typeof params.input === 'string' ? params.input.length : JSON.stringify(params.input).length,
      outputChars: JSON.stringify(params.synthesized).length,
      durationMs: Date.now() - startedAt,
      executionSequence: params.executionSequence ?? undefined,
    },
    createdAt: startedAt,
    schemaVersion: 1,
  };

  await writeConsoleEntry(entry);
  return { synthesized: params.synthesized, entryId };
}

export async function captureError(params: {
  runId: string;
  phase: string;
  pass: string;
  step: string | null;
  error: string;
  parentEntryId?: string | null;
  executionSequence?: number;
}): Promise<void> {
  const showId = await resolveShowId(params.runId);
  let resolvedError = params.error;
  if (!resolvedError || resolvedError === 'undefined') {
    resolvedError = 'Unknown error occurred during pass execution';
  }
  await writeConsoleEntry({
    id: generateUlid(),
    runId: params.runId,
    showId,
    eventType: 'error',
    phase: params.phase as any,
    pass: params.pass,
    step: params.step,
    input: null,
    output: null,
    error: resolvedError,
    parentEntryId: params.parentEntryId ?? null,
    producedArtifactId: null,
    producedCorpusId: null,
    metadata: { executionSequence: params.executionSequence ?? undefined },
    createdAt: Date.now(),
    schemaVersion: 1,
  });
}
