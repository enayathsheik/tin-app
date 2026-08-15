// Tenancy — organizations, memberships, and org-context helpers.
//
// Org-native, not user-native: every business object belongs to an
// organization, never a person. A solo retailer is an organization of one —
// there is no user-native path. All writes to organizations/memberships go
// through the helpers below; do not write these documents ad-hoc elsewhere.
//
// See firestore.rules for the matching tenant-isolation rules (mId, member,
// hasRole, isActiveMember) that these shapes are designed against.
import {
  collection, doc, getDoc, getDocs, query, where,
  serverTimestamp, updateDoc, setDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase/config";

const ORGANIZATIONS = "organizations";
const MEMBERSHIPS = "memberships";

const membershipId = (orgId, uid) => `${orgId}_${uid}`;

const DEFAULT_CAPABILITIES = {
  teams: false,
  roles: false,
  channels: false,
  externalCollab: false,
};

// Returns uid's own active owner membership + org, or null if they don't
// own one yet. Used by createOrganization to stay idempotent.
async function findOwnedOrg(uid) {
  const snap = await getDocs(
    query(collection(db, MEMBERSHIPS), where("uid", "==", uid), where("role", "==", "owner"))
  );
  const ownerMembership = snap.docs.find(d => d.data().status === "active");
  if (!ownerMembership) return null;
  const orgId = ownerMembership.data().orgId;
  const orgSnap = await getDoc(doc(db, ORGANIZATIONS, orgId));
  if (!orgSnap.exists()) return null;
  return { orgId, org: { id: orgId, ...orgSnap.data() }, membership: { id: ownerMembership.id, ...ownerMembership.data() } };
}

// Creates an organization plus its owner membership (createdBy = current
// uid). Idempotent: if the signed-in user already owns an org (anywhere —
// including a legacy random-id org from before this used a deterministic
// id), returns it instead of creating a duplicate.
//
// The solo org this creates always lives at organizations/{uid}: a stable,
// deterministic id means repeat calls can detect exactly what's missing
// instead of guessing. This also makes each write self-healing — if a
// previous call committed the org but never reached the membership write
// (tab closed, network drop), the next call sees the org already there and
// writes only the missing membership.
//
// The org and membership writes are deliberately two separate, ordered
// commits rather than one batch: the memberships create rule does a
// cross-doc get() on the org to verify createdBy, and within a single
// batch/transaction that get() sees pre-commit state — the sibling org
// write in the same batch isn't visible yet, so the get() finds nothing
// and the rule denies the write. Committing the org first (and awaiting
// it) guarantees the membership rule's get() sees it.
export async function createOrganization({ name, type }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("createOrganization: must be signed in");
  if (!name || !type) throw new Error("createOrganization: name and type required");

  const existing = await findOwnedOrg(uid);
  if (existing) return existing;

  const orgRef = doc(db, ORGANIZATIONS, uid);
  const memberRef = doc(db, MEMBERSHIPS, membershipId(uid, uid));
  const [orgSnap, memberSnap] = await Promise.all([getDoc(orgRef), getDoc(memberRef)]);

  let org;
  if (orgSnap.exists()) {
    org = { id: uid, ...orgSnap.data() };
  } else {
    const orgData = {
      name,
      type,
      createdAt: serverTimestamp(),
      createdBy: uid,
      capabilities: { ...DEFAULT_CAPABILITIES },
    };
    await setDoc(orgRef, orgData);
    org = { id: uid, ...orgData };
  }

  let membership;
  if (memberSnap.exists()) {
    membership = { id: memberRef.id, ...memberSnap.data() };
  } else {
    const memberData = {
      orgId: uid,
      uid,
      role: "owner",
      teamIds: [],
      status: "active",
      createdAt: serverTimestamp(),
    };
    await setDoc(memberRef, memberData);
    membership = { id: memberRef.id, ...memberData };
  }

  return { orgId: uid, org, membership };
}

// Returns the user's active memberships — drives which tenants they can see.
export async function getMemberships(uid) {
  const snap = await getDocs(
    query(collection(db, MEMBERSHIPS), where("uid", "==", uid), where("status", "==", "active"))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Returns the user's current/default org context: their active memberships
// plus the org doc for the primary one (owner membership preferred, else
// the first active membership). Returns null if the user is not an active
// member of any org.
export async function resolveActiveOrg(uid) {
  const memberships = await getMemberships(uid);
  if (memberships.length === 0) return null;

  const primary = memberships.find(m => m.role === "owner") || memberships[0];
  const orgSnap = await getDoc(doc(db, ORGANIZATIONS, primary.orgId));
  if (!orgSnap.exists()) return null;

  return { orgId: primary.orgId, org: { id: primary.orgId, ...orgSnap.data() }, membership: primary, memberships };
}

// Derives capabilities from what entities actually exist in the tenant, and
// persists the result onto organizations/{orgId}.capabilities.
//
// Phase 1 has no teams/channels/external-collab entities yet, so all three
// stay false — do NOT fake them to true ahead of the entities existing.
// Phase B+ should extend this to query the relevant collections (e.g. a
// non-empty teams subcollection flips `teams: true`) rather than hardcode.
export async function recomputeCapabilities(orgId) {
  const capabilities = { ...DEFAULT_CAPABILITIES };
  await updateDoc(doc(db, ORGANIZATIONS, orgId), { capabilities });
  return capabilities;
}

// Bootstrap: on admin/first login, if the signed-in user has no owner
// membership anywhere, give them a personal org so there is a live tenant.
// Idempotent via createOrganization — safe to call on every login.
export async function bootstrapOwnerOrg({ name, type }) {
  return createOrganization({ name, type });
}

// Minimal member provisioning — an owner/admin adds a known uid to their org
// with a role. Matches firestore.rules' memberships create rule exactly
// (hasRole(orgId, ['owner','admin'])); no rule change needed.
//
// displayName is admin-supplied rather than looked up, because users/{uid}
// is self-read-only in firestore.rules (no admin exception) — the admin
// can't resolve a stranger's uid to a name via the client SDK. Denormalizing
// it here is what lets the conversations UI show a human label for this
// member without ever reading their user doc.
export async function createMembership({ orgId, uid, role, displayName = "" }) {
  if (!orgId || !uid || !role) throw new Error("createMembership: orgId, uid, role required");
  await setDoc(doc(db, MEMBERSHIPS, membershipId(orgId, uid)), {
    orgId,
    uid,
    role,
    displayName,
    teamIds: [],
    status: "active",
    createdAt: serverTimestamp(),
  });
}
