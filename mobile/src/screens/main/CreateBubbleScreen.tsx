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
import { Colors, Spacing, Radius, Typography, RadioStyles, Gradients, SwitchColors } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

const CATEGORIES = [
  { label: 'Running', image: require('../../assets/images/interest-running.jpg') },
  { label: 'Cooking', image: require('../../assets/images/interest-cooking.jpg') },
  { label: 'Coffee Meets', image: require('../../assets/images/interest-coffee.jpg') },
  { label: 'Professional', image: require('../../assets/images/explore-meetup.jpg') },
  { label: 'Hiking', image: require('../../assets/images/interest-hiking.jpg') },
  { label: 'Tennis', image: require('../../assets/images/interest-tennis.jpg') },
  { label: 'Biking', image: require('../../assets/images/interest-biking.jpg') },
  { label: 'Pets', image: require('../../assets/images/interest-pets.jpg') },
  { label: 'Arts & Crafts', image: require('../../assets/images/interest-crafts.jpg') },
  { label: 'Gardening', image: require('../../assets/images/interest-gardening.jpg') },
  { label: 'Food & Drink', image: require('../../assets/images/explore-food.jpg') },
  { label: 'Wellness', image: require('../../assets/images/explore-wellness.jpg') },
];

const PRIVACY_OPTIONS = [
  { value: 'Public', label: 'Public', subtitle: 'Anyone can find and join this bubble' },
  { value: 'Request', label: 'Request to Join', subtitle: 'People must request to join' },
  { value: 'Private', label: 'Private', subtitle: 'Only invited members can join' },
];

const STEP_TITLES = ['Pick Category', 'Bubble Details', 'Rules', 'Privacy & Settings', 'Review'];

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
  const [rules, setRules] = useState<string[]>([]);
  const [privacy, setPrivacy] = useState('Public');
  const [memberLimit, setMemberLimit] = useState('');
  const [campusOnly, setCampusOnly] = useState(false);

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [ruleText, setRuleText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);

  const isCampusVerified = user?.campusVerified && user?.campusId;

  const handleLocationSelect = (location: { name: string; address: string; lat: number; lng: number }) => {
    setLocationName(location.name);
    setLocationAddress(location.address);
    setLocationLat(String(location.lat));
    setLocationLng(String(location.lng));
    setShowLocationPicker(false);
  };

  const canGoNext = () => {
    switch (step) {
      case 0: return !!category;
      case 1: return !!title && !!description && !!locationName;
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
    setRuleText(rules[index]);
    setShowRuleModal(true);
  };

  const saveRule = () => {
    const trimmed = ruleText.trim();
    if (!trimmed) return;
    if (editingRuleIndex !== null) {
      const updated = [...rules];
      updated[editingRuleIndex] = trimmed;
      setRules(updated);
    } else {
      setRules([...rules, trimmed]);
    }
    setShowRuleModal(false);
    setRuleText('');
  };

  const deleteRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
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
          rules,
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
          <Image
            source={require('../../assets/images/bubble-loading-ring.png')}
            style={styles.loadingImage}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} style={{ marginTop: 24 }} />
          <Text style={styles.loadingText}>Submitting your bubble...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (submitSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContainer}>
          <Image
            source={require('../../assets/images/bubble-submit-success.png')}
            style={styles.successImage}
            resizeMode="contain"
          />
          <Text style={styles.successTitle}>Thanks for submitting{'\n'}your bubble</Text>
          <Text style={styles.successSubtitle}>
            We'll review it and let you know when it's live!
          </Text>
          <TouchableOpacity
            style={styles.finishButton}
            onPress={() => navigation.goBack()}
          >
            <LinearGradient
              colors={Gradients.button.colors as unknown as string[]}
              start={Gradients.button.start}
              end={Gradients.button.end}
              style={styles.gradientButton}
            >
              <Text style={styles.gradientButtonText}>Finish</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerBack} onPress={goBack}>
        <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{STEP_TITLES[step]}</Text>
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
            styles.progressDot,
            i <= step && styles.progressDotActive,
          ]}
        />
      ))}
    </View>
  );

  const renderStepCategory = () => {
    const colWidth = (SCREEN_WIDTH - 40 - 24) / 3;
    return (
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => {
          const selected = category === cat.label;
          return (
            <TouchableOpacity
              key={cat.label}
              style={[styles.categoryCard, { width: colWidth }, selected && styles.categoryCardSelected]}
              onPress={() => setCategory(cat.label)}
              activeOpacity={0.8}
            >
              <Image source={cat.image} style={[styles.categoryImage, { width: colWidth, height: colWidth * 0.75 }]} />
              {selected && (
                <View style={styles.categoryCheckOverlay}>
                  <View style={styles.categoryCheck}>
                    <Ionicons name="checkmark" size={16} color={Colors.brand.skyWhite} />
                  </View>
                </View>
              )}
              <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
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
          placeholderTextColor={Colors.neutral.coolMist}
          value={title}
          onChangeText={setTitle}
          maxLength={50}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Bubble Tagline <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={styles.fieldInput}
          placeholder='Meetup with other Corgi Parents near you'
          placeholderTextColor={Colors.neutral.coolMist}
          value={tagline}
          onChangeText={setTagline}
          maxLength={100}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Bubble Description <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.fieldInput, styles.textArea]}
          placeholder='Tell people what this bubble is about...'
          placeholderTextColor={Colors.neutral.coolMist}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Location <Text style={styles.required}>*</Text></Text>
        <TouchableOpacity style={styles.fieldInputRow} onPress={() => setShowLocationPicker(true)}>
          <Ionicons name="search" size={18} color={Colors.neutral.coolMist} />
          <Text style={locationName ? styles.fieldValue : styles.fieldPlaceholder}>
            {locationName || 'Search location or enter address'}
          </Text>
        </TouchableOpacity>
        {locationName ? (
          <Text style={styles.locationSubtext}>{locationAddress}</Text>
        ) : null}

        <View style={styles.radiusRow}>
          <Text style={styles.radiusLabel}>Radius</Text>
          <View style={styles.radiusStepper}>
            <TouchableOpacity
              style={styles.radiusStepBtn}
              onPress={() => setRadiusMiles(Math.max(1, radiusMiles - 5))}
            >
              <Ionicons name="remove" size={18} color={Colors.neutral.charcoal} />
            </TouchableOpacity>
            <Text style={styles.radiusValue}>{radiusMiles} miles</Text>
            <TouchableOpacity
              style={styles.radiusStepBtn}
              onPress={() => setRadiusMiles(Math.min(50, radiusMiles + 5))}
            >
              <Ionicons name="add" size={18} color={Colors.neutral.charcoal} />
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
        <Text style={styles.fieldLabel}>Add Attachments</Text>
        {attachments.length > 0 ? (
          <View style={styles.attachmentBadge}>
            <Ionicons name="document-attach" size={18} color={Colors.brand.bubbleBlue} />
            <Text style={styles.attachmentBadgeText}>({attachments.length}) Attachments Added</Text>
          </View>
        ) : null}
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
                <Text style={{ fontSize: 16 }}>🎓</Text>
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
        <Ionicons name="add" size={22} color={Colors.brand.bubbleBlue} />
        <Text style={styles.addRuleText}>Add Rule</Text>
      </TouchableOpacity>

      {rules.map((rule, index) => (
        <View key={index} style={styles.ruleItem}>
          <View style={styles.ruleGripIcon}>
            <Ionicons name="menu" size={18} color={Colors.neutral.coolMist} />
          </View>
          <TouchableOpacity style={styles.ruleContent} onPress={() => openEditRule(index)}>
            <Text style={styles.ruleNumber}>{index + 1}.</Text>
            <Text style={styles.ruleText} numberOfLines={2}>{rule}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteRule(index)} style={styles.ruleDelete}>
            <Ionicons name="close-circle" size={20} color={Colors.neutral.coolMist} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const renderStepPrivacy = () => (
    <View style={styles.formSection}>
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Who Can See This Bubble? <Text style={styles.required}>*</Text></Text>
        {PRIVACY_OPTIONS.map((opt) => {
          const selected = privacy === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[RadioStyles.card, selected && RadioStyles.cardSelected, { marginTop: Spacing.sm }]}
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

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Member Limit</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder='Ex: 20'
          placeholderTextColor={Colors.neutral.coolMist}
          value={memberLimit}
          onChangeText={setMemberLimit}
          keyboardType="number-pad"
        />
        <Text style={styles.helperText}>Leave empty for unlimited</Text>
      </View>
    </View>
  );

  const renderStepReview = () => (
    <View style={styles.formSection}>
      <View style={styles.reviewCard}>
        {images.length > 0 ? (
          <Image source={{ uri: images[0] }} style={styles.reviewCoverImage} />
        ) : (
          <View style={[styles.reviewCoverImage, styles.reviewCoverPlaceholder]}>
            <Ionicons name="image-outline" size={40} color={Colors.neutral.coolMist} />
          </View>
        )}

        <View style={styles.reviewBody}>
          <View style={styles.reviewCategoryBadge}>
            <Text style={styles.reviewCategoryText}>{category}</Text>
          </View>
          <Text style={styles.reviewTitle}>{title}</Text>
          {tagline ? <Text style={styles.reviewTagline}>{tagline}</Text> : null}

          {locationName ? (
            <View style={styles.reviewInfoRow}>
              <Ionicons name="location-outline" size={16} color={Colors.neutral.coolMist} />
              <Text style={styles.reviewInfoText}>{locationName} · {radiusMiles} mi radius</Text>
            </View>
          ) : null}

          <View style={styles.reviewInfoRow}>
            <Ionicons name="lock-closed-outline" size={16} color={Colors.neutral.coolMist} />
            <Text style={styles.reviewInfoText}>{PRIVACY_OPTIONS.find(p => p.value === privacy)?.label || privacy}</Text>
          </View>

          {memberLimit ? (
            <View style={styles.reviewInfoRow}>
              <Ionicons name="people-outline" size={16} color={Colors.neutral.coolMist} />
              <Text style={styles.reviewInfoText}>{memberLimit} member limit</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.reviewDivider} />

        <TouchableOpacity
          style={styles.expandableHeader}
          onPress={() => setAboutExpanded(!aboutExpanded)}
        >
          <Text style={styles.expandableTitle}>About</Text>
          <Ionicons name={aboutExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.neutral.coolMist} />
        </TouchableOpacity>
        {aboutExpanded && (
          <Text style={styles.expandableContent}>{description}</Text>
        )}

        {attachments.length > 0 && (
          <>
            <View style={styles.reviewDivider} />
            <TouchableOpacity
              style={styles.expandableHeader}
              onPress={() => setAttachmentsExpanded(!attachmentsExpanded)}
            >
              <Text style={styles.expandableTitle}>Attachments ({attachments.length})</Text>
              <Ionicons name={attachmentsExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.neutral.coolMist} />
            </TouchableOpacity>
            {attachmentsExpanded && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {attachments.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.attachmentThumb} />
                ))}
              </ScrollView>
            )}
          </>
        )}

        {rules.length > 0 && (
          <>
            <View style={styles.reviewDivider} />
            <TouchableOpacity
              style={styles.expandableHeader}
              onPress={() => setRulesExpanded(!rulesExpanded)}
            >
              <Text style={styles.expandableTitle}>Bubble Rules ({rules.length})</Text>
              <Ionicons name={rulesExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.neutral.coolMist} />
            </TouchableOpacity>
            {rulesExpanded && (
              <View style={{ marginTop: 8 }}>
                {rules.map((rule, i) => (
                  <Text key={i} style={styles.reviewRuleItem}>{i + 1}. {rule}</Text>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );

  const renderStepContent = () => {
    switch (step) {
      case 0: return renderStepCategory();
      case 1: return renderStepDetails();
      case 2: return renderStepRules();
      case 3: return renderStepPrivacy();
      case 4: return renderStepReview();
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
          <LinearGradient
            colors={Gradients.button.colors as unknown as string[]}
            start={Gradients.button.start}
            end={Gradients.button.end}
            style={styles.gradientButton}
          >
            <Text style={styles.gradientButtonText}>
              {isReview ? 'Submit for review' : 'Next'}
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
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRuleIndex !== null ? 'Edit Rule' : 'Add Rule'}
              </Text>
            </View>
            <TextInput
              style={[styles.fieldInput, styles.textArea, { marginVertical: 16 }]}
              placeholder="Enter your rule..."
              placeholderTextColor={Colors.neutral.coolMist}
              value={ruleText}
              onChangeText={setRuleText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowRuleModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, !ruleText.trim() && { opacity: 0.5 }]}
                onPress={saveRule}
                disabled={!ruleText.trim()}
              >
                <Text style={styles.modalSaveText}>Save</Text>
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
    backgroundColor: Colors.brand.skyWhite,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.cloudGrey,
  },
  headerBack: {
    padding: Spacing.xs,
    width: 60,
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    flex: 1,
  },
  headerCancel: {
    width: 60,
    alignItems: 'flex-end',
  },
  cancelText: {
    fontSize: Typography.sizes.md,
    color: Colors.neutral.coolMist,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.neutral.cloudGrey,
  },
  progressDotActive: {
    backgroundColor: Colors.brand.bubbleBlue,
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
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
  },
  required: {
    color: Colors.state.error,
  },
  optional: {
    color: Colors.neutral.coolMist,
    fontWeight: Typography.weights.regular,
    fontSize: Typography.sizes.sm,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontSize: Typography.sizes.md,
    backgroundColor: Colors.brand.skyWhite,
    color: Colors.neutral.charcoal,
  },
  fieldInputRow: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.brand.skyWhite,
  },
  fieldValue: {
    fontSize: Typography.sizes.md,
    color: Colors.neutral.charcoal,
    flex: 1,
  },
  fieldPlaceholder: {
    fontSize: Typography.sizes.md,
    color: Colors.neutral.coolMist,
    flex: 1,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  locationSubtext: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  radiusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  radiusLabel: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium,
    color: Colors.neutral.charcoal,
  },
  radiusStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  radiusStepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.neutral.cloudGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusValue: {
    fontSize: Typography.sizes.md,
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.semiBold,
    minWidth: 70,
    textAlign: 'center',
  },
  helperText: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
  },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  categoryCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.neutral.cloudGrey,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryCardSelected: {
    borderColor: Colors.brand.bubbleBlue,
  },
  categoryImage: {
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
  },
  categoryCheckOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  categoryCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.brand.bubbleBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  categoryLabelSelected: {
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.semiBold,
  },

  addRuleButton: {
    borderWidth: 1.5,
    borderColor: Colors.brand.bubbleBlue,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  addRuleText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.bubbleBlue,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.cloudGrey,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  ruleGripIcon: {
    paddingRight: Spacing.xs,
  },
  ruleContent: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  ruleNumber: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
  },
  ruleText: {
    fontSize: Typography.sizes.md,
    color: Colors.neutral.charcoal,
    flex: 1,
  },
  ruleDelete: {
    padding: Spacing.xs,
  },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.neutral.cloudGrey,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
  },
  toggleInfo: {
    flex: 1,
    marginRight: Spacing.md,
    gap: 4,
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggleLabel: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
  },

  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  attachmentBadgeText: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.bubbleBlue,
    fontWeight: Typography.weights.medium,
  },

  reviewCard: {
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.neutral.cloudGrey,
    overflow: 'hidden',
  },
  reviewCoverImage: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.neutral.cloudGrey,
  },
  reviewCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBody: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  reviewCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.neutral.cloudGrey,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  reviewCategoryText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
  },
  reviewTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.neutral.charcoal,
  },
  reviewTagline: {
    fontSize: Typography.sizes.md,
    color: Colors.neutral.coolMist,
  },
  reviewInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reviewInfoText: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: Colors.neutral.cloudGrey,
    marginHorizontal: Spacing.lg,
  },
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  expandableTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
  },
  expandableContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    fontSize: Typography.sizes.md,
    color: Colors.neutral.charcoal,
    lineHeight: 22,
  },
  reviewRuleItem: {
    fontSize: Typography.sizes.md,
    color: Colors.neutral.charcoal,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    lineHeight: 22,
  },
  attachmentThumb: {
    width: 60,
    height: 60,
    borderRadius: Radius.sm,
    marginRight: Spacing.sm,
    marginLeft: Spacing.lg,
  },

  bottomBar: {
    padding: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xxxl : Spacing.xl,
    backgroundColor: Colors.brand.skyWhite,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.cloudGrey,
  },
  gradientButton: {
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  gradientButtonText: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
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
  loadingImage: {
    width: 120,
    height: 120,
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: Typography.sizes.md,
    color: Colors.neutral.coolMist,
  },
  successImage: {
    width: 200,
    height: 200,
    marginBottom: Spacing.xl,
  },
  successTitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  successSubtitle: {
    fontSize: Typography.sizes.md,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.brand.skyWhite,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  modalCancelBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
  },
  modalCancelText: {
    fontSize: Typography.sizes.md,
    color: Colors.neutral.charcoal,
  },
  modalSaveBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
    backgroundColor: Colors.brand.bubbleBlue,
  },
  modalSaveText: {
    fontSize: Typography.sizes.md,
    color: Colors.brand.skyWhite,
    fontWeight: Typography.weights.semiBold,
  },
});
