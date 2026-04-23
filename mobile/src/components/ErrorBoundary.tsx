import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../styles/theme';
import { reportFatalError } from '../utils/crashReporter';

interface Props {
  children: ReactNode;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const context = this.props.context ?? 'ErrorBoundary';
    reportFatalError(error, `${context} — componentStack: ${info.componentStack ?? ''}`);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev = __DEV__;

    return (
      <View style={styles.container} testID="error-boundary-screen">
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>!</Text>
          </View>

          <Text style={styles.title} testID="error-boundary-title">
            Something went wrong
          </Text>

          <Text style={styles.subtitle} testID="error-boundary-subtitle">
            An unexpected error occurred. Please try again.
          </Text>

          {isDev && this.state.error ? (
            <ScrollView style={styles.debugBox} testID="error-boundary-debug">
              <Text style={styles.debugText}>{this.state.error.message}</Text>
              {this.state.error.stack ? (
                <Text style={styles.debugStack}>{this.state.error.stack}</Text>
              ) : null}
            </ScrollView>
          ) : null}

          <TouchableOpacity
            style={styles.button}
            onPress={this.handleReset}
            testID="error-boundary-retry-button"
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background.errorTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  iconText: {
    fontSize: 28,
    fontWeight: Typography.weights.bold,
    color: Colors.status.error,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    lineHeight: Typography.lineHeight.base,
  },
  debugBox: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    maxHeight: 180,
    width: '100%',
  },
  debugText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.status.error,
    fontFamily: 'monospace',
    marginBottom: Spacing.xs,
  },
  debugStack: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    fontFamily: 'monospace',
  },
  button: {
    height: 48,
    paddingHorizontal: Spacing.xxl,
    backgroundColor: Colors.brand.primary,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
});
