import React, { useEffect, useState } from 'react';

export default function SpaceBackground() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full z-[-1] overflow-hidden bg-[#050510]">
      {/* Continuous animation layers + Scroll Parallax */}
      <div 
        className="stars-layer-1 absolute inset-0"
        style={{ transform: `translateY(${scrollY * 0.1}px)` }}
      ></div>
      <div 
        className="stars-layer-2 absolute inset-0"
        style={{ transform: `translateY(${scrollY * 0.25}px)` }}
      ></div>
      <div 
        className="stars-layer-3 absolute inset-0"
        style={{ transform: `translateY(${scrollY * 0.4}px)` }}
      ></div>
      
      {/* Subtle glowing nebula effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] mix-blend-screen pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] mix-blend-screen pointer-events-none"></div>
    </div>
  );
}
