/**
 * Driver Earnings Screen
 * Driver earnings analytics and payment history
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '../../context/AuthContext';

const {width} = Dimensions.get('window');

const EarningsScreen = () => {
  const {user} = useAuth();

  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [earningsData, setEarningsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Period options
  const periodOptions = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
  ];

  // Mock earnings data
  const mockEarningsData = {
    today: {
      totalEarnings: 1250,
      rides: 8,
      deliveries: 3,
      onlineHours: 4.5,
      averagePerHour: 278,
      breakdown: {
        rides: 950,
        deliveries: 300,
        bonus: 0,
      },
      chart: [
        { hour: '6AM', earnings: 0 },
        { hour: '7AM', earnings: 150 },
        { hour: '8AM', earnings: 200 },
        { hour: '9AM', earnings: 180 },
        { hour: '10AM', earnings: 120 },
        { hour: '11AM', earnings: 250 },
        { hour: '12PM', earnings: 180 },
        { hour: '1PM', earnings: 170 },
      ],
    },
    week: {
      totalEarnings: 8500,
      rides: 52,
      deliveries: 18,
      onlineHours: 32,
      averagePerHour: 266,
      breakdown: {
        rides: 6200,
        deliveries: 1800,
        bonus: 500,
      },
      chart: [
        { day: 'Mon', earnings: 1200 },
        { day: 'Tue', earnings: 1500 },
        { day: 'Wed', earnings: 1100 },
        { day: 'Thu', earnings: 1400 },
        { day: 'Fri', earnings: 1800 },
        { day: 'Sat', earnings: 1000 },
        { day: 'Sun', earnings: 500 },
      ],
    },
    month: {
      totalEarnings: 32000,
      rides: 198,
      deliveries: 67,
      onlineHours: 124,
      averagePerHour: 258,
      breakdown: {
        rides: 24000,
        deliveries: 6000,
        bonus: 2000,
      },
      chart: [
        { week: 'Week 1', earnings: 8500 },
        { week: 'Week 2', earnings: 9200 },
        { week: 'Week 3', earnings: 7800 },
        { week: 'Week 4', earnings: 6500 },
      ],
    },
    year: {
      totalEarnings: 384000,
      rides: 2376,
      deliveries: 804,
      onlineHours: 1488,
      averagePerHour: 258,
      breakdown: {
        rides: 288000,
        deliveries: 72000,
        bonus: 24000,
      },
      chart: [
        { month: 'Jan', earnings: 28000 },
        { month: 'Feb', earnings: 32000 },
        { month: 'Mar', earnings: 35000 },
        { month: 'Apr', earnings: 31000 },
        { month: 'May', earnings: 33000 },
        { month: 'Jun', earnings: 29000 },
      ],
    },
  };

  // Mock payment history
  const mockPaymentHistory = [
    {
      id: 'p1',
      date: '2024-01-15',
      amount: 2850,
      type: 'ride',
      status: 'completed',
      description: '5 rides • Delhi',
    },
    {
      id: 'p2',
      date: '2024-01-15',
      amount: 450,
      type: 'delivery',
      status: 'completed',
      description: '2 deliveries • Delhi',
    },
    {
      id: 'p3',
      date: '2024-01-14',
      amount: 3200,
      type: 'ride',
      status: 'completed',
      description: '6 rides • Delhi NCR',
    },
    {
      id: 'p4',
      date: '2024-01-14',
      amount: 600,
      type: 'delivery',
      status: 'completed',
      description: '3 deliveries • Delhi',
    },
    {
      id: 'p5',
      date: '2024-01-13',
      amount: 200,
      type: 'bonus',
      status: 'completed',
      description: 'Peak hour bonus',
    },
  ];

  useEffect(() => {
    loadEarningsData();
  }, [selectedPeriod]);

  const loadEarningsData = () => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setEarningsData(mockEarningsData[selectedPeriod]);
      setIsLoading(false);
    }, 1000);
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
  };

  const handleWithdrawEarnings = () => {
    Alert.alert(
      'Withdraw Earnings',
      'Your earnings will be transferred to your registered bank account within 2-3 business days.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Withdraw',
          onPress: () => {
            Alert.alert('Success', 'Withdrawal request submitted successfully!');
          },
        },
      ]
    );
  };

  const renderEarningsOverview = () => {
    if (!earningsData) return null;

    return (
      <View style={styles.earningsOverview}>
        <View style={styles.totalEarningsCard}>
          <Text style={styles.earningsLabel}>Total Earnings</Text>
          <Text style={styles.totalEarningsAmount}>₹{earningsData.totalEarnings.toLocaleString()}</Text>
          <Text style={styles.earningsPeriod}>{periodOptions.find(p => p.key === selectedPeriod)?.label}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Icon name="car" size={24} color="#FF6B35" />
            <Text style={styles.statValue}>{earningsData.rides}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>

          <View style={styles.statCard}>
            <Icon name="package-variant" size={24} color="#4CAF50" />
            <Text style={styles.statValue}>{earningsData.deliveries}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>

          <View style={styles.statCard}>
            <Icon name="clock" size={24} color="#2196F3" />
            <Text style={styles.statValue}>{earningsData.onlineHours}h</Text>
            <Text style={styles.statLabel}>Online</Text>
          </View>

          <View style={styles.statCard}>
            <Icon name="currency-inr" size={24} color="#9C27B0" />
            <Text style={styles.statValue}>₹{earningsData.averagePerHour}</Text>
            <Text style={styles.statLabel}>Per Hour</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEarningsBreakdown = () => {
    if (!earningsData) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Earnings Breakdown</Text>
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownItem}>
            <View style={styles.breakdownLeft}>
              <View style={[styles.breakdownIcon, {backgroundColor: '#FFF8F5'}]}>
                <Icon name="car" size={20} color="#FF6B35" />
              </View>
              <Text style={styles.breakdownLabel}>Ride Earnings</Text>
            </View>
            <Text style={styles.breakdownAmount}>₹{earningsData.breakdown.rides.toLocaleString()}</Text>
          </View>

          <View style={styles.breakdownItem}>
            <View style={styles.breakdownLeft}>
              <View style={[styles.breakdownIcon, {backgroundColor: '#F1F8E9'}]}>
                <Icon name="package-variant" size={20} color="#4CAF50" />
              </View>
              <Text style={styles.breakdownLabel}>Delivery Earnings</Text>
            </View>
            <Text style={styles.breakdownAmount}>₹{earningsData.breakdown.deliveries.toLocaleString()}</Text>
          </View>

          {earningsData.breakdown.bonus > 0 && (
            <View style={styles.breakdownItem}>
              <View style={styles.breakdownLeft}>
                <View style={[styles.breakdownIcon, {backgroundColor: '#F3E5F5'}]}>
                  <Icon name="star" size={20} color="#9C27B0" />
                </View>
                <Text style={styles.breakdownLabel}>Bonus & Incentives</Text>
              </View>
              <Text style={styles.breakdownAmount}>₹{earningsData.breakdown.bonus.toLocaleString()}</Text>
            </View>
          )}

          <View style={[styles.breakdownItem, styles.breakdownTotal]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>₹{earningsData.totalEarnings.toLocaleString()}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderChart = () => {
    if (!earningsData || !earningsData.chart) return null;

    const maxValue = Math.max(...earningsData.chart.map(item =>
      typeof item.earnings === 'number' ? item.earnings : 0
    ));

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Earnings Trend</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBars}>
            {earningsData.chart.map((item, index) => {
              const label = item.hour || item.day || item.week || item.month;
              const value = typeof item.earnings === 'number' ? item.earnings : 0;
              const height = maxValue > 0 ? (value / maxValue) * 120 : 0;

              return (
                <View key={index} style={styles.chartBarContainer}>
                  <View style={styles.chartBar}>
                    <View
                      style={[
                        styles.chartBarFill,
                        {
                          height: height,
                          backgroundColor: '#FF6B35',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>{label}</Text>
                  <Text style={styles.chartValue}>₹{value}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderPaymentHistory = () => {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          <TouchableOpacity style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
            <Icon name="chevron-right" size={16} color="#FF6B35" />
          </TouchableOpacity>
        </View>

        <View style={styles.paymentList}>
          {mockPaymentHistory.slice(0, 5).map((payment) => (
            <View key={payment.id} style={styles.paymentItem}>
              <View style={styles.paymentLeft}>
                <View style={[
                  styles.paymentIcon,
                  payment.type === 'ride' && {backgroundColor: '#FFF8F5'},
                  payment.type === 'delivery' && {backgroundColor: '#F1F8E9'},
                  payment.type === 'bonus' && {backgroundColor: '#F3E5F5'},
                ]}>
                  <Icon
                    name={
                      payment.type === 'ride' ? 'car' :
                      payment.type === 'delivery' ? 'package-variant' : 'star'
                    }
                    size={20}
                    color={
                      payment.type === 'ride' ? '#FF6B35' :
                      payment.type === 'delivery' ? '#4CAF50' : '#9C27B0'
                    }
                  />
                </View>
                <View style={styles.paymentDetails}>
                  <Text style={styles.paymentDescription}>{payment.description}</Text>
                  <Text style={styles.paymentDate}>{payment.date}</Text>
                </View>
              </View>
              <View style={styles.paymentRight}>
                <Text style={styles.paymentAmount}>+₹{payment.amount.toLocaleString()}</Text>
                <View style={[
                  styles.paymentStatus,
                  payment.status === 'completed' && styles.statusCompleted
                ]}>
                  <Text style={styles.statusText}>{payment.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Earnings</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleWithdrawEarnings}>
          <Icon name="bank-transfer" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {periodOptions.map((period) => (
            <TouchableOpacity
              key={period.key}
              style={[
                styles.periodButton,
                selectedPeriod === period.key && styles.periodButtonActive,
              ]}
              onPress={() => handlePeriodChange(period.key)}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === period.key && styles.periodButtonTextActive,
              ]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading earnings data...</Text>
          </View>
        ) : (
          <>
            {renderEarningsOverview()}
            {renderEarningsBreakdown()}
            {renderChart()}
            {renderPaymentHistory()}
            <View style={styles.bottomSpacer} />
          </>
        )}
      </ScrollView>
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
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodSelector: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F5F5F5',
  },
  periodButtonActive: {
    backgroundColor: '#FF6B35',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
  earningsOverview: {
    marginBottom: 24,
  },
  totalEarningsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  earningsLabel: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  totalEarningsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  earningsPeriod: {
    fontSize: 14,
    color: '#999999',
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
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  breakdownTotal: {
    borderBottomWidth: 0,
    paddingTop: 16,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  breakdownAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 160,
    paddingHorizontal: 8,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  chartBar: {
    flex: 1,
    width: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBarFill: {
    width: 16,
    borderRadius: 8,
  },
  chartLabel: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
  },
  chartValue: {
    fontSize: 10,
    color: '#333333',
    fontWeight: '600',
  },
  paymentList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentDetails: {
    flex: 1,
  },
  paymentDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 2,
  },
  paymentDate: {
    fontSize: 12,
    color: '#999999',
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  paymentStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: '#E8F5E8',
  },
  statusText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 20,
  },
});

export default EarningsScreen;