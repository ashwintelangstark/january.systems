import { useState, useEffect, useRef, useCallback } from 'react';
import { AgentState, ChatMessage, ActiveTool, ClientConfig, EmotionState } from '../types';
import { AudioInputManager } from '../audio/audioInputManager';
import { AudioOutputManager } from '../audio/audioOutputManager';

export function useAgentSocket(activeSessionId?: string) {
  const [agentState, setAgentState] = useState<AgentState>('passive');
  const [emotionState, setEmotionState] = useState<EmotionState>({
    emotion: 'curious',
    valence: 0.4,
    arousal: 0.6,
    tone: 'curious',
    pitch: '+2Hz',
    rate: '+2%',
    color: '#00F5FF',
  });
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTools, setActiveTools] = useState<ActiveTool[]>([]);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [config, setConfig] = useState<ClientConfig | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const audioInputRef = useRef<AudioInputManager | null>(null);
  const audioOutputRef = useRef<AudioOutputManager | null>(null);

  // Initialize Audio Managers
  useEffect(() => {
    // Audio Output Manager
    const outputMgr = new AudioOutputManager((lvl) => {
      setOutputLevel(lvl);
    });
    audioOutputRef.current = outputMgr;

    // Audio Input (Mic) Manager
    const inputMgr = new AudioInputManager(
      (base64Chunk) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: 'audio_input',
              data: base64Chunk,
            })
          );
        }
      },
      (lvl) => {
        setInputLevel(lvl);
      }
    );
    audioInputRef.current = inputMgr;

    // Start mic capture when user interacts
    inputMgr.start().catch((err) => {
      console.warn('[useAgentSocket] Microphone access pending user interaction:', err.message);
    });

    return () => {
      inputMgr.stop();
      outputMgr.flush();
    };
  }, []);

  // Fetch initial config & health
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.log('[useAgentSocket] Server health notice:', err.message));
  }, []);

  // Connect WebSocket
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const port = window.location.port === '5173' ? '3001' : window.location.port || '3001';
    const wsUrl = `${wsProtocol}//${host}:${port}`;

    console.log(`[useAgentSocket] Connecting to January Agent WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('[useAgentSocket] Connected to January Core backend.');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'state_change': {
            setAgentState(msg.state);
            // Echo cancellation: auto mute mic while speaking
            if (audioInputRef.current) {
              if (msg.state === 'speaking') {
                audioInputRef.current.setMute(true);
              } else {
                audioInputRef.current.setMute(isMicMuted);
              }
            }
            break;
          }

          case 'emotion_update': {
            if (msg.payload) {
              setEmotionState(msg.payload);
            }
            break;
          }

          case 'audio_output': {
            if (audioOutputRef.current && msg.data) {
              audioOutputRef.current.playChunk(msg.data);
            }
            break;
          }

          case 'transcript': {
            const { role, text, isFinal } = msg.payload;

            // Trigger speech output if final assistant response
            if (role === 'assistant' && isFinal && text && !isAudioMuted) {
              if (audioOutputRef.current && !audioOutputRef.current.isPlaying()) {
                audioOutputRef.current.speakSynthesizedText(text, emotionState.emotion);
              }
            }

            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === role && last.isStreaming) {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...last,
                    text: last.text + text,
                    isStreaming: !isFinal,
                  },
                ];
              } else {
                return [
                  ...prev,
                  {
                    id: Math.random().toString(36).substring(2, 9),
                    role,
                    source: 'voice',
                    text,
                    timestamp: Date.now(),
                    isStreaming: !isFinal,
                  },
                ];
              }
            });
            break;
          }

          case 'tool_call': {
            const { id, name, args } = msg.payload;
            setActiveTools((prev) => [
              {
                id,
                name,
                args,
                status: 'running',
                startedAt: Date.now(),
              },
              ...prev,
            ]);
            break;
          }

          case 'tool_result': {
            const { id, result, isError } = msg.payload;
            setActiveTools((prev) =>
              prev.map((t) =>
                t.id === id
                  ? {
                      ...t,
                      result,
                      status: isError ? 'failed' : 'completed',
                    }
                  : t
              )
            );
            break;
          }

          case 'interrupt': {
            if (audioOutputRef.current) audioOutputRef.current.flush();
            if (audioInputRef.current) audioInputRef.current.setMute(false);
            break;
          }

          case 'audio_level': {
            setInputLevel(msg.level);
            break;
          }
        }
      } catch (err: any) {
        console.error('[useAgentSocket] Error parsing server message:', err.message);
      }
    };

    ws.onclose = () => {
      console.warn('[useAgentSocket] Disconnected from server. Reconnecting in 3s...');
      setIsConnected(false);
    };

    ws.onerror = (err) => {
      console.error('[useAgentSocket] WebSocket error:', err);
    };

    return () => {
      ws.close();
    };
  }, [isMicMuted]);

  // Send Text Message
  const sendTextMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !socketRef.current) return;

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'user',
          source: 'text',
          text: text.trim(),
          timestamp: Date.now(),
          isStreaming: false,
        },
      ]);

      socketRef.current.send(
        JSON.stringify({
          type: 'text_input',
          text: text.trim(),
          sessionId: activeSessionId,
        })
      );
    },
    [activeSessionId]
  );

  // Trigger Wake
  const triggerWake = useCallback((source: 'voice' | 'manual' = 'manual') => {
    if (!socketRef.current) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'wake_trigger',
        source,
      })
    );

    // Audio cue tone
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }, []);

  const triggerSleep = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({ type: 'sleep_trigger' }));
  }, []);

  const interrupt = useCallback(() => {
    if (audioOutputRef.current) audioOutputRef.current.flush();
    if (socketRef.current) socketRef.current.send(JSON.stringify({ type: 'interrupt' }));
  }, []);

  const toggleMuteMic = useCallback(() => {
    setIsMicMuted((prev) => {
      const next = !prev;
      if (audioInputRef.current) audioInputRef.current.setMute(next);
      return next;
    });
  }, []);

  const toggleMuteAudio = useCallback(() => {
    setIsAudioMuted((prev) => {
      const next = !prev;
      if (audioOutputRef.current) audioOutputRef.current.setMute(next);
      return next;
    });
  }, []);

  return {
    agentState,
    emotionState,
    isConnected,
    messages,
    setMessages,
    activeTools,
    inputLevel,
    outputLevel,
    isMicMuted,
    isAudioMuted,
    config,
    sendTextMessage,
    triggerWake,
    triggerSleep,
    interrupt,
    toggleMuteMic,
    toggleMuteAudio,
  };
}
