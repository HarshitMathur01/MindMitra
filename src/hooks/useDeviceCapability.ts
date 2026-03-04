import { useEffect, useState } from 'react';

export type DeviceTier = 'full' | 'standard' | 'lite';

export interface DeviceCapability {
  tier: DeviceTier;
  /** RAM in GB (undefined if API unavailable) */
  ram: number | undefined;
  /** Whether the GPU supports WebGL 2 */
  hasWebGL2: boolean;
  /** Whether the network connection is considered fast */
  hasFastConnection: boolean;
  /** Number of logical CPU cores (undefined if API unavailable) */
  cpuCores: number | undefined;
}

// Augment Navigator with non-standard APIs that may be absent in older TS libs
interface NetworkInformation extends EventTarget {
  effectiveType?: string;
  downlink?: number;
}

declare global {
  interface Navigator {
    /** Device Memory API — available in Chrome/Edge */
    readonly deviceMemory?: number;
    /** Network Information API — available in Chrome/Android */
    readonly connection?: NetworkInformation;
  }
}

function detectWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

function detectFastConnection(): boolean {
  const conn = navigator.connection;
  if (!conn) return true; // assume fast if API unavailable
  const effectiveType = conn.effectiveType ?? '';
  // '4g' is fast; '3g', '2g', 'slow-2g' are not
  if (effectiveType === '4g') return true;
  if (conn.downlink !== undefined) return conn.downlink >= 1.5; // Mbps
  return effectiveType !== '2g' && effectiveType !== 'slow-2g';
}

function calculateTier(
  ram: number | undefined,
  hasWebGL2: boolean,
  hasFastConnection: boolean,
  cpuCores: number | undefined,
): DeviceTier {
  const ramOk = ram === undefined || ram >= 4;
  const cpuOk = cpuCores === undefined || cpuCores >= 4;

  if (ramOk && hasWebGL2 && hasFastConnection && cpuOk) return 'full';

  const ramMedium = ram === undefined || ram >= 2;
  const cpuMedium = cpuCores === undefined || cpuCores >= 2;

  if (ramMedium && cpuMedium) return 'standard';

  return 'lite';
}

/**
 * Detects device capability synchronously on mount.
 *
 * Returns:
 *  - tier: 'full' | 'standard' | 'lite'
 *  - individual capability flags
 */
export function useDeviceCapability(): DeviceCapability {
  const [capability, setCapability] = useState<DeviceCapability>(() => {
    // Compute synchronously so callers get a value immediately (no loading state needed)
    const ram = navigator.deviceMemory;
    const hasWebGL2 = detectWebGL2();
    const hasFastConnection = detectFastConnection();
    const cpuCores = navigator.hardwareConcurrency || undefined;

    return {
      tier: calculateTier(ram, hasWebGL2, hasFastConnection, cpuCores),
      ram,
      hasWebGL2,
      hasFastConnection,
      cpuCores,
    };
  });

  useEffect(() => {
    // Re-evaluate if the connection changes (e.g., user switches networks)
    const conn = navigator.connection;
    if (!conn) return;

    const handleChange = () => {
      const hasFastConnection = detectFastConnection();
      setCapability(prev => ({
        ...prev,
        hasFastConnection,
        tier: calculateTier(prev.ram, prev.hasWebGL2, hasFastConnection, prev.cpuCores),
      }));
    };

    conn.addEventListener('change', handleChange);
    return () => conn.removeEventListener('change', handleChange);
  }, []);

  return capability;
}
