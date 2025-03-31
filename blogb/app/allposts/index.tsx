import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import config from "@/config";
const { width } = Dimensions.get("window");
const API_BASE_URL = config.apiUrl;

// Helper function to build a full image URL from a relative path.
const getFullImageUrl = (imagePath: string): string => {
  // If the imagePath already starts with "http", return it.
  return imagePath.startsWith("http")
    ? imagePath
    : `${API_BASE_URL}${imagePath}`;
};

// Define the BlogPost interface (now including pimage)
interface BlogPost {
  id: string;
  pname: string;
  pdesc: string;
  pimage: string;
  stime?: string;
  up_date?: string;
  // Add any other properties as needed.
}

export default function BlogPostsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);

  // Fetch posts from the API
  const fetchPosts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/get-posts`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      // Map the data and use "sl.no" as id if available.
      const formattedPosts: BlogPost[] = data.map((post: any) => ({
        id: post["sl.no"]?.toString() || post.id,
        pname: post.pname,
        pdesc: post.pdesc,
        pimage: post.pimage, // include image field from API
        stime: post.stime,
        up_date: post.up_date,
      }));
      setPosts(formattedPosts);
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

  // Handle deletion of a post
  const handleDeletePost = async (postId: string) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        onPress: async () => {
          try {
            const response = await fetch(`${API_BASE_URL}/api/delete-post`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: postId }),
            });
            if (!response.ok) {
              throw new Error(`Server returned ${response.status}`);
            }
            setPosts((prevPosts) =>
              prevPosts.filter((post) => post.id !== postId)
            );
            Alert.alert("Success", "Post deleted successfully");
          } catch (err) {
            console.error("Error deleting post:", err);
            Alert.alert(
              "Error",
              err instanceof Error ? err.message : "Failed to delete post"
            );
          }
        },
        style: "destructive",
      },
    ]);
  };

  // Format date without timezone issues (simple formatting)
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, "0");
      const month = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ][date.getMonth()];
      const year = date.getFullYear();
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      const formattedHours = hours % 12 || 12;
      return `${day} ${month} ${year}, ${formattedHours}:${minutes} ${ampm}`;
    } catch (e) {
      console.error("Date formatting error:", e);
      return "Invalid date";
    }
  };

  // Handle edit post navigation
  const handleEditPost = (post: BlogPost) => {
    // First fetch the complete post details before navigating
    fetch(`${API_BASE_URL}/api/get-posts/${post.id}`)
      .then((res) => res.json())
      .then((data) => {
        const postData = {
          id: post.id,
          pname: post.pname,
          pdesc: post.pdesc,
          pimage: post.pimage,
          aname: data.aname || "",
          img_alt: data.img_alt || "",
          img_title: data.img_title || "",
          cname: data.cname || "",
          stime: data.stime || "",
          up_date: data.up_date || "",
        };

        // Then navigate with complete post data
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

  // Render blog posts
  const renderBlogPosts = () => {
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
    if (posts.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Image
            source={{ uri: "https://via.placeholder.com/50" }}
            style={styles.postImage}
          />
          <Text style={styles.emptyStateText}>No posts available.</Text>
        </View>
      );
    }
    return posts.map((post: BlogPost) => {
      const snippet =
        post.pdesc.length > 30
          ? post.pdesc.substring(0, 30) + "..."
          : post.pdesc;
      return (
        <View key={post.id} style={styles.postCard}>
          {/* Make the entire card clickable to view post details */}
          <TouchableOpacity
            style={styles.postContent}
            onPress={() => router.push(`/${post.id}`)}
          >
            <View style={[styles.postBadge, { backgroundColor: "#E8F5E9" }]}>
              {/* Use getFullImageUrl to construct the proper image URL */}
              <Image
                source={{
                  uri:
                    getFullImageUrl(post.pimage) ||
                    "https://via.placeholder.com/50",
                }}
                style={styles.postImage}
              />
            </View>
            <View style={styles.postInfo}>
              <View>
                <Text style={styles.postTitle}>{post.pname}</Text>
                <Text style={styles.postExcerpt}>{snippet}</Text>
                {post.up_date && (
                  <View style={styles.postTime}>
                    <Ionicons name="time-outline" size={14} color="#666" />
                    <Text style={styles.timeText}>
                      {formatDate(post.up_date)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.postActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditPost(post)}
            >
              <Ionicons name="create-outline" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeletePost(post.id)}
            >
              <Ionicons name="trash-outline" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#1a8e2d", "#146922"]}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={28} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Blog Posts</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#1a8e2d"]}
            tintColor="#1a8e2d"
          />
        }
      >
        <Text style={styles.screenTitle}>All Posts</Text>
        {renderBlogPosts()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  headerContainer: { height: 120, width: "100%" },
  headerGradient: { flex: 1, justifyContent: "flex-end", paddingBottom: 10 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    marginLeft: 15,
  },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 20 },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 15,
  },
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
  postContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
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
});

export {};
