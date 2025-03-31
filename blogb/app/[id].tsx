import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

const BASE_URL = "http://172.20.10.4:5000";

// Helper function to return full URL for an image
const getFullImageUrl = (imagePath: string): string => {
  if (!imagePath) return "https://via.placeholder.com/300";
  if (imagePath.startsWith("http")) return imagePath;
  return `${BASE_URL}${imagePath}`;
};

// Helper function to format date for display
const formatDate = (date: Date): string => {
  try {
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

// Format time display for posts
const getTimeDisplay = (timestamp: string | undefined): string => {
  if (!timestamp) return "Recently";
  try {
    const postDate = new Date(timestamp);
    if (isNaN(postDate.getTime())) return "Invalid date";

    const now = new Date();
    const diffInSeconds = Math.floor(
      (now.getTime() - postDate.getTime()) / 1000
    );

    // If less than a minute
    if (diffInSeconds < 60) {
      return diffInSeconds <= 1 ? "Just now" : `${diffInSeconds} seconds ago`;
    }

    // If less than an hour
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
    }

    // If less than a day
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    }

    // If more than a day, format as date
    return formatDate(postDate);
  } catch (error) {
    console.error("Error in getTimeDisplay:", error);
    return "Unknown time";
  }
};

// Helper function to get relative time for comments
const getRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60)
      return diffInSeconds === 1
        ? `1 second ago`
        : `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return minutes === 1 ? `1 minute ago` : `${minutes} minutes ago`;
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return hours === 1 ? `1 hour ago` : `${hours} hours ago`;
    }
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return days === 1 ? `1 day ago` : `${days} days ago`;
    }
    return formatDate(date);
  } catch (error) {
    console.error("Error calculating relative time:", error);
    return "Unknown time";
  }
};

export default function AdminPostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [postTime, setPostTime] = useState<string>("");
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update timer for relative times
  useEffect(() => {
    if (post?.stime) {
      // Set initial post time
      setPostTime(getTimeDisplay(post.stime));

      // Update timestamps every minute
      const intervalId = setInterval(() => {
        setPostTime(getTimeDisplay(post.stime));

        if (comments.length > 0) {
          const updatedComments = comments.map((comment) => ({
            ...comment,
            relativeTime: getRelativeTime(comment.createdAt),
          }));
          setComments(updatedComments);
        }
      }, 60000); // Update every minute

      timerRef.current = intervalId;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [post, comments]);

  // Fetch post details
  useEffect(() => {
    if (!id) return;

    fetch(`${BASE_URL}/api/get-posts/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setPost(data);

        if (data.stime) {
          setPostTime(getTimeDisplay(data.stime));
        }

        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching post details:", error);
        setLoading(false);
      });

    fetchComments();
  }, [id]);

  // Fetch comments for the post
  const fetchComments = () => {
    if (!id) return;

    setCommentsLoading(true);
    fetch(`${BASE_URL}/api/posts/${id}/comments`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        return res.json();
      })
      .then((fetchedComments) => {
        const mapped = fetchedComments.map((c: any) => ({
          id: c.id,
          user_id: c.user_id,
          author: c.username || "Anonymous",
          authorImage: c.profile_image || "https://via.placeholder.com/40",
          text: c.comment_text,
          createdAt: c.created_at,
          relativeTime: getRelativeTime(c.created_at),
          is_read: c.is_read || false,
        }));
        setComments(mapped);
        setCommentsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching comments:", err);
        setCommentsLoading(false);
      });
  };

  // Mark a comment as read
  const markCommentAsRead = (commentId: number) => {
    fetch(`${BASE_URL}/api/admin/mark-comment-read/${commentId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then(() => {
        // Update local state
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === commentId ? { ...comment, is_read: true } : comment
          )
        );
      })
      .catch((err) => {
        console.error(`Error marking comment ${commentId} as read:`, err);
      });
  };

  // Delete a comment
  const handleDeleteComment = (commentId: number) => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${BASE_URL}/api/admin/comments/${commentId}`,
                {
                  method: "DELETE",
                  headers: {
                    "Content-Type": "application/json",
                  },
                }
              );

              if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
              }

              setComments(comments.filter((c) => c.id !== commentId));
              Alert.alert("Success", "Comment deleted successfully");
            } catch (error) {
              console.error("Error deleting comment:", error);
              Alert.alert(
                "Error",
                "Failed to delete comment. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1a8e2d" />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Post not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerNav}>
        <TouchableOpacity
          onPress={() => {
            console.log("Back pressed");
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1a8e2d" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Post Details</Text>
        <TouchableOpacity
          onPress={() => router.push(`/posts/edit/${id}` as any)}
          style={styles.editButton}
        >
          <Ionicons name="pencil" size={22} color="#1a8e2d" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.header}>
          <Text style={styles.title}>{post.pname}</Text>
          <View style={styles.metaContainer}>
            <View style={styles.authorBadge}>
              <Ionicons name="person" size={16} color="white" />
            </View>
            <View style={styles.metaInfo}>
              <Text style={styles.author}>By {post.aname}</Text>
              <Text style={styles.date}>{postTime}</Text>
            </View>
          </View>
        </View>

        {/* Featured Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: getFullImageUrl(post.pimage) }}
            style={styles.image}
            resizeMode="cover"
          />
          <Text style={styles.imageCaption}>
            {post.img_title || "Post image"}
          </Text>
        </View>

        {/* Post Content */}
        <View style={styles.content}>
          <Text style={styles.bodyText}>{post.pdesc}</Text>
        </View>

        {/* Category Tag */}
        <View style={styles.tagsContainer}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{post.cname || "Uncategorized"}</Text>
          </View>
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Comments ({comments.length})</Text>

          {commentsLoading ? (
            <ActivityIndicator
              size="small"
              color="#1a8e2d"
              style={styles.commentsLoader}
            />
          ) : comments.length === 0 ? (
            <View style={styles.noCommentsContainer}>
              <Ionicons name="chatbubbles-outline" size={40} color="#ddd" />
              <Text style={styles.noCommentsText}>
                No comments on this post
              </Text>
            </View>
          ) : (
            comments.map((comment) => (
              <View
                key={comment.id}
                style={[
                  styles.commentItem,
                  !comment.is_read && styles.unreadComment,
                ]}
              >
                <View style={styles.commentHeader}>
                  <Image
                    source={{ uri: getFullImageUrl(comment.authorImage) }}
                    style={styles.commentAvatar}
                  />
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentAuthor}>{comment.author}</Text>
                    <Text style={styles.commentTime}>
                      {comment.relativeTime}
                    </Text>
                  </View>
                  <View style={styles.commentActions}>
                    {!comment.is_read && (
                      <TouchableOpacity
                        onPress={() => markCommentAsRead(comment.id)}
                        style={styles.markReadButton}
                      >
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={18}
                          color="#1a8e2d"
                        />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => handleDeleteComment(comment.id)}
                      style={styles.deleteCommentButton}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#ff3b30"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.commentText}>{comment.text}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 5,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  editButton: {
    padding: 5,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  metaContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  authorBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1a8e2d",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  metaInfo: {
    flex: 1,
  },
  author: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a8e2d",
    marginBottom: 3,
  },
  date: {
    fontSize: 13,
    color: "#666",
  },
  imageContainer: {
    padding: 20,
    paddingTop: 0,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 10,
  },
  imageCaption: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#444",
  },
  tagsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tag: {
    backgroundColor: "#f0f9f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1a8e2d",
  },
  tagText: {
    fontSize: 14,
    color: "#1a8e2d",
  },
  commentsSection: {
    padding: 20,
    paddingTop: 10,
    backgroundColor: "#f9f9f9",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
  },
  commentsLoader: {
    marginVertical: 20,
  },
  noCommentsContainer: {
    alignItems: "center",
    paddingVertical: 30,
  },
  noCommentsText: {
    fontSize: 16,
    color: "#888",
    marginTop: 10,
  },
  commentItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  unreadComment: {
    borderLeftWidth: 3,
    borderLeftColor: "#1a8e2d",
    backgroundColor: "#f0f9f0",
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  commentMeta: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  commentTime: {
    fontSize: 12,
    color: "#888",
  },
  commentActions: {
    flexDirection: "row",
  },
  markReadButton: {
    padding: 5,
    marginRight: 5,
  },
  deleteCommentButton: {
    padding: 5,
  },
  commentText: {
    fontSize: 15,
    color: "#444",
    marginLeft: 50,
  },
});
