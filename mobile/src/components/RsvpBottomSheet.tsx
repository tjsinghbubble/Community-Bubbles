import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Colors, Spacing, Typography, Radius } from '../styles/theme';
import { RadioIcon } from './icons';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = 280;

type RsvpOption = 'going' | 'not_going';
type RecurringOption = 'this' | 'following' | 'not_going';

interface RsvpBottomSheetProps {
  visible: boolean;
  isRecurring: boolean;
  currentStatus: string | null;
  onClose: () => void;
  onSelect: (option: RsvpOption | RecurringOption) => void;
}

export default function RsvpBottomSheet({
  visible,
  isRecurring,
  currentStatus,
  onClose,
  onSelect,
}: RsvpBottomSheetProps) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSelect = (option: RsvpOption | RecurringOption) => {
    onSelect(option);
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
              {/* Drag handle */}
              <View style={styles.handle} />

              {/* Title */}
              <Text style={styles.title}>
                {isRecurring ? 'RSVP to reoccurring event' : 'RSVP'}
              </Text>

              {isRecurring ? (
                <>
                  <TouchableOpacity style={styles.row} onPress={() => handleSelect('this')}>
                    <Text style={styles.rowText}>This event</Text>
                    <RadioIcon size={20} selected={currentStatus === 'going'} active />
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  <TouchableOpacity style={styles.row} onPress={() => handleSelect('following')}>
                    <Text style={styles.rowText}>This and following events</Text>
                    <RadioIcon size={20} selected={false} active />
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  <TouchableOpacity style={styles.row} onPress={() => handleSelect('not_going')}>
                    <Text style={[styles.rowText, styles.notGoingText]}>Not Going</Text>
                    <RadioIcon size={20} selected={currentStatus === 'not_going'} active />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.row} onPress={() => handleSelect('going')}>
                    <Text style={styles.rowText}>Going</Text>
                    <RadioIcon size={20} selected={currentStatus === 'going'} active />
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  <TouchableOpacity style={styles.row} onPress={() => handleSelect('not_going')}>
                    <Text style={[styles.rowText, styles.notGoingText]}>Not Going</Text>
                    <RadioIcon size={20} selected={currentStatus === 'not_going'} active />
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxxl,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.neutral.lightSilver,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  rowText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: Typography.weights.medium,
  },
  notGoingText: {
    color: Colors.status.error,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.neutral.lightSilver,
  },
});
