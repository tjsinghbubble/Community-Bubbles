import { useEffect, useState } from 'react';
import apiService from '../services/api.service';
import { APP_VERSION } from '../constants/app';

const LOCAL_VERSION = APP_VERSION;

function isNewerVersion(serverVer: string, localVer: string): boolean {
  const toParts = (v: string): number[] => {
    const parts = v.split('-')[0].split('.').map((n) => {
      const parsed = parseInt(n, 10);
      return isNaN(parsed) ? 0 : parsed;
    });
    while (parts.length < 3) parts.push(0);
    return parts;
  };
  const sParts = toParts(serverVer);
  const lParts = toParts(localVer);
  for (let i = 0; i < Math.max(sParts.length, lParts.length); i++) {
    const s = sParts[i] ?? 0;
    const l = lParts[i] ?? 0;
    if (s !== l) return s > l;
  }
  return false;
}

interface AppVersionCheckResult {
  updateAvailable: boolean;
  serverVersion: string | null;
}

export function useAppVersionCheck(): AppVersionCheckResult {
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    apiService.getAppVersion()
      .then((res) => {
        setServerVersion(res.version);
        const minVersion = (res as any).mobileMinVersion ?? null;
        if (LOCAL_VERSION && minVersion && isNewerVersion(minVersion, LOCAL_VERSION)) {
          setUpdateAvailable(true);
        }
      })
      .catch(() => {
        // Server unreachable — leave defaults in place
      });
  }, []);

  return { updateAvailable, serverVersion };
}
