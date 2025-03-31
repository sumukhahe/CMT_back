import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  Alert,
  Image,
  TouchableWithoutFeedback,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, RelativePathString } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import BlogPostsScreen from "./allposts";
import { useRouter } from "expo-router";
import config from "../config";

const { width } = Dimensions.get("window");

// Define your BASE_URL – ensure this matches your server accessible from your device.
const BASE_URL = config.apiUrl;

// Helper function to return the full image URL.
const getFullImageUrl = (imagePath: string): string => {
  return imagePath?.startsWith("http") ? imagePath : `${BASE_URL}${imagePath}`;
};

// Interface for comment notifications
interface CommentNotification {
  id: number;
  comment_text: string;
  created_at: string;
  post_id: number;
  user_id: number;
  username: string;
  profile_image: string;
  post_name: string;
  post_image: string;
  is_read: boolean;
}

// Create animated circle component
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const QUICK_ACTIONS = [
  {
    icon: "add-circle-outline",
    label: "Add\nPosts",
    route: "/posts/add",
    color: "#2E7D32",
    gradient: ["#4CAF50", "#2E7D32"] as const,
  },
  {
    icon: "calendar-outline",
    label: "Calender\nView",
    route: "/calendar",
    color: "#1976D2",
    gradient: ["#2196F3", "#1976D2"] as const,
  },
  {
    icon: "newspaper-outline",
    label: "All\nPosts",
    route: "/allposts",
    color: "#C2185B",
    gradient: ["#E91E63", "#C2185B"] as const,
  },
  {
    icon: "settings-outline",
    label: "Account\n& Settings",
    route: "/account",
    color: "#E64A19",
    gradient: ["#FF5722", "#E64A19"] as const,
  },
] as const;

interface CircularProgressProps {
  increase: number; // Fraction increase from previous month (e.g., 0.5 means 50% increase)
  totalVisits: number;
}

function CircularProgress({ increase, totalVisits }: CircularProgressProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const size = width * 0.55;
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: increase,
      duration: 1500,
      useNativeDriver: true,
    }).start();
  }, [increase]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTextContainer}>
        <Text style={styles.progressPercentage}>
          {Math.round(increase * 100)}%
        </Text>
        <Text style={styles.progressDetails}>Total Visits: {totalVisits}</Text>
      </View>
      <Svg width={size} height={size} style={styles.progressRing}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="white"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}

// Helper function to format view count for display.
const formatViewCount = (views: number): string => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

// Helper function to get color based on view count.
const getViewColor = (views: number): string => {
  if (views >= 1000) return "#4CAF50"; // Green for high traffic
  if (views >= 500) return "#2196F3"; // Blue for medium traffic
  if (views >= 100) return "#FF9800"; // Orange for moderate traffic
  return "#F44336"; // Red for low traffic
};

// Helper function to format time
const formatTime = (dateString: string): string => {
  if (!dateString) return "Recently";

  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60)
    return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
  if (diffHours < 24)
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;

  return date.toLocaleDateString();
};

export default function HomeScreen() {
  const router = useRouter();
  // State for popular posts.
  const [popularPosts, setPopularPosts] = useState<any[]>([]);

  // State for total visit stats.
  const [totalVisits, setTotalVisits] = useState(0);
  const [previousMonthVisits, setPreviousMonthVisits] = useState(0);
  const [visitsIncrease, setVisitsIncrease] = useState(0.1); // Default 10% increase

  // State for notifications.
  const [showNotifications, setShowNotifications] = useState(false);
  const [commentNotifications, setCommentNotifications] = useState<
    CommentNotification[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch popular posts from the server.
  useEffect(() => {
    fetch(`${BASE_URL}/api/popular-posts`)
      .then((response) => response.json())
      .then((data) => {
        console.log("Popular posts data:", data); // Log for debugging
        setPopularPosts(data);

        // Calculate total visits.
        const total = data.reduce(
          (sum: number, post: any) => sum + (post.visits || 0),
          0
        );
        setTotalVisits(total);

        // Set a fixed value for previous month visits.
        const prevMonth = 4250; // Fixed value for previous month visits.
        setPreviousMonthVisits(prevMonth);

        // Calculate percentage for progress circle.
        if (prevMonth > 0) {
          if (total >= prevMonth) {
            const increase = (total - prevMonth) / prevMonth;
            setVisitsIncrease(increase);
          } else {
            const percentOfLastMonth = total / prevMonth;
            setVisitsIncrease(percentOfLastMonth);
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching popular posts:", err);
      });
  }, []);

  // Fetch comment notifications for the admin panel
  const fetchCommentNotifications = () => {
    fetch(`${BASE_URL}/api/admin/comment-notifications?unread=true`)
      .then((response) => response.json())
      .then((data) => {
        console.log("Comment notifications:", data);
        setCommentNotifications(data);

        // Set unread count to the number of notifications
        setUnreadCount(data.length);
      })
      .catch((err) => {
        console.error("Error fetching comment notifications:", err);
      })
      .finally(() => {
        setRefreshing(false);
      });
  };

  // Fetch comment notifications on component mount and periodically
  useEffect(() => {
    fetchCommentNotifications();

    // Set up interval to fetch notifications every 30 seconds
    const intervalId = setInterval(fetchCommentNotifications, 30000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Mark a comment notification as read
  const markCommentAsRead = (commentId: number) => {
    fetch(`${BASE_URL}/api/admin/mark-comment-read/${commentId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then(() => {
        // Remove this notification from the list
        setCommentNotifications((prev) =>
          prev.filter((comment) => comment.id !== commentId)
        );

        // Decrement unread count
        setUnreadCount((prev) => Math.max(0, prev - 1));
      })
      .catch((err) => {
        console.error(`Error marking comment ${commentId} as read:`, err);
      });
  };

  // Mark all comment notifications as read
  const markAllAsRead = () => {
    fetch(`${BASE_URL}/api/admin/mark-all-comments-read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then(() => {
        // Clear all notifications
        setCommentNotifications([]);

        // Reset unread count
        setUnreadCount(0);
      })
      .catch((err) => {
        console.error("Error marking all comments as read:", err);
      });
  };

  // Handle opening notifications
  const handleOpenNotifications = () => {
    setShowNotifications(true);
  };

  // Pull to refresh notifications
  const onRefresh = () => {
    setRefreshing(true);
    fetchCommentNotifications();
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={["#1a8e2d", "#146922"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.flex1}>
              <Text style={styles.greeting}>Monthly Visits</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={handleOpenNotifications}
            >
              <Ionicons name="notifications-outline" size={24} color="white" />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationCount}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <CircularProgress
            increase={visitsIncrease}
            totalVisits={totalVisits}
          />
          {previousMonthVisits > 0 && (
            <View style={styles.comparisonContainer}>
              <Text style={styles.comparisonText}>
                {totalVisits >= previousMonthVisits
                  ? `+${Math.round(
                      ((totalVisits - previousMonthVisits) /
                        previousMonthVisits) *
                        100
                    )}% from last month (${previousMonthVisits} visits)`
                  : `${Math.round(
                      (totalVisits / previousMonthVisits) * 100
                    )}% of last month (${previousMonthVisits} visits)`}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Link
                href={action.route as unknown as RelativePathString}
                key={action.label}
                asChild
              >
                <TouchableOpacity style={styles.actionButton}>
                  <LinearGradient
                    colors={action.gradient}
                    style={styles.actionGradient}
                  >
                    <View style={styles.actionContent}>
                      <View style={styles.actionIcon}>
                        <Ionicons name={action.icon} size={28} color="white" />
                      </View>
                      <Text style={styles.actionLabel}>{action.label}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Posts</Text>
            {popularPosts.length > 0 && (
              <Link href="/allposts" asChild>
                <TouchableOpacity>
                  <Text style={styles.seeAllButton}>See All</Text>
                </TouchableOpacity>
              </Link>
            )}
          </View>
          {popularPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <Image
                source={{ uri: "https://via.placeholder.com/50" }}
                style={styles.postImage}
              />
              <Text style={styles.emptyStateText}>
                No popular posts available
              </Text>
              <Link href="/posts/add" asChild>
                <TouchableOpacity style={styles.addPostButton}>
                  <Text style={styles.addPostButtonText}>Add Post</Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            popularPosts.map((post) => (
              // Updated this Link to use the correct route
              <TouchableOpacity
                key={post.id}
                onPress={() => router.push(`/${post.id}`)}
              >
                <View style={styles.postCard}>
                  <View
                    style={[
                      styles.postBadge,
                      {
                        backgroundColor: `${getViewColor(post.visits || 0)}15`,
                      },
                    ]}
                  >
                    <Image
                      source={{
                        uri: getFullImageUrl(
                          post.imageUrl || "https://via.placeholder.com/50"
                        ),
                      }}
                      style={styles.postImage}
                    />
                  </View>
                  <View style={styles.postInfo}>
                    <View>
                      <Text style={styles.postTitle}>{post.title}</Text>
                      <Text style={styles.postExcerpt}>
                        {post.excerpt && post.excerpt.length > 30
                          ? post.excerpt.substring(0, 30) + "..."
                          : post.excerpt}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.visitsBadge,
                      { backgroundColor: getViewColor(post.visits || 0) },
                    ]}
                  >
                    <Ionicons name="eye" size={20} color="white" />
                    <Text style={styles.visitsText}>
                      {formatViewCount(post.visits || 0)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Comment Notifications Modal */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotifications(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowNotifications(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Comment Notifications</Text>
                  <View style={styles.modalActions}>
                    {unreadCount > 0 && (
                      <TouchableOpacity
                        onPress={markAllAsRead}
                        style={styles.markAllReadButton}
                      >
                        <Text style={styles.markAllReadText}>
                          Mark all as read
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setShowNotifications(false)}
                      style={styles.closeButton}
                    >
                      <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                  </View>
                </View>

                {commentNotifications.length === 0 ? (
                  <View style={styles.emptyNotifications}>
                    <Ionicons
                      name="chatbubbles-outline"
                      size={50}
                      color="#ddd"
                    />
                    <Text style={styles.emptyNotificationsText}>
                      No comments yet
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.notificationsList}
                    refreshControl={
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={["#1a8e2d"]}
                      />
                    }
                  >
                    {commentNotifications.map((comment) => (
                      <TouchableOpacity
                        key={comment.id}
                        style={[
                          styles.notificationItem,
                          comment.is_read
                            ? styles.readNotification
                            : styles.unreadNotification,
                        ]}
                        onPress={() => {
                          router.push(`/${comment.post_id}`);
                        }}
                      >
                        <View style={styles.notificationIcon}>
                          {comment.profile_image ? (
                            <Image
                              source={{
                                uri: getFullImageUrl(comment.profile_image),
                              }}
                              style={styles.notificationImage}
                            />
                          ) : (
                            <Ionicons
                              name="person-circle-outline"
                              size={28}
                              color="#666"
                            />
                          )}
                        </View>

                        <View style={styles.notificationContent}>
                          <Text style={styles.notificationTitle}>
                            <Text style={styles.boldText}>
                              {comment.username}
                            </Text>{" "}
                            commented on{" "}
                            <Text style={styles.boldText}>
                              {comment.post_name}
                            </Text>
                          </Text>

                          <Text
                            style={styles.notificationMessage}
                            numberOfLines={2}
                          >
                            "{comment.comment_text}"
                          </Text>

                          <View style={styles.notificationFooter}>
                            <Text style={styles.notificationTime}>
                              {formatTime(comment.created_at)}
                            </Text>

                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                markCommentAsRead(comment.id);
                              }}
                              style={styles.readButton}
                            >
                              <Text style={styles.readButtonText}>
                                Mark as read
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  header: {
    paddingTop: 50,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: { alignItems: "center", paddingHorizontal: 20 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  greeting: { fontSize: 18, fontWeight: "600", color: "white", opacity: 0.9 },
  comparisonContainer: {
    marginTop: 5,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
  },
  comparisonText: {
    color: "white",
    fontSize: 12,
  },
  content: { flex: 1, paddingTop: 20 },
  quickActionsContainer: { paddingHorizontal: 20, marginBottom: 25 },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 15,
  },
  actionButton: {
    width: (width - 52) / 2,
    height: 110,
    borderRadius: 16,
    overflow: "hidden",
  },
  actionGradient: { flex: 1, padding: 15 },
  actionContent: { flex: 1, justifyContent: "space-between" },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
    marginTop: 8,
  },
  section: { paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 5,
  },
  seeAllButton: { color: "#2E7D32", fontWeight: "600" },
  postCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  postBadge: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  postImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    resizeMode: "cover",
  },
  postInfo: { flex: 1, justifyContent: "space-between" },
  postTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  postExcerpt: { fontSize: 14, color: "#666", marginBottom: 4 },
  postTime: { flexDirection: "row", alignItems: "center" },
  timeText: { marginLeft: 5, color: "#666", fontSize: 14 },
  visitsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  visitsText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },
  progressContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  progressTextContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  progressPercentage: { fontSize: 36, fontWeight: "bold", color: "white" },
  progressDetails: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  progressRing: { transform: [{ rotate: "-90deg" }] },
  flex1: { flex: 1 },

  // Notification styles
  notificationButton: {
    position: "relative",
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    marginLeft: 8,
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF5252",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#146922",
    paddingHorizontal: 4,
  },
  notificationCount: { color: "white", fontSize: 11, fontWeight: "bold" },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  markAllReadButton: {
    marginRight: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#E8F5E9",
    borderRadius: 6,
  },
  markAllReadText: {
    color: "#2E7D32",
    fontSize: 12,
    fontWeight: "500",
  },
  closeButton: { padding: 5 },

  // Notification list styles
  notificationsList: {
    maxHeight: 500,
  },
  notificationItem: {
    flexDirection: "row",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  readNotification: {
    backgroundColor: "#f5f5f5",
  },
  unreadNotification: {
    backgroundColor: "#E3F2FD",
    borderLeftWidth: 3,
    borderLeftColor: "#1976D2",
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    overflow: "hidden",
  },
  notificationImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    resizeMode: "cover",
  },
  notificationContent: { flex: 1 },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  boldText: {
    fontWeight: "600",
  },
  notificationMessage: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
    fontStyle: "italic",
  },
  notificationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: "#999",
  },
  readButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: "#f0f0f0",
  },
  readButtonText: {
    fontSize: 12,
    color: "#666",
  },

  // Empty states
  emptyState: {
    alignItems: "center",
    padding: 30,
    backgroundColor: "white",
    borderRadius: 16,
    marginTop: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
    marginBottom: 20,
  },
  emptyNotifications: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    height: 200,
  },
  emptyNotificationsText: {
    fontSize: 16,
    color: "#999",
    marginTop: 10,
  },
  addPostButton: {
    backgroundColor: "#1a8e2d",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addPostButtonText: { color: "white", fontWeight: "600" },
});
