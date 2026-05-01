import React from 'react';
import { act, create } from 'react-test-renderer';

jest.mock('../../utils/crashReporter', () => ({
  reportFatalError: jest.fn(),
}));

jest.mock('../../screens/main/UpcomingScreen', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: jest.fn(() =>
      React.createElement('View', { testID: 'upcoming-screen-content' }),
    ),
  };
});

import { UpcomingScreenWithBoundary } from '../../navigation/UpcomingScreenWithBoundary';
import UpcomingScreen from '../../screens/main/UpcomingScreen';

const MockUpcomingScreen = UpcomingScreen as jest.MockedFunction<typeof UpcomingScreen>;

function findByTestId(instance: ReturnType<typeof create>, testId: string): any {
  const json = instance.toJSON();
  function search(node: any): any {
    if (!node) return null;
    if (node.props && node.props.testID === testId) return node;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = search(child);
        if (found) return found;
      }
    }
    return null;
  }
  return search(json);
}

function findText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(findText).join('');
  if (node.children) return findText(node.children);
  return '';
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  MockUpcomingScreen.mockImplementation(() => {
    const React = require('react');
    return React.createElement('View', { testID: 'upcoming-screen-content' });
  });
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('UpcomingScreenWithBoundary', () => {
  it('shows the friendly recovery message when UpcomingScreen throws', () => {
    MockUpcomingScreen.mockImplementation(() => {
      throw new Error('Simulated render crash');
    });

    let instance!: ReturnType<typeof create>;
    act(() => {
      instance = create(<UpcomingScreenWithBoundary />);
    });

    const container = findByTestId(instance, 'screen-error-boundary-UpcomingScreen');
    expect(container).not.toBeNull();

    const messageNode = findByTestId(instance, 'screen-error-message-UpcomingScreen');
    expect(messageNode).not.toBeNull();
    expect(findText(messageNode.children)).toContain("Couldn't load your upcoming events");
  });

  it('shows the Try Again button when UpcomingScreen throws', () => {
    MockUpcomingScreen.mockImplementation(() => {
      throw new Error('Simulated render crash');
    });

    let instance!: ReturnType<typeof create>;
    act(() => {
      instance = create(<UpcomingScreenWithBoundary />);
    });

    const retryButton = findByTestId(instance, 'screen-error-retry-UpcomingScreen');
    expect(retryButton).not.toBeNull();
    expect(findText(retryButton.children)).toContain('Try Again');
  });

  it('resets the boundary and shows the screen again when Try Again is pressed', () => {
    MockUpcomingScreen.mockImplementation(() => {
      throw new Error('Simulated render crash');
    });

    let instance!: ReturnType<typeof create>;
    act(() => {
      instance = create(<UpcomingScreenWithBoundary />);
    });

    MockUpcomingScreen.mockImplementation(() => {
      const React = require('react');
      return React.createElement('View', { testID: 'upcoming-screen-content' });
    });

    const retryButton = instance.root.findByProps({
      testID: 'screen-error-retry-UpcomingScreen',
    });
    expect(retryButton).not.toBeNull();

    act(() => {
      retryButton.props.onPress();
    });

    const errorScreen = findByTestId(instance, 'screen-error-boundary-UpcomingScreen');
    expect(errorScreen).toBeNull();

    const screen = findByTestId(instance, 'upcoming-screen-content');
    expect(screen).not.toBeNull();
  });
});
