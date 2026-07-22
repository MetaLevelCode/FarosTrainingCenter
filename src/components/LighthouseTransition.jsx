import React, { useState } from 'react';
import { useWindowSize } from './useWindowSize';
import FaroMobile from './FaroMobile';
import FaroDesktop from './FaroDesktop';
import OptionsScreen from './OptionsScreen';

export default function LighthouseTransition() {
  const { isMobile } = useWindowSize();
  const [transitionComplete, setTransitionComplete] = useState(false);

  const handleTransitionComplete = () => {
    setTransitionComplete(true);
  };

  // When transition is complete, we unmount the lighthouse and show the next screen
  if (transitionComplete) {
    return <OptionsScreen />;
  }

  // Strict conditional rendering based on device type
  return isMobile ? (
    <FaroMobile onComplete={handleTransitionComplete} />
  ) : (
    <FaroDesktop onComplete={handleTransitionComplete} />
  );
}
