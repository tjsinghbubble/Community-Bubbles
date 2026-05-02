import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  Share,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { logAppEvent, logAppWarn } from '../../utils/crashReporter';
import SuccessModal from '../../components/SuccessModal';
import { CalendarIcon, LocationPinIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, PeopleIcon, FlagIcon, CrownIcon } from '../../components/icons';
import ImageCarousel from '../../components/ImageCarousel';
import { EventDetailsSkeleton } from '../../components/SkeletonLoader';
import { Colors, Spacing, Radius, Typography, CardShadow } from '../../styles/theme';
import { API_URL, GOOGLE_PLACES_API_KEY } from '../../config/api';

const directionsIcon = require('../../assets/icons/Icons/directions-diamond.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_PADDING = Spacing.xl;
const IMAGE_WIDTH = SCREEN_WIDTH - CONTENT_PADDING * 2;

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'EventDetails'>;
  route: RouteProp<ExploreStackParamList, 'EventDetails'>;
};

type Event = {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  images: string[];
  date: string;
  startTime: string;
  endTime: string | null;
  locationName: string | null;
  locationAddress: string | null;
  visibility: string;
  petFriendly: boolean;
  smokeFree: boolean;
  wheelchairAccessible: boolean;
  attendeeLimit: number | null;
  rsvpDeadline: string | null;
  creatorId: string;
  bubbleId: string;
};

type Attendee = {
  id: string;
  userId: string;
  eventId: string;
  status: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

type Bubble = {
  id: string;
  title: string;
  creatorId: string;
  privacy?: string;
};

type SignupTask = {
  id: number;
  eventId: string;
  title: string;
  description: string | null;
  icon: string;
  spotsNeeded: number | null;
  createdBy: string;
  signupCount: number;
  hasSignedUp: boolean;
  signers: { id: string; name: string; profilePhoto: string | null }[];
};

const SIGNUP_EMOJIS = ['📋','🙋','🍕','🎉','🏃','🎨','🎸','⚽','🎾','🏋️','🥗','🧹','📸','🎤','🚗','🛒','💡','🔧','🌿','🎁'];

export default function EventDetailsScreen({ navigation, route }: Props) {
  const { eventId, event: routeEvent, bubbleTitle: routeBubbleTitle, highlightTaskId, scrollToRsvp, onTasksChanged } = route.params;
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(routeEvent as Event | null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [isLoading, setIsLoading] = useState(!routeEvent);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isRsvpd, setIsRsvpd] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [showRsvpDropdown, setShowRsvpDropdown] = useState(false);
  const [isRsvping, setIsRsvping] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalConfig, setSuccessModalConfig] = useState({ title: '', subtitle: '' });
  const [shouldNavigateBack, setShouldNavigateBack] = useState(false);
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [eventReportModalVisible, setEventReportModalVisible] = useState(false);
  const [eventReportReason, setEventReportReason] = useState<string | null>(null);
  const [eventReportFreeText, setEventReportFreeText] = useState('');
  const [eventReportSubmitting, setEventReportSubmitting] = useState(false);
  const [reportEventModalVisible, setReportEventModalVisible] = useState(false);
  const [reportEventReason, setReportEventReason] = useState<string | null>(null);
  const [reportEventFreeText, setReportEventFreeText] = useState('');
  const [reportEventSubmitting, setReportEventSubmitting] = useState(false);
  const [myBubbleRole, setMyBubbleRole] = useState<string | null>(null);
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [signupTasks, setSignupTasks] = useState<SignupTask[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState<'create' | 'edit'>('create');
  const [editingTask, setEditingTask] = useState<SignupTask | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskIcon, setTaskIcon] = useState('📋');
  const [taskSpotsNeeded, setTaskSpotsNeeded] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [inlineDraggingId, setInlineDraggingId] = useState<number | null>(null);
  const [inlineHoverIndex, setInlineHoverIndex] = useState<number | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const nativeScrollGesture = useMemo(() => Gesture.Native(), []);
  const dragTranslationY = useSharedValue(0);
  const dragAnchorY = useSharedValue(0);
  const signupTasksRef = useRef<SignupTask[]>([]);
  const reorderTasksRef = signupTasksRef;
  const reorderItemLayouts = useRef<{ [id: number]: { y: number; height: number } }>({});
  const reorderContainerRef = useRef<View>(null);
  const containerPageY = useRef(0);
  const activeDragRef = useRef<{ id: number; index: number; origY: number } | null>(null);
  const activeHoverRef = useRef<number | null>(null);
  const dragStartTouchRef = useRef<{ taskId: number; isOptions: boolean; startAbsX: number; startAbsY: number } | null>(null);
  const canManageRef = useRef(false);
  const handleToggleSignupRef = useRef<(task: SignupTask) => void>(() => {});
  const autoSaveInlineOrderRef = useRef<(tasks: SignupTask[]) => void>(() => {});
  const showTaskOptionsRef = useRef<(task: SignupTask) => void>(() => {});

  const tasksYRef = useRef<number>(0);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const appliedHighlightRef = useRef<string | null>(null);

  const rsvpYRef = useRef<number>(0);
  const [highlightRsvp, setHighlightRsvp] = useState(false);
  const appliedRsvpScrollRef = useRef(false);
  const rsvpPulseAnim = useRef(new Animated.Value(1)).current;
  const taskPulseAnim = useRef(new Animated.Value(1)).current;

  const EVENT_CONCERN_REASONS = [
    'Safety issue at this event',
    'Event didn\'t match description',
    'Venue issue (unsafe, inaccessible, closed)',
    'Organizer no-show or unprepared',
    'Organizer misconduct',
    'Report a member',
    'Other',
  ];

  const EVENT_CONCERN_ROUTING: Record<string, string> = {
    'Safety issue at this event': 'Sent to Superadmins',
    'Event didn\'t match description': 'Sent to Bubble Admins',
    'Venue issue (unsafe, inaccessible, closed)': 'Sent to Superadmins & Bubble Admins',
    'Organizer no-show or unprepared': 'Sent to Bubble Admins, Superadmin notified',
    'Organizer misconduct': 'Sent to Superadmin directly',
    'Report a member': 'Opens member report flow',
    'Other': 'Sent to Superadmins & Bubble Admins (needs triage)',
  };

  const REPORT_EVENT_REASONS = [
    'Event was disorganized, ran late',
    'Organizer no-show',
    'Organizer misconduct',
    'Organizer made me uncomfortable',
  ];

  const REPORT_EVENT_ROUTING: Record<string, string> = {
    'Event was disorganized, ran late': 'Sent to Bubble Admins',
    'Organizer no-show': 'Sent to Bubble Admins + Superadmin notified',
    'Organizer misconduct': 'Sent to Superadmin directly',
    'Organizer made me uncomfortable': 'Sent to Superadmin directly',
  };

  const handleReportConcern = () => {
    setEventReportReason(null);
    setEventReportFreeText('');
    setEventReportModalVisible(true);
  };

  const handleReportEvent = () => {
    setReportEventReason(null);
    setReportEventFreeText('');
    setReportEventModalVisible(true);
  };

  const handleConcernReasonSelect = (reason: string) => {
    if (reason === 'Report a member') {
      setEventReportModalVisible(false);
      handleViewParticipants();
      return;
    }
    setEventReportReason(reason);
  };

  const submitConcernReport = async () => {
    if (!eventReportReason || !event) return;
    setEventReportSubmitting(true);
    try {
      await apiService.submitReport({
        reportType: 'event',
        reason: eventReportReason,
        freeText: eventReportFreeText.trim() || undefined,
        bubbleId: event.bubbleId,
        eventId: event.id,
      });
      setEventReportModalVisible(false);
      const routing = EVENT_CONCERN_ROUTING[eventReportReason] || 'Sent to Superadmins & Bubble Admins';
      Alert.alert('Report Submitted', `Your concern about this event has been received. ${routing}.`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setEventReportSubmitting(false);
    }
  };

  const submitEventReport = async () => {
    if (!reportEventReason || !event) return;
    setReportEventSubmitting(true);
    try {
      await apiService.submitReport({
        reportType: 'event',
        reason: reportEventReason,
        freeText: reportEventFreeText.trim() || undefined,
        bubbleId: event.bubbleId,
        eventId: event.id,
      });
      setReportEventModalVisible(false);
      const routing = REPORT_EVENT_ROUTING[reportEventReason] || 'Sent to Superadmins';
      Alert.alert('Report Submitted', `Your report about this event has been received. ${routing}.`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setReportEventSubmitting(false);
    }
  };

  const lastFetchRef = useRef(0);

  useEffect(() => {
    if (!highlightTaskId || signupTasks.length === 0) return;
    if (appliedHighlightRef.current === highlightTaskId) return;
    appliedHighlightRef.current = highlightTaskId;
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: tasksYRef.current, animated: true });
      setHighlightedTaskId(highlightTaskId);
      taskPulseAnim.setValue(1);
      Animated.loop(
        Animated.sequence([
          Animated.timing(taskPulseAnim, {
            toValue: 1.05,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(taskPulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 },
      ).start(() => {
        setHighlightedTaskId(null);
        taskPulseAnim.setValue(1);
      });
    }, 300);
  }, [highlightTaskId, signupTasks]);

  useEffect(() => {
    if (!scrollToRsvp || appliedRsvpScrollRef.current) return;
    if (!event) return;
    appliedRsvpScrollRef.current = true;
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: rsvpYRef.current, animated: true });
      setHighlightRsvp(true);
      rsvpPulseAnim.setValue(1);
      Animated.loop(
        Animated.sequence([
          Animated.timing(rsvpPulseAnim, {
            toValue: 1.05,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(rsvpPulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 },
      ).start(() => {
        setHighlightRsvp(false);
        rsvpPulseAnim.setValue(1);
      });
    }, 300);
  }, [scrollToRsvp, event]);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastFetchRef.current > 30_000) {
        fetchEvent();
        fetchAttendees();
        fetchSignupTasks();
        lastFetchRef.current = Date.now();
      }
    }, [eventId])
  );

  const fetchEvent = async () => {
    try {
      const data = await apiService.getEvent(eventId) as Event;
      setEvent(data);
      fetchBubble(data.bubbleId);
      logAppEvent('eventDetails.loaded', {
        eventId,
        bubbleId: data.bubbleId,
        hasImages: (data.images?.length > 0 || !!data.coverImage) ? true : false,
        hasLocation: !!data.locationName,
        hasAttendeeLimit: !!data.attendeeLimit,
      });
    } catch (error) {
      logAppWarn('eventDetails.load_failed', { eventId, error: String(error) });
      console.error('Failed to fetch event:', error);
      Alert.alert('Error', 'Failed to load event');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBubble = async (bubbleId: string) => {
    try {
      const data = await apiService.getBubble(bubbleId) as Bubble;
      setBubble(data);
      try {
        const membership = await apiService.checkMembership(bubbleId);
        setMyBubbleRole(membership.role || null);
      } catch {}
    } catch (error) {
      console.error('Failed to fetch bubble:', error);
    }
  };

  const fetchAttendees = async () => {
    try {
      const data = await apiService.getEventAttendees(eventId) as Attendee[];
      setAttendees(data);
      const myAttendance = data.find(a => a.userId === user?.id);
      setIsRsvpd(!!myAttendance);
      setRsvpStatus(myAttendance?.status || null);
      logAppEvent('eventDetails.attendees_loaded', {
        eventId,
        attendeeCount: data.length,
        goingCount: data.filter(a => a.status === 'going').length,
        waitlistedCount: data.filter(a => a.status === 'waitlisted').length,
        userStatus: myAttendance?.status || 'none',
      });
    } catch (error) {
      logAppWarn('eventDetails.attendees_load_failed', { eventId, error: String(error) });
      console.error('Failed to fetch attendees:', error);
    }
  };

  const fetchSignupTasks = async (): Promise<SignupTask[] | null> => {
    try {
      const tasks = await apiService.getEventSignupTasks(eventId) as SignupTask[];
      setSignupTasks(tasks);
      return tasks;
    } catch (error) {
      console.error('Failed to fetch signup tasks:', error);
      return null;
    }
  };

  const openCreateTask = () => {
    setTaskModalMode('create');
    setEditingTask(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskIcon('📋');
    setTaskSpotsNeeded('');
    setShowTaskModal(true);
  };

  const openEditTask = (task: SignupTask) => {
    setTaskModalMode('edit');
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? '');
    setTaskIcon(task.icon);
    setTaskSpotsNeeded(task.spotsNeeded != null ? String(task.spotsNeeded) : '');
    setShowTaskModal(true);
  };

  const handleTaskSubmit = async () => {
    if (!taskTitle.trim()) return;
    setTaskSubmitting(true);
    const parsed = parseInt(taskSpotsNeeded, 10);
    const spotsNum = taskSpotsNeeded.trim() && !isNaN(parsed) ? parsed : null;
    try {
      if (taskModalMode === 'create') {
        await apiService.createEventSignupTask(eventId, {
          title: taskTitle.trim(),
          description: taskDescription.trim() || undefined,
          icon: taskIcon,
          spotsNeeded: spotsNum,
        });
      } else if (editingTask) {
        await apiService.updateEventSignupTask(eventId, editingTask.id, {
          title: taskTitle.trim(),
          description: taskDescription.trim() || undefined,
          icon: taskIcon,
          spotsNeeded: spotsNum,
        });
      }
      const updatedTasks = await fetchSignupTasks();
      if (onTasksChanged && updatedTasks !== null) {
        const openCount = updatedTasks.filter(
          (t) => t.spotsNeeded == null || t.signupCount < t.spotsNeeded
        ).length;
        onTasksChanged(eventId, openCount);
      }
      setShowTaskModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save task. Please try again.');
    } finally {
      setTaskSubmitting(false);
    }
  };

  const showTaskOptions = (task: SignupTask) => {
    Alert.alert(task.title, undefined, [
      { text: 'Edit', onPress: () => openEditTask(task) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteTask(task) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleDeleteTask = (task: SignupTask) => {
    Alert.alert('Delete Task', `Remove "${task.title}" from the sign-up sheet?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiService.deleteEventSignupTask(eventId, task.id);
            const updatedTasks = await fetchSignupTasks();
            if (onTasksChanged && updatedTasks !== null) {
              const openCount = updatedTasks.filter(
                (t) => t.spotsNeeded == null || t.signupCount < t.spotsNeeded
              ).length;
              onTasksChanged(eventId, openCount);
            }
          } catch {
            Alert.alert('Error', 'Failed to delete task.');
          }
        }
      }
    ]);
  };

  useEffect(() => {
    signupTasksRef.current = signupTasks;
  }, [signupTasks]);

  const dragCloneStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragAnchorY.value + dragTranslationY.value }],
  }));

  const _jsUpdateHoverIndex = useCallback((translationY: number) => {
    const drag = activeDragRef.current;
    if (!drag) return;
    const newY = drag.origY + translationY;
    const tasks = reorderTasksRef.current;
    const itemHeight = reorderItemLayouts.current[drag.id]?.height ?? 72;
    const centerY = newY + itemHeight / 2;
    let hoverIdx = tasks.length;
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].id === drag.id) continue;
      const layout = reorderItemLayouts.current[tasks[i].id];
      if (layout && centerY < layout.y + layout.height / 2) {
        hoverIdx = i;
        break;
      }
    }
    if (hoverIdx !== activeHoverRef.current) {
      activeHoverRef.current = hoverIdx;
      setInlineHoverIndex(hoverIdx);
    }
  }, []);

  const _jsFinalizeDrag = useCallback(() => {
    dragStartTouchRef.current = null;
    if (!activeDragRef.current) {
      setScrollEnabled(true);
      return;
    }
    const tasks = reorderTasksRef.current;
    const startIndex = activeDragRef.current.index;
    const finalHover = activeHoverRef.current ?? startIndex;
    activeDragRef.current = null;
    setInlineDraggingId(null);
    setInlineHoverIndex(null);
    setScrollEnabled(true);
    if (finalHover !== startIndex) {
      const newTasks = [...tasks];
      const [item] = newTasks.splice(startIndex, 1);
      const insertAt = finalHover > startIndex ? finalHover - 1 : finalHover;
      newTasks.splice(insertAt, 0, item);
      setSignupTasks(newTasks);
      autoSaveInlineOrderRef.current(newTasks);
    }
  }, []);

  const dragGesture = useMemo(() => {
    const longPress = Gesture.LongPress()
      .minDuration(400)
      .maxDistance(10)
      .runOnJS(true)
      .onBegin((evt) => {
        if (!canManageRef.current) return;
        const touchY = evt.absoluteY - containerPageY.current;
        const optionsThreshold = SCREEN_WIDTH - CONTENT_PADDING - 40;
        const tasks = reorderTasksRef.current;
        for (let i = 0; i < tasks.length; i++) {
          const layout = reorderItemLayouts.current[tasks[i].id];
          if (layout && touchY >= layout.y && touchY < layout.y + layout.height) {
            dragStartTouchRef.current = {
              taskId: tasks[i].id,
              isOptions: evt.absoluteX >= optionsThreshold,
              startAbsX: evt.absoluteX,
              startAbsY: evt.absoluteY,
            };
            return;
          }
        }
        dragStartTouchRef.current = null;
      })
      .onStart(() => {
        const touchInfo = dragStartTouchRef.current;
        if (!touchInfo || touchInfo.isOptions || !canManageRef.current) return;
        const tasks = reorderTasksRef.current;
        const idx = tasks.findIndex(t => t.id === touchInfo.taskId);
        if (idx === -1) return;
        const layout = reorderItemLayouts.current[touchInfo.taskId];
        if (!layout) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        activeDragRef.current = { id: touchInfo.taskId, index: idx, origY: layout.y };
        activeHoverRef.current = idx;
        dragTranslationY.value = 0;
        dragAnchorY.value = layout.y;
        setInlineDraggingId(touchInfo.taskId);
        setInlineHoverIndex(idx);
        setScrollEnabled(false);
      })
      .onFinalize((evt, success) => {
        if (success) return;
        const touchInfo = dragStartTouchRef.current;
        dragStartTouchRef.current = null;
        if (!touchInfo) return;
        const dx = evt.absoluteX - touchInfo.startAbsX;
        const dy = evt.absoluteY - touchInfo.startAbsY;
        if (Math.sqrt(dx * dx + dy * dy) > 12) return;
        const task = reorderTasksRef.current.find(t => t.id === touchInfo.taskId);
        if (!task) return;
        if (touchInfo.isOptions) {
          showTaskOptionsRef.current(task);
        } else {
          handleToggleSignupRef.current(task);
        }
      });

    const jsUpdateHoverIndex = _jsUpdateHoverIndex;
    const jsFinalizeDrag = _jsFinalizeDrag;

    const pan = Gesture.Pan()
      .simultaneousWithExternalGesture(nativeScrollGesture)
      .onUpdate((evt) => {
        dragTranslationY.value = evt.translationY;
        runOnJS(jsUpdateHoverIndex)(evt.translationY);
      })
      .onFinalize(() => {
        dragTranslationY.value = 0;
        runOnJS(jsFinalizeDrag)();
      });

    return Gesture.Simultaneous(longPress, pan);
  }, [dragTranslationY, dragAnchorY, _jsUpdateHoverIndex, _jsFinalizeDrag, nativeScrollGesture]);

  const autoSaveInlineOrder = async (orderedTasks: SignupTask[]) => {
    try {
      const taskIds = orderedTasks.map(t => t.id);
      await apiService.reorderEventSignupTasks(eventId, taskIds);
      if (onTasksChanged) {
        const openCount = orderedTasks.filter(
          (t) => t.spotsNeeded == null || t.signupCount < t.spotsNeeded
        ).length;
        onTasksChanged(eventId, openCount);
      }
    } catch {
      Alert.alert('Error', 'Failed to save order. Please try again.');
      await fetchSignupTasks();
    }
  };

  const handleToggleSignup = async (task: SignupTask) => {
    if (!user) return;
    const optimistic = signupTasks.map(t => {
      if (t.id !== task.id) return t;
      if (t.hasSignedUp) {
        return { ...t, hasSignedUp: false, signupCount: t.signupCount - 1, signers: t.signers.filter(s => s.id !== user.id) };
      } else {
        const newSigner = { id: user.id, name: user.name ?? '', profilePhoto: user.profilePhoto ?? null };
        return { ...t, hasSignedUp: true, signupCount: t.signupCount + 1, signers: [...t.signers.slice(0, 2), newSigner] };
      }
    });
    setSignupTasks(optimistic);
    try {
      if (task.hasSignedUp) {
        await apiService.leaveEventSignupTask(task.id);
      } else {
        await apiService.joinEventSignupTask(task.id);
      }
      const updatedTasks = await fetchSignupTasks();
      if (onTasksChanged && updatedTasks !== null) {
        const openCount = updatedTasks.filter(
          (t) => t.spotsNeeded == null || t.signupCount < t.spotsNeeded
        ).length;
        onTasksChanged(eventId, openCount);
      }
    } catch {
      setSignupTasks(signupTasks);
      Alert.alert('Error', 'Failed to update sign-up. Please try again.');
    }
  };

  const handleRsvpSelect = async (status: 'going' | 'not_going') => {
    setIsRsvping(true);
    setShowRsvpDropdown(false);
    try {
      if (status === 'not_going' && isRsvpd) {
        await apiService.cancelRsvp(eventId);
        setIsRsvpd(false);
        setRsvpStatus('not_going');
        setAttendees(attendees.filter(a => a.userId !== user?.id));
        setSuccessModalConfig({ title: 'RSVP Updated', subtitle: 'You are not attending this event' });
        setShowSuccessModal(true);
      } else if (status === 'going') {
        const result = await apiService.rsvpEvent(eventId, 'going') as { success: boolean; status: string };
        setIsRsvpd(true);
        const actualStatus = result.status || 'going';
        setRsvpStatus(actualStatus);
        fetchAttendees();
        if (actualStatus === 'waitlisted') {
          setSuccessModalConfig({ title: 'Waitlisted', subtitle: 'The event is full. You\'ve been added to the waitlist.' });
        } else {
          setSuccessModalConfig({ title: 'RSVP Confirmed!', subtitle: 'You are attending this event' });
        }
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update RSVP');
    } finally {
      setIsRsvping(false);
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditEvent' as any, { event });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteEvent(eventId);
              setSuccessModalConfig({ title: 'Deleted', subtitle: 'Event has been deleted' });
              setShouldNavigateBack(true);
              setShowSuccessModal(true);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  const showAdminOptions = () => {
    Alert.alert(
      'Manage Event',
      undefined,
      [
        { text: 'Edit Event', onPress: handleEdit },
        { text: 'Delete Event', style: 'destructive', onPress: handleDelete },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleShare = async () => {
    try {
      const configRes = await apiService.getShareBaseUrl();
      const bubbleName = encodeURIComponent(bubble?.title || 'bubble');
      const eventName = encodeURIComponent(event?.title || 'event');
      const deepLink = `${configRes.baseUrl}/${bubbleName}/${eventName}/${eventId}`;
      await Share.share({
        message: `Check out this event: ${event?.title}\n${deepLink}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleViewParticipants = () => {
    navigation.navigate('EventParticipants' as any, {
      eventId,
      eventTitle: event?.title || '',
      bubbleId: event?.bubbleId || '',
      bubbleTitle: bubbleDisplayTitle || bubble?.title || '',
      bubblePrivacy: bubble?.privacy || 'Public',
      eventCreatorId: event?.creatorId || '',
    });
  };

  const openDirections = () => {
    if (!event?.locationName) return;
    const address = event.locationAddress || event.locationName;
    const encodedAddress = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${encodedAddress}`,
      android: `geo:0,0?q=${encodedAddress}`,
    });
    if (url) {
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) return Linking.openURL(url);
          return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
        })
        .catch((err) => console.error('Error opening maps:', err));
    }
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${weekday}, ${monthDay}`;
  };

  const formatDateFull = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let dayLabel: string;
    if (d.getTime() === today.getTime()) dayLabel = 'Today';
    else if (d.getTime() === tomorrow.getTime()) dayLabel = 'Tomorrow';
    else dayLabel = d.toLocaleDateString('en-US', { weekday: 'long' });
    return `${dayLabel}, ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getDate()}`;
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getTimeRange = () => {
    if (!event) return '';
    const start = formatTime(event.startTime);
    const end = event.endTime ? formatTime(event.endTime) : null;
    return end ? `${start} - ${end}` : start;
  };

  if (isLoading || !event) {
    return (
      <SafeAreaView style={styles.container}>
        <EventDetailsSkeleton />
      </SafeAreaView>
    );
  }

  const isEventCreator = event.creatorId === user?.id;
  const isBubbleAdmin = myBubbleRole === 'admin';
  const isSuperAdmin = user?.isSuperAdmin === true;
  const canManage = isEventCreator || isBubbleAdmin || isSuperAdmin;
  canManageRef.current = canManage;
  handleToggleSignupRef.current = handleToggleSignup;
  autoSaveInlineOrderRef.current = autoSaveInlineOrder;
  showTaskOptionsRef.current = showTaskOptions;

  const goingCount = attendees.filter(a => a.status === 'going').length;
  const waitlistCount = attendees.filter(a => a.status === 'waitlisted').length;
  const spotsLeft = event.attendeeLimit ? event.attendeeLimit - goingCount : null;
  const isFull = event.attendeeLimit ? goingCount >= event.attendeeLimit : false;

  const creatorAttendee = attendees.find(a => a.userId === event.creatorId);
  const creatorName = creatorAttendee?.user?.name || (event as any).creatorName || 'Event Creator';
  const creatorProfilePhoto = (event as any).creatorProfilePhoto || null;
  const creatorDisplayName = (() => {
    const parts = creatorName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  })();

  const bubbleDisplayTitle = routeBubbleTitle || bubble?.title || '';

  const eventImages = event.images?.length > 0
    ? event.images
    : event.coverImage
      ? [event.coverImage]
      : [];

  const hasImages = eventImages.length > 0;
  const locationDisplay = event.locationAddress || event.locationName || '';

  const eventAny = event as any;
  const hasValidCoords = eventAny.locationLat && eventAny.locationLng;
  const mapImageUrl = hasValidCoords
    ? `${API_URL}/api/static-map?lat=${eventAny.locationLat}&lng=${eventAny.locationLng}&zoom=15`
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBackButton}>
          <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{event.title}</Text>
        <View style={styles.navRightActions}>
          <View style={{ position: 'relative', zIndex: 200 }}>
            <TouchableOpacity onPress={() => setShowKebabMenu(!showKebabMenu)} style={styles.navShareButton}>
              <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            {showKebabMenu && (
              <View style={styles.kebabMenu}>
                <TouchableOpacity
                  style={styles.kebabMenuItem}
                  onPress={() => { setShowKebabMenu(false); handleShare(); }}
                >
                  <Ionicons name="paper-plane-outline" size={18} color={Colors.text.primary} />
                  <Text style={styles.kebabMenuText}>Share Event</Text>
                </TouchableOpacity>
                {canManage && (
                  <TouchableOpacity
                    style={styles.kebabMenuItem}
                    onPress={() => { setShowKebabMenu(false); showAdminOptions(); }}
                  >
                    <CrownIcon size={18} color={Colors.brand.primary} />
                    <Text style={[styles.kebabMenuText, { color: Colors.brand.primary }]}>Manage Event</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.kebabSeparatorMedium} />
                <TouchableOpacity
                  style={styles.kebabMenuItem}
                  onPress={() => { setShowKebabMenu(false); handleReportConcern(); }}
                >
                  <FlagIcon size={18} color={Colors.status.error} />
                  <Text style={styles.kebabMenuText}>Report a Concern</Text>
                </TouchableOpacity>
                <View style={styles.kebabSeparator} />
                <TouchableOpacity
                  style={styles.kebabMenuItem}
                  onPress={() => { setShowKebabMenu(false); handleReportEvent(); }}
                >
                  <FlagIcon size={18} color={Colors.status.error} />
                  <Text style={[styles.kebabMenuText, { color: Colors.status.error }]}>Report this Event</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {showKebabMenu && (
        <TouchableOpacity
          style={styles.kebabBackdrop}
          activeOpacity={1}
          onPress={() => setShowKebabMenu(false)}
        />
      )}

      <GestureDetector gesture={nativeScrollGesture}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={scrollEnabled}
      >
        {hasImages && (
          <View style={styles.coverImageContainer}>
            {eventImages.length === 1 ? (
              <Image source={{ uri: eventImages[0] }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <ImageCarousel
                images={eventImages}
                width={IMAGE_WIDTH}
                height={200}
                borderRadius={Radius.md}
              />
            )}
          </View>
        )}

        <View style={styles.spotsCenterRow}>
          <Text style={styles.spotsGreenText}>
            {spotsLeft !== null
              ? (isFull ? 'Event Full' : `${spotsLeft} spots left`)
              : `${goingCount} going`}
          </Text>
          {waitlistCount > 0 && (
            <Text style={styles.waitlistCountText}>
              {' · '}Waitlisted: {waitlistCount}
            </Text>
          )}
        </View>

        <View style={styles.infoRows}>
          <View style={[styles.dateTimeRsvpRow, { zIndex: 100 }]} onLayout={(e) => { rsvpYRef.current = e.nativeEvent.layout.y; }}>
            <View style={styles.dateTimeColumn}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <CalendarIcon size={18} color={Colors.text.tertiary} />
                </View>
                <Text style={styles.infoText}>{formatDateShort(event.date)}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <ClockIcon size={18} color={Colors.text.tertiary} />
                </View>
                <Text style={styles.infoText}>{getTimeRange()}</Text>
              </View>
            </View>
            <View style={styles.rsvpDropdownWrapper}>
              <Animated.View style={{ transform: [{ scale: rsvpPulseAnim }] }}>
                <TouchableOpacity
                  style={[
                    styles.rsvpDropdownButton,
                    (rsvpStatus === 'going' || (isEventCreator && !rsvpStatus)) && styles.rsvpDropdownGoing,
                    rsvpStatus === 'not_going' && styles.rsvpDropdownNotGoing,
                    rsvpStatus === 'waitlisted' && styles.rsvpDropdownWaitlisted,
                    (!rsvpStatus && !isEventCreator) && styles.rsvpDropdownDefault,
                    highlightRsvp && styles.rsvpDropdownHighlighted,
                  ]}
                  onPress={() => setShowRsvpDropdown(!showRsvpDropdown)}
                  disabled={isRsvping}
                >
                  {isRsvping ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.rsvpDropdownButtonText}>
                        {isEventCreator
                          ? (rsvpStatus === 'not_going' ? 'Not Going' : 'Going')
                          : (rsvpStatus === 'waitlisted' ? 'Waitlisted' : rsvpStatus === 'going' ? 'Going' : rsvpStatus === 'not_going' ? 'Not Going' : 'RSVP')}
                      </Text>
                      {showRsvpDropdown ? <ChevronUpIcon size={14} color="#FFFFFF" /> : <ChevronDownIcon size={14} color="#FFFFFF" />}
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
              {showRsvpDropdown && (
                <View style={styles.rsvpDropdownMenu}>
                  {(!isEventCreator || rsvpStatus === 'not_going') && (
                    <>
                      <TouchableOpacity
                        style={styles.rsvpDropdownItem}
                        onPress={() => handleRsvpSelect('going')}
                      >
                        <View style={[styles.rsvpStatusDot, { backgroundColor: '#34C759' }]} />
                        <Text style={styles.rsvpDropdownItemText}>Going</Text>
                      </TouchableOpacity>
                      {!isEventCreator && <View style={styles.rsvpDropdownDivider} />}
                    </>
                  )}
                  {(!isEventCreator || rsvpStatus !== 'not_going') && (
                    <TouchableOpacity
                      style={styles.rsvpDropdownItem}
                      onPress={() => handleRsvpSelect('not_going')}
                    >
                      <View style={[styles.rsvpStatusDot, { backgroundColor: '#FF3B30' }]} />
                      <Text style={styles.rsvpDropdownItemText}>Not Going</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <PeopleIcon size={18} color={Colors.text.tertiary} />
            </View>
            <Text style={styles.infoText}>
              {event.attendeeLimit ? `${goingCount} of ${event.attendeeLimit} spots filled` : `${goingCount} going`}
            </Text>
            <TouchableOpacity onPress={handleViewParticipants} style={styles.viewLink}>
              <Text style={styles.viewLinkText}>view {'>'}</Text>
            </TouchableOpacity>
          </View>
          {event.description && (
            <TouchableOpacity style={styles.infoRow} activeOpacity={0.7} onPress={() => Alert.alert(event.title, event.description || '')}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="document-text-outline" size={18} color={Colors.text.tertiary} />
              </View>
              <Text style={styles.infoText} numberOfLines={1}>
                {event.description.length > 30 ? event.description.substring(0, 30) + '...' : event.description}
              </Text>
              <View style={styles.viewLink}>
                <Text style={styles.viewLinkText}>more {'>'}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.separator} />

        <TouchableOpacity style={styles.creatorRow} activeOpacity={0.7} onPress={() => Alert.alert(creatorName, `Event creator`)}>
          {creatorProfilePhoto ? (
            <Image source={{ uri: creatorProfilePhoto }} style={styles.creatorAvatarImage} />
          ) : (
            <View style={styles.creatorAvatar}>
              <Ionicons name="person" size={20} color={Colors.background.primary} />
            </View>
          )}
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorLabel}>
              Created by <Text style={styles.creatorName}>{creatorName}</Text>
            </Text>
            <Text style={styles.creatorCity}>
              {event.locationName ? event.locationName.split(',')[0] : 'Local'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.text.tertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.locationRow} activeOpacity={0.7} onPress={() => event.locationName && setLocationExpanded(!locationExpanded)}>
          <View style={styles.locationIconContainer}>
            <LocationPinIcon size={20} color={Colors.brand.primary} />
          </View>
          <View style={styles.locationInfo}>
            <Text style={styles.locationLandmark}>{event.locationName || 'TBD'}</Text>
            {event.locationAddress && (
              <Text style={styles.locationAddress}>{event.locationAddress}</Text>
            )}
          </View>
          {event.locationName && (
            locationExpanded ? <ChevronUpIcon size={16} color={Colors.text.tertiary} /> : <ChevronDownIcon size={16} color={Colors.text.tertiary} />
          )}
        </TouchableOpacity>

        <View style={styles.separator} />

        {event.locationName && locationExpanded && (
          <View style={styles.mapSection}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.mapContainer}>
              {mapImageUrl ? (
                <Image source={{ uri: mapImageUrl }} style={styles.mapImage} resizeMode="cover" />
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map-outline" size={48} color={Colors.text.tertiary} />
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.directionsButton} onPress={openDirections}>
              <Image source={directionsIcon} style={{ width: 24, height: 24 }} resizeMode="contain" />
              <Text style={styles.directionsText}>Get Directions</Text>
            </TouchableOpacity>
            <View style={styles.separator} />
          </View>
        )}

        <View style={styles.bulletinSection} onLayout={(e) => { tasksYRef.current = e.nativeEvent.layout.y; }}>
          <View style={styles.signupSectionHeader}>
            <Text style={styles.sectionTitle}>
              Sign-up & Help {creatorDisplayName}
            </Text>
            {canManage && (
              <TouchableOpacity style={[styles.addButtonInline, styles.addButtonBelow]} onPress={openCreateTask} data-testid="button-add-task">
                <Text style={styles.addButtonInlineText}>+ Add Task</Text>
              </TouchableOpacity>
            )}
          </View>
          {canManage && signupTasks.length > 1 && (
            <Text style={styles.inlineDragHint}>Hold ☰ and drag to reorder · tap ⋮ to edit</Text>
          )}

          {signupTasks.length === 0 ? (
            <View style={styles.emptyTasksBox}>
              <Text style={styles.emptyTasksEmoji}>🙌</Text>
              <Text style={styles.emptyTasksText}>
                {canManage
                  ? 'Add tasks for members to volunteer for!'
                  : 'No sign-up tasks yet.'}
              </Text>
            </View>
          ) : canManage ? (
            <GestureDetector gesture={dragGesture}>
            <View
              ref={reorderContainerRef}
              onLayout={() => {
                reorderContainerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
                  containerPageY.current = py;
                });
              }}
            >
              {signupTasks.map((task, index) => {
                const spotsLeft = task.spotsNeeded != null ? task.spotsNeeded - task.signupCount : null;
                const isFull = spotsLeft !== null && spotsLeft <= 0;
                const isDragging = inlineDraggingId === task.id;
                const draggingIdx = signupTasks.findIndex(t => t.id === inlineDraggingId);
                const isDropTarget = inlineHoverIndex === index && inlineDraggingId !== null && !isDragging;
                return (
                  <View
                    key={task.id}
                    onLayout={(e) => {
                      reorderItemLayouts.current[task.id] = {
                        y: e.nativeEvent.layout.y,
                        height: e.nativeEvent.layout.height,
                      };
                    }}
                  >
                    {isDropTarget && index < draggingIdx && (
                      <View style={styles.inlineDropIndicator} />
                    )}
                    <View
                      style={[
                        styles.taskCard,
                        task.hasSignedUp && styles.taskCardSigned,
                        isDragging && styles.taskCardDragging,
                      ]}
                      data-testid={`card-task-${task.id}`}
                    >
                      <View style={styles.taskHeader}>
                        <View style={styles.inlineDragHandle}>
                          <Ionicons name="menu" size={18} color={Colors.text.tertiary} />
                        </View>
                        <View style={styles.taskIconWrap}>
                          <Text style={styles.taskEmoji}>{task.icon}</Text>
                        </View>
                        <View style={styles.taskMeta}>
                          <Text style={styles.taskTitle}>{task.title}</Text>
                          {task.description ? (
                            <Text style={styles.taskDesc}>{task.description}</Text>
                          ) : null}
                          <View style={styles.taskSignerRow}>
                            {task.signers.map((s) => (
                              <View key={s.id} style={styles.signerAvatar}>
                                {s.profilePhoto ? (
                                  <Image source={{ uri: s.profilePhoto }} style={styles.signerImg} />
                                ) : (
                                  <Text style={styles.signerInitial}>{s.name?.[0] ?? '?'}</Text>
                                )}
                              </View>
                            ))}
                            <Text style={styles.signerCount}>
                              {task.signupCount} signed up
                              {task.spotsNeeded != null ? ` · ${Math.max(0, spotsLeft!)} spot${spotsLeft === 1 ? '' : 's'} left` : ''}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.taskAdminActions}>
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={isFull && !task.hasSignedUp ? 1 : 0.7}
                            onPress={() => { if (!isFull || task.hasSignedUp) handleToggleSignup(task); }}
                          >
                            {task.hasSignedUp ? (
                              <View style={styles.signedBadge}>
                                <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />
                              </View>
                            ) : isFull ? (
                              <View style={styles.fullBadge}>
                                <Text style={styles.fullBadgeText}>Full</Text>
                              </View>
                            ) : (
                              <View style={styles.signUpBadge}>
                                <Ionicons name="add-circle-outline" size={20} color={Colors.brand.primary} />
                              </View>
                            )}
                          </TouchableOpacity>
                          <View style={styles.taskOptionsBtn}>
                            <Ionicons name="ellipsis-vertical" size={16} color={Colors.text.tertiary} />
                          </View>
                        </View>
                      </View>
                    </View>
                    {isDropTarget && index >= draggingIdx && (
                      <View style={styles.inlineDropIndicator} />
                    )}
                  </View>
                );
              })}

              {inlineDraggingId !== null && (() => {
                const draggingTask = signupTasks.find(t => t.id === inlineDraggingId);
                if (!draggingTask) return null;
                return (
                  <Reanimated.View
                    pointerEvents="none"
                    style={[
                      styles.taskCard,
                      styles.taskCardDragClone,
                      dragCloneStyle,
                    ]}
                  >
                    <View style={styles.taskHeader}>
                      <View style={styles.inlineDragHandle}>
                        <Ionicons name="menu" size={18} color={Colors.brand.primary} />
                      </View>
                      <View style={styles.taskIconWrap}>
                        <Text style={styles.taskEmoji}>{draggingTask.icon}</Text>
                      </View>
                      <View style={styles.taskMeta}>
                        <Text style={styles.taskTitle} numberOfLines={1}>{draggingTask.title}</Text>
                      </View>
                    </View>
                  </Reanimated.View>
                );
              })()}
            </View>
            </GestureDetector>
          ) : (
            signupTasks.map((task) => {
              const spotsLeft = task.spotsNeeded != null ? task.spotsNeeded - task.signupCount : null;
              const isFull = spotsLeft !== null && spotsLeft <= 0;
              const canToggle = !!user && (!isFull || task.hasSignedUp);
              return (
                <Animated.View
                  key={task.id}
                  style={highlightedTaskId === String(task.id) ? { transform: [{ scale: taskPulseAnim }] } : undefined}
                >
                <TouchableOpacity
                  activeOpacity={canToggle ? 0.7 : 1}
                  style={[styles.taskCard, task.hasSignedUp && styles.taskCardSigned, highlightedTaskId === String(task.id) && styles.taskCardHighlighted]}
                  onPress={() => { if (canToggle) handleToggleSignup(task); }}
                  data-testid={`card-task-${task.id}`}
                >
                  <View style={styles.taskHeader}>
                    <View style={styles.taskIconWrap}>
                      <Text style={styles.taskEmoji}>{task.icon}</Text>
                    </View>
                    <View style={styles.taskMeta}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      {task.description ? (
                        <Text style={styles.taskDesc}>{task.description}</Text>
                      ) : null}
                      <View style={styles.taskSignerRow}>
                        {task.signers.map((s) => (
                          <View key={s.id} style={styles.signerAvatar}>
                            {s.profilePhoto ? (
                              <Image source={{ uri: s.profilePhoto }} style={styles.signerImg} />
                            ) : (
                              <Text style={styles.signerInitial}>{s.name?.[0] ?? '?'}</Text>
                            )}
                          </View>
                        ))}
                        <Text style={styles.signerCount}>
                          {task.signupCount} signed up
                          {task.spotsNeeded != null ? ` · ${Math.max(0, spotsLeft!)} spot${spotsLeft === 1 ? '' : 's'} left` : ''}
                        </Text>
                      </View>
                    </View>
                    {task.hasSignedUp ? (
                      <View style={styles.signedBadge}>
                        <Ionicons name="checkmark-circle" size={22} color={Colors.brand.primary} />
                      </View>
                    ) : isFull ? (
                      <View style={styles.fullBadge}>
                        <Text style={styles.fullBadgeText}>Full</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
                </Animated.View>
              );
            })
          )}
        </View>

      </ScrollView>
      </GestureDetector>

      <SuccessModal
        visible={showSuccessModal}
        title={successModalConfig.title}
        subtitle={successModalConfig.subtitle}
        onClose={() => {
          setShowSuccessModal(false);
          if (shouldNavigateBack) {
            navigation.goBack();
          }
        }}
      />
      <Modal
        visible={eventReportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEventReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.eventReportOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.eventReportDialog}>
            <View style={styles.eventReportHeader}>
              <Text style={styles.eventReportTitle}>Report a Concern</Text>
              <TouchableOpacity onPress={() => setEventReportModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.eventReportSubtitle}>
              Report a concern about this event — private to admins
            </Text>
            <ScrollView style={styles.eventReportReasonsList} nestedScrollEnabled>
              {EVENT_CONCERN_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.eventReportReasonItem,
                    eventReportReason === reason && styles.eventReportReasonSelected,
                    reason === 'Report a member' && styles.eventReportReasonLink,
                  ]}
                  onPress={() => handleConcernReasonSelect(reason)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.eventReportReasonText,
                      eventReportReason === reason && styles.eventReportReasonTextSelected,
                      reason === 'Report a member' && { color: Colors.brand.primary },
                    ]}>{reason === 'Report a member' ? '→ Report a member' : reason}</Text>
                    {reason !== 'Report a member' && (
                      <Text style={{ fontSize: 11, color: Colors.text.tertiary, marginTop: 2 }}>
                        {EVENT_CONCERN_ROUTING[reason]}
                      </Text>
                    )}
                  </View>
                  {eventReportReason === reason && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />
                  )}
                  {reason === 'Report a member' && (
                    <Ionicons name="chevron-forward" size={18} color={Colors.brand.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {eventReportReason && (
              <TextInput
                style={styles.eventReportTextInput}
                placeholder="Additional details (optional)"
                placeholderTextColor={Colors.text.tertiary}
                value={eventReportFreeText}
                onChangeText={setEventReportFreeText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
            <TouchableOpacity
              style={[styles.eventReportSubmitButton, !eventReportReason && styles.eventReportSubmitDisabled]}
              onPress={submitConcernReport}
              disabled={!eventReportReason || eventReportSubmitting}
            >
              {eventReportSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.eventReportSubmitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={reportEventModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportEventModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.eventReportOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.eventReportDialog}>
            <View style={styles.eventReportHeader}>
              <Text style={styles.eventReportTitle}>Report Event</Text>
              <TouchableOpacity onPress={() => setReportEventModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.eventReportSubtitle}>
              Report a problem with this event — sent to admins for review
            </Text>
            <ScrollView style={styles.eventReportReasonsList} nestedScrollEnabled>
              {REPORT_EVENT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.eventReportReasonItem,
                    reportEventReason === reason && styles.eventReportReasonSelected,
                  ]}
                  onPress={() => setReportEventReason(reason)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.eventReportReasonText,
                      reportEventReason === reason && styles.eventReportReasonTextSelected,
                    ]}>{reason}</Text>
                    <Text style={{ fontSize: 11, color: Colors.text.tertiary, marginTop: 2 }}>
                      {REPORT_EVENT_ROUTING[reason]}
                    </Text>
                  </View>
                  {reportEventReason === reason && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {reportEventReason && (
              <TextInput
                style={styles.eventReportTextInput}
                placeholder="Additional details (optional)"
                placeholderTextColor={Colors.text.tertiary}
                value={reportEventFreeText}
                onChangeText={setReportEventFreeText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
            <TouchableOpacity
              style={[styles.eventReportSubmitButton, !reportEventReason && styles.eventReportSubmitDisabled]}
              onPress={submitEventReport}
              disabled={!reportEventReason || reportEventSubmitting}
            >
              {reportEventSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.eventReportSubmitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create / Edit Sign-Up Task Modal */}
      <Modal
        visible={showTaskModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTaskModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.taskModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.taskModalSheet}>
            <View style={styles.taskModalHeader}>
              <Text style={styles.taskModalTitle}>
                {taskModalMode === 'create' ? 'New Sign-Up Task' : 'Edit Task'}
              </Text>
              <TouchableOpacity onPress={() => setShowTaskModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.taskModalLabel}>Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiPicker}>
              {SIGNUP_EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiOption, taskIcon === e && styles.emojiOptionSelected]}
                  onPress={() => setTaskIcon(e)}
                >
                  <Text style={styles.emojiOptionText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.taskModalLabel}>Task Title *</Text>
            <TextInput
              style={styles.taskInput}
              value={taskTitle}
              onChangeText={setTaskTitle}
              placeholder="e.g. Bring drinks, Set up chairs…"
              placeholderTextColor={Colors.text.tertiary}
              maxLength={80}
            />

            <Text style={styles.taskModalLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.taskInput, styles.taskInputMulti]}
              value={taskDescription}
              onChangeText={setTaskDescription}
              placeholder="Any extra details…"
              placeholderTextColor={Colors.text.tertiary}
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            <Text style={styles.taskModalLabel}>Spots Needed (optional)</Text>
            <TextInput
              style={styles.taskInput}
              value={taskSpotsNeeded}
              onChangeText={setTaskSpotsNeeded}
              placeholder="Leave blank for unlimited"
              placeholderTextColor={Colors.text.tertiary}
              keyboardType="number-pad"
              maxLength={4}
            />

            <TouchableOpacity
              style={[styles.taskModalSave, (!taskTitle.trim() || taskSubmitting) && styles.taskModalSaveDisabled]}
              onPress={handleTaskSubmit}
              disabled={!taskTitle.trim() || taskSubmitting}
            >
              <Text style={styles.taskModalSaveText}>
                {taskSubmitting ? 'Saving…' : taskModalMode === 'create' ? 'Add Task' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: Spacing.md,
    zIndex: 200,
    backgroundColor: Colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightSilver,
  },
  navBackButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },
  navRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  navShareButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kebabMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 200,
    ...CardShadow,
    borderWidth: 1,
    borderColor: Colors.neutral.cloudGrey,
  },
  kebabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  kebabMenuText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },
  kebabSeparator: {
    height: 1,
    backgroundColor: Colors.neutral.coolMist,
    marginHorizontal: 16,
    opacity: 0.4,
  },
  kebabSeparatorMedium: {
    height: 1.5,
    backgroundColor: '#D0D0D0',
    marginHorizontal: 16,
  },
  kebabSeparatorHeavy: {
    height: 2,
    backgroundColor: '#C0C0C0',
    marginHorizontal: 16,
  },
  kebabBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 150,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: Spacing.xxxl + 20,
  },
  coverImageContainer: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 200,
    borderRadius: Radius.md,
  },
  spotsCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: Spacing.xs,
  },
  spotsGreenText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.status.success,
  },
  waitlistCountText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.status.warning,
  },
  dateTimeRsvpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  dateTimeColumn: {
    flex: 1,
    gap: Spacing.xs,
  },
  rsvpDropdownWrapper: {
    marginLeft: Spacing.md,
    alignSelf: 'flex-start',
  },
  rsvpDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 6,
  },
  rsvpDropdownDefault: {
    backgroundColor: Colors.brand.primary,
  },
  rsvpDropdownGoing: {
    backgroundColor: '#34C759',
  },
  rsvpDropdownNotGoing: {
    backgroundColor: '#FF3B30',
  },
  rsvpDropdownWaitlisted: {
    backgroundColor: '#FF9500',
  },
  rsvpDropdownHighlighted: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  rsvpDropdownButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
  rsvpDropdownMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    ...CardShadow,
    minWidth: 140,
    overflow: 'hidden',
  },
  rsvpDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  rsvpStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rsvpDropdownItemText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.text.primary,
  },
  rsvpDropdownDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  infoRows: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
    zIndex: 100,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoIconContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.regular,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: Typography.lineHeight.base,
  },
  viewLink: {
    marginLeft: Spacing.sm,
  },
  viewLinkText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.brand.primary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border.default,
    marginVertical: Spacing.xl,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.regular,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.base,
  },
  creatorName: {
    fontWeight: Typography.weights.semiBold,
  },
  creatorCity: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.regular,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF4FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationLandmark: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },
  locationAddress: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.regular,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  mapSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.neutral.charcoal,
    marginBottom: Spacing.sm,
  },
  mapContainer: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    height: 180,
    backgroundColor: '#F0F0F0',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8E8E8',
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.brand.primary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    marginTop: Spacing.md,
  },
  directionsText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium,
    color: Colors.brand.primary,
  },
  bulletinSection: {
    marginBottom: Spacing.lg,
    paddingTop: 30,
  },
  rsvpButtonLegacy: {
    display: 'none',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  signupSectionHeader: {
    marginBottom: Spacing.md,
  },
  addButtonBelow: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  addButtonInline: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.brand.primary,
    borderRadius: Radius.full,
  },
  addButtonInlineText: {
    fontSize: 13,
    fontWeight: Typography.weights.semibold,
    color: '#fff',
  },
  emptyTasksBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  emptyTasksEmoji: {
    fontSize: 30,
    marginBottom: Spacing.sm,
  },
  emptyTasksText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  taskCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  taskIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EAF4FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  taskEmoji: {
    fontSize: 18,
  },
  taskMeta: {
    flex: 1,
  },
  taskTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  taskDesc: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
    lineHeight: Typography.lineHeight.sm,
  },
  taskSignerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
    gap: 4,
  },
  signerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D0E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  signerImg: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  signerInitial: {
    fontSize: 10,
    color: Colors.brand.primary,
    fontWeight: Typography.weights.bold,
  },
  signerCount: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  taskCardSigned: {
    borderColor: Colors.brand.primary,
    borderWidth: 1.5,
    backgroundColor: '#F0F8FF',
  },
  taskCardHighlighted: {
    borderColor: Colors.brand.bubbleBlue,
    borderWidth: 2,
  },
  signedBadge: {
    marginLeft: Spacing.sm,
    justifyContent: 'center',
  },
  signUpBadge: {
    marginLeft: Spacing.sm,
    justifyContent: 'center',
  },
  fullBadge: {
    marginLeft: Spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F0F0F0',
    borderRadius: Radius.full,
    justifyContent: 'center',
  },
  fullBadgeText: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontWeight: Typography.weights.medium,
  },
  taskModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  taskModalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  taskModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  taskModalTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
  },
  taskModalLabel: {
    fontSize: 13,
    fontWeight: Typography.weights.semibold,
    color: Colors.text.secondary,
    marginBottom: 6,
    marginTop: Spacing.md,
  },
  emojiPicker: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  emojiOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#F0F0F0',
  },
  emojiOptionSelected: {
    backgroundColor: '#D0E8FF',
    borderWidth: 2,
    borderColor: Colors.brand.primary,
  },
  emojiOptionText: {
    fontSize: 20,
  },
  taskInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    backgroundColor: Colors.background.secondary,
    marginBottom: 4,
  },
  taskInputMulti: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  taskModalSave: {
    backgroundColor: Colors.brand.primary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  taskModalSaveDisabled: {
    opacity: 0.5,
  },
  taskModalSaveText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: '#fff',
  },
  eventReportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  eventReportDialog: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  eventReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventReportTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  eventReportSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  eventReportReasonsList: {
    maxHeight: 280,
    marginBottom: 12,
  },
  eventReportReasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  eventReportReasonSelected: {
    borderColor: Colors.brand.primary,
    backgroundColor: '#EBF5FF',
  },
  eventReportReasonLink: {
    backgroundColor: '#F0F8FF',
    borderColor: Colors.brand.primary,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  eventReportReasonText: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  eventReportReasonTextSelected: {
    color: Colors.brand.primary,
  },
  eventReportTextInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text.primary,
    minHeight: 70,
    marginBottom: 12,
  },
  eventReportSubmitButton: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  eventReportSubmitDisabled: {
    opacity: 0.5,
  },
  eventReportSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  inlineDragHint: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
  },
  inlineDragHandle: {
    paddingRight: 10,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskAdminActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: Spacing.sm,
  },
  taskOptionsBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCardDragging: {
    opacity: 0.35,
  },
  taskCardDragClone: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderColor: Colors.brand.primary,
    ...CardShadow,
    shadowOpacity: 0.18,
    elevation: 8,
    zIndex: 999,
  },
  inlineDropIndicator: {
    height: 2,
    backgroundColor: Colors.brand.primary,
    borderRadius: 2,
    marginBottom: 4,
    marginHorizontal: 4,
  },
});
