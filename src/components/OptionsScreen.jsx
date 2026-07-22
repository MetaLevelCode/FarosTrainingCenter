import React from 'react';
import { motion } from 'framer-motion';

export default function OptionsScreen() {
  return (
    <motion.div 
      className="options-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <motion.h1 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        style={{ fontSize: '2.5rem', marginBottom: '2rem', fontWeight: 'bold' }}
      >
        Navegación del Faro
      </motion.h1>
      
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {[1, 2, 3].map((item, i) => (
          <motion.div
            key={item}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 + (i * 0.1), duration: 0.5 }}
            style={{
              padding: '2rem',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              minWidth: '200px',
              textAlign: 'center',
              fontWeight: '500'
            }}
            whileHover={{ y: -5, boxShadow: '0 15px 30px rgba(0,0,0,0.15)' }}
            whileTap={{ scale: 0.95 }}
          >
            Opción {item}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
