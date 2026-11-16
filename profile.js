
import { supabase } from "./supabase.js";

// ==========================================
// 1. GET PAGE ELEMENTS
// ==========================================

const $ = (id) => document.getElementById(id);

const profileLoading = $("profileLoading");
const profileError = $("profileError");
const profileContent = $("profileContent");

const profileAvatar = $("profileAvatar");
const avatarFallback = $("avatarFallback");
const avatarWrapper = document.querySelector(".avatar-wrapper");

const profileName = $("profileName");
const profileRole = $("profileRole");
const profileWelcome = $("profileWelcome");
const profileBio = $("profileBio");

const detailName = $("detailName");
const detailRole = $("detailRole");
const detailLocation = $("detailLocation");
const locationDetail = $("locationDetail");
const privateInformationNote = $("privateInformationNote");

const profilePhotoInput = $("profilePhotoInput");
const changePhotoButton = $("changePhotoButton");

const createDiscussionSection = $("createDiscussionSection");
const newDiscussionForm = $("newDiscussionForm");
const newDiscussionContent = $("newDiscussionContent");
const newDiscussionButton = $("newDiscussionButton");
const newDiscussionMessage = $("newDiscussionMessage");

const memberPosts = $("memberPosts");
const postCount = $("postCount");
const timelineTitle = $("timelineTitle");

const logoutButton = $("logoutButton");

// NEW: Admin Dashboard navigation link
const adminDashboardLink = $("adminDashboardLink");


// ==========================================
// 2. PROFILE VARIABLES
// ==========================================

const params = new URLSearchParams(window.location.search);
const requestedMemberId = params.get("id");

let currentUser = null;
let profileOwnerId = null;
let isOwnProfile = false;
let currentProfile = null;


// ==========================================
// 3. FORMAT POST TIME
// ==========================================

function formatTime(value) {
    const date = new Date(value);

    const seconds = Math.floor(
        (Date.now() - date.getTime()) / 1000
    );

    if (!Number.isFinite(seconds) || seconds < 0) {
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


// ==========================================
// 4. DISPLAY PROFILE PHOTO
// ==========================================

function showProfilePhoto(photoUrl, name) {
    const letter = name.trim().charAt(0).toUpperCase() || "?";

    avatarFallback.textContent = letter;

    profileAvatar.hidden = true;
    avatarFallback.hidden = false;

    profileAvatar.removeAttribute("src");

    if (!photoUrl) return;

    profileAvatar.onload = () => {
        profileAvatar.hidden = false;
        avatarFallback.hidden = true;
    };

    profileAvatar.onerror = () => {
        profileAvatar.hidden = true;
        avatarFallback.hidden = false;
    };

    profileAvatar.src = photoUrl;
}


// ==========================================
// 5. CREATE DISCUSSION CARD
// ==========================================

function createPostCard(post, name, photoUrl) {
    const card = document.createElement("article");
    card.className = "post-card";

    const top = document.createElement("div");
    top.className = "post-top";

    if (photoUrl) {
        const image = document.createElement("img");

        image.className = "post-avatar";
        image.src = photoUrl;
        image.alt = "";
        image.draggable = false;

        image.addEventListener("error", () => {
            const fallback = document.createElement("div");

            fallback.className = "post-avatar-fallback";
            fallback.textContent =
                name.charAt(0).toUpperCase() || "?";

            image.replaceWith(fallback);
        });

        top.appendChild(image);

    } else {
        const fallback = document.createElement("div");

        fallback.className = "post-avatar-fallback";
        fallback.textContent =
            name.charAt(0).toUpperCase() || "?";

        top.appendChild(fallback);
    }

    const authorDetails = document.createElement("div");

    const author = document.createElement("p");
    author.className = "post-author";
    author.textContent = name;

    const time = document.createElement("p");
    time.className = "post-time";
    time.textContent = formatTime(post.created_at);

    authorDetails.append(author, time);
    top.appendChild(authorDetails);

    const content = document.createElement("p");
    content.className = "post-content";
    content.textContent = post.content;

    card.append(top, content);

    return card;
}


// ==========================================
// 6. LOAD MEMBER DISCUSSIONS
// ==========================================

async function loadProfilePosts(name, photoUrl) {
    const { data, error } = await supabase
        .from("posts")
        .select("id, author_id, content, created_at")
        .eq("author_id", profileOwnerId)
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) throw error;

    memberPosts.replaceChildren();

    const posts = data || [];

    postCount.textContent =
        `${posts.length} ${
            posts.length === 1 ? "discussion" : "discussions"
        }`;

    if (posts.length === 0) {
        const empty = document.createElement("p");

        empty.className = "empty-posts";
        empty.textContent = "No discussions shared yet.";

        memberPosts.appendChild(empty);
        return;
    }

    posts.forEach((post) => {
        memberPosts.appendChild(
            createPostCard(post, name, photoUrl)
        );
    });
}


// ==========================================
// 7. LOAD PROFILE INFORMATION
// ==========================================

async function loadProfile() {
    try {
        // Check signed-in user.
        const { data: authData, error: authError } =
            await supabase.auth.getUser();

        if (authError || !authData.user) {
            window.location.href = "../login.html";
            return;
        }

        currentUser = authData.user;

        // Check the signed-in user's role and approval.
        const { data: viewer, error: viewerError } =
            await supabase
                .from("profiles")
                .select("role, approval_status")
                .eq("id", currentUser.id)
                .single();

        if (
            viewerError ||
            viewer?.approval_status !== "approved"
        ) {
            await supabase.auth.signOut();
            window.location.href = "../login.html";
            return;
        }

        // SHOW ADMIN DASHBOARD ONLY TO APPROVED ADMINS.
        if (adminDashboardLink) {
            const isApprovedAdmin =
                viewer.role === "admin" &&
                viewer.approval_status === "approved";

            adminDashboardLink.hidden = !isApprovedAdmin;
        }

        // Select whose profile to display.
        profileOwnerId = requestedMemberId || currentUser.id;
        isOwnProfile = profileOwnerId === currentUser.id;

        // Load public profile information.
        const { data: profile, error: profileError } =
            await supabase
                .from("profiles")
                .select(
                    "id, display_name, role, bio, avatar_url, approval_status"
                )
                .eq("id", profileOwnerId)
                .single();

        if (
            profileError ||
            !profile ||
            profile.approval_status !== "approved"
        ) {
            throw new Error("This profile is unavailable.");
        }

        currentProfile = profile;

        const name = profile.display_name || "PrivateSpace Member";
        const photoUrl = profile.avatar_url || "";

        // Display public information.
        profileName.textContent = name;
        profileRole.textContent = profile.role || "member";

        profileBio.textContent =
            profile.bio?.trim() || "No biography added yet.";

        detailName.textContent = name;
        detailRole.textContent = profile.role || "member";

        showProfilePhoto(photoUrl, name);


        // ==================================
        // OWNER'S PROFILE
        // ==================================

        if (isOwnProfile) {
            profileWelcome.textContent =
                "Welcome back to your profile";

            timelineTitle.textContent = "My Discussions";

            createDiscussionSection.hidden = false;

            avatarWrapper?.classList.remove("view-only");

            // Load only the owner's private details.
            const { data: privateDetails, error: privateError } =
                await supabase
                    .from("private_profile_details")
                    .select("province, district, profile_completed")
                    .eq("user_id", currentUser.id)
                    .maybeSingle();

            if (privateError) throw privateError;

            if (!privateDetails?.profile_completed) {
                window.location.href = "./profile-setup.html";
                return;
            }

            detailLocation.textContent = [
                privateDetails.province,
                privateDetails.district
            ].filter(Boolean).join(" · ") || "Not added";

            locationDetail.hidden = false;

            privateInformationNote.textContent =
                "Your date of birth and email are private.";
        }


        // ==================================
        // ANOTHER MEMBER'S PROFILE
        // ==================================

        else {
            profileWelcome.textContent =
                "PrivateSpace member profile";

            timelineTitle.textContent = "Discussions";

            createDiscussionSection.hidden = true;

            avatarWrapper?.classList.add("view-only");

            locationDetail.hidden = true;

            privateInformationNote.textContent =
                "Private account information is not displayed.";
        }

        await loadProfilePosts(name, photoUrl);

        profileLoading.hidden = true;
        profileContent.hidden = false;

    } catch (error) {
        console.error("Profile loading error:", error);

        profileLoading.hidden = true;

        profileError.textContent =
            error.message || "Unable to load your profile.";

        profileError.hidden = false;
    }
}


// ==========================================
// 8. OPEN PHOTO SELECTOR
// ==========================================

if (changePhotoButton && profilePhotoInput) {
    changePhotoButton.addEventListener("click", () => {
        if (isOwnProfile) {
            profilePhotoInput.click();
        }
    });
}


// ==========================================
// 9. UPLOAD PROFILE PHOTO
// ==========================================

if (profilePhotoInput) {
    profilePhotoInput.addEventListener("change", async () => {
        const selectedPhoto = profilePhotoInput.files?.[0];

        if (!selectedPhoto || !currentUser || !isOwnProfile) {
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(selectedPhoto.type)) {
            alert("Choose a JPG, PNG or WebP image.");
            profilePhotoInput.value = "";
            return;
        }

        if (selectedPhoto.size > 1024 * 1024) {
            alert("Your photo must be smaller than 1 MB.");
            profilePhotoInput.value = "";
            return;
        }

        changePhotoButton.disabled = true;
        changePhotoButton.textContent = "Uploading...";

        try {
            const extension = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp"
            }[selectedPhoto.type];

            const filePath =
                `${currentUser.id}/profile-photo.${extension}`;

            const { data, error } = await supabase.storage
                .from("avatars")
                .upload(filePath, selectedPhoto, {
                    upsert: true,
                    contentType: selectedPhoto.type
                });

            if (error) throw error;

            const { data: imageData } = supabase.storage
                .from("avatars")
                .getPublicUrl(filePath);

            const photoUrl =
                `${imageData.publicUrl}?updated=${Date.now()}`;

            const { error: updateError } = await supabase
                .from("profiles")
                .update({
                    avatar_url: photoUrl
                })
                .eq("id", currentUser.id);

            if (updateError) throw updateError;

            currentProfile.avatar_url = photoUrl;

            showProfilePhoto(
                photoUrl,
                currentProfile.display_name || "Member"
            );

            await loadProfilePosts(
                currentProfile.display_name || "Member",
                photoUrl
            );

            alert("Your profile picture has been updated!");

        } catch (error) {
            console.error("Photo upload error:", error);

            alert(
                error.message ||
                "Photo upload failed. Please try again."
            );

        } finally {
            changePhotoButton.disabled = false;
            changePhotoButton.textContent = "Change photo";

            profilePhotoInput.value = "";
        }
    });
}


// ==========================================
// 10. PUBLISH A DISCUSSION
// ==========================================

if (newDiscussionForm) {
    newDiscussionForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!isOwnProfile || !currentUser) return;

        const content = newDiscussionContent.value.trim();

        if (!content) {
            newDiscussionMessage.textContent =
                "Please write something first.";
            return;
        }

        newDiscussionButton.disabled = true;
        newDiscussionButton.textContent = "Publishing...";
        newDiscussionMessage.textContent = "";

        try {
            const { error } = await supabase
                .from("posts")
                .insert({
                    author_id: currentUser.id,
                    content: content
                });

            if (error) throw error;

            newDiscussionContent.value = "";

            newDiscussionMessage.textContent =
                "Your discussion has been published!";

            await loadProfilePosts(
                currentProfile.display_name || "Member",
                currentProfile.avatar_url || ""
            );

        } catch (error) {
            console.error("Publishing error:", error);

            newDiscussionMessage.textContent =
                "Could not publish. Please try again.";

        } finally {
            newDiscussionButton.disabled = false;
            newDiscussionButton.textContent = "Publish";
        }
    });
}


// ==========================================
// 11. SIGN OUT
// ==========================================

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Sign out error:", error);

            logoutButton.disabled = false;
            alert("Unable to sign out. Please try again.");
            return;
        }

        window.location.href = "../login.html";
    });
}


// ==========================================
// 12. START PROFILE
// ==========================================

loadProfile();
