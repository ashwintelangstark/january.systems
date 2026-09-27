import React, { useState, useEffect } from 'react';
import { useAgentSocket } from './hooks/useAgentSocket';
import { JanuaryCosmicOrb } from './components/orb/JanuaryCosmicOrb';
import { LiquidGlassDrawer } from './components/drawer/LiquidGlassDrawer';
import { FloatingPromptBar } from './components/input/FloatingPromptBar';
import { TopStatusBar } from './components/hud/TopStatusBar';
import {
  fetchSessions,
  createSession,
  fetchSessionMessages,
  toggleCameraEyes,
  uploadAttachment,
} from './utils/api';
import { BrainSession } from './types';

export const App: React.FC = () => {
  const [sessions, setSessions] = useState<BrainSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('s-1');
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isEyesOpen, setIsEyesOpen] = useState(false);

  const [isChatExpanded, setIsChatExpanded] = useState(false);

  const {
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
    interrupt,
    toggleMuteMic,
    toggleMuteAudio,
  } = useAgentSocket(activeSessionId);

  // Load Brain Sessions on Mount
  useEffect(() => {
    fetchSessions().then(async (loadedSessions) => {
      setSessions(loadedSessions);
      if (loadedSessions.length > 0) {
        const initialId = loadedSessions[0].id;
        setActiveSessionId(initialId);
        try {
          const msgs = await fetchSessionMessages(initialId);
          if (msgs.length > 0) {
            setMessages(msgs);
          }
        } catch {}
      }
    });

    // Check camera status
    fetch('/api/camera/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.isEyesOpen) setIsEyesOpen(true);
      })
      .catch(() => {});
  }, []);

  // Handle Switching Sessions
  const handleSelectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setIsChatExpanded(true);
    const sessionMsgs = await fetchSessionMessages(sessionId);
    if (sessionMsgs.length > 0) {
      setMessages(sessionMsgs);
    }
  };

  // Handle Creating New Chat Session
  const handleNewChat = async () => {
    const newSession = await createSession(
      `Discussion ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    );
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    setIsChatExpanded(true);
  };

  // Handle Camera Eyes Toggle
  const handleToggleEyes = async () => {
    try {
      const targetAction = isEyesOpen ? 'close' : 'open';
      const result = await toggleCameraEyes(targetAction, 60);
      setIsEyesOpen(result.isEyesOpen || false);
    } catch (err) {
      console.warn('[Camera] Failed to toggle eyes:', err);
    }
  };

  // Handle Sending Text Message
  const handleSendText = (text: string) => {
    setIsDrawerOpen(true);
    setIsChatExpanded(true);
    sendTextMessage(text);
  };

  // Handle File Upload Attachment
  const handleFileUpload = async (file: File) => {
    try {
      setIsDrawerOpen(true);
      setIsChatExpanded(true);
      sendTextMessage(`[Attached File: ${file.name}]`);
      await uploadAttachment(file, activeSessionId);
    } catch (err) {
      console.warn('[Upload] Failed to upload file:', err);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#030509] select-none font-sans">
      {/* 1. Cinematic 8K Cosmic Landscape Background */}
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat transition-all duration-1000 scale-100"
        style={{
          backgroundImage: "url('/cosmic_background.jpg')",
        }}
      >
        {/* Subtle Vignette & Gradient Tone Mappings */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/70 pointer-events-none" />
      </div>

      {/* 2. Interactive Three.js 2,000 Particle Cosmic Orb with Dual Energy Vortex */}
      <JanuaryCosmicOrb
        agentState={agentState}
        emotionState={emotionState}
        inputLevel={inputLevel}
        outputLevel={outputLevel}
        onActivate={() => triggerWake('manual')}
        className="z-10"
      />

      {/* 3. Top Status HUD Bar */}
      <TopStatusBar
        agentState={agentState}
        emotionState={emotionState}
        isConnected={isConnected}
        config={config}
      />

      {/* 4. Left Floating Liquid Glass Drawer (Sessions & Extended Chat) */}
      <LiquidGlassDrawer
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        messages={messages}
        activeTools={activeTools}
        isOpen={isDrawerOpen}
        onToggleOpen={() => setIsDrawerOpen(!isDrawerOpen)}
        isChatExpanded={isChatExpanded}
        onToggleChatExpanded={() => setIsChatExpanded(!isChatExpanded)}
        onCloseChatExpanded={() => setIsChatExpanded(false)}
      />

      {/* 5. Bottom Floating Glass Prompt Dock */}
      <FloatingPromptBar
        agentState={agentState}
        isMicMuted={isMicMuted}
        isAudioMuted={isAudioMuted}
        isEyesOpen={isEyesOpen}
        onSendText={handleSendText}
        onTriggerWake={() => triggerWake('manual')}
        onInterrupt={interrupt}
        onToggleMic={toggleMuteMic}
        onToggleAudio={toggleMuteAudio}
        onToggleEyes={handleToggleEyes}
        onFileUpload={handleFileUpload}
      />
    </div>
  );
};

export default App;
