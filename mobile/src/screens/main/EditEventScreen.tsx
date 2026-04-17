import React, { useState } from 'react';
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
  Switch,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import apiService from '../../services/api.service';
import SuccessModal from '../../components/SuccessModal';
import LocationPickerModal from '../../components/LocationPickerModal';
import { GOOGLE_PLACES_API_KEY } from '../../config/api';
import MultiImagePicker from '../../components/MultiImagePicker';
import { LinearGradient } from 'expo-linear-gradient';
import BubbleButton from '../../components/BubbleButton';
import { Colors, Spacing, Radius, Typography, SwitchColors } from '../../styles/theme';
import { ChevronDownIcon, LocationPinIcon } from '../../components/icons';
import ScreenHeader from '../../components/ScreenHeader';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', description: 'Anyone can see and RSVP' },
  { value: 'request', label: 'Request to Join', description: 'Users must request to attend' },
  { value: 'private', label: 'Private', description: 'Only visible to bubble members' },
];

export default function EditEventScreen({ navigation, route }: Props) {
  const { event } = route.params as { event: any };
  
  const [title, setTitle] = useState(event.title || '');
  const [description, setDescription] = useState(event.description || '');
  const [images, setImages] = useState<string[]>(
    Array.isArray(event.images) ? event.images : (event.coverImage ? [event.coverImage] : [])
  );
  const [date, setDate] = useState(event.date || '');
  const [startTime, setStartTime] = useState(event.startTime || '');
  const [endTime, setEndTime] = useState(event.endTime || '');
  const [locationName, setLocationName] = useState(event.locationName || '');
  const [locationAddress, setLocationAddress] = useState(event.locationAddress || '');
  const [visibility, setVisibility] = useState(event.visibility || 'public');
  const [petFriendly, setPetFriendly] = useState(event.petFriendly || false);
  const [smokeFree, setSmokeFree] = useState(event.smokeFree || false);
  const [wheelchairAccessible, setWheelchairAccessible] = useState(event.wheelchairAccessible || false);
  const [attendeeLimitEnabled, setAttendeeLimitEnabled] = useState(!!event.attendeeLimit);
  const [attendeeLimit, setAttendeeLimit] = useState(event.attendeeLimit?.toString() || '');
  
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isFormValid = title && date && startTime;

  const handleSave = async () => {
    if (!isFormValid) return;

    setLoading(true);
    try {
      await apiService.updateEvent(event.id, {
        title,
        description: description || null,
        coverImage: images.length > 0 ? images[0] : null,
        images,
        date,
        startTime,
        endTime: endTime || null,
        locationName: locationName || null,
        locationAddress: locationAddress || null,
        visibility,
        petFriendly,
        smokeFree,
        wheelchairAccessible,
        attendeeLimit: attendeeLimitEnabled && attendeeLimit ? parseInt(attendeeLimit) : null,
        bubbleId: event.bubbleId,
        campusId: event.campusId,
        timezone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      setShowSuccessModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleDateChange = (e: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
      const day = selectedDate.getDate().toString().padStart(2, '0');
      setDate(`${year}-${month}-${day}`);
    }
  };

  const handleStartTimeChange = (e: DateTimePickerEvent, selectedTime?: Date) => {
    setShowStartTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      setStartTime(`${hours}:${minutes}`);
    }
  };

  const handleEndTimeChange = (e: DateTimePickerEvent, selectedTime?: Date) => {
    setShowEndTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      setEndTime(`${hours}:${minutes}`);
    }
  };

  const handleLocationSelect = (place: { name: string; address: string; latitude?: number; longitude?: number }) => {
    setLocationName(place.name);
    setLocationAddress(place.address);
    setShowLocationPicker(false);
  };

  const getPickerDate = () => {
    if (date) {
      return new Date(date + 'T00:00:00');
    }
    return new Date();
  };

  const getPickerTime = (timeStr: string) => {
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    }
    return new Date();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Edit Event" onBack={() => navigation.goBack()} />

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="What's your event called?"
              placeholderTextColor={Colors.neutral.coolMist}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell people about your event..."
              placeholderTextColor={Colors.neutral.coolMist}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photos</Text>
            <MultiImagePicker
              images={images}
              onImagesChange={setImages}
              maxImages={5}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date *</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={date ? styles.selectText : styles.selectPlaceholder}>
                {date ? formatDisplayDate(date) : 'Select date'}
              </Text>
              <Ionicons name="calendar" size={20} color={Colors.neutral.coolMist} />
            </TouchableOpacity>
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Start Time *</Text>
              <TouchableOpacity 
                style={styles.selectInput}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text style={startTime ? styles.selectText : styles.selectPlaceholder}>
                  {startTime ? formatDisplayTime(startTime) : 'Start'}
                </Text>
                <Ionicons name="time" size={20} color={Colors.neutral.coolMist} />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>End Time</Text>
              <TouchableOpacity 
                style={styles.selectInput}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text style={endTime ? styles.selectText : styles.selectPlaceholder}>
                  {endTime ? formatDisplayTime(endTime) : 'End'}
                </Text>
                <Ionicons name="time" size={20} color={Colors.neutral.coolMist} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => setShowLocationPicker(true)}
            >
              <View style={{ flex: 1 }}>
                <Text style={locationName ? styles.selectText : styles.selectPlaceholder}>
                  {locationName || 'Select location'}
                </Text>
                {locationAddress && (
                  <Text style={styles.locationAddress} numberOfLines={1}>
                    {locationAddress}
                  </Text>
                )}
              </View>
              <LocationPinIcon size={20} color={Colors.neutral.coolMist} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Visibility</Text>
            <TouchableOpacity 
              style={styles.selectInput}
              onPress={() => setShowVisibilityPicker(true)}
            >
              <Text style={styles.selectText}>
                {VISIBILITY_OPTIONS.find(v => v.value === visibility)?.label || 'Public'}
              </Text>
              <ChevronDownIcon size={20} color={Colors.neutral.coolMist} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Pet Friendly</Text>
              <Switch
                value={petFriendly}
                onValueChange={setPetFriendly}
                trackColor={{ false: SwitchColors.trackFalse, true: SwitchColors.trackTrue }}
                thumbColor={petFriendly ? SwitchColors.thumbTrue : SwitchColors.thumbFalse}
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Smoke Free</Text>
              <Switch
                value={smokeFree}
                onValueChange={setSmokeFree}
                trackColor={{ false: SwitchColors.trackFalse, true: SwitchColors.trackTrue }}
                thumbColor={smokeFree ? SwitchColors.thumbTrue : SwitchColors.thumbFalse}
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Wheelchair Accessible</Text>
              <Switch
                value={wheelchairAccessible}
                onValueChange={setWheelchairAccessible}
                trackColor={{ false: SwitchColors.trackFalse, true: SwitchColors.trackTrue }}
                thumbColor={wheelchairAccessible ? SwitchColors.thumbTrue : SwitchColors.thumbFalse}
              />
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Limit Attendees</Text>
              <Switch
                value={attendeeLimitEnabled}
                onValueChange={setAttendeeLimitEnabled}
                trackColor={{ false: SwitchColors.trackFalse, true: SwitchColors.trackTrue }}
                thumbColor={attendeeLimitEnabled ? SwitchColors.thumbTrue : SwitchColors.thumbFalse}
              />
            </View>

            {attendeeLimitEnabled && (
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="Maximum number of attendees"
                placeholderTextColor={Colors.neutral.coolMist}
                value={attendeeLimit}
                onChangeText={setAttendeeLimit}
                keyboardType="number-pad"
              />
            )}
          </View>

          <BubbleButton
            title="Save Changes"
            onPress={handleSave}
            disabled={!isFormValid}
            loading={loading}
            testID="button-save-event"
            style={{ marginTop: 12 }}
          />
        </View>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={getPickerDate()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {showStartTimePicker && (
        <DateTimePicker
          value={getPickerTime(startTime)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartTimeChange}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={getPickerTime(endTime)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndTimeChange}
        />
      )}

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
              <Text style={styles.modalTitle}>Select Visibility</Text>
              <TouchableOpacity onPress={() => setShowVisibilityPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            {VISIBILITY_OPTIONS.map((option) => (
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
                    visibility === option.value && styles.modalOptionSelected,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.modalOptionDescription}>{option.description}</Text>
                </View>
                {visibility === option.value && (
                  <Ionicons name="checkmark" size={20} color={Colors.brand.bubbleBlue} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={handleLocationSelect}
        apiKey={GOOGLE_PLACES_API_KEY}
      />

      <SuccessModal
        visible={showSuccessModal}
        title="Event Updated!"
        subtitle="Your changes have been saved successfully"
        onClose={() => {
          setShowSuccessModal(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: Colors.background.primary,
    color: Colors.neutral.charcoal,
  },
  textArea: {
    minHeight: 100,
  },
  selectInput: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: 12,
    padding: 16,
    backgroundColor: Colors.background.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
    color: Colors.neutral.charcoal,
  },
  selectPlaceholder: {
    fontSize: 16,
    color: Colors.neutral.coolMist,
  },
  locationAddress: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  section: {
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.coolMist,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 15,
    color: Colors.neutral.charcoal,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.brand.skyWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    padding: 20,
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
    color: Colors.neutral.charcoal,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.neutral.charcoal,
  },
  modalOptionSelected: {
    color: Colors.brand.bubbleBlue,
    fontWeight: '600',
  },
  modalOptionDescription: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
});
