import { useState, useEffect, useRef, useCallback } from 'react';
import { AgentState, ChatMessage, ActiveTool, ClientConfig, EmotionState } from '../types';
import { AudioInputManager } from '../audio/audioInputManager';
import { AudioOutputManager } from '../audio/audioOutputManager';

export function useAgentSocket(activeSessionId?: string, onVoiceTranscript?: (text: string) => void) {
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
  const [isListening, setIsListening] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isEyesOpen, setIsEyesOpen] = useState(false);
  const [config, setConfig] = useState<ClientConfig | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const audioInputRef = useRef<AudioInputManager | null>(null);
  const audioOutputRef = useRef<AudioOutputManager | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(true);
  const isMicMutedRef = useRef<boolean>(false);
  const agentStateRef = useRef<AgentState>(agentState);
  const onVoiceTranscriptRef = useRef(onVoiceTranscript);

  // Keep refs synchronized
  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    agentStateRef.current = agentState;
  }, [agentState]);

  useEffect(() => {
    onVoiceTranscriptRef.current = onVoiceTranscript;
  }, [onVoiceTranscript]);

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

  // Connect WebSocket with Resilient Auto-Reconnect
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      const wsUrl =
        window.location.port === '5173'
          ? `${wsProtocol}//${window.location.host}/ws`
          : `${wsProtocol}//${host}:3001`;

      console.log(`[useAgentSocket] Connecting to January Agent WebSocket: ${wsUrl}`);
      try {
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (isDisposed) {
            ws?.close();
            return;
          }
          console.log('[useAgentSocket] Connected to January Core backend.');
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case 'state_change': {
                setAgentState(msg.state);
                // Echo cancellation: auto mute mic level while speaking
                if (audioInputRef.current) {
                  if (msg.state === 'speaking') {
                    audioInputRef.current.setMute(true);
                  } else {
                    audioInputRef.current.setMute(isMicMutedRef.current);
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
                  audioOutputRef.current.playChunk(msg.data, msg.mimeType || 'audio/mpeg');
                }
                break;
              }

              case 'transcript': {
                const { role, text, isFinal, source: msgSource } = msg.payload;

                setMessages((prev) => {
                  if (role === 'user') {
                    const isDuplicate = prev.some(
                      (m) =>
                        m.role === 'user' &&
                        m.text.trim().toLowerCase() === text.trim().toLowerCase() &&
                        Math.abs(Date.now() - m.timestamp) < 20000
                    );
                    if (isDuplicate) {
                      return prev;
                    }
                  }

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
                        source: msgSource || (role === 'user' ? 'voice' : 'agent'),
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
                if (audioInputRef.current) audioInputRef.current.setMute(isMicMutedRef.current);
                break;
              }

              case 'audio_level': {
                setInputLevel(msg.level);
                break;
              }

              case 'camera_state': {
                setIsEyesOpen(!!msg.isEyesOpen);
                break;
              }
            }
          } catch (err: any) {
            console.error('[useAgentSocket] Error parsing server message:', err.message);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          if (!isDisposed) {
            reconnectTimeout = setTimeout(connect, 2000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        if (!isDisposed) {
          reconnectTimeout = setTimeout(connect, 2000);
        }
      }
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  // Send Text Message
  const sendTextMessage = useCallback(
    (text: string, explicitSessionId?: string, source: 'text' | 'voice' = 'text') => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const targetSid = explicitSessionId || activeSessionId;

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          role: 'user',
          source,
          text: trimmed,
          timestamp: Date.now(),
          isStreaming: false,
        },
      ]);

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'text_input',
            text: trimmed,
            source,
            sessionId: targetSid,
          })
        );
      }
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
  }, []);

  const triggerSleep = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({ type: 'sleep_trigger' }));
  }, []);

  const interrupt = useCallback(() => {
    if (audioOutputRef.current) audioOutputRef.current.flush();
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
    fetch('/api/voice/stop', { method: 'POST' }).catch(() => {});
    setAgentState('passive');
  }, []);

  const toggleMuteAudio = useCallback(() => {
    setIsAudioMuted((prev) => {
      const next = !prev;
      if (audioOutputRef.current) audioOutputRef.current.setMute(next);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'set_speaker_mute', muted: next }));
      }
      return next;
    });
  }, []);

  const toggleListening = useCallback(() => {
    if (agentState === 'sleeping') {
      triggerWake('manual');
    } else {
      triggerSleep();
    }
  }, [agentState, triggerSleep, triggerWake]);

  const setEyes = useCallback((open: boolean) => {
    setIsEyesOpen(open);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'set_camera_eyes', open, fps: 60 }));
    }
  }, []);

  const toggleEyes = useCallback(() => {
    setIsEyesOpen((prev) => {
      const next = !prev;
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'set_camera_eyes', open: next, fps: 60 }));
      }
      return next;
    });
  }, []);

  // Start continuous listening with user gesture
  const startListening = useCallback(async () => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.warn('[Web STT] SpeechRecognition is not supported in this browser.');
      return;
    }

    try {
      if (audioInputRef.current) {
        await audioInputRef.current.start();
        audioInputRef.current.setMute(false);
      }
    } catch (err: any) {
      console.warn('[Web STT] Mic capture initialization notice:', err.message);
    }

    setIsMicMuted(false);
    isMicMutedRef.current = false;
    setIsListening(true);
    isListeningRef.current = true;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'set_mic_mute', muted: false }));
    }

    if (!recognitionRef.current) {
      try {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          isListeningRef.current = true;
          console.log('🎙️ [Web STT] Microphone is active and listening for your speech.');
        };

        recognition.onresult = (event: any) => {
          let interimText = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0]?.transcript || '';

            if (result.isFinal) {
              const clean = transcript.trim();
              if (clean) {
                console.log(`🎙️ [Web STT] Spoken query captured: "${clean}"`);
                setInterimTranscript('');

                const lower = clean.toLowerCase().replace(/[^\w\s]/g, '').trim();

                // Voice Command: Rise / Wake
                if (
                  lower === 'rise' ||
                  lower === 'wake up' ||
                  lower === 'wake' ||
                  lower === 'arise' ||
                  lower === 'hey january'
                ) {
                  triggerWake('voice');
                }
                // Voice Command: Good Night / Sleep
                else if (
                  lower === 'good night' ||
                  lower === 'goodnight' ||
                  lower === 'sleep' ||
                  lower === 'go to sleep' ||
                  lower === 'standby'
                ) {
                  triggerSleep();
                }
                // Voice Command: Eyes Open / Open Camera
                else if (
                  lower === 'eyes open' ||
                  lower === 'open eyes' ||
                  lower === 'camera open' ||
                  lower === 'open camera' ||
                  lower === 'eyes on' ||
                  lower === 'turn on camera' ||
                  lower === 'enable camera' ||
                  lower.includes('eyes open') ||
                  lower.includes('open eyes') ||
                  lower.includes('open camera')
                ) {
                  setEyes(true);
                }
                // Voice Command: Eyes Closed / Close Camera
                else if (
                  lower === 'eyes closed' ||
                  lower === 'close eyes' ||
                  lower === 'camera closed' ||
                  lower === 'close camera' ||
                  lower === 'eyes off' ||
                  lower === 'turn off camera' ||
                  lower === 'disable camera' ||
                  lower.includes('eyes closed') ||
                  lower.includes('close eyes') ||
                  lower.includes('close camera')
                ) {
                  setEyes(false);
                }
                // Voice Query -> Send to January Brain & LLM Response
                else {
                  if (onVoiceTranscriptRef.current) {
                    onVoiceTranscriptRef.current(clean);
                  } else {
                    sendTextMessage(clean, undefined, 'voice');
                  }
                }
              }
            } else {
              interimText += transcript;
            }
          }

          if (interimText.trim()) {
            setInterimTranscript(interimText.trim());
            if (agentStateRef.current === 'passive') {
              setAgentState('listening');
            }
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'no-speech' || event.error === 'aborted') {
            return;
          }
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            console.warn('⚠️ [Web STT] Microphone access was not permitted by the user or browser.');
            setIsListening(false);
            isListeningRef.current = false;
            setIsMicMuted(true);
            isMicMutedRef.current = true;
            return;
          }
          console.debug('[Web STT] Recognition event notice:', event.error);
        };

        recognition.onend = () => {
          if (!isMicMutedRef.current) {
            setIsListening(true);
            isListeningRef.current = true;
            // 24/7 Auto-recovery: Re-engage recognition seamlessly when browser silence timeout expires
            setTimeout(() => {
              if (!isMicMutedRef.current && agentStateRef.current !== 'speaking') {
                try {
                  recognition.start();
                } catch (err: any) {
                  setTimeout(() => {
                    if (!isMicMutedRef.current && agentStateRef.current !== 'speaking') {
                      try {
                        recognition.start();
                      } catch {}
                    }
                  }, 250);
                }
              }
            }, 100);
          } else {
            setIsListening(false);
            isListeningRef.current = false;
          }
        };

        recognitionRef.current = recognition;
      } catch (err: any) {
        console.warn('[Web STT] SpeechRecognition error:', err.message);
      }
    }

    try {
      recognitionRef.current?.start();
    } catch (err: any) {
      // If already started, ignore
    }
  }, [triggerWake, triggerSleep, toggleEyes, sendTextMessage]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    isListeningRef.current = false;
    setIsMicMuted(true);
    isMicMutedRef.current = true;
    setInterimTranscript('');

    if (audioInputRef.current) {
      audioInputRef.current.setMute(true);
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'set_mic_mute', muted: true }));
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) {}
    }
  }, []);

  const toggleMuteMic = useCallback(async () => {
    if (isListeningRef.current && !isMicMutedRef.current) {
      stopListening();
    } else {
      await startListening();
    }
  }, [startListening, stopListening]);

  // 24/7 Continuous Listening: Auto-start on mount and unlock on initial user gesture
  useEffect(() => {
    startListening();

    const unlockContinuousMic = () => {
      if (!isMicMutedRef.current) {
        startListening();
      }
    };

    window.addEventListener('pointerdown', unlockContinuousMic, { once: true });
    window.addEventListener('keydown', unlockContinuousMic, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockContinuousMic);
      window.removeEventListener('keydown', unlockContinuousMic);
    };
  }, [startListening]);

  // Echo cancellation: pause speech recognition when January is speaking, resume immediately after
  useEffect(() => {
    if (agentState === 'speaking') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    } else {
      if (!isMicMutedRef.current) {
        setIsListening(true);
        isListeningRef.current = true;
        setTimeout(() => {
          if (!isMicMutedRef.current && agentStateRef.current !== 'speaking') {
            try {
              recognitionRef.current?.start();
            } catch {}
          }
        }, 150);
      }
    }
  }, [agentState]);

  // Clean unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
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
    isListening,
    interimTranscript,
    isAudioMuted,
    isEyesOpen,
    config,
    sendTextMessage,
    startListening,
    stopListening,
    triggerWake,
    triggerSleep,
    toggleListening,
    toggleEyes,
    setEyes,
    interrupt,
    toggleMuteMic,
    toggleMuteAudio,
  };
}
