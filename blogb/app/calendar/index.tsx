import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";

// Define an interface for a blog post.
interface BlogPost {
  id: string;
  pname: string; // Title of the post
  pdesc?: string; // Added description field if available
  stime: string; // Scheduled posting date/time (if any)
  up_date: string; // Immediate posting date/time (if any)
  aname?: string; // Author name
  cname?: string; // Category name
  pimage?: string; // API returns the image as "pimage"
  image?: string; // Optionally, if your mapping creates an "image" property.
  img_alt?: string;
  img_title?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const API_BASE_URL = "http://172.20.10.4:5000";

// Helper: Build a full image URL from a relative path.
// If the path already starts with "http", returns it as is.
const getFullImageUrl = (imagePath: string): string => {
  return imagePath.startsWith("http")
    ? imagePath
    : `${API_BASE_URL}${imagePath}`;
};

export default function BlogCalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch posts from the API.
  const fetchPosts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("Fetching posts...");
      const response = await fetch(`${API_BASE_URL}/api/get-posts`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid data format received from server");
      }
      // Map the API data; assign the image field from pimage.
      const postsWithId: BlogPost[] = data.map((post: any) => ({
        id: post["sl.no"]?.toString() || post.id,
        pname: post.pname,
        pdesc: post.pdesc, // Include post description if available
        stime: post.stime,
        up_date: post.up_date,
        aname: post.aname,
        cname: post.cname,
        // If image is not defined, fallback to pimage.
        image: post.image || post.pimage,
        img_alt: post.img_alt,
        img_title: post.img_title,
      }));
      console.log(`Fetched ${postsWithId.length} posts`);
      setPosts(postsWithId);
    } catch (err) {
      console.error("Error fetching posts:", err);
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [fetchPosts])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchPosts();
  }, [fetchPosts]);

  // Helper: Returns number of days in the month and the first day index.
  const getDaysInMonth = (date: Date): { days: number; firstDay: number } => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  // Helper: Create a Date object from a post's stime or up_date.
  const getEffectiveDate = (post: BlogPost): Date | null => {
    try {
      const dateString =
        post.stime && post.stime.trim() !== "" ? post.stime : post.up_date;
      if (!dateString || dateString.trim() === "") {
        console.log(`No date string found for post ID: ${post.id}`);
        return null;
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.log(
          `Invalid date string: ${dateString} for post ID: ${post.id}`
        );
        return null;
      }
      console.log(
        `Post ID: ${post.id}, Date string: ${dateString}, Parsed: ${date.toISOString()}`
      );
      return date;
    } catch (error) {
      console.error(`Error parsing date for post ID ${post.id}:`, error);
      return null;
    }
  };

  // Filter posts by selected date (compare year, month, and day).
  const filterPostsByDate = (posts: BlogPost[], date: Date): BlogPost[] => {
    console.log(`Filtering posts for date: ${date.toDateString()} (IST)`);
    return posts.filter((post) => {
      const effectiveDate = getEffectiveDate(post);
      if (!effectiveDate) {
        console.log(`Filtering: Post ${post.id} has no valid date`);
        return false;
      }
      const sameDate =
        effectiveDate.getFullYear() === date.getFullYear() &&
        effectiveDate.getMonth() === date.getMonth() &&
        effectiveDate.getDate() === date.getDate();
      console.log(
        `Filtering: Post ${post.id} date: ${effectiveDate.toDateString()}, Selected: ${date.toDateString()}, Match: ${sameDate}`
      );
      return sameDate;
    });
  };

  // Helper: Format a Date object for display in IST.
  const formatDateToIST = (date: Date): string => {
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Navigation: Go to previous/next month.
  const goToPreviousMonth = () => {
    setSelectedDate(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1)
    );
  };
  const goToNextMonth = () => {
    setSelectedDate(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1)
    );
  };

  // Function to handle editing a post.
  const handleEditPost = (post: BlogPost) => {
    // Fetch complete post details first.
    fetch(`${API_BASE_URL}/api/get-posts/${post.id}`)
      .then((res) => res.json())
      .then((data) => {
        // Construct a complete post data object.
        const postData = {
          id: post.id,
          pname: post.pname,
          pdesc: data.pdesc || post.pdesc || "",
          pimage: post.image || post.pimage,
          aname: data.aname || "",
          img_alt: data.img_alt || "",
          img_title: data.img_title || "",
          cname: data.cname || "",
          stime: data.stime || "",
          up_date: data.up_date || "",
        };
        // Navigate with the full post data.
        router.push({
          pathname: "/calendar/editpost",
          params: postData,
        });
      })
      .catch((err) => {
        console.error("Error fetching complete post details:", err);
        Alert.alert("Error", "Failed to load post details for editing");
      });
  };

  // Render the calendar grid.
  const renderCalendar = (): JSX.Element[] => {
    const { days, firstDay } = getDaysInMonth(selectedDate);
    const calendarRows: JSX.Element[] = [];
    let currentWeek: JSX.Element[] = [];

    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }
    for (let day = 1; day <= days; day++) {
      const date = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        day
      );
      const dayHasPosts = posts.some((post) => {
        const effectiveDate = getEffectiveDate(post);
        return (
          effectiveDate &&
          effectiveDate.getFullYear() === date.getFullYear() &&
          effectiveDate.getMonth() === date.getMonth() &&
          effectiveDate.getDate() === date.getDate()
        );
      });
      const isToday = new Date().toDateString() === date.toDateString();
      const isSelected = date.toDateString() === selectedDate.toDateString();
      currentWeek.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            isToday && styles.today,
            isSelected && styles.selectedDay,
            dayHasPosts && styles.dayWithPosts,
          ]}
          onPress={() => setSelectedDate(date)}
        >
          <Text
            style={[
              styles.dayText,
              isToday && styles.todayText,
              isSelected && styles.selectedDayText,
            ]}
          >
            {day}
          </Text>
          {dayHasPosts && <View style={styles.postIndicator} />}
        </TouchableOpacity>
      );
      if ((firstDay + day) % 7 === 0 || day === days) {
        calendarRows.push(
          <View key={`week-${calendarRows.length}`} style={styles.calendarWeek}>
            {currentWeek}
          </View>
        );
        currentWeek = [];
      }
    }
    return calendarRows;
  };

  // Render blog posts for the selected date.
  const renderBlogPosts = (): JSX.Element => {
    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1a8e2d" />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPosts}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    const filteredPosts = filterPostsByDate(posts, selectedDate);
    if (filteredPosts.length === 0) {
      return (
        <View style={styles.noPostsContainer}>
          <Text style={styles.noPostsText}>No posts for this date.</Text>
        </View>
      );
    }
    return (
      <View>
        {filteredPosts.map((post, index) => {
          const effectiveDate = getEffectiveDate(post);
          const dateTimeString = effectiveDate
            ? effectiveDate.toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }) + " IST"
            : "";
          return (
            <View key={`post-${post.id}-${index}`} style={styles.blogCard}>
              <View style={[styles.postBadge, { backgroundColor: "#E8F5E9" }]}>
                <Image
                  source={{
                    uri:
                      post.image || post.pimage
                        ? getFullImageUrl(post.image || post.pimage || "")
                        : "https://via.placeholder.com/50",
                  }}
                  style={styles.postImage}
                />
              </View>
              <View style={styles.postInfo}>
                <View>
                  <Text style={styles.blogTitle}>{post.pname}</Text>
                  {dateTimeString && (
                    <View style={styles.postTime}>
                      <Ionicons name="time-outline" size={14} color="#666" />
                      <Text style={styles.timeText}>{dateTimeString}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.postActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEditPost(post)}
                >
                  <Ionicons name="create-outline" size={20} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    // Set up deletion logic if needed
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1a8e2d", "#146922"]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Blog & Calendar</Text>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={["#1a8e2d"]}
              tintColor="#1a8e2d"
            />
          }
        >
          {/* Calendar */}
          <View style={styles.calendarContainer}>
            <View style={styles.monthHeader}>
              <TouchableOpacity onPress={goToPreviousMonth}>
                <Ionicons name="chevron-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.monthText}>
                {selectedDate.toLocaleString("default", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <TouchableOpacity onPress={goToNextMonth}>
                <Ionicons name="chevron-forward" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.weekdayHeader}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={styles.weekdayText}>
                  {day}
                </Text>
              ))}
            </View>
            {renderCalendar().map((row, index) => (
              <React.Fragment key={`calendar-row-${index}`}>
                {row}
              </React.Fragment>
            ))}
          </View>

          {/* Blog Posts Section */}
          <View style={styles.blogContainer}>
            <Text style={styles.blogSectionTitle}>
              Blog Posts for {formatDateToIST(selectedDate)}
            </Text>
            {renderBlogPosts()}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "ios" ? 140 : 120,
  },
  content: { flex: 1, paddingTop: Platform.OS === "ios" ? 50 : 30 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    marginTop: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    flex: 1,
    marginTop: 15,
    marginLeft: 15,
  },
  scrollContainer: { paddingBottom: 20 },
  calendarContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  monthText: { fontSize: 18, fontWeight: "600", color: "#333" },
  weekdayHeader: { flexDirection: "row", marginBottom: 10 },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    color: "#666",
    fontWeight: "500",
  },
  calendarWeek: { flexDirection: "row", marginBottom: 5 },
  calendarDay: {
    flex: 1,
    height: 40,
    marginHorizontal: 2,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    minWidth: 36,
    maxWidth: 46,
  },
  dayText: { fontSize: 16, color: "#333" },
  today: { backgroundColor: "#1a8e2d15" },
  todayText: { color: "#1a8e2d", fontWeight: "600" },
  selectedDay: { backgroundColor: "rgba(255, 195, 0, 0.3)" },
  selectedDayText: { fontWeight: "600" },
  dayWithPosts: {},
  postIndicator: {
    position: "absolute",
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1a8e2d",
  },
  blogContainer: {
    marginHorizontal: 20,
    padding: 15,
    elevation: 2,
  },
  blogSectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 15,
  },
  noPostsContainer: { padding: 15, alignItems: "center" },
  noPostsText: { fontSize: 16, color: "#666", marginBottom: 16 },
  centerContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#f44336",
    marginBottom: 16,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#1a8e2d",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: { color: "white", fontWeight: "600" },
  blogCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  postBadge: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    overflow: "hidden",
  },
  postImage: { width: 50, height: 50, borderRadius: 8, resizeMode: "cover" },
  postInfo: { flex: 1, justifyContent: "space-between" },
  blogTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  postTime: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  timeText: { marginLeft: 5, color: "#666", fontSize: 12 },
  postActions: {
    flexDirection: "column",
    justifyContent: "space-between",
    height: 70,
  },
  editButton: {
    backgroundColor: "#4CAF50",
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  deleteButton: {
    backgroundColor: "#f44336",
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
});

export {};
