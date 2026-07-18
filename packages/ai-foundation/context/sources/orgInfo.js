// Reads basic org info for each participant org. Read-only — never writes.
async function getOrgInfo(db, orgIds) {
  const results = await Promise.all(
    orgIds.map(async (orgId) => {
      const snap = await db.collection('organizations').doc(orgId).get();
      if (!snap.exists) return null;
      const data = snap.data();
      return { id: orgId, name: data.name, type: data.type };
    })
  );
  return results.filter(Boolean);
}

module.exports = { getOrgInfo };
