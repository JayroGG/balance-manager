import { createContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// Shared bits of the glass system (ADR-027), kept leaf-level so GlassBackdrop / GlassFill / GlassSurface
// can import them without cycles.

// Android's BlurView blurs a BlurTargetView; GlassBackdrop provides its ref here.
export const BlurTargetContext = createContext(null);

// False in a dev client built before expo-blur was added (native view missing) -> callers fall back to a wash.
export const nativeBlurAvailable = () => {
  try {
    return !!requireOptionalNativeModule('ExpoBlur');
  } catch {
    return false;
  }
};

export const useReduceTransparency = () => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => live && setOn(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', setOn);
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);
  return on;
};
