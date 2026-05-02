import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors } from '../styles/theme';

type Mode = 'date' | 'time';

type Props = {
  visible: boolean;
  value: Date;
  mode?: Mode;
  title?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
};

export default function SpinnerDatePickerModal({
  visible,
  value,
  mode = 'date',
  title,
  minimumDate,
  maximumDate,
  minuteInterval,
  onConfirm,
  onCancel,
}: Props) {
  const [tempValue, setTempValue] = useState(value);
  const initialRef = useRef(value);
  initialRef.current = value;

  useEffect(() => {
    if (visible) {
      setTempValue(initialRef.current);
    }
  }, [visible]);

  if (Platform.OS === 'android') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="default"
        onChange={(e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) {
            onConfirm(d);
          } else {
            onCancel();
          }
        }}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        minuteInterval={minuteInterval}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onCancel}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onCancel}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="button-picker-cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.titleText}>
              {title ?? (mode === 'time' ? 'Select Time' : 'Select Date')}
            </Text>

            <TouchableOpacity
              onPress={() => onConfirm(tempValue)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID="button-picker-done"
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={tempValue}
            mode={mode}
            display="spinner"
            onChange={(_e: DateTimePickerEvent, d?: Date) => {
              if (d) setTempValue(d);
            }}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            minuteInterval={minuteInterval}
            style={styles.picker}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#F9F9F9',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCDCDC',
  },
  cancelText: {
    fontSize: 16,
    color: '#8E8E93',
    minWidth: 56,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand.bubbleBlue,
    minWidth: 56,
    textAlign: 'right',
  },
  picker: {
    width: '100%',
  },
});
