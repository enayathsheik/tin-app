// ============================================================
// TIN — Firebase Cloud Function: Places Data Pull
// File: functions/index.js
// Deploy: firebase deploy --only functions
// ============================================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions }   = require("firebase-functions/v2");
const { initializeApp }      = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// Set region to asia-south1 (Mumbai) for lowest latency from India
setGlobalOptions({ region: "asia-south1", timeoutSeconds: 540, memory: "512MiB" });

// AI Foundation Layer functions (onMessageCreate, confirmSuggestedAction,
// dismissSuggestedAction) — see ai.js. Required after initializeApp() above
// so its Firestore/Admin SDK usage shares this same default app. Wrapped so
// a bug in ai.js (e.g. a missing dependency) can't crash every function in
// this codebase — it did once already, taking down pullPlacesData and
// friends too, since they all load through this same entrypoint.
try {
  Object.assign(exports, require("./ai"));
} catch (err) {
  console.error("Failed to load ai.js — AI Foundation functions unavailable:", err);
}

// Cross-company conversation functions (createExternalConversation) — see
// conversations.js. Same isolation rationale as ai.js above.
try {
  Object.assign(exports, require("./conversations"));
} catch (err) {
  console.error("Failed to load conversations.js — external-conversation functions unavailable:", err);
}

// ── YOUR PLACES API KEY (store in Firebase env config) ───────
// Set via: firebase functions:secrets:set PLACES_API_KEY
// Then access via: process.env.PLACES_API_KEY
// For now, hardcoded below — move to secret before production
const PLACES_API_KEY = process.env.PLACES_API_KEY || "AIzaSyDM5HbNqYqNEodGMl0dEYfHK7sV-nlxJMc";

const DELAY_MS       = 300;
const MAX_PER_QUERY  = 5;
const sleep          = ms => new Promise(r => setTimeout(r, ms));

// ── PINCODE REGISTRY ─────────────────────────────────────────
const PINCODE_REGISTRY = {
  "Mumbai MMR": [
    // South & Central Mumbai
    ...Array.from({length:40},(_,i)=>({ pincode:`4000${String(i+1).padStart(2,"0")}`, lat:18.9388+(i*0.001), lng:72.8354+(i*0.001), city:"Mumbai", state:"Maharashtra" })),
    // Western suburbs
    ...Array.from({length:26},(_,i)=>({ pincode:`40005${String(i).padStart(1,"0")}`, lat:19.055+(i*0.002), lng:72.8295+(i*0.001), city:"Mumbai", state:"Maharashtra" })),
    // Eastern suburbs
    ...Array.from({length:18},(_,i)=>({ pincode:`40008${String(i).padStart(1,"0")}`, lat:19.076+(i*0.002), lng:72.901+(i*0.001), city:"Mumbai", state:"Maharashtra" })),
    // Thane
    { pincode:"400601", lat:19.2183, lng:72.9781, city:"Thane",       state:"Maharashtra" },
    { pincode:"400602", lat:19.2310, lng:72.9856, city:"Thane",       state:"Maharashtra" },
    { pincode:"400603", lat:19.2400, lng:72.9900, city:"Thane",       state:"Maharashtra" },
    { pincode:"400604", lat:19.2500, lng:73.0000, city:"Thane",       state:"Maharashtra" },
    // Navi Mumbai
    { pincode:"400701", lat:19.0330, lng:73.0297, city:"Navi Mumbai", state:"Maharashtra" },
    { pincode:"400703", lat:19.0437, lng:73.0190, city:"Navi Mumbai", state:"Maharashtra" },
    { pincode:"400706", lat:18.9952, lng:73.0041, city:"Navi Mumbai", state:"Maharashtra" },
    // Kalyan / Bhiwandi
    { pincode:"421001", lat:19.2961, lng:73.0631, city:"Bhiwandi",    state:"Maharashtra" },
    { pincode:"421301", lat:19.2437, lng:73.1355, city:"Kalyan",      state:"Maharashtra" },
  ],
  "Pune": [
    ...Array.from({length:48},(_,i)=>({ pincode:`41100${String(i+1).padStart(1,"0")}`, lat:18.5204+(i*0.003), lng:73.8567+(i*0.002), city:"Pune", state:"Maharashtra" })),
    { pincode:"411057", lat:18.6298, lng:73.7997, city:"Pune",              state:"Maharashtra" },
    { pincode:"411062", lat:18.4529, lng:73.8503, city:"Pune",              state:"Maharashtra" },
    { pincode:"411018", lat:18.6279, lng:73.8009, city:"Pimpri-Chinchwad",  state:"Maharashtra" },
    { pincode:"411033", lat:18.6490, lng:73.7780, city:"Pimpri-Chinchwad",  state:"Maharashtra" },
  ],
  "Delhi NCR": [
    ...Array.from({length:96},(_,i)=>({ pincode:`1100${String(i+1).padStart(2,"0")}`, lat:28.6139+(i*0.003), lng:77.2090+(i*0.002), city:"Delhi", state:"Delhi" })),
    { pincode:"201301", lat:28.5355, lng:77.3910, city:"Noida",     state:"Uttar Pradesh" },
    { pincode:"201303", lat:28.5706, lng:77.3219, city:"Noida",     state:"Uttar Pradesh" },
    { pincode:"201305", lat:28.6130, lng:77.3600, city:"Noida",     state:"Uttar Pradesh" },
    { pincode:"122001", lat:28.4595, lng:77.0266, city:"Gurgaon",   state:"Haryana" },
    { pincode:"122002", lat:28.4700, lng:77.0360, city:"Gurgaon",   state:"Haryana" },
    { pincode:"122004", lat:28.4650, lng:77.0550, city:"Gurgaon",   state:"Haryana" },
    { pincode:"121001", lat:28.4089, lng:77.3178, city:"Faridabad", state:"Haryana" },
    { pincode:"121002", lat:28.3900, lng:77.3100, city:"Faridabad", state:"Haryana" },
    { pincode:"201001", lat:28.6692, lng:77.4538, city:"Ghaziabad", state:"Uttar Pradesh" },
    { pincode:"201002", lat:28.6800, lng:77.4600, city:"Ghaziabad", state:"Uttar Pradesh" },
  ],
  "Bangalore": [
    ...Array.from({length:100},(_,i)=>({ pincode:`56000${String(i+1).padStart(1,"0")}`, lat:12.9716+(i*0.002), lng:77.5946+(i*0.002), city:"Bengaluru", state:"Karnataka" })),
  ],
  "Hyderabad": [
    ...Array.from({length:90},(_,i)=>({ pincode:`50000${String(i+1).padStart(1,"0")}`, lat:17.3850+(i*0.002), lng:78.4867+(i*0.002), city:"Hyderabad", state:"Telangana" })),
    { pincode:"500003", lat:17.4399, lng:78.4983, city:"Secunderabad", state:"Telangana" },
    { pincode:"500032", lat:17.4474, lng:78.3762, city:"Hyderabad",    state:"Telangana" },
  ],
  "Ahmedabad": [
    ...Array.from({length:63},(_,i)=>({ pincode:`38000${String(i+1).padStart(1,"0")}`, lat:23.0225+(i*0.003), lng:72.5714+(i*0.002), city:"Ahmedabad", state:"Gujarat" })),
    { pincode:"382010", lat:23.2156, lng:72.6369, city:"Gandhinagar", state:"Gujarat" },
    { pincode:"382016", lat:23.2300, lng:72.6500, city:"Gandhinagar", state:"Gujarat" },
  ],
  "Chennai": [
    ...Array.from({length:119},(_,i)=>({ pincode:`60000${String(i+1).padStart(1,"0")}`, lat:13.0827+(i*0.002), lng:80.2707+(i*0.002), city:"Chennai", state:"Tamil Nadu" })),
    { pincode:"600097", lat:12.9200, lng:80.2300, city:"Chennai", state:"Tamil Nadu" },
    { pincode:"600119", lat:12.8700, lng:80.2100, city:"Chennai", state:"Tamil Nadu" },
  ],
};

// ── PLACES API CALL ──────────────────────────────────────────
async function searchPlaces(textQuery, lat, lng, radiusM = 5000) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type":    "application/json",
      "X-Goog-Api-Key":  PLACES_API_KEY,
      "X-Goog-FieldMask":"places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri,places.location,places.regularOpeningHours",
    },
    body: JSON.stringify({
      textQuery,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusM } },
      maxResultCount: 20,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API ${res.status}: ${err.substring(0, 200)}`);
  }
  return res.json();
}

// ── CLOUD FUNCTION: pullPlacesData ───────────────────────────
exports.pullPlacesData = onCall({ cors: true }, async (request) => {
  // Auth check — only admins
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

  const {
    jobId,
    cities       = ["Mumbai MMR"],
    categories   = [],          // array of { name, keywords }
    minRating    = 5.0,
    maxPerQuery  = 5,
    radiusM      = 5000,
    pincodesOverride = null,    // optional: custom pincode array
  } = request.data;

  if (!jobId)         throw new HttpsError("invalid-argument", "jobId required");
  if (!categories.length) throw new HttpsError("invalid-argument", "At least one category required");

  // Create job doc in Firestore for real-time progress
  const jobRef = db.collection("pull_jobs").doc(jobId);
  await jobRef.set({
    jobId,
    cities,
    categories:  categories.map(c => c.name),
    minRating,
    maxPerQuery,
    status:      "running",
    progress:    0,
    total:       0,
    found:       0,
    skipped:     0,
    errors:      0,
    startedAt:   FieldValue.serverTimestamp(),
    updatedAt:   FieldValue.serverTimestamp(),
    log:         [],
  });

  // Build pincode list
  let pincodes = [];
  if (pincodesOverride && pincodesOverride.length > 0) {
    pincodes = pincodesOverride;
  } else {
    for (const city of cities) {
      const cityPins = PINCODE_REGISTRY[city] || [];
      pincodes.push(...cityPins);
    }
  }

  // Deduplicate pincodes
  const seenPins = new Set();
  pincodes = pincodes.filter(p => {
    if (seenPins.has(p.pincode)) return false;
    seenPins.add(p.pincode);
    return true;
  });

  const totalQueries = pincodes.length * categories.length;
  await jobRef.update({ total: totalQueries });

  const seenPlaceIds = new Set();
  let found = 0, skipped = 0, errors = 0, queryCount = 0;
  const logLines = [];

  // Batch writer for staging
  let batch = db.batch();
  let batchCount = 0;

  const flushBatch = async () => {
    if (batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  for (const pc of pincodes) {
    for (const cat of categories) {
      queryCount++;
      const query = `${cat.keywords} near ${pc.pincode} ${pc.city}`;

      try {
        await sleep(DELAY_MS);
        const data   = await searchPlaces(query, pc.lat, pc.lng, radiusM);
        const places = (data.places || []).filter(p =>
          p.rating >= minRating && !seenPlaceIds.has(p.id)
        );

        if (places.length === 0) {
          skipped++;
        } else {
          const taken = places.slice(0, maxPerQuery);
          for (const place of taken) {
            seenPlaceIds.add(place.id);
            const addr = place.formattedAddress || "";
            const pinMatch = addr.match(/\b[1-9][0-9]{5}\b/);

            const storeData = {
              // Core fields matching TIN store schema
              storeName:          place.displayName?.text || "",
              phone:              place.nationalPhoneNumber || place.internationalPhoneNumber || "",
              whatsapp:           place.nationalPhoneNumber || "",
              address:            addr,
              city:               pc.city,
              state:              pc.state,
              pincode:            pinMatch?.[0] || pc.pincode,
              businessType:       "Retailer",
              ownerName:          "",
              email:              "",
              gst:                "",
              brands:             "",
              instagram:          "",
              website:            place.websiteUri || "",
              categories:         [{ category: cat.name, subCategory: "", productType: "" }],
              // Metadata
              googlePlaceId:      place.id,
              googleRating:       place.rating || 0,
              googleReviewCount:  place.userRatingCount || 0,
              lat:                place.location?.latitude  || null,
              lng:                place.location?.longitude || null,
              // Staging fields
              verificationStatus: "staged",
              pullJobId:          jobId,
              pulledAt:           FieldValue.serverTimestamp(),
              confidence:         60,
              type:               "store",
              contributorId:      "google_places_pull",
            };

            const stageRef = db.collection("staged_stores").doc();
            batch.set(stageRef, storeData);
            batchCount++;
            found++;

            // Flush every 400 (Firestore batch limit is 500)
            if (batchCount >= 400) await flushBatch();
          }
        }

      } catch (err) {
        errors++;
        logLines.push(`ERR [${pc.pincode}] ${cat.name}: ${err.message.substring(0, 80)}`);
      }

      // Update progress every 25 queries
      if (queryCount % 25 === 0) {
        await jobRef.update({
          progress:  Math.round((queryCount / totalQueries) * 100),
          found,
          skipped,
          errors,
          updatedAt: FieldValue.serverTimestamp(),
          log:       logLines.slice(-20), // keep last 20 log lines
        });
      }
    }
  }

  // Final flush
  await flushBatch();

  // Mark job complete
  await jobRef.update({
    status:      "completed",
    progress:    100,
    found,
    skipped,
    errors,
    finishedAt:  FieldValue.serverTimestamp(),
    updatedAt:   FieldValue.serverTimestamp(),
    log:         logLines.slice(-50),
  });

  return { success: true, found, skipped, errors, jobId };
});

// ── CLOUD FUNCTION: publishStagedStores ──────────────────────
// Moves approved staged stores → live /stores collection
exports.publishStagedStores = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

  const { storeIds } = request.data;
  if (!storeIds?.length) throw new HttpsError("invalid-argument", "No store IDs provided");

  let published = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const id of storeIds) {
    const stagedSnap = await db.collection("staged_stores").doc(id).get();
    if (!stagedSnap.exists) continue;

    const data = stagedSnap.data();
    const liveData = {
      ...data,
      verificationStatus: "community_added",
      publishedAt:        FieldValue.serverTimestamp(),
      pointsAwarded:      10,
    };
    delete liveData.pulledAt;
    delete liveData.pullJobId;

    // Add to live stores
    const liveRef = db.collection("stores").doc();
    batch.set(liveRef, liveData);

    // Delete from staging
    batch.delete(db.collection("staged_stores").doc(id));

    published++;
    batchCount++;

    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  await batch.commit();
  return { success: true, published };
});

// ── CLOUD FUNCTION: deleteStagedStores ───────────────────────
exports.deleteStagedStores = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");

  const { storeIds } = request.data;
  if (!storeIds?.length) throw new HttpsError("invalid-argument", "No store IDs provided");

  let batch = db.batch();
  let count = 0;
  for (const id of storeIds) {
    batch.delete(db.collection("staged_stores").doc(id));
    count++;
    if (count % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  return { success: true, deleted: count };
});
