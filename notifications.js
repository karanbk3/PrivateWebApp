
import { supabase } from "./supabase.js";

// ======================================
// 1. PAGE ELEMENTS
// ======================================

const authLoading = document.getElementById("authLoading");
const protectedContent = document.getElementById("protectedContent");

const memberName = document.getElementById("memberName");
const logoutButton = document.getElementById("logoutButton");

const notificationList = document.getElementById("notificationList");
const unreadCount = document.getElementById("unreadCount");

const refreshButton = document.getElementById("refreshButton");
const markAllReadButton = document.getElementById("markAllReadButton");
const notificationMessage = document.getElementById("notificationMessage");


// ======================================
// 2. PAGE DATA
// ======================================

let currentUser = null;
let notifications = [];
let profiles = {};
let posts = {};
let comments = {};


// ======================================
// 3. HELPER FUNCTIONS
// ======================================

function createElement(tag, className, text = "") {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== "") {
        element.textContent = text;
    }

    return element;
}


function getTimeAgo(dateValue) {
    const date = new Date(dateValue);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (Number.isNaN(seconds) || seconds < 0) {
        return "Just now";
    }

    if (seconds < 60) return "Just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
}


function getInitial(name) {
    return (name || "M").trim().charAt(0).toUpperCase();
}


function showMessage(message, isError = false) {
    notificationMessage.textContent = message;
    notificationMessage.style.color = isError ? "#f08a9c" : "#75d9e8";
}


function createAvatar(profile) {
    const avatar = createElement(
        "div",
        "notification-avatar",
        getInitial(profile?.display_name)
    );

    if (profile?.avatar_url) {
        const image = document.createElement("img");

        image.src = profile.avatar_url;
        image.alt = "Member profile picture";

        image.onerror = () => {
            image.remove();
            avatar.textContent = getInitial(profile?.display_name);
        };

        avatar.textContent = "";
        avatar.appendChild(image);
    }

    return avatar;
}


// ======================================
// 4. CHECK MEMBER ACCESS
// ======================================

async function checkMemberAccess() {
    const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
        window.location.href = "../login.html";
        return false;
    }

    currentUser = sessionData.session.user;

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, display_name, approval_status")
        .eq("id", currentUser.id)
        .single();

    if (error || !profile || profile.approval_status !== "approved") {
        await supabase.auth.signOut();
        window.location.href = "../login.html";
        return false;
    }

    memberName.textContent = profile.display_name || "Member";

    return true;
}


// ======================================
// 5. LOAD NOTIFICATIONS
// ======================================

async function loadNotifications() {
    notificationList.replaceChildren(
        createElement(
            "div",
            "notification-empty",
            "Loading your notifications..."
        )
    );

    const { data, error } = await supabase
        .from("notifications")
        .select(`
            id,
            recipient_id,
            actor_id,
            post_id,
            comment_id,
            notification_type,
            is_read,
            created_at
        `)
        .eq("recipient_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        console.error("Notification loading error:", error);

        notificationList.replaceChildren(
            createElement(
                "div",
                "notification-empty",
                "We could not load notifications. Please try again."
            )
        );

        return;
    }

    notifications = data || [];

    await loadRelatedInformation();

    renderNotifications();
}


// ======================================
// 6. LOAD MEMBER NAMES AND RELATED DATA
// ======================================

async function loadRelatedInformation() {
    profiles = {};
    posts = {};
    comments = {};

    const actorIds = [
        ...new Set(notifications.map(item => item.actor_id))
    ];

    const postIds = [
        ...new Set(notifications.map(item => item.post_id).filter(Boolean))
    ];

    const commentIds = [
        ...new Set(notifications.map(item => item.comment_id).filter(Boolean))
    ];

    if (actorIds.length > 0) {
        const { data, error } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", actorIds);

        if (error) {
            console.error("Could not load member profiles:", error);
        } else {
            for (const profile of data || []) {
                profiles[profile.id] = profile;
            }
        }
    }

    if (postIds.length > 0) {
        const { data, error } = await supabase
            .from("posts")
            .select("id, content")
            .in("id", postIds);

        if (error) {
            console.error("Could not load related discussions:", error);
        } else {
            for (const post of data || []) {
                posts[post.id] = post;
            }
        }
    }

    if (commentIds.length > 0) {
        const { data, error } = await supabase
            .from("comments")
            .select("id, content")
            .in("id", commentIds);

        if (error) {
            console.error("Could not load related comments:", error);
        } else {
            for (const comment of data || []) {
                comments[comment.id] = comment;
            }
        }
    }
}


// ======================================
// 7. CREATE NOTIFICATION DESCRIPTION
// ======================================

function getNotificationText(notification) {
    const actor = profiles[notification.actor_id]?.display_name
        || "A community member";

    if (notification.notification_type === "new_reply") {
        return {
            actor,
            action: "replied to your comment"
        };
    }

    return {
        actor,
        action: "commented on your discussion"
    };
}


// ======================================
// 8. DISPLAY NOTIFICATIONS
// ======================================

function renderNotifications() {
    notificationList.replaceChildren();

    const unread = notifications.filter(item => !item.is_read).length;

    unreadCount.textContent = unread;

    if (notifications.length === 0) {
        notificationList.appendChild(
            createElement(
                "div",
                "notification-empty",
                "You're all caught up! New comments and replies will appear here."
            )
        );

        return;
    }

    for (const notification of notifications) {
        const text = getNotificationText(notification);

        const item = createElement(
            "a",
            `notification-item ${notification.is_read ? "" : "unread"}`
        );

        item.href =
            `./discussions.html?post=${encodeURIComponent(notification.post_id)}`;

        item.appendChild(createAvatar(profiles[notification.actor_id]));

        const content = createElement("div", "notification-content");

        const title = createElement("p", "notification-title");

        const actorName = createElement("strong", "", text.actor);

        title.append(
            actorName,
            document.createTextNode(` ${text.action}.`)
        );

        content.appendChild(title);

        const relatedComment = comments[notification.comment_id];
        const relatedPost = posts[notification.post_id];

        let description = "";

        if (relatedComment?.content) {
            description = relatedComment.content;
        } else if (relatedPost?.content) {
            description = relatedPost.content;
        }

        if (description) {
            const preview = description.length > 110
                ? description.slice(0, 110) + "..."
                : description;

            content.appendChild(
                createElement("p", "notification-description", preview)
            );
        }

        content.appendChild(
            createElement(
                "span",
                "notification-time",
                getTimeAgo(notification.created_at)
            )
        );

        const status = createElement("span", "notification-status");

        item.append(content, status);

        item.addEventListener("click", async event => {
            event.preventDefault();

            if (!notification.is_read) {
                const success = await markNotificationRead(notification.id);

                if (!success) {
                    showMessage(
                        "Could not update this notification. Please try again.",
                        true
                    );
                    return;
                }
            }

            window.location.href = item.href;
        });

        notificationList.appendChild(item);
    }
}


// ======================================
// 9. MARK ONE NOTIFICATION AS READ
// ======================================

async function markNotificationRead(notificationId) {
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("recipient_id", currentUser.id);

    if (error) {
        console.error(error);
        return false;
    }

    const notification = notifications.find(
        item => item.id === notificationId
    );

    if (notification) {
        notification.is_read = true;
    }

    return true;
}


// ======================================
// 10. MARK ALL NOTIFICATIONS AS READ
// ======================================

markAllReadButton.addEventListener("click", async () => {
    const unreadItems = notifications.filter(item => !item.is_read);

    if (unreadItems.length === 0) {
        showMessage("You have no unread notifications.");
        return;
    }

    markAllReadButton.disabled = true;
    markAllReadButton.textContent = "Updating...";

    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", currentUser.id)
        .eq("is_read", false);

    if (error) {
        console.error(error);
        showMessage("Could not update notifications.", true);
    } else {
        for (const item of notifications) {
            item.is_read = true;
        }

        renderNotifications();
        showMessage("All notifications marked as read.");
    }

    markAllReadButton.disabled = false;
    markAllReadButton.textContent = "Mark all as read";
});


// ======================================
// 11. REFRESH NOTIFICATIONS
// ======================================

refreshButton.addEventListener("click", async () => {
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";

    await loadNotifications();

    refreshButton.disabled = false;
    refreshButton.textContent = "↻ Refresh";
});


// ======================================
// 12. SIGN OUT
// ======================================

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Signing out...";

    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error(error);

        logoutButton.disabled = false;
        logoutButton.textContent = "Sign out";

        showMessage("Could not sign out. Please try again.", true);
        return;
    }

    window.location.href = "../login.html";
});


// ======================================
// 13. START PAGE
// ======================================

async function startNotificationsPage() {
    try {
        const allowed = await checkMemberAccess();

        if (!allowed) return;

        await loadNotifications();

        authLoading.hidden = true;
        protectedContent.hidden = false;

    } catch (error) {
        console.error("Notifications page error:", error);

        authLoading.textContent =
            "Something went wrong. Please refresh the page.";
    }
}

startNotificationsPage();
