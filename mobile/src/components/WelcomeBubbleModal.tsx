import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BubbleButton from './BubbleButton';
import { Colors, Spacing, Typography } from '../styles/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface NextEventInfo {
  title: string;
  date: string;
  startTime: string;
}

interface RuleDisplay {
  name: string;
  description: string;
}

interface WelcomeBubbleModalProps {
  visible: boolean;
  onClose: () => void;
  onLetsGo: () => void;
  bubbleName: string;
  category: string;
  rules: RuleDisplay[];
  nextEvent?: NextEventInfo | null;
}

export default function WelcomeBubbleModal({
  visible,
  onClose,
  onLetsGo,
  bubbleName,
  category,
  rules,
  nextEvent,
}: WelcomeBubbleModalProps) {
  const [checkedRules, setCheckedRules] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!visible) {
      setCheckedRules(new Set());
    }
  }, [visible]);

  const toggleRule = (index: number) => {
    setCheckedRules((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const allRulesChecked = rules.length === 0 || checkedRules.size === rules.length;

  const formatNextEventTime = () => {
    if (!nextEvent) return null;
    const eventDate = new Date(nextEvent.date + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const [hoursStr, minutesStr] = nextEvent.startTime.split(':');
    const hours = parseInt(hoursStr);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const timeStr = `${h}:${minutesStr} ${ampm}`;

    let dayStr = '';
    if (eventDate.toDateString() === today.toDateString()) {
      dayStr = 'Today';
    } else if (eventDate.toDateString() === tomorrow.toDateString()) {
      dayStr = 'Tomorrow';
    } else {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      dayStr = dayNames[eventDate.getDay()];
    }

    return `Next event: ${nextEvent.title} — ${dayStr} at ${timeStr}`;
  };

  const hasRules = rules.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handleBar} />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            data-testid="button-close-welcome"
          >
            <Ionicons name="close" size={24} color={Colors.text.primary} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.title} data-testid="text-welcome-title">
              Welcome to {bubbleName}
            </Text>
            <Text style={styles.category} data-testid="text-welcome-category">
              {category}
            </Text>

            <View style={styles.separator} />

            {hasRules && (
              <>
                <Text style={styles.sectionTitle}>Bubble Rules</Text>
                <Text style={styles.sectionSubtitle}>Tap each rule to confirm</Text>

                {rules.map((rule, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.ruleRow}
                    onPress={() => toggleRule(index)}
                    activeOpacity={0.7}
                    data-testid={`button-rule-${index}`}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        checkedRules.has(index) && styles.checkboxChecked,
                      ]}
                    >
                      {checkedRules.has(index) && (
                        <Ionicons name="checkmark" size={14} color={Colors.status.success} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ruleText}>{rule.name}</Text>
                      {rule.description ? <Text style={styles.ruleDescriptionText}>{rule.description}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}

                <View style={styles.separator} />
              </>
            )}

            <Text style={styles.sectionTitle}>Next Steps</Text>

            <View style={styles.nextStepRow}>
              <Text style={styles.nextStepEmoji}>👋</Text>
              <View style={styles.nextStepContent}>
                <Text style={styles.nextStepTitle}>Introduce Yourself</Text>
                <Text style={styles.nextStepSubtitle}>
                  Say hi in the group chat — everyone's friendly.
                </Text>
              </View>
            </View>

            <View style={styles.nextStepRow}>
              <Text style={styles.nextStepEmoji}>🎯</Text>
              <View style={styles.nextStepContent}>
                <Text style={styles.nextStepTitle}>RSVP to an Upcoming Event</Text>
                {nextEvent ? (
                  <Text style={styles.nextStepSubtitle}>{formatNextEventTime()}</Text>
                ) : (
                  <Text style={styles.nextStepSubtitle}>
                    Check the events tab for upcoming activities.
                  </Text>
                )}
              </View>
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <BubbleButton
              title="Let's Go"
              variant="primary"
              onPress={onLetsGo}
              disabled={!allRulesChecked}
              testID="button-lets-go"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    maxHeight: SCREEN_HEIGHT * 0.97,
    flex: 0,
  },
  scrollContent: {
    paddingBottom: Spacing.xs,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.neutral.charcoal,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.xl,
    zIndex: 1,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  category: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.neutral.lightSilver,
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    marginBottom: Spacing.xxs,
  },
  sectionSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
    marginBottom: Spacing.md,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.status.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: Colors.status.success,
    backgroundColor: `${Colors.status.success}1A`,
  },
  ruleText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.md,
  },
  ruleDescriptionText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.sm,
    marginTop: 2,
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
  },
  nextStepEmoji: {
    fontSize: 20,
    marginRight: Spacing.md,
    marginTop: 2,
  },
  nextStepContent: {
    flex: 1,
  },
  nextStepTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  nextStepSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
    lineHeight: Typography.lineHeight.sm,
  },
  buttonContainer: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
  },
});
