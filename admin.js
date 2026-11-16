
import { supabase } from "./supabase.js";

// ========================================
// 1. PAGE ELEMENTS
// ========================================

const loading = document.getElementById("dashboardLoading");
const dashboardError = document.getElementById("dashboardError");
const errorMessage = document.getElementById("errorMessage");
const dashboardContent = document.getElementById("dashboardContent");

const adminName = document.getElementById("adminName");
const adminAvatar = document.getElementById("adminAvatar");
const welcomeName = document.getElementById("welcomeName");

const totalMembers = document.getElementById("totalMembers");
const pendingMembers = document.getElementById("pendingMembers");
const approvedMembers = document.getElementById("approvedMembers");
const rejectedMembers = document.getElementById("rejectedMembers");

const pendingList = document.getElementById("pendingList");
const allMembersList = document.getElementById("allMembersList");

const pendingCountLabel = document.getElementById("pendingCountLabel");
const noPendingMessage = document.getElementById("noPendingMessage");
const noMembersMessage = document.getElementById("noMembersMessage");

const memberSearch = document.getElementById("memberSearch");
const statusFilter = document.getElementById("statusFilter");

const refreshButton = document.getElementById("refreshButton");
const logoutButton = document.getElementById("logoutButton");

const dashboardMessage = document.getElementById("dashboardMessage");


// ========================================
// 2. DATA
// ========================================

let currentAdmin = null;
let members = [];
let updatingMemberId = null;


// ========================================
// 3. MESSAGES
// ========================================

function showMessage(message, isError = false) {
    dashboardMessage.textContent = message;
    dashboardMessage.hidden = false;

    dashboardMessage.style.background = isError
        ? "#fff1f2"
        : "#e8f8f0";

    dashboardMessage.style.color = isError
        ? "#a52c3a"
        : "#14734f";
}

function showAccessError(message) {
    loading.hidden = true;
    dashboardContent.hidden = true;
    dashboardError.hidden = false;

    errorMessage.textContent = message;
}


// ========================================
// 4. CHECK ADMIN ACCESS
// ========================================

async function checkAdminAccess() {
    try {
        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user) {
            window.location.replace("./login.html");
            return;
        }

        const { data: profile, error: profileError } =
            await supabase
                .from("profiles")
                .select("id, display_name, role, approval_status")
                .eq("id", data.user.id)
                .maybeSingle();

        if (profileError || !profile) {
            showAccessError("Your account profile could not be verified.");
            return;
        }

        if (
            profile.role !== "admin" ||
            profile.approval_status !== "approved"
        ) {
            showAccessError("You do not have approved administrator access.");
            return;
        }

        currentAdmin = profile;

        const name = profile.display_name || "Administrator";

        adminName.textContent = name;
        welcomeName.textContent = name;
        adminAvatar.textContent = name.trim().charAt(0).toUpperCase() || "A";

        loading.hidden = true;
        dashboardError.hidden = true;
        dashboardContent.hidden = false;

        await loadMembers();

    } catch (error) {
        console.error("Admin access error:", error);
        showAccessError("Something went wrong while checking administrator access.");
    }
}


// ========================================
// 5. LOAD MEMBERS
// ========================================

async function loadMembers() {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";

    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("id, display_name, role, approval_status, created_at, avatar_url")
            .eq("role", "member")
            .order("created_at", { ascending: false });

        if (error) throw error;

        members = data || [];

        updateStatistics();
        renderPendingMembers();
        renderAllMembers();

        dashboardMessage.hidden = true;

    } catch (error) {
        console.error("Member loading error:", error);

        showMessage(
            "Could not load members. Please check your database permissions.",
            true
        );

    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = "↻ Refresh data";
    }
}


// ========================================
// 6. UPDATE STATISTICS
// ========================================

function updateStatistics() {
    const pending = members.filter(
        member => member.approval_status === "pending"
    ).length;

    const approved = members.filter(
        member => member.approval_status === "approved"
    ).length;

    const rejected = members.filter(
        member => member.approval_status === "rejected"
    ).length;

    totalMembers.textContent = members.length;
    pendingMembers.textContent = pending;
    approvedMembers.textContent = approved;
    rejectedMembers.textContent = rejected;

    pendingCountLabel.textContent =
        `${pending} request${pending === 1 ? "" : "s"}`;
}


// ========================================
// 7. CREATE AVATAR
// ========================================

function createAvatar(member) {
    const avatar = document.createElement("div");
    avatar.className = "member-avatar";

    const name = member.display_name || "Member";

    if (member.avatar_url) {
        const image = document.createElement("img");

        image.src = member.avatar_url;
        image.alt = `${name}'s profile picture`;

        image.addEventListener("error", () => {
            avatar.replaceChildren();
            avatar.textContent = name.trim().charAt(0).toUpperCase() || "M";
        });

        avatar.appendChild(image);
    } else {
        avatar.textContent = name.trim().charAt(0).toUpperCase() || "M";
    }

    return avatar;
}


// ========================================
// 8. CREATE MEMBER ROW
// ========================================

function createMemberRow(member, showActions = false) {
    const row = document.createElement("article");
    row.className = "member-row";

    const name = member.display_name || "Unnamed member";

    const avatar = createAvatar(member);

    const information = document.createElement("div");
    information.className = "member-information";

    const heading = document.createElement("h3");
    heading.textContent = name;

    const details = document.createElement("p");

    const joinedDate = member.created_at
        ? new Date(member.created_at).toLocaleDateString()
        : "Date unavailable";

    details.textContent = `Member · Joined ${joinedDate}`;

    information.append(heading, details);

    const actions = document.createElement("div");
    actions.className = "member-actions";

    const status = document.createElement("span");
    const approvalStatus = member.approval_status || "unknown";

    status.className = `member-status ${approvalStatus}`;
    status.textContent = approvalStatus;

    actions.appendChild(status);

    if (showActions && approvalStatus === "pending") {
        const approveButton = document.createElement("button");

        approveButton.type = "button";
        approveButton.className = "action-button approve-button";
        approveButton.textContent = "Approve";
        approveButton.disabled = updatingMemberId !== null;

        approveButton.addEventListener("click", () => {
            updateMemberApproval(member.id, "approved");
        });

        const rejectButton = document.createElement("button");

        rejectButton.type = "button";
        rejectButton.className = "action-button reject-button";
        rejectButton.textContent = "Reject";
        rejectButton.disabled = updatingMemberId !== null;

        rejectButton.addEventListener("click", () => {
            updateMemberApproval(member.id, "rejected");
        });

        actions.append(approveButton, rejectButton);
    }

    row.append(avatar, information, actions);

    return row;
}


// ========================================
// 9. PENDING MEMBERS
// ========================================

function renderPendingMembers() {
    pendingList.replaceChildren();

    const pending = members.filter(
        member => member.approval_status === "pending"
    );

    noPendingMessage.hidden = pending.length !== 0;

    pending.forEach(member => {
        pendingList.appendChild(createMemberRow(member, true));
    });
}


// ========================================
// 10. ALL MEMBERS
// ========================================

function renderAllMembers() {
    allMembersList.replaceChildren();

    const searchText = memberSearch.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;

    const filteredMembers = members.filter(member => {
        const name = (member.display_name || "").toLowerCase();

        const matchesName = name.includes(searchText);

        const matchesStatus =
            selectedStatus === "all" ||
            member.approval_status === selectedStatus;

        return matchesName && matchesStatus;
    });

    noMembersMessage.hidden = filteredMembers.length !== 0;

    filteredMembers.forEach(member => {
        allMembersList.appendChild(createMemberRow(member));
    });
}


// ========================================
// 11. APPROVE OR REJECT
// ========================================

async function updateMemberApproval(userId, newStatus) {
    if (updatingMemberId !== null) return;

    const member = members.find(item => item.id === userId);

    if (!member) return;

    const actionName = newStatus === "approved" ? "approve" : "reject";
    const memberName = member.display_name || "this member";

    const confirmed = window.confirm(
        `Are you sure you want to ${actionName} ${memberName}?`
    );

    if (!confirmed) return;

    updatingMemberId = userId;
    renderPendingMembers();

    try {
        const { error } = await supabase.rpc(
            "admin_set_member_approval",
            {
                p_user_id: userId,
                p_status: newStatus
            }
        );

        if (error) throw error;

        showMessage(`${memberName} has been ${newStatus} successfully.`);

        await loadMembers();

    } catch (error) {
        console.error("Approval error:", error);

        showMessage(
            error.message || "Unable to update member status.",
            true
        );

    } finally {
        updatingMemberId = null;
        renderPendingMembers();
    }
}


// ========================================
// 12. SEARCH AND FILTER
// ========================================

memberSearch.addEventListener("input", renderAllMembers);
statusFilter.addEventListener("change", renderAllMembers);


// ========================================
// 13. REFRESH
// ========================================

refreshButton.addEventListener("click", loadMembers);


// ========================================
// 14. SIGN OUT
// ========================================

logoutButton.addEventListener("click", async () => {
    const confirmed = window.confirm("Are you sure you want to sign out?");

    if (!confirmed) return;

    logoutButton.disabled = true;
    logoutButton.textContent = "Signing out...";

    try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace("./login.html");

    } catch (error) {
        console.error("Sign out error:", error);

        showMessage("Unable to sign out. Please try again.", true);

        logoutButton.disabled = false;
        logoutButton.textContent = "↪ Sign out";
    }
});


// ========================================
// 15. START DASHBOARD
// ========================================

checkAdminAccess();
