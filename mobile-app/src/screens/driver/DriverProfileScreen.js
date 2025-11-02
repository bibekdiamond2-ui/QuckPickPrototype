/**
 * Driver Profile Screen
 * Driver-specific profile management and verification status
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '../../context/AuthContext';
import {useNavigation} from '@react-navigation/native';

const {width} = Dimensions.get('window');

const DriverProfileScreen = () => {
  const {user} = useAuth();
  const navigation = useNavigation();

  // Mock driver data
  const [driverData, setDriverData] = useState({
    verificationStatus: 'approved',
    documentsSubmitted: true,
    verifiedAt: new Date('2024-01-01'),
    vehicleInfo: {
      make: 'Maruti Suzuki',
      model: 'Swift',
      year: 2020,
      color: 'White',
      licensePlate: 'DL 01 AB 1234',
      insuranceExpiry: '2024-12-31',
      registrationExpiry: '2025-01-15',
    },
    statistics: {
      totalTrips: 156,
      averageRating: 4.8,
      acceptanceRate: 85,
      completionRate: 98,
      onlineHours: 124,
      totalEarnings: 45230,
    },
    documents: {
      driverLicense: { uploaded: true, verified: true, expiryDate: '2025-06-30' },
      vehicleRegistration: { uploaded: true, verified: true, expiryDate: '2025-01-15' },
      insurance: { uploaded: true, verified: true, expiryDate: '2024-12-31' },
      pollutionCertificate: { uploaded: true, verified: true, expiryDate: '2024-06-30' },
    },
    bankAccount: {
      accountNumber: 'XXXXXX1234',
      bankName: 'State Bank of India',
      ifsc: 'SBIN0001234',
    },
  });

  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { key: 'profile', label: 'Profile', icon: 'account' },
    { key: 'vehicle', label: 'Vehicle', icon: 'car' },
    { key: 'documents', label: 'Documents', icon: 'file-document' },
    { key: 'statistics', label: 'Statistics', icon: 'chart-line' },
  ];

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'Profile editing feature coming soon!');
  };

  const handleUploadDocument = (documentType) => {
    Alert.alert('Upload Document', `Upload ${documentType} document feature coming soon!`);
  };

  const handleUpdateVehicle = () => {
    Alert.alert('Update Vehicle', 'Vehicle information update feature coming soon!');
  };

  const handleUpdateBankAccount = () => {
    Alert.alert('Update Bank Account', 'Bank account update feature coming soon!');
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'How would you like to contact support?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => Linking.openURL('tel:1800-123-4567'),
        },
        {
          text: 'Email',
          onPress: () => Linking.openURL('mailto:support@quickpickup.com'),
        },
      ]
    );
  };

  const handleBecomeDriver = () => {
    Alert.alert(
      'Become a Driver',
      'To become a driver, you need to complete the verification process. Our team will contact you within 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Verification',
          onPress: () => Alert.alert('Success', 'Verification process initiated!'),
        },
      ]
    );
  };

  const renderVerificationStatus = () => {
    const statusConfig = {
      pending: { color: '#FF9800', icon: 'clock', text: 'Pending' },
      approved: { color: '#4CAF50', icon: 'check-circle', text: 'Approved' },
      rejected: { color: '#F44336', icon: 'close-circle', text: 'Rejected' },
    };

    const status = statusConfig[driverData.verificationStatus] || statusConfig.pending;

    return (
      <View style={styles.verificationStatus}>
        <View style={styles.statusHeader}>
          <Icon name={status.icon} size={24} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.text}
          </Text>
        </View>
        <Text style={styles.statusDescription}>
          {driverData.verificationStatus === 'approved'
            ? 'Your driver account is verified and active'
            : driverData.verificationStatus === 'pending'
            ? 'Your documents are under review'
            : 'Your verification was rejected. Please reapply.'}
        </Text>
        {driverData.verifiedAt && (
          <Text style={styles.verifiedDate}>
            Verified on {driverData.verifiedAt.toLocaleDateString()}
          </Text>
        )}
      </View>
    );
  };

  const renderProfileTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name</Text>
          <Text style={styles.infoValue}>{user?.name || 'Driver Name'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{user?.phoneNumber || '+91 XXXXX XXXXX'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email || 'driver@example.com'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Member Since</Text>
          <Text style={styles.infoValue}>January 2024</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Bank Account</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Account</Text>
          <Text style={styles.infoValue}>{driverData.bankAccount.accountNumber}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Bank</Text>
          <Text style={styles.infoValue}>{driverData.bankAccount.bankName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>IFSC</Text>
          <Text style={styles.infoValue}>{driverData.bankAccount.ifsc}</Text>
        </View>
        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdateBankAccount}
        >
          <Icon name="bank" size={20} color="#FF6B35" />
          <Text style={styles.updateButtonText}>Update Bank Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderVehicleTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Vehicle Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Make</Text>
          <Text style={styles.infoValue}>{driverData.vehicleInfo.make}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Model</Text>
          <Text style={styles.infoValue}>{driverData.vehicleInfo.model}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Year</Text>
          <Text style={styles.infoValue}>{driverData.vehicleInfo.year}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Color</Text>
          <Text style={styles.infoValue}>{driverData.vehicleInfo.color}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>License Plate</Text>
          <Text style={styles.infoValue}>{driverData.vehicleInfo.licensePlate}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Insurance Valid Until</Text>
          <Text style={styles.infoValue}>{driverData.vehicleInfo.insuranceExpiry}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Registration Valid Until</Text>
          <Text style={styles.infoValue}>{driverData.vehicleInfo.registrationExpiry}</Text>
        </View>
        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdateVehicle}
        >
          <Icon name="car" size={20} color="#FF6B35" />
          <Text style={styles.updateButtonText}>Update Vehicle Info</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDocumentsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Required Documents</Text>
        {Object.entries(driverData.documents).map(([docType, docInfo]) => (
          <View key={docType} style={styles.documentItem}>
            <View style={styles.documentHeader}>
              <View style={styles.documentLeft}>
                <Icon
                  name="file-document"
                  size={24}
                  color={docInfo.verified ? '#4CAF50' : '#FF9800'}
                />
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName}>
                    {docType.replace(/([A-Z])/g, ' $1').trim()}
                  </Text>
                  <Text style={styles.documentExpiry}>
                    Expires: {docInfo.expiryDate}
                  </Text>
                </View>
              </View>
              <View style={[
                styles.documentStatus,
                docInfo.verified ? styles.statusVerified : styles.statusPending
              ]}>
                <Icon
                  name={docInfo.verified ? 'check' : 'clock'}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.documentStatusText}>
                  {docInfo.verified ? 'Verified' : 'Pending'}
                </Text>
              </View>
            </View>
            {!docInfo.verified && (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => handleUploadDocument(docType)}
              >
                <Icon name="upload" size={16} color="#FF6B35" />
                <Text style={styles.uploadButtonText}>Upload Document</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  const renderStatisticsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Icon name="car" size={32} color="#FF6B35" />
          <Text style={styles.statValue}>{driverData.statistics.totalTrips}</Text>
          <Text style={styles.statLabel}>Total Trips</Text>
        </View>

        <View style={styles.statCard}>
          <Icon name="star" size={32} color="#FFD700" />
          <Text style={styles.statValue}>{driverData.statistics.averageRating}</Text>
          <Text style={styles.statLabel}>Average Rating</Text>
        </View>

        <View style={styles.statCard}>
          <Icon name="check-circle" size={32} color="#4CAF50" />
          <Text style={styles.statValue}>{driverData.statistics.acceptanceRate}%</Text>
          <Text style={styles.statLabel}>Acceptance Rate</Text>
        </View>

        <View style={styles.statCard}>
          <Icon name="flag-checkered" size={32} color="#9C27B0" />
          <Text style={styles.statValue}>{driverData.statistics.completionRate}%</Text>
          <Text style={styles.statLabel}>Completion Rate</Text>
        </View>

        <View style={styles.statCard}>
          <Icon name="clock" size={32} color="#2196F3" />
          <Text style={styles.statValue}>{driverData.statistics.onlineHours}h</Text>
          <Text style={styles.statLabel}>Online Hours</Text>
        </View>

        <View style={styles.statCard}>
          <Icon name="currency-inr" size={32} color="#4CAF50" />
          <Text style={styles.statValue}>₹{driverData.statistics.totalEarnings.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </View>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'vehicle':
        return renderVehicleTab();
      case 'documents':
        return renderDocumentsTab();
      case 'statistics':
        return renderStatisticsTab();
      default:
        return renderProfileTab();
    }
  };

  // Check if user is a driver or wants to become one
  const isDriver = user?.role === 'driver';

  if (!isDriver) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Driver Profile</Text>
        </View>

        <View style={styles.becomeDriverContainer}>
          <Icon name="car" size={80} color="#CCCCCC" />
          <Text style={styles.becomeDriverTitle}>Become a Driver</Text>
          <Text style={styles.becomeDriverDescription}>
            Start earning with Quick Pickup by becoming a driver. Complete our simple verification process to get started.
          </Text>
          <TouchableOpacity
            style={styles.becomeDriverButton}
            onPress={handleBecomeDriver}
          >
            <Icon name="car" size={20} color="#FFFFFF" />
            <Text style={styles.becomeDriverButtonText}>Become a Driver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Driver Profile</Text>
        <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
          <Icon name="pencil" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Verification Status */}
      {renderVerificationStatus()}

      {/* Profile Picture */}
      <View style={styles.profilePictureContainer}>
        <View style={styles.profilePicture}>
          <Icon name="account" size={60} color="#FFFFFF" />
        </View>
        <TouchableOpacity style={styles.changePhotoButton}>
          <Icon name="camera" size={20} color="#FF6B35" />
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.activeTab,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon
                name={tab.icon}
                size={20}
                color={activeTab === tab.key ? '#FFFFFF' : '#666666'}
              />
              <Text style={[
                styles.tabText,
                activeTab === tab.key && styles.activeTabText,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.tabContentContainer} showsVerticalScrollIndicator={false}>
        {renderTabContent()}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Support Button */}
      <TouchableOpacity style={styles.supportButton} onPress={handleContactSupport}>
        <Icon name="headset" size={20} color="#FFFFFF" />
        <Text style={styles.supportButtonText}>Contact Support</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF6B35',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationStatus: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusDescription: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 32,
    flex: 1,
  },
  verifiedDate: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 32,
    marginTop: 4,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  changePhotoText: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
  },
  tabContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#FF6B35',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabContentContainer: {
    flex: 1,
    padding: 16,
  },
  tabContent: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666666',
  },
  infoValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F5',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
    gap: 8,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
  },
  documentItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  documentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 2,
  },
  documentExpiry: {
    fontSize: 12,
    color: '#666666',
  },
  documentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusVerified: {
    backgroundColor: '#4CAF50',
  },
  statusPending: {
    backgroundColor: '#FF9800',
  },
  documentStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F5',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    alignSelf: 'flex-start',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: (width - 48) / 2 - 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  supportButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 80,
  },
  becomeDriverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  becomeDriverTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 20,
    marginBottom: 12,
  },
  becomeDriverDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  becomeDriverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  becomeDriverButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default DriverProfileScreen;