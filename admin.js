
import { supabase } from "./supabase.js";

// ========================================
// 1. GET PAGE ELEMENTS
// ========================================

const loading = document.getElementById("dashboardLoading");
const dashboardError = document.getElementById("dashboardError");
const errorMessage = document.getElementById("errorMessage");
const dashboardContent = document.getElementById("dashboardContent");

const adminName = document.getElementById("adminName");
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
// 2. STORE DATA
// ========================================

let currentAdmin = null;
let members = [];


// ========================================
// 3. SHOW MESSAGES
// ========================================

function showDashboardMessage(message, isError = false) {
    dashboardMessage.textContent = message;
    dashboardMessage.hidden = false;

    dashboardMessage.style.background = isError ? "#fff1f2" : "#e8f8f0";
    dashboardMessage.style.color = isError ? "#a52c3a" : "#14734f";
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
        const { data: userData, error: authError } =
            await supabase.auth.getUser();

        if (authError || !userData.user) {
            window.location.href = "../login.html";
            return;
        }

        const user = userData.user;

        const { data: profile, error: profileError } =
            await supabase
                .from("profiles")
                .select("id, display_name, role, approval_status")
                .eq("id", user.id)
                .maybeSingle();

        if (profileError || !profile) {
            showAccessError("Your profile could not be verified.");
            return;
        }

        if (
            profile.role !== "admin" ||
            profile.approval_status !== "approved"
        ) {
            showAccessError(
                "You do not have approved administrator access."
            );
            return;
        }

        currentAdmin = profile;

        const name = profile.display_name || "Administrator";

        adminName.textContent = name;
        welcomeName.textContent = name;

        loading.hidden = true;
        dashboardError.hidden = true;
        dashboardContent.hidden = false;

        await loadMembers();

    } catch (error) {
        console.error("Admin access error:", error);
        showAccessError("Something went wrong while checking access.");
    }
}


// ========================================
// 5. LOAD MEMBERS FROM SUPABASE
// ========================================

async function loadMembers() {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";

    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("id, display_name, role, approval_status, created_at")
            .eq("role", "member")
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        members = data || [];

        updateStatistics();
        renderPendingMembers();
        renderAllMembers();

        dashboardMessage.hidden = true;

    } catch (error) {
        console.error("Member loading error:", error);

        showDashboardMessage(
            "Could not load members. Please check your database permissions.",
            true
        );

    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = "↻ Refresh data";
    }
}


// ========================================
// 6. UPDATE DASHBOARD STATISTICS
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
// 7. CREATE MEMBER AVATAR
// ========================================

function createAvatar(name) {
    const avatar = document.createElement("div");

    avatar.className = "member-avatar";

    avatar.textContent = (
        name.trim().charAt(0) || "M"
    ).toUpperCase();

    return avatar;
}


// ========================================
// 8. CREATE MEMBER ROW
// ========================================

function createMemberRow(member, showActions = false) {
    const row = document.createElement("article");
    row.className = "member-row";

    const name = member.display_name || "Unnamed member";

    const avatar = createAvatar(name);

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
    status.className =
        `member-status ${member.approval_status}`;

    status.textContent = member.approval_status || "unknown";

    actions.appendChild(status);

    if (
        showActions &&
        member.approval_status === "pending"
    ) {
        const approveButton = document.createElement("button");

        approveButton.className =
            "action-button approve-button";

        approveButton.textContent = "Approve";

        approveButton.addEventListener("click", () => {
            updateMemberApproval(member.id, "approved");
        });

        const rejectButton = document.createElement("button");

        rejectButton.className =
            "action-button reject-button";

        rejectButton.textContent = "Reject";

        rejectButton.addEventListener("click", () => {
            updateMemberApproval(member.id, "rejected");
        });

        actions.append(approveButton, rejectButton);
    }

    row.append(avatar, information, actions);

    return row;
}


// ========================================
// 9. SHOW PENDING MEMBERS
// ========================================

function renderPendingMembers() {
    pendingList.replaceChildren();

    const pending = members.filter(
        member => member.approval_status === "pending"
    );

    noPendingMessage.hidden = pending.length !== 0;

    pending.forEach(member => {
        pendingList.appendChild(
            createMemberRow(member, true)
        );
    });
}


// ========================================
// 10. SHOW ALL MEMBERS
// ========================================

function renderAllMembers() {
    allMembersList.replaceChildren();

    const searchText = memberSearch.value
        .trim()
        .toLowerCase();

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
        allMembersList.appendChild(
            createMemberRow(member, false)
        );
    });
}


// ========================================
// 11. APPROVE OR REJECT MEMBER
// ========================================

async function updateMemberApproval(userId, newStatus) {
    const member = members.find(
        item => item.id === userId
    );

    if (!member) {
        return;
    }

    const actionName =
        newStatus === "approved" ? "approve" : "reject";

    const confirmed = window.confirm(
        `Are you sure you want to ${actionName} ${member.display_name || "this member"}?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const buttons = document.querySelectorAll(
            ".member-actions button"
        );

        buttons.forEach(button => {
            button.disabled = true;
        });

        const { error } = await supabase.rpc(
            "admin_set_member_approval",
            {
                p_user_id: userId,
                p_status: newStatus
            }
        );

        if (error) {
            throw error;
        }

        showDashboardMessage(
            `Member ${newStatus} successfully.`
        );

        await loadMembers();

    } catch (error) {
        console.error("Approval error:", error);

        showDashboardMessage(
            error.message || "Unable to update member status.",
            true
        );

        renderPendingMembers();
    }
}


// ========================================
// 12. SEARCH AND FILTER
// ========================================

memberSearch.addEventListener("input", renderAllMembers);

statusFilter.addEventListener("change", renderAllMembers);


// ========================================
// 13. REFRESH DASHBOARD
// ========================================

refreshButton.addEventListener("click", loadMembers);


// ========================================
// 14. SIGN OUT
// ========================================

logoutButton.addEventListener("click", async () => {
    const confirmed = window.confirm(
        "Are you sure you want to sign out?"
    );

    if (!confirmed) {
        return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
        showDashboardMessage(
            "Unable to sign out. Please try again.",
            true
        );
        return;
    }

    window.location.href = "../login.html";
});


// ========================================
// 15. START DASHBOARD
// ========================================

checkAdminAccess();
