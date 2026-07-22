import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Lighthouse.css';

export default function FaroMobile({ onComplete }) {
  const [phase, setPhase] = useState('rise'); // 'rise', 'expand', 'shrink'

  return (
    <div className="lighthouse-container lighthouse-mobile-container">
      <div className="stars" />

      {/* Light Expansion / Shrink */}
      <AnimatePresence>
        {phase !== 'rise' && (
          <motion.div
            key="light-beam"
            className="light-beam-mobile"
            initial={{ width: 0, height: 0, opacity: 0 }}
            animate={
              phase === 'expand'
                ? { width: '250vw', height: '250vw', opacity: 1 } // expand
                : { width: 0, height: 0, opacity: 0 } // shrink
            }
            transition={{ 
              duration: phase === 'expand' ? 1.2 : 0.8, 
              ease: phase === 'expand' ? "easeOut" : "easeIn" 
            }}
            onAnimationComplete={() => {
              if (phase === 'expand') setPhase('shrink');
              if (phase === 'shrink') onComplete();
            }}
            style={{ 
              bottom: '150px' // Positioning at the lighthouse bulb
            }}
          />
        )}
      </AnimatePresence>

      {/* Lighthouse Body */}
      <motion.div
        className="lighthouse-body"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        onAnimationComplete={() => setPhase('expand')}
        style={{ width: '120px', height: '200px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}
      >
        <div className="lighthouse-stripes" />
        
        {/* Top of the Lighthouse */}
        <div className="lighthouse-top" style={{ width: '140px', height: '60px', top: '-60px', left: '-12px' }}>
           {/* The Bulb */}
           <div className="lighthouse-bulb" style={{ width: '30px', height: '30px', marginBottom: '15px' }} />
        </div>
      </motion.div>
    </div>
  );
}
