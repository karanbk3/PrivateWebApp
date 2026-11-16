```javascript
import { supabase } from "./supabase.js";

// ==========================================
// 1. PAGE ELEMENTS
// ==========================================

const authLoading = document.getElementById("authLoading");
const protectedContent = document.getElementById("protectedContent");

const memberName = document.getElementById("memberName");
const logoutButton = document.getElementById("logoutButton");

const discussionFeed = document.getElementById("discussionFeed");
const discussionCount = document.getElementById("discussionCount");
const searchInput = document.getElementById("searchInput");

const notificationBadge = document.getElementById("notificationBadge");

const discussionModal = document.getElementById("discussionModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeDiscussionModal = document.getElementById("closeDiscussionModal");

const modalPostContent = document.getElementById("modalPostContent");
const commentList = document.getElementById("commentList");
const commentCount = document.getElementById("commentCount");

const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const commentSubmitButton = document.getElementById("commentSubmitButton");
const commentMessage = document.getElementById("commentMessage");


// ==========================================
// 2. PAGE DATA
// ==========================================

let currentUser = null;
let allPosts = [];
let currentPost = null;
let memberProfiles = {};
let commentCounts = {};


// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

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


function getInitial(name) {
    return (name || "M").trim().charAt(0).toUpperCase();
}


function getProfile(userId) {
    return memberProfiles[userId] || {
        display_name: "PrivateSpace Member",
        avatar_url: null
    };
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


function createAvatar(profile, className = "author-avatar") {
    const avatar = createElement(
        "div",
        className,
        getInitial(profile.display_name)
    );

    if (profile.avatar_url) {
        const image = document.createElement("img");

        image.src = profile.avatar_url;
        image.alt = "Profile picture";
        image.loading = "lazy";

        image.onerror = () => {
            image.remove();
            avatar.textContent = getInitial(profile.display_name);
        };

        avatar.textContent = "";
        avatar.appendChild(image);
    }

    return avatar;
}


function createProfileLink(userId, profile) {
    const link = createElement("a", "profile-link");

    link.href = `./profile.html?id=${encodeURIComponent(userId)}`;

    link.appendChild(createAvatar(profile));

    const details = createElement("div", "author-details");

    details.appendChild(
        createElement("span", "author-name", profile.display_name)
    );

    link.appendChild(details);

    return link;
}


function showMessage(message, isError = false) {
    commentMessage.textContent = message;
    commentMessage.style.color = isError ? "#f08a9c" : "#75d9e8";
}


function getFilteredPosts() {
    const term = searchInput.value.trim().toLowerCase();

    if (!term) return allPosts;

    return allPosts.filter(post => {
        const profile = getProfile(post.author_id);

        return (
            (post.content || "").toLowerCase().includes(term) ||
            (profile.display_name || "").toLowerCase().includes(term)
        );
    });
}


// ==========================================
// 4. CHECK MEMBER ACCESS
// ==========================================

async function checkMemberAccess() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
        window.location.href = "./login.html";
        return false;
    }

    currentUser = data.session.user;

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name, role, approval_status")
        .eq("id", currentUser.id)
        .single();

    if (
        profileError ||
        !profile ||
        profile.approval_status !== "approved" ||
        profile.role !== "member"
    ) {
        await supabase.auth.signOut();
        window.location.href = "./login.html";
        return false;
    }

    memberName.textContent = profile.display_name || "Member";

    return true;
}


// ==========================================
// 5. LOAD MEMBER PROFILES
// ==========================================

async function loadMemberProfiles(userIds) {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];

    if (uniqueIds.length === 0) return;

    const missingIds = uniqueIds.filter(
        id => !memberProfiles[id]
    );

    if (missingIds.length === 0) return;

    const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", missingIds);

    if (error) {
        console.error("Profile loading error:", error);
        return;
    }

    for (const profile of data || []) {
        memberProfiles[profile.id] = profile;
    }
}


// ==========================================
// 6. LOAD DISCUSSIONS
// ==========================================

async function loadDiscussions() {
    discussionFeed.replaceChildren(
        createElement("div", "empty-feed", "Loading discussions...")
    );

    const { data, error } = await supabase
        .from("posts")
        .select("id, author_id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        console.error("Discussion loading error:", error);

        discussionFeed.replaceChildren(
            createElement(
                "div",
                "empty-feed",
                "We could not load discussions. Please refresh the page."
            )
        );

        discussionCount.textContent = "Unable to load";
        return;
    }

    allPosts = data || [];

    await loadMemberProfiles(
        allPosts.map(post => post.author_id)
    );

    await loadCommentCounts();

    renderDiscussions(allPosts);
}


// ==========================================
// 7. LOAD COMMENT COUNTS
// ==========================================

async function loadCommentCounts() {
    commentCounts = {};

    if (allPosts.length === 0) return;

    const postIds = allPosts.map(post => post.id);

    const { data, error } = await supabase
        .from("comments")
        .select("post_id")
        .in("post_id", postIds);

    if (error) {
        console.error("Comment count error:", error);
        return;
    }

    for (const comment of data || []) {
        commentCounts[comment.post_id] =
            (commentCounts[comment.post_id] || 0) + 1;
    }
}


// ==========================================
// 8. DISPLAY DISCUSSIONS
// ==========================================

function renderDiscussions(posts) {
    discussionFeed.replaceChildren();

    discussionCount.textContent =
        `${posts.length} ${posts.length === 1 ? "discussion" : "discussions"}`;

    if (posts.length === 0) {
        discussionFeed.appendChild(
            createElement(
                "div",
                "empty-feed",
                allPosts.length === 0
                    ? "No discussions have been published yet."
                    : "No discussions found. Try another search."
            )
        );

        return;
    }

    for (const post of posts) {
        const profile = getProfile(post.author_id);

        const card = createElement("article", "discussion-card");

        // Author
        const author = createElement("div", "discussion-author");

        author.appendChild(
            createProfileLink(post.author_id, profile)
        );

        const authorDetails = author.querySelector(".author-details");

        authorDetails.appendChild(
            createElement(
                "span",
                "post-time",
                getTimeAgo(post.created_at)
            )
        );

        card.appendChild(author);

        // Post content
        const content = createElement(
            "p",
            "discussion-content preview"
        );

        content.textContent = post.content || "";

        card.appendChild(content);

        // Read more
        if ((post.content || "").length > 240) {
            const readMore = createElement(
                "button",
                "read-more-button",
                "Read full discussion"
            );

            readMore.type = "button";

            readMore.addEventListener("click", () => {
                openDiscussion(post);
            });

            card.appendChild(readMore);
        }

        // Actions
        const actions = createElement(
            "div",
            "discussion-card-actions"
        );

        const readButton = createElement(
            "button",
            "discussion-action"
        );

        readButton.type = "button";

        readButton.append(
            createElement("span", "", "↗"),
            document.createTextNode(" Read discussion")
        );

        readButton.addEventListener("click", () => {
            openDiscussion(post);
        });

        const commentButton = createElement(
            "button",
            "discussion-action"
        );

        commentButton.type = "button";

        const totalComments = commentCounts[post.id] || 0;

        commentButton.append(
            createElement("span", "", "◌"),
            document.createTextNode(
                ` ${totalComments} ${totalComments === 1 ? "comment" : "comments"}`
            )
        );

        commentButton.addEventListener("click", () => {
            openDiscussion(post);
        });

        actions.append(readButton, commentButton);

        card.appendChild(actions);

        discussionFeed.appendChild(card);
    }
}


// ==========================================
// 9. SEARCH DISCUSSIONS
// ==========================================

searchInput.addEventListener("input", () => {
    renderDiscussions(getFilteredPosts());
});


// ==========================================
// 10. OPEN A DISCUSSION
// ==========================================

async function openDiscussion(post) {
    currentPost = post;

    const profile = getProfile(post.author_id);

    modalPostContent.replaceChildren();

    const author = createElement("div", "discussion-author");

    author.appendChild(
        createProfileLink(post.author_id, profile)
    );

    const authorDetails = author.querySelector(".author-details");

    authorDetails.appendChild(
        createElement(
            "span",
            "post-time",
            getTimeAgo(post.created_at)
        )
    );

    const fullText = createElement("p", "full-post-text");
    fullText.textContent = post.content || "";

    modalPostContent.append(author, fullText);

    discussionModal.hidden = false;
    document.body.style.overflow = "hidden";

    commentInput.value = "";
    showMessage("");

    commentSubmitButton.disabled = false;
    commentSubmitButton.textContent = "Comment";

    await loadComments(post.id);

    if (currentPost?.id === post.id) {
        commentInput.focus();
    }
}


// ==========================================
// 11. CLOSE THE DISCUSSION
// ==========================================

function closeModal() {
    discussionModal.hidden = true;
    document.body.style.overflow = "";

    currentPost = null;
}

closeDiscussionModal.addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", closeModal);

document.addEventListener("keydown", event => {
    if (
        event.key === "Escape" &&
        !discussionModal.hidden
    ) {
        closeModal();
    }
});


// ==========================================
// 12. LOAD COMMENTS
// ==========================================

async function loadComments(postId) {
    commentList.replaceChildren(
        createElement("p", "form-message", "Loading comments...")
    );

    const { data, error } = await supabase
        .from("comments")
        .select(`
            id,
            post_id,
            author_id,
            content,
            parent_comment_id,
            created_at
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Comment loading error:", error);

        commentList.replaceChildren(
            createElement(
                "p",
                "form-message",
                "Could not load comments. Please try again."
            )
        );

        return;
    }

    const comments = data || [];

    await loadMemberProfiles(
        comments.map(comment => comment.author_id)
    );

    if (!currentPost || currentPost.id !== postId) return;

    commentList.replaceChildren();

    commentCount.textContent =
        `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`;

    if (comments.length === 0) {
        commentList.appendChild(
            createElement(
                "p",
                "form-message",
                "No comments yet. Start the conversation."
            )
        );

        return;
    }

    // Organize comments and replies.
    const commentMap = new Map();

    for (const comment of comments) {
        commentMap.set(comment.id, {
            ...comment,
            children: []
        });
    }

    const rootComments = [];

    for (const comment of comments) {
        const item = commentMap.get(comment.id);

        if (
            comment.parent_comment_id &&
            commentMap.has(comment.parent_comment_id)
        ) {
            commentMap
                .get(comment.parent_comment_id)
                .children.push(item);
        } else {
            rootComments.push(item);
        }
    }

    for (const comment of rootComments) {
        commentList.appendChild(renderComment(comment));
    }
}


// ==========================================
// 13. DISPLAY COMMENTS AND REPLIES
// ==========================================

function renderComment(comment) {
    const profile = getProfile(comment.author_id);

    const wrapper = createElement("div", "comment-item");

    // Avatar and profile link
    const avatarLink = createElement("a");

    avatarLink.href =
        `./profile.html?id=${encodeURIComponent(comment.author_id)}`;

    avatarLink.setAttribute("aria-label", "View member profile");

    avatarLink.appendChild(
        createAvatar(profile, "comment-avatar")
    );

    // Comment body
    const body = createElement("div", "comment-body");

    const bubble = createElement("div", "comment-bubble");

    const authorLink = createElement(
        "a",
        "comment-author",
        profile.display_name
    );

    authorLink.href =
        `./profile.html?id=${encodeURIComponent(comment.author_id)}`;

    const text = createElement("div", "comment-text");
    text.textContent = comment.content || "";

    bubble.append(authorLink, text);

    // Comment time and reply button
    const meta = createElement("div", "comment-meta");

    meta.appendChild(
        createElement(
            "span",
            "",
            getTimeAgo(comment.created_at)
        )
    );

    const replyButton = createElement(
        "button",
        "reply-button",
        "Reply"
    );

    replyButton.type = "button";

    meta.appendChild(replyButton);

    body.append(bubble, meta);

    // Reply form area
    const replyArea = createElement("div", "reply-area");

    replyButton.addEventListener("click", () => {
        if (replyArea.childElementCount > 0) {
            replyArea.replaceChildren();
            return;
        }

        replyArea.appendChild(
            createReplyForm(comment)
        );
    });

    // Existing replies
    if (comment.children.length > 0) {
        const children = createElement("div", "comment-children");

        for (const child of comment.children) {
            children.appendChild(
                renderComment(child)
            );
        }

        body.appendChild(children);
    }

    body.appendChild(replyArea);

    wrapper.append(avatarLink, body);

    return wrapper;
}


// ==========================================
// 14. CREATE A REPLY FORM
// ==========================================

function createReplyForm(parentComment) {
    const form = createElement("form", "reply-form");

    const textarea = document.createElement("textarea");

    textarea.maxLength = 2000;
    textarea.required = true;
    textarea.placeholder = "Write your reply...";

    const button = createElement(
        "button",
        "",
        "Send reply"
    );

    button.type = "submit";

    const message = createElement("p", "form-message");

    form.append(textarea, button, message);

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!currentPost) return;

        const content = textarea.value.trim();

        if (!content) {
            message.textContent = "Please write a reply.";
            return;
        }

        button.disabled = true;
        button.textContent = "Sending...";

        const { error } = await supabase
            .from("comments")
            .insert({
                post_id: currentPost.id,
                author_id: currentUser.id,
                parent_comment_id: parentComment.id,
                content: content
            });

        if (error) {
            console.error("Reply error:", error);

            message.textContent = "Could not send your reply.";

            button.disabled = false;
            button.textContent = "Send reply";

            return;
        }

        await loadComments(currentPost.id);
        await loadCommentCounts();

        renderDiscussions(getFilteredPosts());
    });

    return form;
}


// ==========================================
// 15. ADD A NEW COMMENT
// ==========================================

commentForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentPost || !currentUser) return;

    const content = commentInput.value.trim();

    if (!content) {
        showMessage("Please write a comment first.", true);
        return;
    }

    commentSubmitButton.disabled = true;
    commentSubmitButton.textContent = "Sending...";

    const { error } = await supabase
        .from("comments")
        .insert({
            post_id: currentPost.id,
            author_id: currentUser.id,
            content: content
        });

    if (error) {
        console.error("Comment error:", error);

        showMessage(
            "Could not send your comment. Please try again.",
            true
        );

        commentSubmitButton.disabled = false;
        commentSubmitButton.textContent = "Comment";

        return;
    }

    commentInput.value = "";

    showMessage("Your comment was added.");

    await loadComments(currentPost.id);
    await loadCommentCounts();

    renderDiscussions(getFilteredPosts());

    commentSubmitButton.disabled = false;
    commentSubmitButton.textContent = "Comment";
});


// ==========================================
// 16. LOAD UNREAD NOTIFICATIONS
// ==========================================

async function loadNotificationCount() {
    const { count, error } = await supabase
        .from("notifications")
        .select("id", {
            count: "exact",
            head: true
        })
        .eq("recipient_id", currentUser.id)
        .eq("is_read", false);

    if (error) {
        console.error("Notification loading error:", error);
        return;
    }

    const unreadCount = count || 0;

    notificationBadge.textContent =
        unreadCount > 99 ? "99+" : unreadCount;

    notificationBadge.hidden = unreadCount === 0;
}


// ==========================================
// 17. SIGN OUT
// ==========================================

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = "Signing out...";

    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error("Sign out error:", error);

        logoutButton.disabled = false;
        logoutButton.textContent = "Sign out";

        return;
    }

    window.location.href = "./login.html";
});


// ==========================================
// 18. START THE PAGE
// ==========================================

async function startDiscussionsPage() {
    try {
        const allowed = await checkMemberAccess();

        if (!allowed) return;

        await loadDiscussions();
        await loadNotificationCount();

        // Open a discussion from a notification link.
        const params = new URLSearchParams(
            window.location.search
        );

        const requestedPostId = params.get("post");

        if (requestedPostId) {
            const requestedPost = allPosts.find(
                post => String(post.id) === requestedPostId
            );

            if (requestedPost) {
                await openDiscussion(requestedPost);
            }
        }

        authLoading.hidden = true;
        protectedContent.hidden = false;

    } catch (error) {
        console.error("Discussions page error:", error);

        authLoading.textContent =
            "Something went wrong. Please refresh the page.";
    }
}


// Start everything.
startDiscussionsPage();
```
