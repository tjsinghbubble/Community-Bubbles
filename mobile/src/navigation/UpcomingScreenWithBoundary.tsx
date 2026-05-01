import React from 'react';
import UpcomingScreen from '../screens/main/UpcomingScreen';
import { ScreenErrorBoundary } from '../components/ErrorBoundary';

export function UpcomingScreenWithBoundary(props: React.ComponentProps<typeof UpcomingScreen>) {
  return (
    <ScreenErrorBoundary context="UpcomingScreen" message="Couldn't load your upcoming events — tap to retry">
      <UpcomingScreen {...props} />
    </ScreenErrorBoundary>
  );
}
