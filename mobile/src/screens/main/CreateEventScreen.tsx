import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import apiService from '../../services/api.service';
import LocationPickerModal from '../../components/LocationPickerModal';
import { GOOGLE_PLACES_API_KEY } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import MultiImagePicker from '../../components/MultiImagePicker';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route?: RouteProp<any>;
};

type Bubble = {
  id: string;
  title: string;
  category: string;
  campusId?: number | null;
};

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', description: 'Anyone can see and RSVP' },
  { value: 'request', label: 'Request to Join', description: 'Users must request to attend' },
  { value: 'private', label: 'Private', description: 'Only visible to bubble members' },
];

const ENVIRONMENT_OPTIONS = [
  { key: 'petFriendly', label: 'Pet Friendly', icon: 'paw' as const },
  { key: 'smokeFree', label: 'Smoke Free', icon: 'ban' as const },
  { key: 'wheelchairAccessible', label: 'Wheelchair Accessible', icon: 'accessibility' as const },
];

export default function CreateEventScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const routeParams = route?.params as { bubbleId?: string; bubbleTitle?: string } | undefined;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<any>(null);
  const [campusOnly, setCampusOnly] = useState(false);
  
  const isCampusVerified = user?.campusVerified && user?.campusId;

  // User's bubbles for selection
  const [myBubbles, setMyBubbles] = useState<Bubble[]>([]);
  const [showBubblePicker, setShowBubblePicker] = useState(false);

  // Step 1: Basic Info
  const [selectedBubble, setSelectedBubble] = useState<Bubble | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Images
  const [images, setImages] = useState<string[]>([]);

  // Step 3: Date & Time
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Step 4: Location
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLatitude, setLocationLatitude] = useState<number | undefined>();
  const [locationLongitude, setLocationLongitude] = useState<number | undefined>();
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Step 5: Privacy & Settings
  const [visibility, setVisibility] = useState('public');
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [petFriendly, setPetFriendly] = useState(false);
  const [smokeFree, setSmokeFree] = useState(false);
  const [wheelchairAccessible, setWheelchairAccessible] = useState(false);
  const [attendeeLimitEnabled, setAttendeeLimitEnabled] = useState(false);
  const [attendeeLimit, setAttendeeLimit] = useState('');
  const [rsvpDeadlineEnabled, setRsvpDeadlineEnabled] = useState(false);
  const [rsvpDeadline, setRsvpDeadline] = useState('');

  // Date/Time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showRsvpDeadlinePicker, setShowRsvpDeadlinePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedStartTime, setSelectedStartTime] = useState<Date>(new Date());
  const [selectedEndTime, setSelectedEndTime] = useState<Date>(new Date());
  const [selectedRsvpDeadline, setSelectedRsvpDeadline] = useState<Date>(new Date());

  useEffect(() => {
    fetchMyBubbles();
  }, []);

  const fetchMyBubbles = async () => {
    try {
      const data = await apiService.getMyCreatedBubbles() as Bubble[];
      setMyBubbles(data);
      
      // Auto-select bubble if passed via route params
      if (routeParams?.bubbleId) {
        const preselectedBubble = data.find(b => b.id === routeParams.bubbleId);
        if (preselectedBubble) {
          setSelectedBubble(preselectedBubble);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bubbles:', error);
    }
  };

  const canProceedToNext = () => {
    switch (step) {
      case 1:
        return selectedBubble && title.trim().length >= 3;
      case 2:
        return true; // Cover image is optional
      case 3:
        return date && startTime;
      case 4:
        return true; // Location is optional
      case 5:
        return true;
      case 6:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < 6) {
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
      const eventData = {
        bubbleId: selectedBubble!.id,
        title: title.trim(),
        description: description.trim() || null,
        coverImage: images.length > 0 ? images[0] : null,
        images,
        date,
        startTime,
        endTime: endTime || null,
        locationName: locationName.trim() || null,
        locationAddress: locationAddress.trim() || null,
        visibility,
        petFriendly,
        smokeFree,
        wheelchairAccessible,
        attendeeLimit: attendeeLimitEnabled && attendeeLimit ? parseInt(attendeeLimit) : null,
        rsvpDeadline: rsvpDeadlineEnabled && rsvpDeadline ? rsvpDeadline : null,
        campusId: selectedBubble?.campusId || (campusOnly && isCampusVerified ? user?.campusId : null),
      };

      const event = await apiService.createEvent(eventData);
      setCreatedEvent(event);
      setShowSuccessModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigation.goBack();
  };

  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTimeForDisplay = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Date picker handlers
  const onDateChange = (event: DateTimePickerEvent, selectedDateValue?: Date) => {
    // Always hide picker on Android, or on iOS when dismissed/set
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

  const onRsvpDeadlineChange = (event: DateTimePickerEvent, selectedDateValue?: Date) => {
    if (Platform.OS === 'android' || event.type === 'dismissed' || event.type === 'set') {
      setShowRsvpDeadlinePicker(false);
    }
    if (event.type === 'set' && selectedDateValue) {
      setSelectedRsvpDeadline(selectedDateValue);
      const year = selectedDateValue.getFullYear();
      const month = String(selectedDateValue.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDateValue.getDate()).padStart(2, '0');
      setRsvpDeadline(`${year}-${month}-${day}`);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4, 5, 6].map((s) => (
        <View
          key={s}
          style={[
            styles.stepDot,
            s === step && styles.stepDotActive,
            s < step && styles.stepDotCompleted,
          ]}
        />
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Basic Info</Text>
      <Text style={styles.stepSubtitle}>What's your event about?</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Select Bubble *</Text>
        <TouchableOpacity
          style={styles.selectInput}
          onPress={() => setShowBubblePicker(true)}
        >
          <Text style={selectedBubble ? styles.selectText : styles.selectPlaceholder}>
            {selectedBubble ? selectedBubble.title : 'Choose a bubble for this event'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
        {myBubbles.length === 0 && (
          <Text style={styles.helperTextWarning}>
            You need to create a bubble first to host events
          </Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Event Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Give your event a catchy name"
          placeholderTextColor="#999"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
        <Text style={styles.charCount}>{title.length}/80</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Tell people what to expect..."
          placeholderTextColor="#999"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Event Photos</Text>
      <Text style={styles.stepSubtitle}>Add photos to make your event stand out</Text>

      <View style={styles.inputGroup}>
        <MultiImagePicker
          images={images}
          onImagesChange={setImages}
          maxImages={5}
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Date & Time</Text>
      <Text style={styles.stepSubtitle}>When is your event happening?</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Date *</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#666" />
          <Text style={[styles.pickerButtonText, !date && styles.pickerPlaceholder]}>
            {date ? formatDateForDisplay(date) : 'Select a date'}
          </Text>
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
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Start Time *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowStartTimePicker(true)}
          >
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={[styles.pickerButtonText, !startTime && styles.pickerPlaceholder]}>
              {startTime ? formatTimeForDisplay(startTime) : 'Start'}
            </Text>
          </TouchableOpacity>
          {showStartTimePicker && (
            <DateTimePicker
              value={selectedStartTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onStartTimeChange}
              is24Hour={false}
            />
          )}
        </View>

        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>End Time</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowEndTimePicker(true)}
          >
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={[styles.pickerButtonText, !endTime && styles.pickerPlaceholder]}>
              {endTime ? formatTimeForDisplay(endTime) : 'End'}
            </Text>
          </TouchableOpacity>
          {showEndTimePicker && (
            <DateTimePicker
              value={selectedEndTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onEndTimeChange}
              is24Hour={false}
            />
          )}
        </View>
      </View>

      <Text style={styles.helperText}>Tap to select date and time</Text>
    </View>
  );

  const handleLocationSelect = (location: { name: string; address: string; latitude?: number; longitude?: number }) => {
    setLocationName(location.name);
    setLocationAddress(location.address);
    setLocationLatitude(location.latitude);
    setLocationLongitude(location.longitude);
  };

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Location</Text>
      <Text style={styles.stepSubtitle}>Where will the event take place?</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Search Location</Text>
        <TouchableOpacity
          style={styles.locationSearchButton}
          onPress={() => setShowLocationPicker(true)}
        >
          {locationName ? (
            <View style={styles.selectedLocation}>
              <Ionicons name="location" size={20} color="hsl(210, 95%, 55%)" />
              <View style={styles.selectedLocationText}>
                <Text style={styles.selectedLocationName} numberOfLines={1}>{locationName}</Text>
                <Text style={styles.selectedLocationAddress} numberOfLines={1}>{locationAddress}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setLocationName('');
                  setLocationAddress('');
                  setLocationLatitude(undefined);
                  setLocationLongitude(undefined);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.locationSearchPlaceholder}>
              <Ionicons name="search" size={20} color="#999" />
              <Text style={styles.locationSearchPlaceholderText}>Search for a place...</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.locationTip}>
        <Ionicons name="information-circle-outline" size={20} color="#666" />
        <Text style={styles.locationTipText}>
          You can also host virtual events by adding a meeting link in the description
        </Text>
      </View>

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={handleLocationSelect}
        apiKey={GOOGLE_PLACES_API_KEY}
      />
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Privacy & Settings</Text>
      <Text style={styles.stepSubtitle}>Control who can see and join your event</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Visibility</Text>
        <TouchableOpacity
          style={styles.selectInput}
          onPress={() => setShowVisibilityPicker(true)}
        >
          <Text style={styles.selectText}>
            {VISIBILITY_OPTIONS.find(v => v.value === visibility)?.label}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
        <Text style={styles.helperText}>
          {VISIBILITY_OPTIONS.find(v => v.value === visibility)?.description}
        </Text>
      </View>

      {selectedBubble?.campusId ? (
        <>
          <View style={styles.sectionDivider} />
          <View style={styles.campusInfoRow}>
            <Text style={{ fontSize: 16 }}>🎓</Text>
            <View style={styles.campusInfoText}>
              <Text style={styles.campusToggleLabel}>Campus Only Event</Text>
              <Text style={styles.helperText}>
                This event will only be visible to students from the bubble's campus
              </Text>
            </View>
          </View>
        </>
      ) : isCampusVerified && (
        <>
          <View style={styles.sectionDivider} />
          <View style={styles.campusToggleRow}>
            <View style={styles.campusToggleInfo}>
              <View style={styles.campusToggleLabelRow}>
                <Text style={{ fontSize: 16 }}>🎓</Text>
                <Text style={styles.campusToggleLabel}>Campus Only</Text>
              </View>
              <Text style={styles.helperText}>
                Only students from your campus can see and attend this event
              </Text>
            </View>
            <Switch
              value={campusOnly}
              onValueChange={setCampusOnly}
              trackColor={{ false: '#e0e0e0', true: 'hsl(210, 95%, 75%)' }}
              thumbColor={campusOnly ? 'hsl(210, 95%, 55%)' : '#f4f3f4'}
            />
          </View>
        </>
      )}

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>Environment</Text>
      {ENVIRONMENT_OPTIONS.map(option => (
        <TouchableOpacity
          key={option.key}
          style={styles.checkboxRow}
          onPress={() => {
            if (option.key === 'petFriendly') setPetFriendly(!petFriendly);
            if (option.key === 'smokeFree') setSmokeFree(!smokeFree);
            if (option.key === 'wheelchairAccessible') setWheelchairAccessible(!wheelchairAccessible);
          }}
        >
          <View style={styles.checkboxIcon}>
            <Ionicons name={option.icon} size={20} color="#666" />
          </View>
          <Text style={styles.checkboxLabel}>{option.label}</Text>
          <View style={[
            styles.checkbox,
            (option.key === 'petFriendly' && petFriendly ||
             option.key === 'smokeFree' && smokeFree ||
             option.key === 'wheelchairAccessible' && wheelchairAccessible) && styles.checkboxChecked
          ]}>
            {(option.key === 'petFriendly' && petFriendly ||
             option.key === 'smokeFree' && smokeFree ||
             option.key === 'wheelchairAccessible' && wheelchairAccessible) && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>Capacity</Text>
      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setAttendeeLimitEnabled(!attendeeLimitEnabled)}
      >
        <View style={styles.checkboxIcon}>
          <Ionicons name="people-outline" size={20} color="#666" />
        </View>
        <Text style={styles.checkboxLabel}>Limit attendees</Text>
        <View style={[styles.checkbox, attendeeLimitEnabled && styles.checkboxChecked]}>
          {attendeeLimitEnabled && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
      {attendeeLimitEnabled && (
        <TextInput
          style={[styles.input, styles.limitInput]}
          placeholder="Maximum attendees"
          placeholderTextColor="#999"
          value={attendeeLimit}
          onChangeText={setAttendeeLimit}
          keyboardType="number-pad"
        />
      )}

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>RSVP Deadline</Text>
      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setRsvpDeadlineEnabled(!rsvpDeadlineEnabled)}
      >
        <View style={styles.checkboxIcon}>
          <Ionicons name="time-outline" size={20} color="#666" />
        </View>
        <Text style={styles.checkboxLabel}>Set RSVP deadline</Text>
        <View style={[styles.checkbox, rsvpDeadlineEnabled && styles.checkboxChecked]}>
          {rsvpDeadlineEnabled && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
      {rsvpDeadlineEnabled && (
        <>
          <TouchableOpacity
            style={[styles.pickerButton, styles.limitInput]}
            onPress={() => setShowRsvpDeadlinePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={[styles.pickerButtonText, !rsvpDeadline && styles.pickerPlaceholder]}>
              {rsvpDeadline ? formatDateForDisplay(rsvpDeadline) : 'Select deadline date'}
            </Text>
          </TouchableOpacity>
          {showRsvpDeadlinePicker && (
            <DateTimePicker
              value={selectedRsvpDeadline}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onRsvpDeadlineChange}
              minimumDate={new Date()}
            />
          )}
        </>
      )}
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review & Publish</Text>
      <Text style={styles.stepSubtitle}>Make sure everything looks good</Text>

      <View style={styles.previewCard}>
        {images.length > 0 ? (
          <Image source={{ uri: images[0] }} style={styles.previewImage} />
        ) : (
          <View style={styles.previewImagePlaceholder}>
            <Ionicons name="calendar" size={40} color="#ccc" />
          </View>
        )}

        <View style={styles.previewContent}>
          <Text style={styles.previewBubble}>{selectedBubble?.title}</Text>
          <Text style={styles.previewTitle}>{title}</Text>
          {description && <Text style={styles.previewDescription}>{description}</Text>}

          <View style={styles.previewRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.previewText}>{formatDateForDisplay(date)}</Text>
          </View>

          <View style={styles.previewRow}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.previewText}>
              {formatTimeForDisplay(startTime)}
              {endTime && ` - ${formatTimeForDisplay(endTime)}`}
            </Text>
          </View>

          {locationName && (
            <View style={styles.previewRow}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.previewText}>{locationName}</Text>
            </View>
          )}

          <View style={styles.previewBadges}>
            <View style={styles.previewBadge}>
              <Text style={styles.previewBadgeText}>
                {VISIBILITY_OPTIONS.find(v => v.value === visibility)?.label}
              </Text>
            </View>
            {attendeeLimitEnabled && attendeeLimit && (
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}>Max {attendeeLimit}</Text>
              </View>
            )}
          </View>

          {(petFriendly || smokeFree || wheelchairAccessible) && (
            <View style={styles.previewEnvironment}>
              {petFriendly && <Ionicons name="paw" size={16} color="hsl(210, 95%, 55%)" />}
              {smokeFree && <Ionicons name="ban" size={16} color="hsl(210, 95%, 55%)" />}
              {wheelchairAccessible && <Ionicons name="accessibility" size={16} color="hsl(210, 95%, 55%)" />}
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name={step === 1 ? 'close' : 'arrow-back'} size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Event</Text>
        <Text style={styles.stepCounter}>{step}/6</Text>
      </View>

      {renderStepIndicator()}

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderCurrentStep()}
      </ScrollView>

      <View style={styles.footer}>
        {step < 6 ? (
          <TouchableOpacity
            style={[styles.nextButton, !canProceedToNext() && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={!canProceedToNext()}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.publishButton, loading && styles.buttonDisabled]}
            onPress={handlePublish}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.publishButtonText}>Publish Event</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={showBubblePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBubblePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBubblePicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Bubble</Text>
              <TouchableOpacity onPress={() => setShowBubblePicker(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {myBubbles.length === 0 ? (
                <Text style={styles.noBubblesText}>
                  You haven't created any bubbles yet. Create a bubble first to host events.
                </Text>
              ) : (
                myBubbles.map(bubble => (
                  <TouchableOpacity
                    key={bubble.id}
                    style={styles.modalOption}
                    onPress={() => {
                      setSelectedBubble(bubble);
                      setShowBubblePicker(false);
                    }}
                  >
                    <View>
                      <Text style={[
                        styles.modalOptionText,
                        selectedBubble?.id === bubble.id && styles.modalOptionSelected
                      ]}>
                        {bubble.title}
                      </Text>
                      <Text style={styles.modalOptionSubtext}>{bubble.category}</Text>
                    </View>
                    {selectedBubble?.id === bubble.id && (
                      <Ionicons name="checkmark" size={20} color="hsl(210, 95%, 55%)" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showVisibilityPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVisibilityPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowVisibilityPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Event Visibility</Text>
              <TouchableOpacity onPress={() => setShowVisibilityPicker(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            {VISIBILITY_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  setVisibility(option.value);
                  setShowVisibilityPicker(false);
                }}
              >
                <View>
                  <Text style={[
                    styles.modalOptionText,
                    visibility === option.value && styles.modalOptionSelected
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.modalOptionSubtext}>{option.description}</Text>
                </View>
                {visibility === option.value && (
                  <Ionicons name="checkmark" size={20} color="hsl(210, 95%, 55%)" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color="hsl(142, 71%, 45%)" />
            </View>
            <Text style={styles.successTitle}>Event Created!</Text>
            <Text style={styles.successSubtitle}>
              Your event has been published to {selectedBubble?.title}
            </Text>
            <TouchableOpacity style={styles.successButton} onPress={handleSuccessClose}>
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  stepCounter: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  stepDotActive: {
    backgroundColor: 'hsl(210, 95%, 55%)',
    width: 24,
  },
  stepDotCompleted: {
    backgroundColor: 'hsl(210, 95%, 75%)',
  },
  scrollContent: {
    flex: 1,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#000',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9f9f9',
    gap: 12,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  pickerPlaceholder: {
    color: '#999',
  },
  textArea: {
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  selectInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
    color: '#000',
  },
  selectPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  helperTextWarning: {
    fontSize: 12,
    color: '#e74c3c',
    marginTop: 6,
  },
  imagePreviewContainer: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  datePreview: {
    fontSize: 13,
    color: 'hsl(210, 95%, 55%)',
    marginTop: 6,
    fontWeight: '500',
  },
  timePreview: {
    fontSize: 13,
    color: 'hsl(210, 95%, 55%)',
    marginTop: 6,
    fontWeight: '500',
  },
  locationTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f5ff',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  locationTipText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  locationSearchButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  locationSearchPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationSearchPlaceholderText: {
    fontSize: 16,
    color: '#999',
  },
  selectedLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedLocationText: {
    flex: 1,
  },
  selectedLocationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedLocationAddress: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkboxIcon: {
    width: 32,
    marginRight: 8,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: 'hsl(210, 95%, 55%)',
    borderColor: 'hsl(210, 95%, 55%)',
  },
  limitInput: {
    marginTop: 8,
    marginLeft: 40,
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  previewImage: {
    width: '100%',
    height: 160,
  },
  previewImagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    padding: 16,
  },
  previewBubble: {
    fontSize: 12,
    color: 'hsl(210, 95%, 55%)',
    fontWeight: '600',
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  previewDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  previewText: {
    fontSize: 14,
    color: '#666',
  },
  previewBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  previewBadge: {
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  previewBadgeText: {
    fontSize: 12,
    color: 'hsl(210, 95%, 45%)',
    fontWeight: '600',
  },
  previewEnvironment: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  nextButton: {
    backgroundColor: 'hsl(210, 95%, 55%)',
    borderRadius: 25,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  publishButton: {
    backgroundColor: 'hsl(142, 71%, 45%)',
    borderRadius: 25,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  modalOptionSelected: {
    color: 'hsl(210, 95%, 55%)',
    fontWeight: '600',
  },
  noBubblesText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  successButton: {
    backgroundColor: 'hsl(210, 95%, 55%)',
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  campusToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  campusToggleInfo: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  campusToggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  campusToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  campusInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'hsl(210, 95%, 95%)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'hsl(210, 95%, 85%)',
    gap: 12,
  },
  campusInfoText: {
    flex: 1,
    gap: 4,
  },
});
