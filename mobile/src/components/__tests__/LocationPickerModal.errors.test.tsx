/**
 * LocationPickerModal — Google Places failure-handling spec (QA Goal 2).
 *
 * ⚠️ CURRENTLY DISABLED via jest.config.js `testPathIgnorePatterns`, for TWO reasons:
 *   1. The component has NO error path yet. It wires only `onPress` (success) on
 *      GooglePlacesAutocomplete (LocationPickerModal.tsx:68) — no `onFail`/`onNotFound`/
 *      `onTimeout`, no error UI. The "error handling" describe block below is the SPEC for
 *      the fix tracked in Trello (location-picker-no-error-handling, c/hqJLRSwU). These
 *      assertions FAIL against today's component — that is intended (red = bug present).
 *   2. Full react-native render is broken on RN 0.83.x under jest-expo in this repo (same
 *      reason the *.navigation.test files are ignored — see jest.config.js).
 *
 * TO ACTIVATE: after (1) wiring onFail/onNotFound/onTimeout + an inline error message +
 *   a `button-location-picker-close` / `text-location-search-error` testID into the
 *   component, and (2) the RN 0.83.x render-env fix, REMOVE this file from
 *   jest.config.js:testPathIgnorePatterns.
 *
 * WHY a component test (not headless): Google Places is called DIRECT from the client; the
 * server never mediates the lookup, so token/network/5xx failures are unreachable from the
 * headless API layer. Mocking the autocomplete here is the only DETERMINISTIC way to drive
 * REQUEST_DENIED (bad/expired key), timeout (network partition), and empty-for-valid (5xx).
 */
import React from 'react';
import { act, create } from 'react-test-renderer';

// Capture the props GooglePlacesAutocomplete is rendered with, so a test can invoke its
// callbacks (onPress / onFail / onNotFound / onTimeout) the way the library would.
let gpaProps: any = null;
jest.mock('react-native-google-places-autocomplete', () => ({
  GooglePlacesAutocomplete: (props: any) => {
    gpaProps = props;
    return null;
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

import LocationPickerModal from '../LocationPickerModal';

function render(extra: Partial<React.ComponentProps<typeof LocationPickerModal>> = {}) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  let tree: any;
  act(() => {
    tree = create(
      <LocationPickerModal visible onClose={onClose} onSelect={onSelect} apiKey="TEST_KEY" {...extra} />,
    );
  });
  return { tree, onSelect, onClose };
}

describe('LocationPickerModal — success path (current behavior)', () => {
  it('maps a selected place to LocationData and closes', () => {
    const { onSelect, onClose } = render();
    act(() => {
      gpaProps.onPress(
        { structured_formatting: { main_text: 'Morcom Rose Garden' }, description: 'Morcom Rose Garden, Oakland', place_id: 'p1' },
        { formatted_address: '700 Jean St, Oakland, CA', geometry: { location: { lat: 37.8, lng: -122.25 } } },
      );
    });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Morcom Rose Garden',
      address: '700 Jean St, Oakland, CA',
      latitude: 37.8,
      longitude: -122.25,
      placeId: 'p1',
    }));
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── SPEC for the fix (Trello c/hqJLRSwU). Expected to FAIL until the component gains an
// error path. Each test names the QA Goal 2 cause it stands in for. ───────────────────────
describe('LocationPickerModal — Google failure handling (DESIRED, not yet implemented)', () => {
  it('2a/2b expired or missing key (REQUEST_DENIED): surfaces an error, does NOT auto-close', () => {
    const { onClose } = render();
    expect(typeof gpaProps.onFail).toBe('function'); // currently undefined → red
    act(() => gpaProps.onFail('REQUEST_DENIED'));
    expect(onClose).not.toHaveBeenCalled(); // user stays in a dismissible modal, not wedged
    // and an inline error is shown (assert on the rendered error testID once implemented).
  });

  it('2c network partition (timeout): surfaces a retryable error', () => {
    render();
    expect(typeof gpaProps.onTimeout).toBe('function'); // currently undefined → red
    act(() => gpaProps.onTimeout());
  });

  it('2d Google 5xx / no result for a valid query: surfaces "no results", stays usable', () => {
    const { onClose } = render();
    expect(typeof gpaProps.onNotFound).toBe('function'); // currently undefined → red
    act(() => gpaProps.onNotFound());
    expect(onClose).not.toHaveBeenCalled();
  });
});
