import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  LayoutAnimation,
  UIManager,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDownIcon, ChevronUpIcon } from '../../components/icons';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type PendingBubble = {
  id: string;
  title: string;
  tagline: string;
  category: string;
  creatorId: string;
  createdAt: string;
};

type PendingEvent = {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  bubbleId: string;
  bubble: {
    id: string;
    title: string;
  };
  createdAt: string;
};

type ReportItem = {
  id: string;
  reportType: string;
  reason: string;
  freeText?: string;
  reporterUserId: string;
  reportedUserId?: string;
  bubbleId: string;
  eventId?: string;
  visibleTo: string;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string; email: string };
  reportedUser?: { id: string; name: string; email: string };
  bubble?: { id: string; title: string };
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  individual: 'Person',
  bubble: 'Bubble',
  event: 'Event',
  admin: 'Admin',
};

const REPORT_TYPE_ICONS: Record<string, string> = {
  individual: 'person-outline',
  bubble: 'apps-outline',
  event: 'calendar-outline',
  admin: 'shield-outline',
};

const REPORT_TYPE_COLORS: Record<string, string> = {
  individual: '#FF9500',
  bubble: Colors.brand.bubbleBlue,
  event: '#AF52DE',
  admin: '#FF3B30',
};

export default function PendingReviewsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [pendingBubbles, setPendingBubbles] = useState<PendingBubble[]>([]);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<{ type: 'bubble' | 'event'; id: string } | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    concerns: false,
    events: false,
    bubbles: false,
  });

  const isSuperAdmin = user?.isSuperAdmin === true;

  useFocusEffect(
    useCallback(() => {
      loadAllItems();
    }, [])
  );

  const toggleSection = (section: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const loadAllItems = async () => {
    try {
      if (isSuperAdmin) {
        const [bubbles, adminReports] = await Promise.all([
          apiService.getPendingBubbles(),
          apiService.getAdminReports(),
        ]);
        setPendingBubbles(bubbles);
        setReports(adminReports);
      } else {
        const myBubbles = await apiService.getMyBubbles();
        const adminBubbles = (myBubbles as any[]).filter((b: any) => b.role === 'admin');
        const allReports: ReportItem[] = [];
        for (const bubble of adminBubbles) {
          try {
            const bubbleReports = await apiService.getBubbleReports(bubble.id);
            allReports.push(...bubbleReports);
          } catch {}
        }
        setReports(allReports);
      }

      const events = await apiService.getPendingEvents();
      setPendingEvents(events);
    } catch (error) {
      console.error('Failed to load pending items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllItems();
  };

  const handleApproveBubble = async (bubbleId: string) => {
    setActionLoading(bubbleId);
    try {
      await apiService.approveBubble(bubbleId);
      setPendingBubbles(prev => prev.filter(b => b.id !== bubbleId));
    } catch (error) {
      Alert.alert('Error', 'Failed to approve bubble');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectBubble = (bubbleId: string) => {
    setRejectReason('');
    setRejectTarget({ type: 'bubble', id: bubbleId });
    setRejectModalVisible(true);
  };

  const handleApproveEvent = async (eventId: string) => {
    setActionLoading(eventId);
    try {
      await apiService.approveEvent(eventId);
      setPendingEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (error) {
      Alert.alert('Error', 'Failed to approve event');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectEvent = (eventId: string) => {
    setRejectReason('');
    setRejectTarget({ type: 'event', id: eventId });
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    setRejectModalVisible(false);
    const { type, id } = rejectTarget;
    setActionLoading(id);
    try {
      if (type === 'bubble') {
        await apiService.rejectBubble(id, rejectReason || undefined);
        setPendingBubbles(prev => prev.filter(b => b.id !== id));
        Alert.alert('Rejected', 'Bubble has been rejected');
      } else {
        await apiService.rejectEvent(id, rejectReason || undefined);
        setPendingEvents(prev => prev.filter(e => e.id !== id));
        Alert.alert('Rejected', 'Event has been rejected');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to reject ${type}`);
    } finally {
      setActionLoading(null);
      setRejectTarget(null);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    setActionLoading(reportId);
    try {
      await apiService.updateReportStatus(reportId, 'resolved');
      setReports(prev => prev.filter(r => r.id !== reportId));
      Alert.alert('Resolved', 'Report has been marked as resolved');
    } catch (error) {
      Alert.alert('Error', 'Failed to resolve report');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    Alert.alert(
      'Dismiss Report',
      'Are you sure you want to dismiss this report?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(reportId);
            try {
              await apiService.updateReportStatus(reportId, 'dismissed');
              setReports(prev => prev.filter(r => r.id !== reportId));
              Alert.alert('Dismissed', 'Report has been dismissed');
            } catch (error) {
              Alert.alert('Error', 'Failed to dismiss report');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      </SafeAreaView>
    );
  }

  const pendingReports = reports.filter(r => r.status === 'pending');

  const renderAccordionHeader = (
    title: string,
    count: number,
    countColor: string,
    sectionKey: string,
    iconName: keyof typeof Ionicons.glyphMap,
    iconColor: string,
  ) => {
    const isExpanded = expandedSections[sectionKey];
    return (
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={() => toggleSection(sectionKey)}
        activeOpacity={0.7}
      >
        <View style={styles.accordionHeaderLeft}>
          <Ionicons name={iconName} size={18} color={iconColor} />
          <Text style={styles.accordionTitle}>{title}</Text>
          {count > 0 && (
            <View style={[styles.countBadge, { backgroundColor: countColor }]}>
              <Text style={styles.countBadgeText}>{count}</Text>
            </View>
          )}
        </View>
        {isExpanded ? <ChevronUpIcon size={20} color={Colors.neutral.coolMist} /> : <ChevronDownIcon size={20} color={Colors.neutral.coolMist} />}
      </TouchableOpacity>
    );
  };

  const renderBubbleCard = (bubble: PendingBubble) => (
    <View key={bubble.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardCategory}>
          <Text style={styles.categoryText}>{bubble.category}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{bubble.title}</Text>
      <Text style={styles.cardSubtitle}>{bubble.tagline}</Text>
      
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleRejectBubble(bubble.id)}
          disabled={actionLoading === bubble.id}
        >
          {actionLoading === bubble.id ? (
            <ActivityIndicator size="small" color={Colors.state.error} />
          ) : (
            <>
              <Ionicons name="close" size={18} color={Colors.state.error} />
              <Text style={styles.rejectText}>Reject</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => handleApproveBubble(bubble.id)}
          disabled={actionLoading === bubble.id}
        >
          <LinearGradient
            colors={[...Gradients.button.colors] as [string, string, ...string[]]}
            start={Gradients.button.start}
            end={Gradients.button.end}
            style={[styles.actionButton, styles.approveButton]}
          >
            {actionLoading === bubble.id ? (
              <ActivityIndicator size="small" color={'#FFFFFF'} />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color={'#FFFFFF'} />
                <Text style={styles.approveText}>Approve</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEventCard = (event: PendingEvent) => (
    <View key={event.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.bubbleTag}>
          <Ionicons name="apps-outline" size={14} color={Colors.brand.bubbleBlue} />
          <Text style={styles.bubbleTagText}>{event.bubble?.title || 'Unknown Bubble'}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{event.title}</Text>
      <View style={styles.eventMeta}>
        <Ionicons name="calendar-outline" size={14} color={Colors.neutral.coolMist} />
        <Text style={styles.eventMetaText}>
          {formatDate(event.date)} at {event.startTime}
        </Text>
      </View>
      
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleRejectEvent(event.id)}
          disabled={actionLoading === event.id}
        >
          {actionLoading === event.id ? (
            <ActivityIndicator size="small" color={Colors.state.error} />
          ) : (
            <>
              <Ionicons name="close" size={18} color={Colors.state.error} />
              <Text style={styles.rejectText}>Reject</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => handleApproveEvent(event.id)}
          disabled={actionLoading === event.id}
        >
          <LinearGradient
            colors={[...Gradients.button.colors] as [string, string, ...string[]]}
            start={Gradients.button.start}
            end={Gradients.button.end}
            style={[styles.actionButton, styles.approveButton]}
          >
            {actionLoading === event.id ? (
              <ActivityIndicator size="small" color={'#FFFFFF'} />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color={'#FFFFFF'} />
                <Text style={styles.approveText}>Approve</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReportCard = (report: ReportItem) => {
    const typeColor = REPORT_TYPE_COLORS[report.reportType] || Colors.neutral.coolMist;
    const typeIcon = REPORT_TYPE_ICONS[report.reportType] || 'alert-circle-outline';
    const typeLabel = REPORT_TYPE_LABELS[report.reportType] || report.reportType;

    return (
      <View key={report.id} style={styles.card}>
        <View style={styles.reportHeader}>
          <View style={[styles.reportTypeBadge, { backgroundColor: typeColor + '18' }]}>
            <Ionicons name={typeIcon as any} size={14} color={typeColor} />
            <Text style={[styles.reportTypeText, { color: typeColor }]}>
              {typeLabel} Report
            </Text>
          </View>
          <Text style={styles.reportDate}>
            {formatDate(report.createdAt)}
          </Text>
        </View>

        <Text style={styles.reportReason}>{report.reason}</Text>

        {report.freeText && (
          <View style={styles.reportFreeTextBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.neutral.coolMist} />
            <Text style={styles.reportFreeText}>"{report.freeText}"</Text>
          </View>
        )}

        <View style={styles.reportMeta}>
          <View style={styles.reportMetaRow}>
            <Ionicons name="person-outline" size={13} color={Colors.neutral.coolMist} />
            <Text style={styles.reportMetaText}>
              Reported by: {report.reporter?.name || 'Unknown'}
            </Text>
          </View>
          {report.reportedUser && (
            <View style={styles.reportMetaRow}>
              <Ionicons name="alert-circle-outline" size={13} color={'#FF9500'} />
              <Text style={styles.reportMetaText}>
                About: {report.reportedUser.name}
              </Text>
            </View>
          )}
          {report.bubble && (
            <View style={styles.reportMetaRow}>
              <Ionicons name="apps-outline" size={13} color={Colors.brand.bubbleBlue} />
              <Text style={styles.reportMetaText}>
                Bubble: {report.bubble.title}
              </Text>
            </View>
          )}
          <View style={styles.reportMetaRow}>
            <Ionicons name="eye-outline" size={13} color={Colors.neutral.coolMist} />
            <Text style={styles.reportMetaText}>
              Routed to: {report.visibleTo === 'superadmin' ? 'Super Admins' : report.visibleTo === 'bubble_admin' ? 'Bubble Admins' : 'Both'}
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.dismissButton]}
            onPress={() => handleDismissReport(report.id)}
            disabled={actionLoading === report.id}
          >
            {actionLoading === report.id ? (
              <ActivityIndicator size="small" color={Colors.neutral.coolMist} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color={Colors.neutral.coolMist} />
                <Text style={styles.dismissText}>Dismiss</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.resolveButton]}
            onPress={() => handleResolveReport(report.id)}
            disabled={actionLoading === report.id}
          >
            {actionLoading === report.id ? (
              <ActivityIndicator size="small" color="#34C759" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#34C759" />
                <Text style={styles.resolveText}>Resolve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const totalItems = pendingReports.length + pendingEvents.length + pendingBubbles.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Needs Attention</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {totalItems === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color={Colors.neutral.coolMist} />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyText}>No items need attention</Text>
          </View>
        ) : (
          <View style={styles.accordionContainer}>
            {renderAccordionHeader('Pending Concerns', pendingReports.length, Colors.state.error, 'concerns', 'warning', Colors.state.error)}
            {expandedSections.concerns && (
              <View style={styles.accordionContent}>
                {pendingReports.length === 0 ? (
                  <Text style={styles.emptySection}>No pending concerns</Text>
                ) : (
                  pendingReports.map(renderReportCard)
                )}
              </View>
            )}

            {renderAccordionHeader('Pending Event Approval', pendingEvents.length, '#F59E0B', 'events', 'flash', '#F59E0B')}
            {expandedSections.events && (
              <View style={styles.accordionContent}>
                {pendingEvents.length === 0 ? (
                  <Text style={styles.emptySection}>No pending events</Text>
                ) : (
                  pendingEvents.map(renderEventCard)
                )}
              </View>
            )}

            {isSuperAdmin && (
              <>
                {renderAccordionHeader('Pending Bubble Approval', pendingBubbles.length, Colors.neutral.coolMist, 'bubbles', 'checkmark-circle', '#34C759')}
                {expandedSections.bubbles && (
                  <View style={styles.accordionContent}>
                    {pendingBubbles.length === 0 ? (
                      <Text style={styles.emptySection}>No pending bubbles</Text>
                    ) : (
                      pendingBubbles.map(renderBubbleCard)
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.rejectModalOverlay}
        >
          <TouchableOpacity
            style={styles.rejectModalOverlay}
            activeOpacity={1}
            onPress={() => setRejectModalVisible(false)}
          >
            <View style={styles.rejectModalContent}>
              <Text style={styles.rejectModalTitle}>
                Reject {rejectTarget?.type === 'bubble' ? 'Bubble' : 'Event'}
              </Text>
              <Text style={styles.rejectModalSubtitle}>
                Enter a reason for rejection (optional):
              </Text>
              <TextInput
                style={styles.rejectModalInput}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Reason..."
                placeholderTextColor={Colors.neutral.coolMist}
                multiline
                autoFocus
              />
              <View style={styles.rejectModalActions}>
                <TouchableOpacity
                  style={styles.rejectModalCancel}
                  onPress={() => setRejectModalVisible(false)}
                >
                  <Text style={styles.rejectModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectModalConfirm}
                  onPress={handleConfirmReject}
                >
                  <Text style={styles.rejectModalConfirmText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral.cloudGrey,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: Colors.brand.skyWhite,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    marginTop: 8,
  },
  accordionContainer: {
    padding: 16,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.brand.skyWhite,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 2,
    shadowColor: Colors.neutral.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.skyWhite,
  },
  accordionContent: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  emptySection: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    paddingVertical: 20,
  },
  card: {
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.neutral.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardCategory: {
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: Colors.brand.bubbleBlue,
    fontWeight: '500',
  },
  bubbleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  bubbleTagText: {
    fontSize: 12,
    color: Colors.brand.bubbleBlue,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    marginBottom: 12,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  eventMetaText: {
    fontSize: 13,
    color: Colors.neutral.coolMist,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
  },
  rejectText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.state.error,
  },
  approveButton: {
    flex: 1,
  },
  approveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissButton: {
    flex: 1,
    backgroundColor: Colors.neutral.cloudGrey,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.coolMist,
  },
  resolveButton: {
    flex: 1,
    backgroundColor: '#DCFCE7',
  },
  resolveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reportTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reportDate: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
  },
  reportReason: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.neutral.charcoal,
    marginBottom: 8,
  },
  reportFreeTextBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.neutral.cloudGrey,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  reportFreeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.neutral.coolMist,
    fontStyle: 'italic',
  },
  reportMeta: {
    gap: 4,
    marginBottom: 12,
  },
  reportMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportMetaText: {
    fontSize: 12,
    color: Colors.neutral.coolMist,
  },
  rejectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectModalContent: {
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: '85%',
    maxWidth: 340,
  },
  rejectModalTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginBottom: 6,
  },
  rejectModalSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  rejectModalInput: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top' as const,
    marginBottom: Spacing.md,
  },
  rejectModalActions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: Spacing.md,
  },
  rejectModalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  rejectModalCancelText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    fontWeight: '600' as const,
  },
  rejectModalConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: Colors.status.error,
    borderRadius: Radius.md,
  },
  rejectModalConfirmText: {
    fontSize: Typography.sizes.base,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
});
