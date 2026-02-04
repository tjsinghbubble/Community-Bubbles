import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config/api';
import SuccessModal from '../../components/SuccessModal';
import apiService from '../../services/api.service';

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const navigation = useNavigation<any>();
  const [hasAdminItems, setHasAdminItems] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const isSuperAdmin = user?.isSuperAdmin === true;

  useEffect(() => {
    checkAdminItems();
  }, [user]);

  const checkAdminItems = async () => {
    if (!user) return;
    
    try {
      let count = 0;
      
      if (isSuperAdmin) {
        const pendingBubbles = await apiService.getPendingBubbles();
        count += pendingBubbles.length;
      }
      
      const pendingEvents = await apiService.getPendingEvents();
      count += pendingEvents.length;
      
      setPendingCount(count);
      setHasAdminItems(count > 0 || isSuperAdmin);
    } catch (error) {
      setHasAdminItems(isSuperAdmin);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => confirmDeleteAccount()
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        Alert.alert('Error', data.error || 'Failed to delete account');
        return;
      }

      setShowSuccessModal(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="hsl(210, 95%, 55%)" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isSuperAdmin ? 'Admin' : 'Profile'}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.interestsContainer}>
            {user.interests && user.interests.length > 0 ? (
              user.interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noInterests}>No interests selected</Text>
            )}
          </View>
        </View>

        {hasAdminItems && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Administration</Text>
            
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => navigation.navigate('PendingReviews')}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="time-outline" size={24} color="#333" />
                <Text style={styles.menuItemText}>Pending Reviews</Text>
                {pendingCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingCount}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={24} color="#333" />
              <Text style={styles.menuItemText}>Log Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, styles.deleteItem]} 
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            <View style={styles.menuItemLeft}>
              {deleting ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              )}
              <Text style={styles.deleteText}>Delete Account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SuccessModal
        visible={showSuccessModal}
        title="Account Deleted"
        subtitle="Your account has been successfully deleted"
        onClose={async () => {
          setShowSuccessModal(false);
          await logout();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'hsl(210, 95%, 55%)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  interestText: {
    color: 'hsl(210, 95%, 45%)',
    fontSize: 14,
    fontWeight: '500',
  },
  noInterests: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  deleteItem: {
    borderBottomWidth: 0,
  },
  deleteText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  badge: {
    backgroundColor: 'hsl(210, 95%, 55%)',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
