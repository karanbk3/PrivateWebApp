```javascript
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

let isLoading = false;
let isMarkingAllRead = false;


// ======================================
// 3. HELPER FUNCTIONS
// ======================================

function createElement(tag, className = "", text = "") {
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

    const seconds = Math.floor(
        (Date.now() - date.getTime()) / 1000
    );

    if (!Number.isFinite(seconds) || seconds < 0) {
        return "Just now";
    }

    if (seconds < 60) {
        return "Just now";
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
        return `${days}d ago`;
    }

    return date.toLocaleDateString();
}


function getInitial(name) {
    return (name || "M").trim().charAt(0).toUpperCase();
}


function showMessage(message, isError = false) {
    notificationMessage.textContent = message;

    notificationMessage.style.color = isError
        ? "#f08a9c"
        : "#75d9e8";
}


function createAvatar(profile) {
    const avatar = createElement(
        "div",
        "notification-avatar",
        getInitial(profile?.display_name)
    );

    if (!profile?.avatar_url) {
        return avatar;
    }

    const image = document.createElement("img");

    image.src = profile.avatar_url;
    image.alt = "Member profile picture";
    image.loading = "lazy";

    image.onerror = () => {
        image.remove();

        avatar.textContent = getInitial(
            profile?.display_name
        );
    };

    avatar.textContent = "";
    avatar.appendChild(image);

    return avatar;
}


function setButtonLoading(button, isLoading, normalText, loadingText) {
    button.disabled = isLoading;

    button.textContent = isLoading
        ? loadingText
        : normalText;
}


function updateUnreadCount() {
    const unread = notifications.filter(
        item => !item.is_read
    ).length;

    unreadCount.textContent = unread;
}


// ======================================
// 4. CHECK MEMBER ACCESS
// ======================================

async function checkMemberAccess() {

    const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
        window.location.href = "./login.html";
        return false;
    }

    currentUser = sessionData.session.user;

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, display_name, approval_status")
        .eq("id", currentUser.id)
        .single();

    if (error || !profile) {
        console.error("Profile loading error:", error);

        await supabase.auth.signOut();

        window.location.href = "./login.html";
        return false;
    }

    if (profile.approval_status !== "approved") {
        await supabase.auth.signOut();

        window.location.href = "./login.html";
        return false;
    }

    memberName.textContent = profile.display_name || "Member";

    return true;
}


// ======================================
// 5. LOAD NOTIFICATIONS
// ======================================

async function loadNotifications() {

    if (isLoading) {
        return false;
    }

    isLoading = true;

    notificationList.replaceChildren(
        createElement(
            "div",
            "notification-empty",
            "Loading your notifications..."
        )
    );

    showMessage("");

    try {

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
            throw error;
        }

        notifications = data || [];

        await loadRelatedInformation();

        renderNotifications();

        return true;

    } catch (error) {

        console.error("Notification loading error:", error);

        notificationList.replaceChildren(
            createElement(
                "div",
                "notification-empty",
                "We could not load your notifications. Please try again."
            )
        );

        showMessage(
            "Unable to load notifications. Check your connection and try again.",
            true
        );

        return false;

    } finally {

        isLoading = false;

    }
}


// ======================================
// 6. LOAD RELATED INFORMATION
// ======================================

async function loadRelatedInformation() {

    profiles = {};
    posts = {};
    comments = {};

    const actorIds = [
        ...new Set(
            notifications
                .map(item => item.actor_id)
                .filter(Boolean)
        )
    ];

    const postIds = [
        ...new Set(
            notifications
                .map(item => item.post_id)
                .filter(Boolean)
        )
    ];

    const commentIds = [
        ...new Set(
            notifications
                .map(item => item.comment_id)
                .filter(Boolean)
        )
    ];

    // Load member profiles
    if (actorIds.length > 0) {

        const { data, error } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", actorIds);

        if (error) {

            console.error(
                "Could not load member profiles:",
                error
            );

        } else {

            for (const profile of data || []) {
                profiles[profile.id] = profile;
            }

        }
    }


    // Load related discussions
    if (postIds.length > 0) {

        const { data, error } = await supabase
            .from("posts")
            .select("id, content")
            .in("id", postIds);

        if (error) {

            console.error(
                "Could not load discussions:",
                error
            );

        } else {

            for (const post of data || []) {
                posts[post.id] = post;
            }

        }
    }


    // Load related comments
    if (commentIds.length > 0) {

        const { data, error } = await supabase
            .from("comments")
            .select("id, content")
            .in("id", commentIds);

        if (error) {

            console.error(
                "Could not load comments:",
                error
            );

        } else {

            for (const comment of data || []) {
                comments[comment.id] = comment;
            }

        }
    }
}


// ======================================
// 7. NOTIFICATION TEXT
// ======================================

function getNotificationText(notification) {

    const actor =
        profiles[notification.actor_id]?.display_name
        || "A community member";

    switch (notification.notification_type) {

        case "new_reply":

            return {
                actor,
                action: "replied to your comment"
            };

        case "new_comment":

            return {
                actor,
                action: "commented on your discussion"
            };

        default:

            return {
                actor,
                action: "shared an update with you"
            };
    }
}


// ======================================
// 8. CREATE NOTIFICATION LINK
// ======================================

function getNotificationLink(notification) {

    if (notification.post_id) {

        return (
            "./discussions.html?post=" +
            encodeURIComponent(notification.post_id)
        );

    }

    return "./discussions.html";
}


// ======================================
// 9. DISPLAY NOTIFICATIONS
// ======================================

function renderNotifications() {

    notificationList.replaceChildren();

    updateUnreadCount();

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

        item.href = getNotificationLink(notification);

        // Member avatar
        item.appendChild(
            createAvatar(profiles[notification.actor_id])
        );


        // Notification content
        const content = createElement(
            "div",
            "notification-content"
        );


        // Notification title
        const title = createElement(
            "p",
            "notification-title"
        );

        const actorName = createElement(
            "strong",
            "",
            text.actor
        );

        title.append(
            actorName,
            document.createTextNode(` ${text.action}.`)
        );

        content.appendChild(title);


        // Related discussion or comment preview
        const relatedComment =
            comments[notification.comment_id];

        const relatedPost =
            posts[notification.post_id];

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
                createElement(
                    "p",
                    "notification-description",
                    preview
                )
            );
        }


        // Notification time
        content.appendChild(
            createElement(
                "span",
                "notification-time",
                getTimeAgo(notification.created_at)
            )
        );


        // Read/unread indicator
        const status = createElement(
            "span",
            "notification-status"
        );

        status.setAttribute(
            "aria-label",
            notification.is_read ? "Read" : "Unread"
        );

        item.append(content, status);


        // Open notification
        item.addEventListener("click", async event => {

            event.preventDefault();

            if (notification.is_read) {

                window.location.href = item.href;
                return;

            }

            item.style.pointerEvents = "none";

            const success = await markNotificationRead(
                notification.id
            );

            item.style.pointerEvents = "";

            if (!success) {

                showMessage(
                    "Could not update this notification. Please try again.",
                    true
                );

                return;
            }

            window.location.href = item.href;

        });


        notificationList.appendChild(item);

    }
}


// ======================================
// 10. MARK ONE NOTIFICATION AS READ
// ======================================

async function markNotificationRead(notificationId) {

    const notification = notifications.find(
        item => item.id === notificationId
    );

    if (!notification || notification.is_read) {
        return true;
    }

    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("recipient_id", currentUser.id);

    if (error) {

        console.error(
            "Could not mark notification as read:",
            error
        );

        return false;
    }

    notification.is_read = true;

    updateUnreadCount();

    return true;
}


// ======================================
// 11. MARK ALL AS READ
// ======================================

markAllReadButton.addEventListener("click", async () => {

    if (isMarkingAllRead) {
        return;
    }

    const unreadItems = notifications.filter(
        item => !item.is_read
    );

    if (unreadItems.length === 0) {

        showMessage("You have no unread notifications.");

        return;
    }

    isMarkingAllRead = true;

    setButtonLoading(
        markAllReadButton,
        true,
        "Mark all as read",
        "Updating..."
    );

    try {

        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("recipient_id", currentUser.id)
            .eq("is_read", false);

        if (error) {
            throw error;
        }

        for (const item of notifications) {
            item.is_read = true;
        }

        renderNotifications();

        showMessage("All notifications marked as read.");

    } catch (error) {

        console.error(
            "Mark all as read error:",
            error
        );

        showMessage(
            "Could not update notifications. Please try again.",
            true
        );

    } finally {

        isMarkingAllRead = false;

        setButtonLoading(
            markAllReadButton,
            false,
            "Mark all as read",
            "Updating..."
        );

    }

});


// ======================================
// 12. REFRESH NOTIFICATIONS
// ======================================

refreshButton.addEventListener("click", async () => {

    if (isLoading) {
        return;
    }

    setButtonLoading(
        refreshButton,
        true,
        "↻ Refresh",
        "Refreshing..."
    );

    await loadNotifications();

    setButtonLoading(
        refreshButton,
        false,
        "↻ Refresh",
        "Refreshing..."
    );

});


// ======================================
// 13. SIGN OUT
// ======================================

logoutButton.addEventListener("click", async () => {

    logoutButton.disabled = true;
    logoutButton.textContent = "Signing out...";

    try {

        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.href = "./login.html";

    } catch (error) {

        console.error("Sign out error:", error);

        logoutButton.disabled = false;
        logoutButton.textContent = "Sign out";

        showMessage(
            "Could not sign out. Please try again.",
            true
        );

    }

});


// ======================================
// 14. START NOTIFICATIONS PAGE
// ======================================

async function startNotificationsPage() {

    try {

        const allowed = await checkMemberAccess();

        if (!allowed) {
            return;
        }

        // Show the protected page after access is checked
        authLoading.hidden = true;
        protectedContent.hidden = false;

        await loadNotifications();

    } catch (error) {

        console.error(
            "Notifications page error:",
            error
        );

        authLoading.textContent =
            "Something went wrong. Please refresh the page.";

    }

}


// ======================================
// 15. START
// ======================================

startNotificationsPage();
```
