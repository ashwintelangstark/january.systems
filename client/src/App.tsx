import React from 'react';
import { useAgentSocket } from './hooks/useAgentSocket';
import { Header } from './components/Header';
import { OrbVisualizer } from './components/OrbVisualizer';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { ChatConsole } from './components/ChatConsole';
import { ToolActivityPanel } from './components/ToolActivityPanel';
import { DualInputBar } from './components/DualInputBar';

export const App: React.FC = () => {
  const {
    agentState,
    emotionState,
    isConnected,
    messages,
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
  } = useAgentSocket();

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090E] text-slate-100 overflow-hidden font-['Outfit',sans-serif]">
      {/* Top Navigation & Status Bar */}
      <Header
        agentState={agentState}
        emotionState={emotionState}
        isConnected={isConnected}
        config={config}
      />

      {/* Main Interactive Stage */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0">
        {/* Left Column: AI Presence, Dynamic Orb, Oscilloscope */}
        <section className="w-80 flex flex-col items-center justify-between glass-panel rounded-2xl border border-white/10 p-5 select-none">
          <div className="w-full text-center">
            <h2 className="text-xs font-mono font-bold tracking-widest uppercase text-slate-400">
              Neural Acoustic Core
            </h2>
          </div>

          {/* Central Pulsing 3D Orb */}
          <div className="my-auto flex flex-col items-center">
            <OrbVisualizer
              agentState={agentState}
              emotionState={emotionState}
              inputLevel={inputLevel}
              outputLevel={outputLevel}
              onActivate={() => triggerWake('manual')}
            />
          </div>

          {/* Real-time Oscilloscope Waveform */}
          <div className="w-full flex flex-col items-center gap-2">
            <div className="flex items-center justify-between w-full text-[10px] font-mono text-slate-400 px-1">
              <span>SPECTRAL STREAM</span>
              <span className="text-cyan-400 font-semibold">
                {agentState === 'speaking' ? '24kHz OUT' : '16kHz IN'}
              </span>
            </div>
            <WaveformVisualizer
              agentState={agentState}
              inputLevel={inputLevel}
              outputLevel={outputLevel}
            />
          </div>
        </section>

        {/* Center Column: Live Conversation Timeline & Code Execution */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0">
          <ChatConsole
            messages={messages}
            activeTools={activeTools}
          />
        </section>

        {/* Right Column: Local Tools & Automation HUD */}
        <aside className="h-full">
          <ToolActivityPanel
            activeTools={activeTools}
            onQuickAction={(prompt) => sendTextMessage(prompt)}
          />
        </aside>
      </main>

      {/* Bottom Fixed Dual Input Controller */}
      <DualInputBar
        agentState={agentState}
        isMicMuted={isMicMuted}
        isAudioMuted={isAudioMuted}
        onSendText={sendTextMessage}
        onTriggerWake={() => triggerWake('manual')}
        onInterrupt={interrupt}
        onToggleMic={toggleMuteMic}
        onToggleAudio={toggleMuteAudio}
      />
    </div>
  );
};

export default App;
