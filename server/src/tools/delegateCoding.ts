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
  htmlPreview?: string;
  isWebApp?: boolean;
  error?: string;
}

export async function delegateCoding(args: DelegateCodingArgs): Promise<DelegateCodingResult> {
  const { prompt, language, context } = args;

  if (!prompt || typeof prompt !== 'string') {
    return {
      success: false,
      model: config.claudeModel,
      response: 'Error: A valid coding or simulation prompt must be provided.',
      error: 'Empty prompt',
    };
  }

  console.log(`[Tool:delegate_coding] Delegating coding/simulation task to Claude 3.7 Sonnet... Prompt: "${prompt.slice(0, 80)}..."`);

  const isSimulationOrWeb = /simulation|simulate|web\s*app|website|html|ui|frontend|visualizer|game|calculator|timer|stopwatch|dashboard/i.test(prompt);

  const systemPrompt =
    'You are Claude 3.7 Sonnet, the specialized elite software engineering and simulation engine inside January AI.\n' +
    'RULES FOR CODE, SIMULATIONS & APPS:\n' +
    '1. Provide clean, production-grade, highly optimized, and well-structured code based directly on what the user requested.\n' +
    '2. If asked to develop a simulation, interactive web application, widget, or UI, provide a self-contained, fully runnable single-file HTML5/CSS3/JavaScript document enclosed in a ```html code block so it renders live in the browser preview.\n' +
    '3. Structure your answer with a very brief 1-sentence introduction followed by the complete code block.\n' +
    '4. Never output unnecessary boilerplate conversational fluff.';

  let userContent = prompt;
  if (context) {
    userContent = `Context:\n${context}\n\nTask:\n${prompt}`;
  }
  if (language) {
    userContent += `\nTarget Language / Framework: ${language}`;
  } else if (isSimulationOrWeb) {
    userContent += `\nFormat: Complete runnable single-file HTML5/CSS/JavaScript with interactive canvas or UI.`;
  }

  // Strategy 1: Direct Anthropic Cloud API (if key starts with sk-ant-)
  if (config.claudeApiKey && config.claudeApiKey.startsWith('sk-ant-')) {
    try {
      const anthropic = new Anthropic({
        apiKey: config.claudeApiKey,
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

      const codeMatch = fullText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
      const codeSnippet = codeMatch ? codeMatch[1].trim() : undefined;
      const htmlPreview = isSimulationOrWeb && codeSnippet ? codeSnippet : undefined;

      return {
        success: true,
        model: config.claudeModel,
        response: fullText,
        codeSnippet,
        htmlPreview,
        isWebApp: Boolean(htmlPreview) || isSimulationOrWeb,
      };
    } catch (e: any) {
      console.warn('[Tool:delegate_coding] Official Anthropic API error:', e.message);
    }
  }

  // Strategy 2: Local Claude Code Proxy (fcc-server on 127.0.0.1:8082 or config.claudeProxyUrl)
  try {
    const proxyUrl = config.claudeProxyUrl || 'http://127.0.0.1:8082';
    const proxyCheck = await fetch(`${proxyUrl}/health`).catch(() => null);
    if (proxyCheck && (proxyCheck.ok || proxyCheck.status === 204)) {
      console.log(`[Tool:delegate_coding] Connecting via Claude Code proxy (${proxyUrl})...`);

      const proxyRes = await fetch(`${proxyUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'freecc',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.claudeModel,
          max_tokens: 4096,
          stream: false,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });

      let fullText = '';
      if (proxyRes.ok) {
        const rawBody = await proxyRes.text();
        try {
          const data = JSON.parse(rawBody);
          if (Array.isArray(data.content)) {
            const textBlocks = data.content.filter((b: any) => b.type === 'text');
            if (textBlocks.length > 0) {
              fullText = textBlocks.map((b: any) => b.text).join('\n');
            }
          }
        } catch {
          // If body is SSE stream or text
          const textMatches = [...rawBody.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
          if (textMatches.length > 0) {
            fullText = textMatches
              .map((m) => {
                try {
                  return JSON.parse(`"${m[1]}"`);
                } catch {
                  return m[1];
                }
              })
              .join('');
          } else {
            fullText = rawBody;
          }
        }
      }

      fullText = fullText.trim();

      if (fullText) {
        const codeMatch = fullText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
        const codeSnippet = codeMatch ? codeMatch[1].trim() : undefined;
        let htmlPreview: string | undefined = undefined;
        if (codeMatch) {
          const blockTypeMatch = fullText.match(/```([a-zA-Z0-9_-]+)/);
          const lang = blockTypeMatch ? blockTypeMatch[1].toLowerCase() : '';
          if (
            lang === 'html' ||
            codeSnippet?.includes('<html') ||
            codeSnippet?.includes('<!DOCTYPE') ||
            codeSnippet?.includes('<body') ||
            codeSnippet?.includes('<canvas') ||
            codeSnippet?.includes('<div')
          ) {
            htmlPreview = codeSnippet;
          }
        }

        console.log(`[Tool:delegate_coding] Successfully generated via Claude Code proxy (${fullText.length} chars).`);

        return {
          success: true,
          model: `${config.claudeModel} (Claude Engine)`,
          response: fullText,
          codeSnippet,
          htmlPreview,
          isWebApp: Boolean(htmlPreview) || isSimulationOrWeb,
        };
      }
    }
  } catch (err: any) {
    console.warn('[Tool:delegate_coding] Claude proxy error:', err.message);
  }

  // Strategy 3: Local Ollama fallback (qwen3-coder:30b / qwen2.5:latest)
  try {
    console.log('[Tool:delegate_coding] Fallback to local Ollama coding model (qwen3-coder:30b)...');
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3-coder:30b',
        prompt: `${systemPrompt}\n\nTask: ${userContent}`,
        stream: false,
      }),
    });

    if (ollamaRes.ok) {
      const data = (await ollamaRes.json()) as any;
      const fullText = (data.response || '').trim();

      const codeMatch = fullText.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
      const codeSnippet = codeMatch ? codeMatch[1].trim() : undefined;
      const htmlPreview = isSimulationOrWeb && codeSnippet ? codeSnippet : undefined;

      return {
        success: true,
        model: 'qwen3-coder:30b (Ollama Local)',
        response: fullText,
        codeSnippet,
        htmlPreview,
        isWebApp: Boolean(htmlPreview) || isSimulationOrWeb,
      };
    }
  } catch (err: any) {
    console.warn('[Tool:delegate_coding] Ollama fallback error:', err.message);
  }

  return {
    success: false,
    model: config.claudeModel,
    response: `Anthropic Claude API Error: Please ensure server/.env has a valid Claude API key (sk-ant-...) or that the local Claude Code server is active.`,
    error: 'Authentication or connection error',
  };
}
