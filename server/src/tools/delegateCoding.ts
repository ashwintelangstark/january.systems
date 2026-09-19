import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

export interface DelegateCodingArgs {
  prompt: string;
  language?: string;
  context?: string;
}

export interface DelegateCodingResult {
  success: boolean;
  model: string;
  response: string;
  codeSnippet?: string;
  language?: string;
  compilationCommand?: string;
  verbalSummary?: string;
  error?: string;
}

/**
 * Detects primary programming language from prompt or code content
 */
function detectLanguage(prompt: string, explicitLang?: string): string {
  if (explicitLang) {
    const l = explicitLang.toLowerCase();
    if (l.includes('c++') || l.includes('cpp') || l.includes('cxx')) return 'cpp';
    if (l === 'c' || l.includes('c language') || l.includes('c program')) return 'c';
    if (l.includes('python') || l.includes('py')) return 'python';
    return l;
  }
  const lower = prompt.toLowerCase();
  if (/(?:c\+\+|cpp|cxx|g\+\+|std::|\bstl\b|iostream|<vector>|<memory>|<algorithm>)/i.test(lower)) return 'cpp';
  if (/(?:\bc\s+(?:program|code|language|script|file|syntax)|\bin\s+c\b|\bstdio\.h|\bmalloc\b|\bfree\b|\bpointers?\b|\bgcc\b|\bclang\b)/i.test(lower)) {
    if (!/(?:c\+\+|cpp|cxx|g\+\+|std::|iostream)/i.test(lower)) {
      return 'c';
    }
  }
  if (/(?:python|python3|\bpy\b|\bpip\b|django|flask|numpy|pandas)/i.test(lower)) return 'python';
  return 'python';
}

/**
 * Extracts compilation or execution instructions based on language
 */
function getRunInstructions(lang: string): string {
  switch (lang.toLowerCase()) {
    case 'c':
      return 'gcc -Wall -Wextra -O2 main.c -o main && ./main';
    case 'cpp':
    case 'c++':
      return 'g++ -std=c++17 -Wall -Wextra -O2 main.cpp -o main && ./main';
    case 'python':
    default:
      return 'python3 main.py';
  }
}

/**
 * Generates a voice-friendly 1-sentence verbal summary for audio speakers
 */
function getVerbalSummary(prompt: string, lang: string): string {
  const cleanLang = lang === 'cpp' ? 'C++' : lang === 'c' ? 'C' : 'Python';
  return `I've generated the ${cleanLang} code for you on screen with full explanations and compilation instructions.`;
}

/**
 * Core software engineering and coding synthesis engine.
 * Focused specifically on Python, C, and C++ systems programming, algorithms, and utilities.
 * Executes through a resilient multi-tier pipeline:
 * 1. Anthropic Claude (if valid sk-ant- key)
 * 2. Google Gemini API (High-speed, robust primary fallback)
 * 3. Local Claude Code Proxy (if active on 127.0.0.1:8082)
 * 4. Local Ollama (if active on 127.0.0.1:11434)
 */
export async function delegateCoding(args: DelegateCodingArgs): Promise<DelegateCodingResult> {
  const { prompt, language, context } = args;

  if (!prompt || typeof prompt !== 'string') {
    return {
      success: false,
      model: 'None',
      response: 'Error: A valid coding prompt must be provided.',
      error: 'Empty prompt',
    };
  }

  const targetLang = detectLanguage(prompt, language);
  console.log(`[CodingEngine] Processing coding task (${targetLang.toUpperCase()}): "${prompt.slice(0, 80)}..."`);

  const systemPrompt =
    'You are the elite, world-class software engineering and systems programming engine inside January AI.\n' +
    'SPECIALIZATION & CORE FOCUS:\n' +
    'You specialize in Python, C, and C++ software engineering, algorithms, data structures, and systems programming.\n\n' +
    'STRICT CODE GENERATION STANDARDS:\n' +
    '1. PYTHON: Write idiomatic, clean, modern Python 3. Include type hints, clear docstrings, error handling, and an `if __name__ == "__main__":` test/demo execution block.\n' +
    '2. C: Write standard C99/C11 code with all necessary standard headers (`#include <stdio.h>`, `#include <stdlib.h>`, etc.). Ensure proper memory management (`malloc`/`free`), pointer safety, zero memory leaks, and standard return codes.\n' +
    '3. C++: Write modern C++17/C++20 with standard headers (`#include <iostream>`, `<vector>`, `<memory>`, `<algorithm>`), RAII, STL containers, clean classes/structs, and a runnable `main()` function.\n\n' +
    'OUTPUT FORMAT:\n' +
    '1. A brief 1-sentence introduction.\n' +
    '2. The complete, self-contained, fully runnable code block with the exact language specifier (```python, ```c, or ```cpp).\n' +
    '3. A concise breakdown of how it works and time/space complexity.\n' +
    '4. The exact compilation and execution commands (e.g. `gcc main.c -o main && ./main` or `python3 main.py`).';

  let userContent = prompt;
  if (context) {
    userContent = `Context:\n${context}\n\nTask:\n${prompt}`;
  }
  userContent += `\nTarget Language: ${targetLang.toUpperCase()}`;

  // =========================================================================
  // TIER 1: Anthropic Cloud API (if key starts with sk-ant- and is reachable)
  // =========================================================================
  if (config.claudeApiKey && config.claudeApiKey.startsWith('sk-ant-')) {
    try {
      console.log('[CodingEngine] Attempting generation with Anthropic Claude API...');
      const anthropic = new Anthropic({
        apiKey: config.claudeApiKey,
        timeout: 7000, // 7-second strict timeout
      });

      const response = await anthropic.messages.create({
        model: config.claudeModel,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      });

      let fullText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          fullText += block.text + '\n';
        }
      }
      fullText = fullText.trim();

      if (fullText) {
        const codeMatch = fullText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
        const codeSnippet = codeMatch ? codeMatch[1].trim() : undefined;
        console.log(`[CodingEngine] Successfully generated with Claude 3.7 Sonnet (${fullText.length} chars).`);

        return {
          success: true,
          model: `Claude 3.7 Sonnet (${config.claudeModel})`,
          response: fullText,
          codeSnippet,
          language: targetLang,
          compilationCommand: getRunInstructions(targetLang),
          verbalSummary: getVerbalSummary(prompt, targetLang),
        };
      }
    } catch (e: any) {
      console.warn('[CodingEngine] Claude API unavailable or errored:', e.message, '-> Seamlessly falling back to Google Gemini...');
    }
  }

  // =========================================================================
  // TIER 2: Google Gemini API (Primary / Instant High-Speed Fallback)
  // =========================================================================
  if (config.geminiApiKey) {
    const candidateModels = [
      'models/gemini-3.6-flash',
      'models/gemini-3.5-flash-lite',
      'models/gemini-2.5-flash',
    ];

    for (const model of candidateModels) {
      try {
        console.log(`[CodingEngine] Generating ${targetLang.toUpperCase()} code with Google Gemini API (${model})...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${config.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: userContent }],
                },
              ],
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
              generationConfig: {
                temperature: 0.2, // low temperature for precise, bug-free code
                maxOutputTokens: 4096,
              },
            }),
          }
        );

        clearTimeout(timeout);
        const data = (await response.json()) as any;

        if (response.ok && data?.candidates?.[0]?.content?.parts) {
          const fullText = data.candidates[0].content.parts
            .map((p: any) => p.text || '')
            .join('')
            .trim();

          if (fullText) {
            const codeMatch = fullText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
            const codeSnippet = codeMatch ? codeMatch[1].trim() : undefined;
            console.log(`[CodingEngine] Successfully generated with Google Gemini (${model}, ${fullText.length} chars).`);

            return {
              success: true,
              model: `Google Gemini (${model.replace('models/', '')})`,
              response: fullText,
              codeSnippet,
              language: targetLang,
              compilationCommand: getRunInstructions(targetLang),
              verbalSummary: getVerbalSummary(prompt, targetLang),
            };
          }
        }

        console.warn(`[CodingEngine] Gemini model ${model} returned status ${response.status}:`, data?.error?.message?.slice(0, 80));
      } catch (err: any) {
        console.warn(`[CodingEngine] Gemini attempt failed for ${model}:`, err.message);
      }
    }
  }

  // =========================================================================
  // TIER 3: Local Claude Code Proxy (fcc-server on 127.0.0.1:8082 with timeout)
  // =========================================================================
  try {
    const proxyUrl = config.claudeProxyUrl || 'http://127.0.0.1:8082';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const proxyCheck = await fetch(`${proxyUrl}/health`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeout);

    if (proxyCheck && (proxyCheck.ok || proxyCheck.status === 204)) {
      console.log(`[CodingEngine] Connecting via Claude Code proxy (${proxyUrl})...`);
      const postController = new AbortController();
      const postTimeout = setTimeout(() => postController.abort(), 8000);

      const proxyRes = await fetch(`${proxyUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'freecc',
          'anthropic-version': '2023-06-01',
        },
        signal: postController.signal,
        body: JSON.stringify({
          model: config.claudeModel,
          max_tokens: 4096,
          stream: false,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      clearTimeout(postTimeout);

      if (proxyRes.ok) {
        const rawBody = await proxyRes.text();
        let fullText = '';
        try {
          const data = JSON.parse(rawBody);
          if (Array.isArray(data.content)) {
            const textBlocks = data.content.filter((b: any) => b.type === 'text');
            if (textBlocks.length > 0) fullText = textBlocks.map((b: any) => b.text).join('\n');
          }
        } catch {
          fullText = rawBody;
        }

        fullText = fullText.trim();
        if (fullText) {
          const codeMatch = fullText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
          const codeSnippet = codeMatch ? codeMatch[1].trim() : undefined;

          return {
            success: true,
            model: `Claude 3.7 Sonnet (Local Proxy)`,
            response: fullText,
            codeSnippet,
            language: targetLang,
            compilationCommand: getRunInstructions(targetLang),
            verbalSummary: getVerbalSummary(prompt, targetLang),
          };
        }
      }
    }
  } catch (err: any) {
    // Ignore proxy failure
  }

  // =========================================================================
  // TIER 4: Local Ollama (with strict 2s timeout check)
  // =========================================================================
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'qwen2.5-coder:latest',
        prompt: `${systemPrompt}\n\nTask: ${userContent}`,
        stream: false,
      }),
    });

    clearTimeout(timeout);

    if (ollamaRes.ok) {
      const data = (await ollamaRes.json()) as any;
      const fullText = (data.response || '').trim();
      const codeMatch = fullText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
      const codeSnippet = codeMatch ? codeMatch[1].trim() : undefined;

      return {
        success: true,
        model: 'Local Ollama Coder',
        response: fullText,
        codeSnippet,
        language: targetLang,
        compilationCommand: getRunInstructions(targetLang),
        verbalSummary: getVerbalSummary(prompt, targetLang),
      };
    }
  } catch (err: any) {
    // Ignore Ollama failure
  }

  return {
    success: false,
    model: 'None',
    response: `Coding Engine Error: Unable to reach Claude API or Gemini API. Please ensure your GEMINI_API key is configured in server/.env.`,
    error: 'AI coding engines unreachable',
  };
}
