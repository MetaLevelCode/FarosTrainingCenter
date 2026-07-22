import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Lighthouse.css';

export default function FaroDesktop({ onComplete }) {
  const [phase, setPhase] = useState('idle'); // 'idle', 'sweep'

  useEffect(() => {
    // Start sweep after initial lighthouse entrance
    const timer = setTimeout(() => {
      setPhase('sweep');
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="lighthouse-container lighthouse-desktop-container">
      <div className="stars" />

      {/* Lighthouse Body (Left Side) */}
      <motion.div
        className="lighthouse-body"
        initial={{ x: '-150%' }}
        animate={{ x: '10vw' }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{ width: '150px', height: '60vh', borderTopLeftRadius: '25px', borderTopRightRadius: '25px', position: 'absolute', bottom: 0 }}
      >
        <div className="lighthouse-stripes" />
        
        {/* Top of the Lighthouse */}
        <div className="lighthouse-top" style={{ width: '180px', height: '80px', top: '-80px', left: '-17px' }}>
           {/* The Bulb */}
           <div className="lighthouse-bulb" style={{ width: '40px', height: '40px', marginBottom: '20px' }} />
        </div>
      </motion.div>

      {/* Light Sweep Effect */}
      <AnimatePresence>
        {phase === 'sweep' && (
          <motion.div
            key="light-sweep"
            className="light-beam-desktop"
            initial={{ width: '0vw', opacity: 0 }}
            animate={{ width: '150vw', opacity: 1 }}
            transition={{ duration: 1.8, ease: "easeInOut" }}
            onAnimationComplete={() => onComplete()}
            style={{ 
              top: 'calc(40vh - 40px)', // Aligning roughly with the bulb
              left: 'calc(10vw + 75px)', // Originating from the lighthouse center
              height: '80px', // Initial beam thickness
              scaleY: 25, // Expand to cover whole vertical space eventually
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
