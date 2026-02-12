import React, { useState, useRef } from 'react';
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
  Dimensions,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { API_URL, GOOGLE_PLACES_API_KEY } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import cometChatService from '../../services/cometchat.service';
import MultiImagePicker from '../../components/MultiImagePicker';
import LocationPickerModal from '../../components/LocationPickerModal';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Colors,
  Spacing,
  Radius,
  Typography,
  RadioStyles,
  Gradients,
  SwitchColors,
  ModalStyles,
  SliderStyles,
} from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

const CATEGORIES = [
  { label: 'Running', image: require('../../assets/images/running.jpg') },
  { label: 'Cooking', image: require('../../assets/images/cooking.jpg') },
  { label: 'Coffee Meets', image: require('../../assets/images/coffee-meets.jpg') },
  { label: 'Hiking', image: require('../../assets/images/hiking.jpg') },
  { label: 'Tennis', image: require('../../assets/images/tennis.jpg') },
  { label: 'Biking', image: require('../../assets/images/biking.jpg') },
  { label: 'Arts & Crafts', image: require('../../assets/images/arts-crafts.jpg') },
  { label: 'Community', image: require('../../assets/images/community.jpg') },
  { label: 'Gardening', image: require('../../assets/images/gardening.jpg') },
  { label: 'Wellness', image: require('../../assets/images/wellness.jpg') },
  { label: 'Yoga', image: require('../../assets/images/yoga.jpg') },
];

const MANDATORY_RULES = [
  'Be Respectful. Treat all members with kindness and courtesy.',
  'Stay On Topic. Keep posts relevant to the bubble\'s purpose.',
];

const DEFAULT_OPTIONAL_RULE = 'Have fun and be yourself!';

const PRIVACY_OPTIONS = [
  { value: 'Public', label: 'Public', subtitle: 'Anyone can discover and join' },
  { value: 'Request', label: 'Request to Join', subtitle: 'Admin approval required before joining' },
  { value: 'Private', label: 'Private', subtitle: 'Invite-only event' },
];

const STEP_TITLES = ['Create a Bubble', 'Bubble Details', 'Rules', 'Privacy & Settings', 'Preview'];

export default function CreateBubbleScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(0);

  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState('');
  const [locationLng, setLocationLng] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(15);
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [customRules, setCustomRules] = useState<string[]>([]);
  const [privacy, setPrivacy] = useState('Public');
  const [memberLimit, setMemberLimit] = useState('');
  const [campusOnly, setCampusOnly] = useState(false);

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [ruleText, setRuleText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [expandAbout, setExpandAbout] = useState(false);
  const [expandAttachments, setExpandAttachments] = useState(false);
  const [expandRules, setExpandRules] = useState(false);

  const isCampusVerified = user?.campusVerified && user?.campusId;

  const allRules = [...MANDATORY_RULES, DEFAULT_OPTIONAL_RULE, ...customRules];

  const handleLocationSelect = (location: { name: string; address: string; latitude?: number; longitude?: number; placeId?: string }) => {
    setLocationName(location.name);
    setLocationAddress(location.address);
    if (location.latitude != null) setLocationLat(String(location.latitude));
    if (location.longitude != null) setLocationLng(String(location.longitude));
    setShowLocationPicker(false);
  };

  const canGoNext = () => {
    switch (step) {
      case 0: return !!category;
      case 1: return !!title && !!description;
      case 2: return true;
      case 3: return !!privacy;
      case 4: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (step < 4) {
      setStep(step + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
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
      setCustomRules([...customRules, trimmed]);
    }
    setShowRuleModal(false);
    setRuleText('');
  };

  const deleteRule = (index: number) => {
    setCustomRules(customRules.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/bubbles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to create bubble');
        setLoading(false);
        return;
      }

      try {
        const groupType = privacy === 'Public' ? 'public' : 'private';
        await cometChatService.createGroup(data.id, title, groupType);
        try {
          await cometChatService.joinGroup(data.id, groupType);
        } catch (joinError: any) {
          console.log('Join group note:', joinError?.code || joinError);
        }
        try {
          await cometChatService.sendMessage(data.id, `Welcome to ${title}! 🎉`);
        } catch (msgError) {
          console.log('Welcome message not sent:', msgError);
        }
      } catch (chatError) {
        console.log('CometChat group creation error:', chatError);
      }

      setLoading(false);
      setSubmitSuccess(true);
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to create bubble. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (submitSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContainer}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <Text style={styles.successTitle}>Thanks for submitting your bubble</Text>
          <Text style={styles.successSubtitle}>
            We'll look over the details and let you know when your bubble is live
          </Text>
          <TouchableOpacity
            style={styles.finishButton}
            onPress={() => navigation.goBack()}
          >
            <View style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Finish</Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerBack} onPress={goBack}>
        <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{step === 4 ? title : STEP_TITLES[step]}</Text>
      <TouchableOpacity style={styles.headerCancel} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[0, 1, 2, 3, 4].map((i) => (
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

  const renderStepCategory = () => {
    const sectionPadding = Spacing.xl;
    const gap = Spacing.sm;
    const colWidth = (SCREEN_WIDTH - (sectionPadding * 2) - (gap * 2)) / 3;
    return (
      <View style={styles.formSection}>
        <Text style={styles.stepPrompt}>What category will your bubble be in?</Text>
        <View style={[styles.categoryGrid, { paddingHorizontal: 0 }]}>
          {CATEGORIES.map((cat) => {
            const selected = category === cat.label;
            return (
              <TouchableOpacity
                key={cat.label}
                style={[styles.categoryCard, { width: colWidth }]}
                onPress={() => setCategory(selected ? '' : cat.label)}
                activeOpacity={0.8}
              >
                <View style={{ position: 'relative' }}>
                  <Image source={cat.image} resizeMode="cover" style={[styles.categoryImage, { width: colWidth, height: colWidth }]} />
                  {selected && (
                    <View style={styles.categoryCheckOverlay}>
                      <View style={styles.categoryCheck}>
                        <Ionicons name="checkmark" size={14} color={Colors.background.primary} />
                      </View>
                    </View>
                  )}
                  {selected && <View style={styles.categoryImageSelectedBorder} />}
                </View>
                <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStepDetails = () => (
    <View style={styles.formSection}>
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Bubble Title <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.fieldInput}
          placeholder='Ex: Corgi Fam'
          placeholderTextColor={Colors.text.tertiary}
          value={title}
          onChangeText={(t) => setTitle(t.slice(0, 60))}
          maxLength={60}
        />
        <Text style={styles.charCount}>{title.length}/60</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Bubble Tagline <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={styles.fieldInput}
          placeholder='Meetup with other Corgi Parents near you'
          placeholderTextColor={Colors.text.tertiary}
          value={tagline}
          onChangeText={(t) => setTagline(t.slice(0, 100))}
          maxLength={100}
        />
        <Text style={styles.charCount}>{tagline.length}/100</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Bubble Description <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.fieldInput, styles.textArea]}
          placeholder='Tell people what this bubble is about...'
          placeholderTextColor={Colors.text.tertiary}
          value={description}
          onChangeText={(t) => setDescription(t.slice(0, 500))}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={styles.charCount}>{description.length}/500</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Location <Text style={styles.required}>*</Text></Text>
        <TouchableOpacity
          style={styles.locationFieldButton}
          onPress={() => setShowLocationPicker(true)}
        >
          <Ionicons name="search-outline" size={18} color={Colors.text.tertiary} />
          <Text style={locationName ? styles.locationFieldText : styles.locationFieldPlaceholder}>
            {locationName || 'Search location or enter address'}
          </Text>
        </TouchableOpacity>
        {locationAddress ? (
          <Text style={styles.locationSubtext}>{locationAddress}</Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <View style={styles.radiusHeader}>
          <Text style={styles.fieldLabel}>Radius</Text>
          <Text style={styles.radiusValueText}>{radiusMiles} miles</Text>
        </View>
        <View style={styles.sliderContainer}>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${((radiusMiles - 1) / 49) * 100}%` }]} />
          </View>
          <View style={styles.sliderTicksRow}>
            {[1, 10, 20, 30, 40, 50].map((val) => (
              <TouchableOpacity
                key={val}
                onPress={() => setRadiusMiles(val)}
                style={styles.sliderTick}
              >
                <Text style={[styles.sliderTickText, radiusMiles === val && styles.sliderTickActive]}>{val}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.sliderStepRow}>
            <TouchableOpacity
              style={styles.sliderStepBtn}
              onPress={() => setRadiusMiles(Math.max(1, radiusMiles - 1))}
            >
              <Ionicons name="remove" size={16} color={Colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sliderStepBtn}
              onPress={() => setRadiusMiles(Math.min(50, radiusMiles + 1))}
            >
              <Ionicons name="add" size={16} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Add a Cover Photo <Text style={styles.optional}>(Strongly Recommended)</Text></Text>
        <MultiImagePicker
          images={images}
          onImagesChange={setImages}
          maxImages={1}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Add Attachments <Text style={styles.optional}>(optional)</Text></Text>
        <MultiImagePicker
          images={attachments}
          onImagesChange={setAttachments}
          maxImages={5}
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

  const renderStepRules = () => (
    <View style={styles.formSection}>
      <TouchableOpacity style={styles.addRuleButton} onPress={openAddRule}>
        <Ionicons name="add" size={20} color={Colors.brand.primary} />
        <Text style={styles.addRuleText}>Add Rule</Text>
      </TouchableOpacity>

      {MANDATORY_RULES.map((rule, index) => (
        <View key={`mandatory-${index}`} style={styles.ruleItem}>
          <View style={styles.ruleContent}>
            <Text style={styles.ruleText}>{rule}</Text>
          </View>
          <Ionicons name="menu" size={20} color={Colors.text.tertiary} />
        </View>
      ))}

      {customRules.map((rule, index) => (
        <View key={`custom-${index}`} style={styles.ruleItem}>
          <TouchableOpacity style={styles.ruleContent} onPress={() => openEditRule(index)}>
            <Text style={styles.ruleText}>{rule}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteRule(index)} style={{ padding: Spacing.xs }}>
            <Ionicons name="close-circle" size={18} color={Colors.text.tertiary} />
          </TouchableOpacity>
          <Ionicons name="menu" size={20} color={Colors.text.tertiary} />
        </View>
      ))}
    </View>
  );

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
        <TouchableOpacity>
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
      case 0: return renderStepCategory();
      case 1: return renderStepDetails();
      case 2: return renderStepRules();
      case 3: return renderStepPrivacy();
      case 4: return renderStepPreview();
      default: return null;
    }
  };

  const renderNextButton = () => {
    const isReview = step === 4;
    const disabled = !canGoNext();
    return (
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[disabled && styles.buttonDisabled]}
          onPress={isReview ? handleSubmit : goNext}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <View style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {isReview ? 'Submit for review' : 'Next'}
            </Text>
          </View>
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
        <ScrollView
          ref={scrollRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {renderStepContent()}
        </ScrollView>
      </KeyboardAvoidingView>
      {renderNextButton()}

      <Modal
        visible={showRuleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRuleModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRuleModal(false)}
        >
          <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRuleIndex !== null ? 'Edit Rule' : 'Add Rule'}
              </Text>
            </View>
            <TextInput
              style={[styles.fieldInput, styles.textArea, { marginVertical: Spacing.lg }]}
              placeholder="Enter your rule..."
              placeholderTextColor={Colors.text.tertiary}
              value={ruleText}
              onChangeText={setRuleText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
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
                style={[styles.primaryButton, { flex: 1 }, !ruleText.trim() && { opacity: 0.5 }]}
                onPress={saveRule}
                disabled={!ruleText.trim()}
              >
                <Text style={styles.primaryButtonText}>
                  {editingRuleIndex !== null ? 'Save' : 'Add Rule'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  },

  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 2,
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
  charCount: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    textAlign: 'right',
  },
  helperText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },

  stepPrompt: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.lg,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryCard: {
    alignItems: 'center',
  },
  categoryImage: {
    borderRadius: Radius.md,
  },
  categoryImageSelectedBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.md,
    borderWidth: 2.5,
    borderColor: Colors.brand.primary,
  },
  categoryCheckOverlay: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
  },
  categoryCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  categoryLabelSelected: {
    color: Colors.brand.primary,
    fontWeight: Typography.weights.semiBold,
  },

  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  mapPinButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.primary,
  },
  locationSubtext: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginTop: Spacing.xxs,
  },

  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radiusValueText: {
    fontSize: Typography.sizes.base,
    color: Colors.brand.primary,
    fontWeight: Typography.weights.semiBold,
  },
  sliderContainer: {
    gap: Spacing.sm,
  },
  sliderTrack: {
    height: SliderStyles.track.height,
    backgroundColor: Colors.border.light,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: Colors.brand.primary,
    borderRadius: Radius.full,
  },
  sliderTicksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderTick: {
    paddingVertical: Spacing.xxs,
  },
  sliderTickText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  sliderTickActive: {
    color: Colors.brand.primary,
    fontWeight: Typography.weights.semiBold,
  },
  sliderStepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
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
  ruleNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxs,
  },
  ruleNumberText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.secondary,
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
  ruleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    alignSelf: 'flex-start',
    backgroundColor: Colors.background.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.xs,
  },
  ruleBadgeText: {
    fontSize: Typography.sizes.xxs,
    color: Colors.text.tertiary,
    fontWeight: Typography.weights.medium,
  },
  ruleDeleteBtn: {
    padding: Spacing.xs,
  },
  addRuleButton: {
    borderWidth: 1.5,
    borderColor: Colors.brand.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
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

  locationFieldButton: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background.primary,
  },
  locationFieldText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    flex: 1,
  },
  locationFieldPlaceholder: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    flex: 1,
  },
  attachmentsButton: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background.primary,
  },
  attachmentsButtonText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
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
    backgroundColor: Colors.text.secondary,
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
  finishButton: {
    width: '80%',
    marginTop: Spacing.xxxl,
  },

  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },
  celebrationEmoji: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  loadingImage: {
    width: 120,
    height: 120,
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
  },
  successImage: {
    width: 200,
    height: 200,
    marginBottom: Spacing.xl,
  },
  successTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  successSubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.base,
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
  modalHeader: {
    alignItems: 'center',
    paddingBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.md,
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
