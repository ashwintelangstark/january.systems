import React, { useState, useEffect } from 'react';

interface GreetingHeaderProps {
  isDrawerOpen?: boolean;
  isChatExpanded?: boolean;
}

export const GreetingHeader: React.FC<GreetingHeaderProps> = ({
  isDrawerOpen = false,
  isChatExpanded = false,
}) => {
  const [greeting, setGreeting] = useState<string>('');

  const calculateGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Good morning, STARK';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon, STARK';
    } else {
      // 17:00 - 04:59 (Evening through late night: strictly no goodnight message)
      return 'Good evening, STARK';
    }
  };

  useEffect(() => {
    // Initial calculation
    setGreeting(calculateGreeting());

    // Update dynamically every minute so it transitions promptly on the hour
    const interval = setInterval(() => {
      setGreeting(calculateGreeting());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Compute smooth horizontal shift matching the Three.js orb position
  let shiftX = 0;
  if (isDrawerOpen) {
    shiftX = isChatExpanded ? 180 : 70;
  }

  return (
    <header
      className="absolute top-[12vh] md:top-[14vh] lg:top-[15vh] left-1/2 z-20 flex flex-col items-center justify-center text-center pointer-events-none select-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        transform: `translateX(calc(-50% + ${shiftX}px))`,
      }}
    >
      {/* Dynamic Main Greeting in SF Pro Display */}
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[-0.03em] text-white leading-tight drop-shadow-[0_3px_18px_rgba(0,0,0,0.95)] [text-shadow:_0_1px_12px_rgba(0,0,0,0.8)] font-display transition-all duration-500">
        {greeting}
      </h1>

      {/* Subheading in SF Pro Text */}
      <p className="mt-1.5 text-xs sm:text-sm md:text-[14.5px] font-medium tracking-[-0.015em] text-slate-200 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] [text-shadow:_0_1px_8px_rgba(0,0,0,0.8)] font-sans">
        what are we planning today ?
      </p>
    </header>
  );
};

export default GreetingHeader;
