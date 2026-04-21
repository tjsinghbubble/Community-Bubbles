import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { API_URL } from '../services/api.service';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    this.reportCrash(error, errorInfo);
  }

  private async reportCrash(error: Error, errorInfo: React.ErrorInfo) {
    try {
      await fetch(`${API_URL}/api/crash-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          platform: 'mobile',
        }),
      });
    } catch {
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>😕</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          The app hit an unexpected error. It's been logged and we'll look into it.
        </Text>

        {__DEV__ && this.state.error && (
          <ScrollView style={styles.debugBox}>
            <Text style={styles.debugText}>{this.state.error.message}</Text>
            {this.state.errorInfo?.componentStack && (
              <Text style={styles.debugStack}>{this.state.errorInfo.componentStack}</Text>
            )}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.button} onPress={this.handleReset}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1F26',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  debugBox: {
    backgroundColor: '#1E1F26',
    borderRadius: 10,
    padding: 12,
    maxHeight: 200,
    width: '100%',
    marginBottom: 24,
  },
  debugText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  debugStack: {
    color: '#aaa',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#35A8F7',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
