// Short bilingual (English + Hindi) labels for the skilled-lane screens
// (profile + apply), owner decision Phase 4: few words, plain Hindi.
// Professional-lane screens use the English text only.
export const HI = {
  yourName: ["Your name", "आपका नाम"],
  mobile: ["Mobile number", "मोबाइल नंबर"],
  yourTrade: ["Your trade", "आपका काम"],
  pickTrades: ["Tap every trade you can do", "जो काम आप करते हैं, सब चुनें"],
  city: ["City", "शहर"],
  workAreas: ["Areas you can work in", "किन इलाकों में काम करेंगे"],
  experience: ["Experience (years)", "अनुभव (साल)"],
  languages: ["Languages you speak", "आप कौन सी भाषा बोलते हैं"],
  workDone: ["Work you have done", "आपने कौन सा काम किया है"],
  workWanted: ["Kind of work you want", "कैसा काम चाहिए"],
  expectedPay: ["Expected pay", "कितनी मज़दूरी चाहिए"],
  available: ["When can you start?", "कब से काम शुरू कर सकते हैं?"],
  whoCanSee: ["Who can see your profile", "आपकी प्रोफ़ाइल कौन देख सकता है"],
  next: ["Next", "आगे"],
  back: ["Back", "पीछे"],
  skip: ["Skip for now", "अभी छोड़ें"],
  save: ["Save", "सेव करें"],
  apply: ["Apply", "आवेदन करें"],
  sendApplication: ["Send application", "आवेदन भेजें"],
  applied: ["Applied", "आवेदन हो गया"],
  addLater: ["You can add more later", "बाकी जानकारी बाद में जोड़ सकते हैं"],
  // L8: contact unlocks only when an employer shortlists the applicant.
  phonePrivate: ["Employers see your number only after they shortlist you", "नौकरी देने वाला आपको शॉर्टलिस्ट करने के बाद ही आपका नंबर देख सकता है"],
  myApplications: ["My applications", "मेरे आवेदन"],
  withdraw: ["Withdraw application", "आवेदन वापस लें"],
  acceptInterview: ["Accept interview", "इंटरव्यू मंज़ूर करें"],
  anotherTime: ["Ask for another time", "दूसरा समय माँगें"],
  decline: ["Decline", "मना करें"],
  acceptOffer: ["Accept offer", "ऑफ़र मंज़ूर करें"],
  declineOffer: ["Decline offer", "ऑफ़र मना करें"],
};

// Hindi for the skilled-lane work types and availability options.
export const WORK_TYPE_HI = {
  daily_wage: "दिहाड़ी",
  project_based: "प्रोजेक्ट का काम",
  full_time: "पूरे समय की नौकरी",
  temporary: "कुछ दिनों का काम",
  fixed_term: "तय समय का ठेका",
  on_call: "ज़रूरत पर बुलावा",
};
export const AVAIL_HI = {
  immediate: "तुरंत",
  within_15_days: "15 दिन में",
  within_30_days: "30 दिन में",
  within_60_days: "60 दिन में",
  employed_open: "अभी काम पर हूँ, नया काम देख रहा हूँ",
};

// "English · हिन्दी" when bilingual, else English.
export const t = (key, bilingual) => (bilingual ? `${HI[key][0]} · ${HI[key][1]}` : HI[key][0]);
