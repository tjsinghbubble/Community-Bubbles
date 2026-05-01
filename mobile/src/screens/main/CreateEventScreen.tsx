import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Switch,
  KeyboardAvoidingView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import apiService from '../../services/api.service';
import LocationPickerModal from '../../components/LocationPickerModal';
import { GOOGLE_PLACES_API_KEY } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import MultiImagePicker from '../../components/MultiImagePicker';
import { Colors, Spacing, Radius, Typography, SwitchColors, Gradients } from '../../styles/theme';
import { CalendarIcon, LocationPinIcon, CheckboxIcon, ChevronDownIcon, ClockIcon, PeopleIcon } from '../../components/icons';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route?: RouteProp<any>;
};

type Bubble = {
  id: string;
  title: string;
  category: string;
  campusId?: number | null;
  coverImage?: string | null;
};

const STEP_TITLES = ['Event Details', 'Date & Location', 'Privacy & Settings', 'Review & Publish'];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', description: 'Anyone can discover and join' },
  { value: 'request', label: 'Request to Join', description: 'Host approval required before attending' },
  { value: 'private', label: 'Private', description: 'Invite-only event' },
];

const ENVIRONMENT_OPTIONS = [
  { key: 'petFriendly', label: 'Pet Friendly', description: 'Pets are welcome', icon: 'paw' as const },
  { key: 'smokeFree', label: 'Smoke Free', description: 'No smoking allowed', icon: 'ban' as const },
  { key: 'wheelchairAccessible', label: 'Wheelchair Accessible', description: 'Accessible venue', icon: 'accessibility' as const },
];

const TIME_MINUTE_INTERVAL = 5;

const RECURRENCE_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Every Day' },
  { value: 'weekly', label: 'Every Week' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Every Month' },
  { value: 'yearly', label: 'Every Year' },
  { value: 'custom', label: 'Custom' },
];

const CUSTOM_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function CreateEventScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const routeParams = route?.params as { bubbleId?: string; bubbleTitle?: string } | undefined;
  const isBubblePreselected = !!routeParams?.bubbleId;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<any>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [campusOnly, setCampusOnly] = useState(false);

  const isCampusVerified = user?.campusVerified && user?.campusId;
  const step3ScrollRef = useRef<ScrollView>(null);
  const rsvpSectionY = useRef(0);

  const [myBubbles, setMyBubbles] = useState<Bubble[]>([]);
  const [showBubblePicker, setShowBubblePicker] = useState(false);
  const [selectedBubble, setSelectedBubble] = useState<Bubble | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('never');
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurrenceCustomFrequency, setRecurrenceCustomFrequency] = useState('weekly');
  const [recurrenceCustomInterval, setRecurrenceCustomInterval] = useState('1');
  const [showCustomFrequencyPicker, setShowCustomFrequencyPicker] = useState(false);
  const [recurrenceEndType, setRecurrenceEndType] = useState<'never' | 'on_date'>('never');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [selectedRecurrenceEndDate, setSelectedRecurrenceEndDate] = useState(new Date());
  const [showRecurrenceEndDatePicker, setShowRecurrenceEndDatePicker] = useState(false);

  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLatitude, setLocationLatitude] = useState<number | undefined>();
  const [locationLongitude, setLocationLongitude] = useState<number | undefined>();
  const [locationTbd, setLocationTbd] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [visibility, setVisibility] = useState('public');
  const [petFriendly, setPetFriendly] = useState(false);
  const [smokeFree, setSmokeFree] = useState(false);
  const [wheelchairAccessible, setWheelchairAccessible] = useState(false);
  const [attendeeLimit, setAttendeeLimit] = useState('');
  const [rsvpDeadline, setRsvpDeadline] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showRsvpDatePicker, setShowRsvpDatePicker] = useState(false);
  const [showRsvpTimePicker, setShowRsvpTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedStartTime, setSelectedStartTime] = useState<Date>(new Date());
  const [selectedEndTime, setSelectedEndTime] = useState<Date>(new Date());
  const [selectedRsvpDate, setSelectedRsvpDate] = useState<Date>(new Date());
  const [reviewAreaHeight, setReviewAreaHeight] = useState(0);

  useEffect(() => {
    fetchMyBubbles();
  }, []);

  const fetchMyBubbles = async () => {
    try {
      const data = await apiService.getMyCreatedBubbles() as Bubble[];
      setMyBubbles(data);
      if (routeParams?.bubbleId) {
        const preselected = data.find(b => b.id === routeParams.bubbleId);
        if (preselected) {
          setSelectedBubble(preselected);
        } else {
          setSelectedBubble({
            id: routeParams.bubbleId,
            title: routeParams.bubbleTitle || 'Selected Bubble',
            category: '',
            coverImage: null,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch bubbles:', error);
    }
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  };

  const formatTimeForDisplay = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatRsvpForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    const h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day}/${year} ${hour12}:${min} ${ampm}`;
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDateValue?: Date) => {
    if (Platform.OS === 'android' || event.type === 'dismissed' || event.type === 'set') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && selectedDateValue) {
      setSelectedDate(selectedDateValue);
      const year = selectedDateValue.getFullYear();
      const month = String(selectedDateValue.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDateValue.getDate()).padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
    }
  };

  const onStartTimeChange = (event: DateTimePickerEvent, selectedTimeValue?: Date) => {
    if (Platform.OS === 'android' || event.type === 'dismissed' || event.type === 'set') {
      setShowStartTimePicker(false);
    }
    if (event.type === 'set' && selectedTimeValue) {
      setSelectedStartTime(selectedTimeValue);
      const hours = String(selectedTimeValue.getHours()).padStart(2, '0');
      const minutes = String(selectedTimeValue.getMinutes()).padStart(2, '0');
      setStartTime(`${hours}:${minutes}`);
    }
  };

  const onEndTimeChange = (event: DateTimePickerEvent, selectedTimeValue?: Date) => {
    if (Platform.OS === 'android' || event.type === 'dismissed' || event.type === 'set') {
      setShowEndTimePicker(false);
    }
    if (event.type === 'set' && selectedTimeValue) {
      setSelectedEndTime(selectedTimeValue);
      const hours = String(selectedTimeValue.getHours()).padStart(2, '0');
      const minutes = String(selectedTimeValue.getMinutes()).padStart(2, '0');
      setEndTime(`${hours}:${minutes}`);
    }
  };

  const onRsvpDateChange = (event: DateTimePickerEvent, selectedDateValue?: Date) => {
    if (Platform.OS === 'android' || event.type === 'dismissed' || event.type === 'set') {
      setShowRsvpDatePicker(false);
    }
    if (event.type === 'set' && selectedDateValue) {
      setSelectedRsvpDate(selectedDateValue);
      setRsvpDeadline(selectedDateValue.toISOString());
      if (Platform.OS === 'android') {
        setShowRsvpTimePicker(true);
      }
    }
  };

  const onRsvpTimeChange = (event: DateTimePickerEvent, selectedTimeValue?: Date) => {
    if (Platform.OS === 'android' || event.type === 'dismissed' || event.type === 'set') {
      setShowRsvpTimePicker(false);
    }
    if (event.type === 'set' && selectedTimeValue) {
      const combined = new Date(selectedRsvpDate);
      combined.setHours(selectedTimeValue.getHours(), selectedTimeValue.getMinutes());
      setSelectedRsvpDate(combined);
      setRsvpDeadline(combined.toISOString());
    }
  };

  const handleLocationSelect = (location: { name: string; address: string; latitude?: number; longitude?: number }) => {
    setLocationName(location.name);
    setLocationAddress(location.address);
    setLocationLatitude(location.latitude);
    setLocationLongitude(location.longitude);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedBubble) {
        Alert.alert('Required', 'Please select a bubble for this event');
        return;
      }
      if (title.trim().length < 3) {
        Alert.alert('Required', 'Event title must be at least 3 characters');
        return;
      }
      if (!description.trim()) {
        Alert.alert('Required', 'Please add an event description');
        return;
      }
    }
    if (step === 2) {
      if (!date) {
        Alert.alert('Required', 'Please select a date');
        return;
      }
      if (!startTime) {
        Alert.alert('Required', 'Please select a start time');
        return;
      }
    }
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      const eventData: any = {
        bubbleId: selectedBubble!.id,
        title: title.trim(),
        description: description.trim() || null,
        coverImage: images.length > 0 ? images[0] : null,
        images,
        date,
        startTime,
        endTime: endTime || null,
        locationName: locationTbd ? 'TBD' : (locationName.trim() || null),
        locationAddress: locationTbd ? 'TBD' : (locationAddress.trim() || null),
        locationLat: locationLatitude ? String(locationLatitude) : null,
        locationLng: locationLongitude ? String(locationLongitude) : null,
        locationTbd,
        visibility,
        petFriendly,
        smokeFree,
        wheelchairAccessible,
        attendeeLimit: attendeeLimit ? parseInt(attendeeLimit) : null,
        rsvpDeadline: rsvpDeadline || null,
        recurrenceType: recurringEnabled ? recurrenceType : 'never',
        recurrenceCustomFrequency: recurrenceType === 'custom' ? recurrenceCustomFrequency : null,
        recurrenceCustomInterval: recurrenceType === 'custom' ? parseInt(recurrenceCustomInterval) || 1 : null,
        recurrenceEndDate: recurringEnabled && recurrenceEndType === 'on_date' && recurrenceEndDate ? recurrenceEndDate : null,
        campusId: selectedBubble?.campusId || (campusOnly && isCampusVerified ? user?.campusId : null),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const event = await apiService.createEvent(eventData);
      setCreatedEvent(event);
      setShowSuccess(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleBack} style={styles.headerBackBtn} testID="create-event-back-button" accessibilityLabel="Go back">
        <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{STEP_TITLES[step - 1]}</Text>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerCancelBtn} testID="create-event-cancel-button" accessibilityLabel="Cancel">
        <Text style={styles.headerCancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEventCard = () => (
    <View style={styles.successEventCard}>
      {images.length > 0 ? (
        <Image source={{ uri: images[0] }} style={styles.successEventCardImage} />
      ) : (
        <View style={styles.successEventCardImagePlaceholder}>
          <Ionicons name="image-outline" size={36} color={Colors.neutral.coolMist} />
        </View>
      )}
      <View style={styles.successEventCardBody}>
        <Text style={styles.reviewTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.reviewDetailRow}>
          <Ionicons name="calendar-outline" size={16} color={Colors.brand.bubbleBlue} />
          <Text style={styles.reviewDetailValue}>{date ? formatDateForDisplay(date) : 'No date set'}</Text>
        </View>
        <View style={styles.reviewDetailRow}>
          <ClockIcon size={16} color={Colors.brand.bubbleBlue} />
          <Text style={styles.reviewDetailValue}>
            {startTime ? formatTimeForDisplay(startTime) : '--:--'}
            {endTime ? ` - ${formatTimeForDisplay(endTime)}` : ''}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer} keyboardShouldPersistTaps="handled">
      {!isBubblePreselected && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Select Bubble *</Text>
          <TouchableOpacity style={styles.fieldInput} onPress={() => setShowBubblePicker(true)} testID="create-event-bubble-picker" accessibilityLabel="Select bubble">
            <Text style={selectedBubble ? styles.fieldValue : styles.fieldPlaceholder}>
              {selectedBubble ? selectedBubble.title : 'Choose a bubble for this event'}
            </Text>
            <ChevronDownIcon size={20} color={Colors.neutral.coolMist} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Event Title *</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="Ex. San Francisco Art Makers"
          placeholderTextColor={Colors.neutral.coolMist}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          testID="create-event-title-input"
          accessibilityLabel="Event title"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Event Description *</Text>
        <TextInput
          style={styles.fieldTextArea}
          placeholder="What's your event about?"
          placeholderTextColor={Colors.neutral.coolMist}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          testID="create-event-description-input"
          accessibilityLabel="Event description"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Add a Cover Photo (Strongly Recommended)</Text>
        <MultiImagePicker
          images={images}
          onImagesChange={setImages}
          maxImages={1}
        />
        {images.length > 0 && (
          <Text style={styles.uploadSuccessText}>Successfully Uploaded!</Text>
        )}
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Date *</Text>
        <TouchableOpacity style={styles.fieldInput} onPress={() => setShowDatePicker(true)} testID="create-event-date-picker" accessibilityLabel="Select event date">
          <Text style={date ? styles.fieldValue : styles.fieldPlaceholder}>
            {date ? formatDateForDisplay(date) : 'Select Date'}
          </Text>
          <CalendarIcon size={20} color={Colors.neutral.coolMist} />
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}
      </View>

      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <Text style={styles.fieldLabel}>Start Time *</Text>
          <TouchableOpacity style={styles.fieldInput} onPress={() => setShowStartTimePicker(true)} testID="create-event-start-time-picker" accessibilityLabel="Select start time">
            <Text style={startTime ? styles.fieldValue : styles.fieldPlaceholder}>
              {startTime ? formatTimeForDisplay(startTime) : '00:00'}
            </Text>
          </TouchableOpacity>
          {showStartTimePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={selectedStartTime}
              mode="time"
              display="default"
              onChange={onStartTimeChange}
              is24Hour={false}
              minuteInterval={TIME_MINUTE_INTERVAL}
            />
          )}
        </View>
        <View style={styles.timeField}>
          <Text style={styles.fieldLabel}>End Time</Text>
          <TouchableOpacity style={styles.fieldInput} onPress={() => setShowEndTimePicker(true)} testID="create-event-end-time-picker" accessibilityLabel="Select end time">
            <Text style={endTime ? styles.fieldValue : styles.fieldPlaceholder}>
              {endTime ? formatTimeForDisplay(endTime) : '00:00'}
            </Text>
          </TouchableOpacity>
          {showEndTimePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={selectedEndTime}
              mode="time"
              display="default"
              onChange={onEndTimeChange}
              is24Hour={false}
              minuteInterval={TIME_MINUTE_INTERVAL}
            />
          )}
        </View>
      </View>

      {Platform.OS === 'ios' && showStartTimePicker && (
        <Modal transparent animationType="fade" visible={showStartTimePicker}>
          <View style={styles.timePickerOverlay}>
            <View style={styles.timePickerModal}>
              <Text style={styles.timePickerTitle}>Select Start Time</Text>
              <DateTimePicker
                value={selectedStartTime}
                mode="time"
                display="spinner"
                onChange={(e, val) => {
                  if (val) {
                    setSelectedStartTime(val);
                  }
                }}
                is24Hour={false}
                minuteInterval={TIME_MINUTE_INTERVAL}
                style={{ height: 200, width: '100%' }}
              />
              <View style={styles.timePickerActions}>
                <TouchableOpacity
                  style={styles.timePickerCancelBtn}
                  onPress={() => setShowStartTimePicker(false)}
                  testID="create-event-start-time-cancel"
                  accessibilityLabel="Cancel start time selection"
                >
                  <Text style={styles.timePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timePickerConfirmBtn}
                  onPress={() => {
                    const hours = String(selectedStartTime.getHours()).padStart(2, '0');
                    const minutes = String(selectedStartTime.getMinutes()).padStart(2, '0');
                    setStartTime(`${hours}:${minutes}`);
                    setShowStartTimePicker(false);
                  }}
                  testID="create-event-start-time-confirm"
                  accessibilityLabel="Confirm start time"
                >
                  <Text style={styles.timePickerConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'ios' && showEndTimePicker && (
        <Modal transparent animationType="fade" visible={showEndTimePicker}>
          <View style={styles.timePickerOverlay}>
            <View style={styles.timePickerModal}>
              <Text style={styles.timePickerTitle}>Select End Time</Text>
              <DateTimePicker
                value={selectedEndTime}
                mode="time"
                display="spinner"
                onChange={(e, val) => {
                  if (val) {
                    setSelectedEndTime(val);
                  }
                }}
                is24Hour={false}
                minuteInterval={TIME_MINUTE_INTERVAL}
                style={{ height: 200, width: '100%' }}
              />
              <View style={styles.timePickerActions}>
                <TouchableOpacity
                  style={styles.timePickerCancelBtn}
                  onPress={() => setShowEndTimePicker(false)}
                  testID="create-event-end-time-cancel"
                  accessibilityLabel="Cancel end time selection"
                >
                  <Text style={styles.timePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timePickerConfirmBtn}
                  onPress={() => {
                    const hours = String(selectedEndTime.getHours()).padStart(2, '0');
                    const minutes = String(selectedEndTime.getMinutes()).padStart(2, '0');
                    setEndTime(`${hours}:${minutes}`);
                    setShowEndTimePicker(false);
                  }}
                  testID="create-event-end-time-confirm"
                  accessibilityLabel="Confirm end time"
                >
                  <Text style={styles.timePickerConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <View style={styles.divider} />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Recurring Event</Text>
        <Switch
          value={recurringEnabled}
          onValueChange={(val) => {
            setRecurringEnabled(val);
            if (!val) {
              setRecurrenceType('never');
              setRecurrenceEndType('never');
              setRecurrenceEndDate('');
            }
          }}
          trackColor={{ false: SwitchColors.trackFalse, true: SwitchColors.trackTrue }}
          thumbColor={recurringEnabled ? SwitchColors.thumbTrue : SwitchColors.thumbFalse}
          testID="create-event-recurring-switch"
          accessibilityLabel="Recurring event"
        />
      </View>

      {recurringEnabled && (
        <View style={styles.recurrenceContainer}>
          {RECURRENCE_OPTIONS.map((option, idx) => (
            <React.Fragment key={option.value}>
              <TouchableOpacity
                style={styles.recurrenceOption}
                onPress={() => {
                  setRecurrenceType(option.value);
                  if (option.value === 'never') {
                    setRecurringEnabled(false);
                  }
                }}
                testID={`create-event-recurrence-${option.value}`}
                accessibilityLabel={option.label}
              >
                <Text style={styles.recurrenceOptionText}>{option.label}</Text>
                {recurrenceType === option.value && (
                  <Ionicons name="checkmark" size={20} color={Colors.brand.bubbleBlue} />
                )}
              </TouchableOpacity>
              {idx < RECURRENCE_OPTIONS.length - 1 && (
                <View style={styles.recurrenceDivider} />
              )}
            </React.Fragment>
          ))}

          {recurrenceType === 'custom' && (
            <View style={styles.customRecurrenceContainer}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Frequency</Text>
                <TouchableOpacity
                  style={styles.fieldInput}
                  onPress={() => setShowCustomFrequencyPicker(!showCustomFrequencyPicker)}
                  testID="create-event-custom-frequency-picker"
                  accessibilityLabel="Select custom frequency"
                >
                  <Text style={styles.fieldValue}>
                    {CUSTOM_FREQUENCY_OPTIONS.find(f => f.value === recurrenceCustomFrequency)?.label}
                  </Text>
                  <ChevronDownIcon size={20} color={Colors.neutral.coolMist} />
                </TouchableOpacity>
                {showCustomFrequencyPicker && (
                  <View style={styles.dropdownList}>
                    {CUSTOM_FREQUENCY_OPTIONS.map((freq) => (
                      <TouchableOpacity
                        key={freq.value}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setRecurrenceCustomFrequency(freq.value);
                          setShowCustomFrequencyPicker(false);
                        }}
                        testID={`create-event-custom-frequency-option-${freq.value}`}
                        accessibilityLabel={freq.label}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          recurrenceCustomFrequency === freq.value && styles.dropdownItemTextActive
                        ]}>{freq.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Every</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={recurrenceCustomInterval}
                  onChangeText={(val) => {
                    const num = val.replace(/[^0-9]/g, '');
                    if (num === '' || (parseInt(num) >= 1 && parseInt(num) <= 999)) {
                      setRecurrenceCustomInterval(num);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={3}
                  testID="create-event-recurrence-interval-input"
                  accessibilityLabel="Recurrence interval"
                />
              </View>
            </View>
          )}

          <View style={styles.recurrenceDivider} />

          <Text style={[styles.fieldLabel, { marginBottom: 8, marginTop: 4 }]}>Ends</Text>
          <TouchableOpacity
            style={styles.recurrenceOption}
            onPress={() => {
              setRecurrenceEndType('never');
              setRecurrenceEndDate('');
            }}
            testID="create-event-recurrence-end-never"
            accessibilityLabel="Recurrence ends: Never"
          >
            <Text style={styles.recurrenceOptionText}>Never</Text>
            {recurrenceEndType === 'never' && (
              <Ionicons name="checkmark" size={20} color={Colors.brand.bubbleBlue} />
            )}
          </TouchableOpacity>
          <View style={styles.recurrenceDivider} />
          <TouchableOpacity
            style={styles.recurrenceOption}
            onPress={() => {
              setRecurrenceEndType('on_date');
              if (!recurrenceEndDate) {
                setShowRecurrenceEndDatePicker(true);
              }
            }}
            testID="create-event-recurrence-end-on-date"
            accessibilityLabel="Recurrence ends: On a specific date"
          >
            <Text style={styles.recurrenceOptionText}>
              {recurrenceEndType === 'on_date' && recurrenceEndDate
                ? `Ends on ${formatDateForDisplay(recurrenceEndDate)}`
                : 'On a specific date'}
            </Text>
            {recurrenceEndType === 'on_date' && (
              <Ionicons name="checkmark" size={20} color={Colors.brand.bubbleBlue} />
            )}
          </TouchableOpacity>
          {recurrenceEndType === 'on_date' && (
            <TouchableOpacity
              style={[styles.fieldInput, { marginTop: 8 }]}
              onPress={() => setShowRecurrenceEndDatePicker(true)}
              testID="create-event-recurrence-end-date-picker"
              accessibilityLabel="Select recurrence end date"
            >
              <Text style={recurrenceEndDate ? styles.fieldValue : styles.fieldPlaceholder}>
                {recurrenceEndDate ? formatDateForDisplay(recurrenceEndDate) : 'Select end date'}
              </Text>
              <CalendarIcon size={20} color={Colors.neutral.coolMist} />
            </TouchableOpacity>
          )}
          {showRecurrenceEndDatePicker && (
            <DateTimePicker
              value={selectedRecurrenceEndDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDateValue) => {
                if (Platform.OS === 'android' || event.type === 'dismissed' || event.type === 'set') {
                  setShowRecurrenceEndDatePicker(false);
                }
                if (event.type === 'set' && selectedDateValue) {
                  setSelectedRecurrenceEndDate(selectedDateValue);
                  const year = selectedDateValue.getFullYear();
                  const month = String(selectedDateValue.getMonth() + 1).padStart(2, '0');
                  const day = String(selectedDateValue.getDate()).padStart(2, '0');
                  setRecurrenceEndDate(`${year}-${month}-${day}`);
                  setRecurrenceEndType('on_date');
                }
              }}
              minimumDate={new Date()}
            />
          )}
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Location</Text>
        <TouchableOpacity style={styles.fieldInput} onPress={() => setShowLocationPicker(true)}>
          <Text style={locationName ? styles.fieldValue : styles.fieldPlaceholder}>
            {locationTbd ? 'TBD' : (locationName || 'Search location or enter address')}
          </Text>
          <Ionicons name="search" size={20} color={Colors.neutral.coolMist} />
        </TouchableOpacity>
        {locationName && !locationTbd ? (
          <Text style={styles.locationAddressText}>{locationAddress}</Text>
        ) : null}
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Location TBD</Text>
        <Switch
          value={locationTbd}
          onValueChange={setLocationTbd}
          trackColor={{ false: SwitchColors.trackFalse, true: SwitchColors.trackTrue }}
          thumbColor={locationTbd ? SwitchColors.thumbTrue : SwitchColors.thumbFalse}
          testID="create-event-location-tbd-switch"
          accessibilityLabel="Location TBD"
        />
      </View>

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={handleLocationSelect}
        apiKey={GOOGLE_PLACES_API_KEY}
      />
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView ref={step3ScrollRef} style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Who Can See This Event? *</Text>
      {VISIBILITY_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={styles.radioRow}
          onPress={() => setVisibility(option.value)}
          testID={`create-event-visibility-${option.value}`}
          accessibilityLabel={option.label}
        >
          <View style={[styles.radioCircle, visibility === option.value && styles.radioCircleSelected]}>
            {visibility === option.value && <View style={styles.radioCircleInner} />}
          </View>
          <View style={styles.radioTextContainer}>
            <Text style={styles.radioLabel}>{option.label}</Text>
            <Text style={styles.radioDescription}>{option.description}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {selectedBubble?.campusId ? (
        <View style={styles.campusInfoBanner}>
          <Text style={styles.campusInfoIcon}>🎓</Text>
          <View style={styles.campusInfoContent}>
            <Text style={styles.campusInfoTitle}>Campus Only Event</Text>
            <Text style={styles.campusInfoDescription}>This event will only be visible to students from the bubble's campus</Text>
          </View>
        </View>
      ) : isCampusVerified ? (
        <View style={styles.toggleRow}>
          <View style={styles.campusToggleLeft}>
            <Text style={styles.campusInfoIcon}>🎓</Text>
            <Text style={styles.toggleLabel}>Campus Only</Text>
          </View>
          <Switch
            value={campusOnly}
            onValueChange={setCampusOnly}
            trackColor={{ false: SwitchColors.trackFalse, true: SwitchColors.trackTrue }}
            thumbColor={campusOnly ? SwitchColors.thumbTrue : SwitchColors.thumbFalse}
            testID="create-event-campus-only-switch"
            accessibilityLabel="Campus only"
          />
        </View>
      ) : null}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Event Environment</Text>
      {ENVIRONMENT_OPTIONS.map((option) => {
        const isChecked =
          (option.key === 'petFriendly' && petFriendly) ||
          (option.key === 'smokeFree' && smokeFree) ||
          (option.key === 'wheelchairAccessible' && wheelchairAccessible);
        return (
          <TouchableOpacity
            key={option.key}
            style={styles.checkboxRow}
            onPress={() => {
              if (option.key === 'petFriendly') setPetFriendly(!petFriendly);
              if (option.key === 'smokeFree') setSmokeFree(!smokeFree);
              if (option.key === 'wheelchairAccessible') setWheelchairAccessible(!wheelchairAccessible);
            }}
            testID={`create-event-environment-${option.key}`}
            accessibilityLabel={option.label}
          >
            <CheckboxIcon size={18} checked={isChecked} />
            <Ionicons name={option.icon} size={20} color={Colors.neutral.coolMist} style={styles.checkboxIcon} />
            <View style={styles.checkboxTextContainer}>
              <Text style={styles.checkboxLabel}>{option.label}</Text>
              <Text style={styles.checkboxDescription}>{option.description}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.divider} />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Attendee Limit</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="E.g. 25 (Leave empty for unlimited)"
          placeholderTextColor={Colors.neutral.coolMist}
          value={attendeeLimit}
          onChangeText={(val) => setAttendeeLimit(val.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          testID="create-event-attendee-limit-input"
          accessibilityLabel="Attendee limit"
        />
      </View>

      <View
        style={styles.fieldGroup}
        onLayout={(e) => { rsvpSectionY.current = e.nativeEvent.layout.y; }}
      >
        <Text style={styles.fieldLabel}>RSVP Deadline</Text>
        <TouchableOpacity
          style={styles.fieldInput}
          onPress={() => {
            setShowRsvpDatePicker(true);
            setTimeout(() => {
              step3ScrollRef.current?.scrollTo({ y: rsvpSectionY.current - 40, animated: true });
            }, 100);
          }}
          testID="create-event-rsvp-deadline-picker"
          accessibilityLabel="Select RSVP deadline"
        >
          <Text style={rsvpDeadline ? styles.fieldValue : styles.fieldPlaceholder}>
            {rsvpDeadline ? formatRsvpForDisplay(rsvpDeadline) : 'Select deadline'}
          </Text>
          <CalendarIcon size={20} color={Colors.neutral.coolMist} />
        </TouchableOpacity>
        {showRsvpDatePicker && (
          <DateTimePicker
            value={selectedRsvpDate}
            mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onRsvpDateChange}
            minimumDate={new Date()}
            minuteInterval={TIME_MINUTE_INTERVAL}
          />
        )}
        {showRsvpTimePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={selectedRsvpDate}
            mode="time"
            display="default"
            onChange={onRsvpTimeChange}
            minuteInterval={TIME_MINUTE_INTERVAL}
          />
        )}
      </View>
    </ScrollView>
  );

  const SEPARATOR_HEIGHT = 1;
  const usableHeight = reviewAreaHeight > 0 ? reviewAreaHeight - (SEPARATOR_HEIGHT * 2) : 0;

  const handleViewEventNavigation = () => {
    setShowSuccess(false);
    setTimeout(() => {
      if (createdEvent?.id) {
        navigation.replace('EventDetails', {
          eventId: createdEvent.id,
          source: 'createEvent',
          bubbleId: selectedBubble?.id,
          bubbleTitle: selectedBubble?.title,
        });
      } else {
        navigation.goBack();
      }
    }, 300);
  };

  const renderStep4 = () => (
    <View
      style={styles.flex1}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && h !== reviewAreaHeight) setReviewAreaHeight(h);
      }}
    >
      {usableHeight > 0 ? (
        <View style={styles.flex1}>
          <View style={{ height: usableHeight * 0.5, paddingHorizontal: 20, paddingTop: 12, alignItems: 'center' }}>
            {images.length > 0 ? (
              <Image source={{ uri: images[0] }} style={styles.reviewCoverImage} />
            ) : (
              <View style={styles.reviewCoverPlaceholder}>
                <Ionicons name="image-outline" size={56} color={Colors.neutral.coolMist} />
              </View>
            )}
            <Text style={styles.reviewTitle} numberOfLines={1}>{title}</Text>
          </View>

          <View style={styles.reviewSeparator} />

          <View style={{ height: usableHeight * 0.2, paddingHorizontal: 20, justifyContent: 'center' }}>
            {description ? (
              <Text style={styles.reviewDescription} numberOfLines={4}>{description}</Text>
            ) : null}
          </View>

          <View style={styles.reviewSeparator} />

          <View style={{ height: usableHeight * 0.3, paddingHorizontal: 20, justifyContent: 'center' }}>
            <View style={styles.reviewDetailRow}>
              <CalendarIcon size={18} color={Colors.neutral.charcoal} />
              <Text style={styles.reviewDetailValue}>{date ? formatDateForDisplay(date) : 'No date set'}</Text>
            </View>

            <View style={styles.reviewDetailRow}>
              <ClockIcon size={18} color={Colors.neutral.charcoal} />
              <Text style={styles.reviewDetailValue}>
                {startTime ? formatTimeForDisplay(startTime) : '--:--'}
                {endTime ? ` - ${formatTimeForDisplay(endTime)}` : ''}
              </Text>
            </View>

            <View style={styles.reviewDetailRow}>
              <LocationPinIcon size={18} color={Colors.neutral.charcoal} />
              <Text style={styles.reviewDetailValue} numberOfLines={2}>{locationTbd ? 'TBD' : (locationAddress || 'TBD')}</Text>
            </View>

            {attendeeLimit ? (
              <View style={styles.reviewDetailRow}>
                <PeopleIcon size={18} color={Colors.neutral.charcoal} />
                <Text style={styles.reviewDetailValue}>Limit: {attendeeLimit} people</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderSuccessScreen = () => (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.brand.skyWhite} />
      {renderHeader()}
      <View style={styles.stepIndicatorBar}>
        <View style={[styles.stepIndicatorSegment, styles.stepIndicatorActive]} />
        <View style={[styles.stepIndicatorSegment, styles.stepIndicatorActive]} />
        <View style={[styles.stepIndicatorSegment, styles.stepIndicatorActive]} />
        <View style={[styles.stepIndicatorSegment, styles.stepIndicatorActive]} />
      </View>
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        {renderEventCard()}
      </ScrollView>
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity style={styles.publishButton} disabled>
          <View style={styles.publishButtonContent}>
            <Ionicons name="checkmark" size={20} color={Colors.brand.skyWhite} style={{ marginRight: 8 }} />
            <Text style={styles.publishButtonText}>Publish Event</Text>
          </View>
        </TouchableOpacity>
      </View>
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successCheckCircle}>
              <Ionicons name="checkmark" size={48} color={Colors.brand.skyWhite} />
            </View>
            <Text style={styles.successTitle}>Event Created!</Text>
            <Text style={styles.successSubtitle}>Your event has been published successfully</Text>
            <TouchableOpacity
              onPress={handleViewEventNavigation}
              style={{ width: '100%' }}
              testID="create-event-view-event-button"
              accessibilityLabel="View Event"
            >
              <LinearGradient
                colors={[...Gradients.button.colors] as [string, string]}
                start={Gradients.button.start}
                end={Gradients.button.end}
                style={styles.successViewButton}
              >
                <Text style={styles.successViewButtonText}>View Event</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  const renderBubblePickerModal = () => (
    <Modal
      visible={showBubblePicker}
      animationType="slide"
      transparent
      onRequestClose={() => setShowBubblePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Select a Bubble</Text>
          <ScrollView style={styles.modalScrollContent}>
            {myBubbles.map((bubble, idx) => (
              <React.Fragment key={bubble.id}>
                <TouchableOpacity
                  style={styles.bubbleRow}
                  onPress={() => {
                    setSelectedBubble(bubble);
                    setShowBubblePicker(false);
                  }}
                  testID={`create-event-bubble-option-${bubble.id}`}
                  accessibilityLabel={bubble.title}
                >
                  {bubble.coverImage ? (
                    <Image source={{ uri: bubble.coverImage }} style={styles.bubbleRowImage} />
                  ) : (
                    <View style={styles.bubbleRowImagePlaceholder}>
                      <Ionicons name="people" size={20} color={Colors.neutral.coolMist} />
                    </View>
                  )}
                  <View style={styles.bubbleRowTextContainer}>
                    <Text style={styles.bubbleRowName} numberOfLines={1}>{bubble.title.length > 25 ? bubble.title.substring(0, 25) + '...' : bubble.title}</Text>
                    <Text style={styles.bubbleRowCategory}>{bubble.category}</Text>
                  </View>
                </TouchableOpacity>
                {idx < myBubbles.length - 1 && <View style={styles.bubbleRowDivider} />}
              </React.Fragment>
            ))}
            {myBubbles.length === 0 && (
              <Text style={styles.emptyBubblesText}>You need to create a bubble first to host events</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (showSuccess) {
    return renderSuccessScreen();
  }

  const getBottomButtonLabel = () => {
    if (step === 3) return 'Review';
    if (step === 4) return 'Publish Event';
    return 'Next';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.brand.skyWhite} />
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderHeader()}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        <View style={styles.bottomButtonContainer}>
          {step === 4 ? (
            <TouchableOpacity
              style={[styles.publishButton, loading && styles.primaryButtonDisabled]}
              onPress={handlePublish}
              disabled={loading}
              testID="create-event-publish-button"
              accessibilityLabel="Publish Event"
            >
              {loading ? (
                <ActivityIndicator color={Colors.brand.skyWhite} />
              ) : (
                <View style={styles.publishButtonContent}>
                  <Ionicons name="checkmark" size={20} color={Colors.brand.skyWhite} style={{ marginRight: 8 }} />
                  <Text style={styles.publishButtonText}>Publish Event</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[loading && styles.primaryButtonDisabled]}
              onPress={handleNext}
              disabled={loading}
              testID="create-event-next-button"
              accessibilityLabel={getBottomButtonLabel()}
            >
              <LinearGradient
                colors={[...Gradients.button.colors] as [string, string]}
                start={Gradients.button.start}
                end={Gradients.button.end}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>{getBottomButtonLabel()}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {renderBubblePickerModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.skyWhite,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  headerCancelBtn: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  headerCancelText: {
    fontSize: 16,
    color: Colors.brand.bubbleBlue,
    fontWeight: '500',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral.charcoal,
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.neutral.charcoal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldTextArea: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.neutral.charcoal,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  fieldValue: {
    fontSize: 16,
    color: Colors.neutral.charcoal,
    flex: 1,
  },
  fieldPlaceholder: {
    fontSize: 16,
    color: Colors.neutral.coolMist,
    flex: 1,
  },
  uploadSuccessText: {
    fontSize: 14,
    color: Colors.state.success,
    fontWeight: '500',
    marginTop: 8,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  timeField: {
    flex: 1,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.neutral.coolMist,
    marginVertical: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral.charcoal,
  },
  recurrenceContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  recurrenceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  recurrenceOptionText: {
    fontSize: 16,
    color: Colors.neutral.charcoal,
  },
  recurrenceDivider: {
    height: 1,
    backgroundColor: Colors.neutral.coolMist,
  },
  customRecurrenceContainer: {
    marginTop: 12,
    paddingLeft: 8,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: Colors.brand.skyWhite,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  dropdownItemText: {
    fontSize: 16,
    color: Colors.neutral.charcoal,
  },
  dropdownItemTextActive: {
    color: Colors.brand.bubbleBlue,
    fontWeight: '600',
  },
  locationAddressText: {
    fontSize: 13,
    color: Colors.neutral.coolMist,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    marginBottom: 16,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.neutral.coolMist,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioCircleSelected: {
    borderColor: Colors.brand.bubbleBlue,
  },
  radioCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.brand.bubbleBlue,
  },
  radioTextContainer: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral.charcoal,
  },
  radioDescription: {
    fontSize: 13,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.neutral.coolMist,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderColor: Colors.brand.bubbleBlue,
  },
  checkboxIcon: {
    marginRight: 4,
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral.charcoal,
  },
  checkboxDescription: {
    fontSize: 13,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  bottomButtonContainer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 20,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.cloudGrey,
  },
  primaryButton: {
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButton: {
    backgroundColor: Colors.state.success,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.brand.skyWhite,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  successEventCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    overflow: 'hidden',
    backgroundColor: Colors.brand.skyWhite,
  },
  successEventCardImage: {
    width: '100%',
    height: 120,
    backgroundColor: Colors.neutral.cloudGrey,
  },
  successEventCardImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: Colors.neutral.cloudGrey,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successEventCardBody: {
    padding: 12,
  },
  reviewCoverImage: {
    width: '100%',
    flex: 1,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  reviewCoverPlaceholder: {
    width: '100%',
    flex: 1,
    borderRadius: 12,
    backgroundColor: Colors.neutral.cloudGrey,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewSeparator: {
    height: 1,
    backgroundColor: Colors.neutral.cloudGrey,
    marginHorizontal: 20,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
    marginTop: 10,
    textAlign: 'center',
  },
  reviewDescription: {
    fontSize: 15,
    color: Colors.neutral.charcoal,
    lineHeight: 22,
  },
  reviewDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  reviewDetailValue: {
    fontSize: 15,
    color: Colors.neutral.charcoal,
    flex: 1,
  },
  stepIndicatorBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 4,
    paddingVertical: 8,
  },
  stepIndicatorSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.neutral.coolMist,
  },
  stepIndicatorActive: {
    backgroundColor: Colors.brand.bubbleBlue,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModal: {
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  successCheckCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.state.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: Colors.neutral.coolMist,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  successViewButton: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  successViewButtonText: {
    color: Colors.neutral.charcoal,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.brand.skyWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.neutral.coolMist,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  bubbleRowImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.neutral.cloudGrey,
  },
  bubbleRowImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.neutral.coolMist,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleRowTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  bubbleRowName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral.charcoal,
  },
  bubbleRowCategory: {
    fontSize: 13,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  bubbleRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8E8E8',
  },
  emptyBubblesText: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    paddingVertical: 20,
  },
  campusInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8F4FD',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SwitchColors.trackTrue,
    gap: 10,
    marginTop: 12,
  },
  campusInfoIcon: {
    fontSize: 18,
  },
  campusInfoContent: {
    flex: 1,
    gap: 4,
  },
  campusInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  campusInfoDescription: {
    fontSize: 13,
    color: Colors.neutral.coolMist,
    lineHeight: 18,
  },
  campusToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerModal: {
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 16,
    width: '85%',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  timePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    marginBottom: 12,
  },
  timePickerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  timePickerCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    alignItems: 'center',
  },
  timePickerCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.neutral.charcoal,
  },
  timePickerConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.brand.bubbleBlue,
    alignItems: 'center',
  },
  timePickerConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.skyWhite,
  },
});
