import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Switch,
  PanResponder,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { GOOGLE_PLACES_API_KEY } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import SuccessModal from '../../components/SuccessModal';
import MultiImagePicker from '../../components/MultiImagePicker';
import LocationPickerModal from '../../components/LocationPickerModal';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Colors,
  Spacing,
  Radius,
  Typography,
  RadioStyles,
  SwitchColors,
  ModalStyles,
  Gradients,
} from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

const PRIVACY_OPTIONS = [
  { value: 'Public', label: 'Public', subtitle: 'Anyone can discover and join' },
  { value: 'Request', label: 'Request to Join', subtitle: 'Admin approval required before joining' },
  { value: 'Private', label: 'Private', subtitle: 'Invite-only, hidden from explore' },
];

const STEP_TITLES = ['Bubble Details', 'Rules', 'Privacy & Settings', 'Preview'];

export default function EditBubbleScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { bubble } = route.params as { bubble: any };
  const scrollRef = useRef<FlatList>(null);

  const [step, setStep] = useState(0);

  const [category] = useState(bubble.category || '');
  const [title, setTitle] = useState(bubble.title || '');
  const [tagline, setTagline] = useState(bubble.tagline || '');
  const [description, setDescription] = useState(bubble.description || '');
  const [locationName, setLocationName] = useState(bubble.locationName || '');
  const [locationAddress, setLocationAddress] = useState(bubble.locationAddress || '');
  const [locationLat, setLocationLat] = useState(bubble.locationLat ? String(bubble.locationLat) : '');
  const [locationLng, setLocationLng] = useState(bubble.locationLng ? String(bubble.locationLng) : '');
  const [radiusMiles, setRadiusMiles] = useState(bubble.radiusMiles || 15);
  const [images, setImages] = useState<string[]>(
    Array.isArray(bubble.images) ? bubble.images : (bubble.coverImage ? [bubble.coverImage] : [])
  );
  const [attachments, setAttachments] = useState<string[]>(
    Array.isArray(bubble.attachments) ? [...bubble.attachments] : []
  );
  const [customRules, setCustomRules] = useState<string[]>(
    Array.isArray(bubble.rules) ? [...bubble.rules] : []
  );
  const [privacy, setPrivacy] = useState(bubble.privacy || 'Public');
  const [memberLimit, setMemberLimit] = useState(
    bubble.memberLimit ? String(bubble.memberLimit) : ''
  );
  const [campusOnly, setCampusOnly] = useState(!!bubble.campusId);

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [ruleText, setRuleText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [expandAbout, setExpandAbout] = useState(true);
  const [expandAttachments, setExpandAttachments] = useState(false);
  const [expandRules, setExpandRules] = useState(false);
  const [expandedRuleIndex, setExpandedRuleIndex] = useState<number | null>(null);

  const sliderWidth = useRef(0);

  const isCampusVerified = user?.campusVerified && user?.campusId;

  const allRules = [...customRules];

  const handleSliderLayout = (e: LayoutChangeEvent) => {
    sliderWidth.current = e.nativeEvent.layout.width;
  };

  const handleSliderTouch = (e: GestureResponderEvent) => {
    if (sliderWidth.current <= 0) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / sliderWidth.current));
    const val = Math.round(1 + ratio * 49);
    setRadiusMiles(val);
  };

  const sliderPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handleSliderTouch(e),
      onPanResponderMove: (e) => handleSliderTouch(e),
    })
  ).current;

  const handleLocationSelect = (location: { name: string; address: string; latitude?: number; longitude?: number; placeId?: string }) => {
    setLocationName(location.name);
    setLocationAddress(location.address);
    if (location.latitude != null) setLocationLat(String(location.latitude));
    if (location.longitude != null) setLocationLng(String(location.longitude));
    setShowLocationPicker(false);
  };

  const canGoNext = () => {
    switch (step) {
      case 0: return !!title && !!description;
      case 1: return true;
      case 2: return !!privacy;
      case 3: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (step < 3) {
      setStep(step + 1);
      scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
      scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    } else {
      navigation.goBack();
    }
  };

  const openAddRule = () => {
    setEditingRuleIndex(null);
    setRuleText('');
    setShowRuleModal(true);
  };

  const openEditRule = (index: number) => {
    setEditingRuleIndex(index);
    setRuleText(customRules[index]);
    setShowRuleModal(true);
  };

  const saveRule = () => {
    const trimmed = ruleText.trim();
    if (!trimmed) return;
    if (editingRuleIndex !== null) {
      const updated = [...customRules];
      updated[editingRuleIndex] = trimmed;
      setCustomRules(updated);
    } else {
      setCustomRules([trimmed, ...customRules]);
    }
    setShowRuleModal(false);
    setRuleText('');
  };

  const deleteRule = (index: number) => {
    setCustomRules(customRules.filter((_, i) => i !== index));
    if (expandedRuleIndex === index) {
      setExpandedRuleIndex(null);
    } else if (expandedRuleIndex !== null && expandedRuleIndex > index) {
      setExpandedRuleIndex(expandedRuleIndex - 1);
    }
  };

  const moveRuleUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...customRules];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setCustomRules(updated);
    if (expandedRuleIndex === index) setExpandedRuleIndex(index - 1);
    else if (expandedRuleIndex === index - 1) setExpandedRuleIndex(index);
  };

  const moveRuleDown = (index: number) => {
    if (index >= customRules.length - 1) return;
    const updated = [...customRules];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setCustomRules(updated);
    if (expandedRuleIndex === index) setExpandedRuleIndex(index + 1);
    else if (expandedRuleIndex === index + 1) setExpandedRuleIndex(index);
  };

  const toggleRuleExpand = (globalIndex: number) => {
    setExpandedRuleIndex(expandedRuleIndex === globalIndex ? null : globalIndex);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await apiService.updateBubble(bubble.id, {
        title,
        tagline: tagline || title,
        category,
        description,
        rules: allRules,
        privacy,
        coverImage: images.length > 0 ? images[0] : null,
        images,
        attachments,
        memberLimit: memberLimit && !isNaN(parseInt(memberLimit)) ? parseInt(memberLimit) : null,
        locationName: locationName || null,
        locationAddress: locationAddress || null,
        locationLat: locationLat || null,
        locationLng: locationLng || null,
        radiusMiles,
        campusId: campusOnly && isCampusVerified ? user?.campusId : null,
      });

      setLoading(false);
      setShowSuccessModal(true);
    } catch (error: any) {
      setLoading(false);
      Alert.alert('Error', error.message || 'Failed to update bubble. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
          <Text style={styles.loadingText}>Saving changes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerBack} onPress={goBack}>
        <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{step === 3 ? title : STEP_TITLES[step]}</Text>
      <TouchableOpacity style={styles.headerCancel} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            i <= step && styles.progressSegmentActive,
          ]}
        />
      ))}
    </View>
  );

  const renderStepDetails = () => (
    <View style={styles.formSection}>
      {category ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryDisplay}>
            <Text style={styles.categoryDisplayText}>{category}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Bubble Title <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="Ex: Corgi Fam"
          placeholderTextColor={Colors.text.tertiary}
          value={title}
          onChangeText={(t) => setTitle(t.slice(0, 60))}
          maxLength={60}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Bubble Tagline <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="Meetup with other Corgi Parents near you"
          placeholderTextColor={Colors.text.tertiary}
          value={tagline}
          onChangeText={(t) => setTagline(t.slice(0, 100))}
          maxLength={100}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Bubble Description <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.fieldInput, styles.textArea]}
          placeholder="Describe what your bubble is about..."
          placeholderTextColor={Colors.text.tertiary}
          value={description}
          onChangeText={(t) => setDescription(t.slice(0, 500))}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={500}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Location <Text style={styles.required}>*</Text></Text>
        <TouchableOpacity
          style={styles.locationTappableField}
          onPress={() => setShowLocationPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="location-outline" size={20} color={locationName ? Colors.brand.primary : Colors.text.tertiary} />
          <View style={styles.locationTappableContent}>
            <Text style={[styles.locationTappableText, !locationName && styles.locationTappablePlaceholder]} numberOfLines={1}>
              {locationName || 'Search location or enter address'}
            </Text>
            {locationAddress ? (
              <Text style={styles.locationTappableSubtext} numberOfLines={1}>{locationAddress}</Text>
            ) : null}
          </View>
          <Ionicons name="search" size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>
        {locationName ? (
          <TouchableOpacity
            style={styles.locationClearButton}
            onPress={() => {
              setLocationName('');
              setLocationAddress('');
              setLocationLat('');
              setLocationLng('');
            }}
          >
            <Ionicons name="close-circle" size={16} color={Colors.text.tertiary} />
            <Text style={styles.locationClearText}>Clear location</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.sliderSeparator} />

      <View style={styles.sliderSection}>
        <Text style={styles.sliderValueCentered}>{radiusMiles} miles</Text>
        <View
          style={styles.sliderTrackWrapper}
          onLayout={handleSliderLayout}
          {...sliderPanResponder.panHandlers}
        >
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${((radiusMiles - 1) / 49) * 100}%` }]} />
          </View>
          <View
            style={[
              styles.sliderThumb,
              { left: `${((radiusMiles - 1) / 49) * 100}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Add a Cover Photo <Text style={styles.optional}>(Strongly Recommended)</Text></Text>
        <MultiImagePicker
          images={images}
          onImagesChange={setImages}
          maxImages={1}
          addLabel="+ Add"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Add Attachments</Text>
        <MultiImagePicker
          images={attachments}
          onImagesChange={setAttachments}
          maxImages={5}
          acceptAllFiles
        />
      </View>

      {isCampusVerified && (
        <View style={styles.fieldGroup}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <View style={styles.toggleLabelRow}>
                <Text style={{ fontSize: Typography.sizes.md }}>🎓</Text>
                <Text style={styles.toggleLabel}>Campus Only</Text>
              </View>
              <Text style={styles.helperText}>
                Only students from your campus can see and join
              </Text>
            </View>
            <Switch
              value={campusOnly}
              onValueChange={setCampusOnly}
              trackColor={{ false: SwitchColors.trackFalse, true: SwitchColors.trackTrue }}
              thumbColor={campusOnly ? SwitchColors.thumbTrue : SwitchColors.thumbFalse}
            />
          </View>
        </View>
      )}

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={handleLocationSelect}
        apiKey={GOOGLE_PLACES_API_KEY}
      />
    </View>
  );

  const renderStepRules = () => {
    return (
      <View style={styles.formSection}>
        <TouchableOpacity style={styles.addRuleButton} onPress={openAddRule}>
          <View style={styles.addRuleDashedBorder}>
            <Ionicons name="add" size={20} color={Colors.brand.primary} />
            <Text style={styles.addRuleText}>Add Rule</Text>
          </View>
        </TouchableOpacity>

        {customRules.map((rule, index) => {
          const isExpanded = expandedRuleIndex === index;
          return (
            <Swipeable
              key={`rule-${index}`}
              renderRightActions={() => (
                <TouchableOpacity
                  style={styles.swipeDeleteAction}
                  onPress={() => deleteRule(index)}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.background.primary} />
                  <Text style={styles.swipeDeleteText}>Delete</Text>
                </TouchableOpacity>
              )}
              overshootRight={false}
            >
              <TouchableOpacity
                style={styles.ruleItem}
                onPress={() => toggleRuleExpand(index)}
                activeOpacity={0.7}
              >
                <View style={styles.ruleContent}>
                  <Text style={styles.ruleText} numberOfLines={isExpanded ? undefined : 2}>{rule}</Text>
                  {isExpanded && (
                    <View style={styles.ruleActions}>
                      <TouchableOpacity
                        style={[styles.ruleActionButton, index === 0 && styles.ruleActionDisabled]}
                        onPress={() => moveRuleUp(index)}
                        disabled={index === 0}
                      >
                        <Ionicons name="arrow-up" size={16} color={index === 0 ? Colors.text.tertiary : Colors.brand.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ruleActionButton, index === customRules.length - 1 && styles.ruleActionDisabled]}
                        onPress={() => moveRuleDown(index)}
                        disabled={index === customRules.length - 1}
                      >
                        <Ionicons name="arrow-down" size={16} color={index === customRules.length - 1 ? Colors.text.tertiary : Colors.brand.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ruleActionButton}
                        onPress={() => openEditRule(index)}
                      >
                        <Ionicons name="pencil" size={16} color={Colors.brand.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ruleActionButton, { borderColor: Colors.status.error }]}
                        onPress={() => deleteRule(index)}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.status.error} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={styles.ruleDragHandle}>
                  <Ionicons name="menu" size={20} color={Colors.text.tertiary} />
                </View>
              </TouchableOpacity>
            </Swipeable>
          );
        })}
      </View>
    );
  };

  const renderStepPrivacy = () => (
    <View style={styles.formSection}>
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Who Can See This Bubble? <Text style={styles.required}>*</Text></Text>
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          {PRIVACY_OPTIONS.map((opt) => {
            const selected = privacy === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[RadioStyles.card, selected && RadioStyles.cardSelected]}
                onPress={() => setPrivacy(opt.value)}
              >
                <View style={[RadioStyles.circle, selected && RadioStyles.circleSelected]}>
                  {selected && <View style={RadioStyles.innerDot} />}
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <Text style={RadioStyles.label}>{opt.label}</Text>
                  <Text style={RadioStyles.description}>{opt.subtitle}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Member Limit</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder='Ex: 20'
          placeholderTextColor={Colors.text.tertiary}
          value={memberLimit}
          onChangeText={(t) => setMemberLimit(t.replace(/[^0-9]/g, '').slice(0, 5))}
          keyboardType="number-pad"
          maxLength={5}
        />
        <Text style={styles.helperText}>Leave empty for unlimited</Text>
      </View>
    </View>
  );

  const renderStepPreview = () => (
    <View style={styles.formSection}>
      {images.length > 0 ? (
        <Image source={{ uri: images[0] }} style={styles.previewCoverImage} />
      ) : (
        <View style={[styles.previewCoverImage, styles.reviewCoverPlaceholder]}>
          <Ionicons name="image-outline" size={40} color={Colors.text.tertiary} />
        </View>
      )}

      <Text style={styles.previewTagline}>{tagline || title}</Text>

      <View style={styles.previewDivider} />

      <TouchableOpacity
        style={styles.previewSectionHeader}
        onPress={() => setExpandAbout(!expandAbout)}
      >
        <Text style={styles.previewSectionTitle}>About</Text>
        <Ionicons name={expandAbout ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.text.secondary} />
      </TouchableOpacity>
      {expandAbout && (
        <Text style={styles.previewSectionBody}>{description}</Text>
      )}

      <View style={styles.previewDivider} />

      <TouchableOpacity
        style={styles.previewSectionHeader}
        onPress={() => setExpandAttachments(!expandAttachments)}
      >
        <Text style={styles.previewSectionTitle}>Attachments</Text>
        <Ionicons name={expandAttachments ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.text.secondary} />
      </TouchableOpacity>

      <View style={styles.previewDivider} />

      <View style={styles.previewMembersRow}>
        <View style={styles.reviewInfoRow}>
          <Ionicons name="people-outline" size={18} color={Colors.text.primary} />
          <Text style={styles.previewMembersText}>{memberLimit || '0'} Members</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Members', `Member limit: ${memberLimit || 'Unlimited'}`)}>
          <Text style={styles.previewViewLink}>view {'>'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.previewDivider} />

      <TouchableOpacity
        style={styles.previewSectionHeader}
        onPress={() => setExpandRules(!expandRules)}
      >
        <Text style={styles.previewSectionTitle}>Bubble Rules</Text>
        <Ionicons name={expandRules ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.text.secondary} />
      </TouchableOpacity>
      {expandRules && allRules.map((rule, i) => (
        <Text key={i} style={styles.reviewRuleItem}>{i + 1}. {rule}</Text>
      ))}
    </View>
  );

  const renderStepContent = () => {
    switch (step) {
      case 0: return renderStepDetails();
      case 1: return renderStepRules();
      case 2: return renderStepPrivacy();
      case 3: return renderStepPreview();
      default: return null;
    }
  };

  const renderNextButton = () => {
    const isReview = step === 3;
    const disabled = !canGoNext();
    return (
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={isReview ? handleSubmit : goNext}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={Gradients.button.colors as unknown as string[]}
            start={Gradients.button.start}
            end={Gradients.button.end}
            style={[styles.primaryButton, disabled && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>
              {isReview ? 'Save Changes' : 'Next'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderProgressBar()}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={scrollRef}
          data={[{ key: 'form' }]}
          renderItem={() => renderStepContent()}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      </KeyboardAvoidingView>
      {renderNextButton()}

      <Modal
        visible={showRuleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRuleModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowRuleModal(false)}
          >
            <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
              <TextInput
                style={[styles.fieldInput, styles.ruleModalInput]}
                placeholder="Enter your rule..."
                placeholderTextColor={Colors.text.tertiary}
                value={ruleText}
                onChangeText={setRuleText}
                autoFocus
              />
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalSecondaryBtn}
                  onPress={() => setShowRuleModal(false)}
                >
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveRule}
                  disabled={!ruleText.trim()}
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={Gradients.button.colors as unknown as string[]}
                    start={Gradients.button.start}
                    end={Gradients.button.end}
                    style={[styles.primaryButton, !ruleText.trim() && { opacity: 0.5 }]}
                  >
                    <Text style={styles.primaryButtonText}>Save</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <SuccessModal
        visible={showSuccessModal}
        title="Bubble Updated!"
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
    backgroundColor: Colors.background.primary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerBack: {
    padding: Spacing.xs,
    width: 60,
  },
  headerTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.md,
    textAlign: 'center',
    flex: 1,
  },
  headerCancel: {
    width: 60,
    alignItems: 'flex-end',
  },
  cancelText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.status.error,
    textDecorationLine: 'underline',
  },

  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 1.5,
    borderRadius: Radius.full,
    backgroundColor: Colors.border.light,
  },
  progressSegmentActive: {
    backgroundColor: Colors.brand.primary,
  },

  content: {
    flex: 1,
  },
  formSection: {
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  fieldGroup: {
    gap: Spacing.sm,
  },
  fieldLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.text.primary,
  },
  required: {
    color: Colors.status.error,
  },
  optional: {
    color: Colors.text.tertiary,
    fontWeight: Typography.weights.regular,
    fontSize: Typography.sizes.sm,
  },
  fieldInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.sizes.base,
    backgroundColor: Colors.background.primary,
    color: Colors.text.primary,
  },
  textArea: {
    height: undefined,
    minHeight: 120,
    paddingVertical: Spacing.lg,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },

  categoryDisplay: {
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background.surface,
  },
  categoryDisplayText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
  },

  locationTappableField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm + Spacing.xxs,
    paddingVertical: Spacing.sm + Spacing.xxs,
    backgroundColor: Colors.background.primary,
    gap: Spacing.sm,
  },
  locationTappableContent: {
    flex: 1,
  },
  locationTappableText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: Typography.weights.medium,
  },
  locationTappablePlaceholder: {
    color: Colors.text.tertiary,
    fontWeight: Typography.weights.regular,
  },
  locationTappableSubtext: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  locationClearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    marginTop: Spacing.xxs,
    paddingVertical: Spacing.xxs,
  },
  locationClearText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },

  sliderSeparator: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginVertical: Spacing.xs,
  },
  sliderSection: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  sliderValueCentered: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: Typography.weights.medium,
  },
  sliderTrackWrapper: {
    width: '100%',
    height: 30,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 3,
    backgroundColor: Colors.border.light,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: Colors.text.secondary,
    borderRadius: Radius.full,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.text.secondary,
    marginLeft: -10,
    top: 5,
  },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background.surface,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  toggleInfo: {
    flex: 1,
    marginRight: Spacing.md,
    gap: Spacing.xxs,
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggleLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },

  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  ruleContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  ruleText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.base,
  },
  ruleActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  ruleActionButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.surface,
  },
  ruleActionDisabled: {
    opacity: 0.4,
  },
  swipeDeleteAction: {
    backgroundColor: Colors.status.error,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginLeft: Spacing.sm,
    gap: Spacing.xxs,
  },
  swipeDeleteText: {
    color: Colors.background.primary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
  },
  ruleDragHandle: {
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRuleButton: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  addRuleDashedBorder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.brand.primary,
    borderRadius: Platform.OS === 'ios' ? Radius.lg : 0,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  addRuleText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.primary,
  },

  reviewCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reviewRuleItem: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.base,
    paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  previewCoverImage: {
    width: '100%',
    height: 200,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background.surface,
  },
  previewTagline: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
    lineHeight: Typography.lineHeight.base,
  },
  previewDivider: {
    height: 1,
    backgroundColor: Colors.border.light,
  },
  previewSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  previewSectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },
  previewSectionBody: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.base,
    paddingBottom: Spacing.md,
  },
  previewMembersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  previewMembersText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },
  previewViewLink: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.primary,
    fontWeight: Typography.weights.medium,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xxxl : Spacing.xl,
    paddingTop: Spacing.lg,
  },
  primaryButton: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.background.primary,
    letterSpacing: Typography.letterSpacing.tight,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: `rgba(0,0,0,${ModalStyles.overlay.opacity})`,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.background.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
  },
  ruleModalInput: {
    marginBottom: Spacing.lg,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.background.primary,
  },
  modalSecondaryText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.secondary,
    letterSpacing: Typography.letterSpacing.tight,
  },
});
