import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
  Dimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../styles/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface ShareQRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  bubbleName: string;
  shareUrl: string;
}

export default function ShareQRCodeModal({
  visible,
  onClose,
  bubbleName,
  shareUrl,
}: ShareQRCodeModalProps) {
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out "${bubbleName}" on Bubble!\n${shareUrl}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handle} />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            data-testid="button-close-qr-modal"
          >
            <Ionicons name="close" size={24} color={Colors.text.primary} />
          </TouchableOpacity>

          <Text style={styles.title} data-testid="text-qr-title">Share Bubble</Text>
          <Text style={styles.bubbleName} data-testid="text-qr-bubble-name">{bubbleName}</Text>

          <View style={styles.qrContainer} data-testid="qr-code-container">
            <QRCode
              value={shareUrl}
              size={200}
              color={Colors.brand.midnight}
              backgroundColor={Colors.background.primary}
            />
          </View>

          <Text style={styles.urlText} data-testid="text-share-url" numberOfLines={2}>
            {shareUrl}
          </Text>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            data-testid="button-share-from-qr"
          >
            <Ionicons name="share-outline" size={20} color={Colors.background.primary} />
            <Text style={styles.shareButtonText}>Share Link</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: Spacing.huge,
    alignItems: 'center',
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.neutral.lightSilver,
    borderRadius: 2,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
    zIndex: 1,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  bubbleName: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    marginBottom: Spacing.xxl,
  },
  qrContainer: {
    padding: Spacing.xl,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  urlText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: Radius.full,
    gap: Spacing.sm,
  },
  shareButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    color: Colors.background.primary,
  },
});
