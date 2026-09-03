/* XPost Lite engine — ported from the Python engine in the desktop XPost Studio.
   Weights mirrored from xai-org/x-algorithm home-mixer/params/param.rs (sync 2026-08-28). */
(function () {
  "use strict";

  const W = {
    FAVORITE: 0.5, REPLY: 5.0, MUTUAL_BOOST: 15.0, RETWEET: 1.0,
    PHOTO_EXPAND: 0.05, VIDEO_OPEN: 0.07, CLICK: 0.4, OPEN_LINK: 0.2,
    SHARE: 2.0, SHARE_VIA_DM: 5.0, SHARE_VIA_COPY_LINK: 20.0,
    DWELL: 0.05, QUOTE: 5.0, FOLLOW_AUTHOR: 4.0, CONT_DWELL_TIME: 0.004,
    NOT_INTERESTED: -43.2, MUTE: -58.8, BLOCK: -31.2, REPORT: -234.0, NOT_DWELLED: -0.02,
    DIVERSITY_DECAY: 0.5, DIVERSITY_FLOOR: 0.25, OON: 0.75,
    COLD_IMPRESSIONS: 1000, COLD_FOLLOWERS: 1000,
    STANDARD_LIMIT: 280, PREMIUM_LIMIT: 25000,
  };

  const BASE = {
    favorite: 0.035, reply: 0.004, retweet: 0.006, quote: 0.0012,
    share: 0.0008, share_via_dm: 0.0012, share_via_copy_link: 0.001,
    follow_author: 0.003, photo_expand: 0, video_open: 0,
    dwell: 0.55, dwell_time: 8.0, not_dwelled: 0.45,
    not_interested: 0.004, mute_author: 0.0002, block_author: 0.00008, report: 0.00004,
  };

  const DISPLAY_ANCHORS = [
    [-1.8, 0], [-0.3, 10], [-0.06, 32], [-0.02, 48],
    [0.03, 58], [0.12, 78], [0.3, 100],
  ];

  const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
  const HASHTAG_RE = /#\w+/g;
  const MENTION_RE = /@\w+/g;
  const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F02F}]/gu;
  const CJK_RE = /[\u1100-\u11FF\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u3000-\u303F\u3040-\u30FF]/;
  const MARK_RE = /\p{M}/u;
  const WORD_RE = /[\w'-]+/g;

  const REPLY_BAIT = [
    /\breply\s+(with|below)\b/i, /\bcomment\s+(below|down)\b/i, /\bwhat(?:'s| is)? your\b/i,
    /\bthoughts\?\s*$/im, /\bagree\s+or\s+disagree\b/i, /\bdrop\s+a\b.*\bbelow\b/i,
    /\bwho\s+else\b/i, /\bcan\s+we\s+talk\s+about\b/i, /\bam\s+i\s+the\s+only\s+one\b/i,
    /\bhot\s+take\b/i, /\bcurious\s+what\s+you\b/i, /\btell\s+me\s+(if|why|how)\b/i,
    /\bwhat\s+would\s+you\s+(do|add|change)\b/i, /\bwhich\s+one\b/i, /\byour\s+turn\b/i,
  ];
  const QUOTE_BAIT = [/\bquote\s+(this|tweet|post)\b/i, /\bqt\s+this\b/i, /\bscreenshot\s+this\b/i,
    /\b(quote\s+and\s+)?(rt|repost)\s+to\s+(save|remember)\b/i];
  const FOLLOW_BAIT = [
    /\bfollow\s+back\b/i, /\bf4f\b/i, /\bfollow\s+for\s+follow\b/i, /\bifb\b/i,
    /\bgive\s+me\s+(a\s+)?follow\b/i, /\bdrop\s+(your|a)\s+handle\b/i,
    /\bfollow\s+me\s+and\b/i, /\bi\s+follow\s+back\b/i, /\bmutuals\??\s*$/im,
  ];
  const LIKE_BAIT = [
    /\blike\s+if\b/i, /\blike\s+and\s+rt\b/i, /\blike\s+&\s*(rt|retweet|share)\b/i,
    /\brt\s+if\b/i, /\bretweet\s+if\b/i, /\brepost\s+if\b/i, /\bshare\s+if\b/i,
    /\btag\s+(someone|a\s+friend)\b/i, /\btag\s+3\b/i, /\bsmash\s+that\b/i, /\bhit\s+(that\s+)?(like|follow)\b/i,
  ];
  const SPAM_PATTERNS = [
    /\bfollowers?\s+(cheap|fast|free)\b/i, /\b(buy|sell)\s+followers\b/i,
    /\bfree\s+(followers|likes|retweets)\b/i, /\bdouble\s+your\s+(btc|crypto|money|eth)\b/i,
    /\bsend\s+(me\s+)?(btc|eth|crypto|usdt)\b/i, /\b(giveaway|airdrop)\b.*\b(dm|follow|retweet)\b/is,
    /\b(dm|message)\s+me\s+(for|to\s+get)\b/i, /\bmake\s+\$\d+k?\s+(a\s+)?(day|week|month)\b/i,
    /\bclick\s+my\s+(bio|link)\b/i, /\b1000\s+followers\s+in\b/i, /\bearn\s+(crypto|money)\s+(while|fast)\b/i,
    /\b(guaranteed|instant)\s+(reach|virality|viral)\b/i, /\bengagement\s+(groups?|pods?|train)\b/i,
    /\b(no|without)\s+algorithm\b/i,
  ];
  const SENSITIVE_PATTERNS = [
    [/\b(nsfw|onlyfans|porn|escort|hookup)\b/i, "NSFW signals (NSFW_TEXT drop risk out-of-network)"],
    [/\bkill\s+yourself\b|\bkys\b/i, "abuse (FOSNR_ABUSE drop)"],
    [/\b(gas\s+the|lynch|racial\s+slur)\b/i, "hateful conduct (FOSNR_HATEFUL_CONDUCT drop)"],
    [/\bi\s+will\s+(kill|hurt|find)\s+you\b/i, "violent speech (FOSNR_VIOLENT_SPEECH drop)"],
    [/\b(stolen|leaked)\s+(nudes|photos|video)\b/i, "NCII / abuse risk"],
  ];
  const CIVIC_PATTERNS = [
    [/\b(election|ballot|voting)\s+(is\s+)?(rigged|stolen|fraud)\b/i, "civic integrity (FOSNR_CIVIC_INTEGRITY drop)"],
    [/\bdon'?t\s+vote\b/i, "civic integrity (FOSNR_CIVIC_INTEGRITY drop)"],
    [/\bfake\s+(ballots?|electors?)\b/i, "civic integrity (FOSNR_CIVIC_INTEGRITY drop)"],
  ];
  const SUSPICIOUS_TLDS = [".xyz", ".top", ".click", ".loan", ".work", ".rest", ".fit", ".info", ".buzz", ".quest", ".monster", ".sbs", ".cfd"];
  const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co/", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "t.ly"];

  const HOOK_NUMBER_RE = /^\s*(?:\d+[\).:]|\d+%|\w+\s*[:\u2014-])/;
  const LIST_MARKER_RE = /(?:^|\n)\s*(?:\d+[\).]|[-*\u2022\u2023\u2043])\s+/g;
  const THREAD_MARKER_RE = /\b(1\s*\/\s*\d+|\u2776|thread\b|\u{1F9F5})/iu;
  const TAKEAWAY_RE = /^\s*(?:bottom line|key takeaway|takeaway|tl;?dr|the (?:fix|lesson|result|point|truth)|net net|the bottom line)[:\u2014\-\u2192]/im;
  const CONTRAST_RE = /\b(wrong|overrated|underrated|myth|stop|never|always|mistake|nobody|everyone|unpopular|actually|truth|lie|lying|honest|harsh|controversial)\b/i;
  const STORY_RE = /\b(i\s|my\s|me\s|we\s|when\s+i|last\s+year|years\s+ago|yesterday|today\s+i)\b/i;
  const EXPERTISE_RE = /\b(how\s+to|framework|system|playbook|strategy|lesson|steps|guide|template|checklist|process|method)\b/i;
  const CLICKBAIT_RE = /\b(you\s+won'?t\s+believe|shocking|this\s+changed\s+everything|insane|mind.?blown|wait\s+for\s+it)\b/i;
  const SENTENCE_SPLIT_RE = /(?<=[.!?\u2026])\s+/;

  function weightedLength(text) {
    let total = 0;
    const urls = text.match(URL_RE) || [];
    total += urls.length * 23;
    let rest = text;
    for (const u of urls) rest = rest.split(u).join(" ");
    for (const ch of rest) {
      if (CJK_RE.test(ch)) total += 2;
      else if (MARK_RE.test(ch)) continue;
      else total += 1;
    }
    return total;
  }

  function matchAny(res, text) {
    const hits = [];
    for (const r of res) {
      const m = text.match(r);
      if (m) hits.push(m[0].trim());
    }
    return hits;
  }

  function suspiciousLinks(urls) {
    const out = [];
    for (const u of urls) {
      const lu = u.toLowerCase();
      if (SHORTENERS.some((s) => lu.includes(s))) out.push(u + " (link shortener — common in spam patterns)");
      else if (SUSPICIOUS_TLDS.some((t) => lu.includes(t))) out.push(u + " (TLD frequently abused — MALICIOUS_URL scan risk)");
    }
    return out;
  }

  function extractFeatures(text, opts) {
    opts = opts || {};
    const urls = (text.match(URL_RE) || []).map((u) => u.replace(/[).,;:!?'"]+$/, ""));
    const plain = text.replace(URL_RE, " ");
    const words = plain.match(WORD_RE) || [];
    const letters = (plain.match(/[a-zA-Z]/g) || []);
    const caps = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase());
    const sentenceParts = plain.split(/[.!?\n]+/).filter((s) => s.trim());
    const emojiList = plain.match(EMOJI_RE) || [];
    const hashtags = text.match(HASHTAG_RE) || [];
    const mentions = text.match(MENTION_RE) || [];
    const allCapsWords = words.filter((w) => w.length >= 3 && w === w.toUpperCase() && !/\d/.test(w));
    const listItems = plain.match(LIST_MARKER_RE) || [];
    const firstLine = plain.trim() ? plain.trim().split("\n")[0] : "";

    return {
      weighted_length: weightedLength(text),
      char_count: text.length,
      word_count: words.length,
      sentence_count: Math.max(1, sentenceParts.length),
      avg_sentence_len: words.length / Math.max(1, sentenceParts.length),
      has_question: plain.includes("?"),
      question_count: (plain.match(/\?/g) || []).length,
      exclamations: (plain.match(/!/g) || []).length,
      hashtags: hashtags.length,
      hashtag_list: hashtags,
      mentions: mentions.length,
      emoji_count: emojiList.length,
      all_caps_count: allCapsWords.length,
      has_link: urls.length > 0,
      link_count: urls.length,
      links: urls,
      has_list: listItems.length > 0,
      list_items: listItems.length,
      has_numbers: /\d/.test(plain),
      has_thread_marker: THREAD_MARKER_RE.test(plain),
      has_takeaway: TAKEAWAY_RE.test(plain),
      first_line: firstLine,
      hook_starts_with_number: HOOK_NUMBER_RE.test(firstLine),
      is_reply: !!opts.is_reply,
      is_premium: !!opts.is_premium,
      has_photo: !!opts.has_photo,
      has_video: !!opts.has_video,
      like_bait: matchAny(LIKE_BAIT, plain),
      reply_bait: matchAny(REPLY_BAIT, plain),
      follow_bait: matchAny(FOLLOW_BAIT, plain),
      quote_bait: matchAny(QUOTE_BAIT, plain),
      spam_hits: matchAny(SPAM_PATTERNS, plain),
      sensitive_hits: SENSITIVE_PATTERNS.filter(([r]) => r.test(plain)).map(([, w]) => w),
      civic_hits: CIVIC_PATTERNS.filter(([r]) => r.test(plain)).map(([, w]) => w),
      suspicious_links: suspiciousLinks(urls),
    };
  }

  function clamp(x, lo, hi) { return Math.max(lo == null ? 0 : lo, Math.min(hi == null ? 1 : hi, x)); }

  function estimateProbabilities(f) {
    const p = Object.assign({}, BASE);
    const ln = f.weighted_length;
    const premium = !!f.is_premium;

    let wl = 1.0;
    if (premium) {
      if (ln < 40) wl = 0.8; else if (ln < 90) wl = 0.95;
      else if (ln <= 260) wl = 1.25; else if (ln <= 1500) wl = 1.3;
      else if (ln <= 6000) wl = 1.15; else wl = 1.0;
    } else {
      if (ln < 40) wl = 0.8; else if (ln < 90) wl = 0.95;
      else if (ln <= 260) wl = 1.25; else if (ln <= 280) wl = 1.05;
    }

    let media = 1.0;
    if (f.has_photo) media *= 1.3;
    if (f.has_video) media *= 1.5;
    const hook = f.hook_starts_with_number ? 1.2 : 1.0;
    const listm = f.has_list ? 1.15 : 1.0;
    let tag = 1.0;
    if (f.hashtags === 1) tag = 1.02; else if (f.hashtags <= 2) tag = 0.95;
    else if (f.hashtags <= 4) tag = 0.8; else tag = 0.65;
    let emoji = 1.0;
    if (f.emoji_count >= 1 && f.emoji_count <= 4) emoji = 1.05; else if (f.emoji_count > 8) emoji = 0.8;
    const capsM = f.all_caps_count >= 3 ? 0.85 : 1.0;
    const exclM = f.exclamations >= 3 ? 0.85 : 1.0;

    p.favorite = BASE.favorite * wl * media * hook * listm * tag * emoji * capsM * exclM;
    if (f.like_bait.length) p.favorite *= 1.25;

    let reply = 1.0;
    if (f.has_question) reply *= 2.2;
    if (f.question_count >= 2) reply *= 1.35;
    if (f.reply_bait.length) reply *= 1.8;
    if (f.has_list) reply *= 0.85;
    const story = STORY_RE.test(f.first_line) ? 1.3 : 1.0;
    p.reply = BASE.reply * wl * media * reply * story * capsM;

    let rt = 1.0;
    if (f.has_list) rt *= 1.2;
    if (ln <= 140 && f.has_question) rt *= 1.25;
    if (CONTRAST_RE.test(f.first_line)) rt *= 1.3;
    if (f.quote_bait.length) rt *= 1.1;
    p.retweet = BASE.retweet * wl * media * rt * listm * tag;

    let qt = 1.0;
    if (CONTRAST_RE.test(f.first_line)) qt *= 2.0;
    if (f.has_question) qt *= 1.4;
    p.quote = BASE.quote * wl * qt * media;

    let utility = 1.0;
    if (f.has_list) utility *= 2.0;
    if (EXPERTISE_RE.test(f.first_line)) utility *= 1.6;
    if (f.has_numbers) utility *= 1.3;
    if (f.has_thread_marker) utility *= 1.4;
    p.share_via_dm = BASE.share_via_dm * utility;
    p.share_via_copy_link = BASE.share_via_copy_link * utility;
    p.share = BASE.share * utility * 0.9;

    let fa = 1.0;
    if (f.has_thread_marker) fa *= 2.0;
    if (f.has_list) fa *= 1.5;
    if (EXPERTISE_RE.test(f.first_line)) fa *= 1.4;
    if (STORY_RE.test(f.first_line)) fa *= 1.2;
    p.follow_author = BASE.follow_author * wl * fa;

    if (f.has_photo) p.photo_expand = BASE.favorite * 0.55 * wl;
    if (f.has_video) p.video_open = 0.02;

    let dwell = 1.0;
    if (ln >= 160) dwell *= 1.15;
    if (f.has_photo || f.has_video) dwell *= 1.2;
    if (f.avg_sentence_len > 40) dwell *= 0.8;
    if (premium && ln > 1200) dwell *= 0.9;
    p.dwell = clamp(BASE.dwell * dwell);

    let dtime;
    if (premium && ln > 280) dtime = Math.min(45.0, 8.0 + f.word_count / 4.0);
    else dtime = 8.0 * (1.0 + Math.min(0.8, ln / 280.0));
    if (f.has_photo) dtime += 3.0;
    if (f.has_video) dtime += 6.0;
    if (f.has_list) dtime += 2.0;
    if (f.avg_sentence_len > 40) dtime *= 0.85;
    p.dwell_time = dtime;

    if (f.has_takeaway) {
      p.dwell = clamp(p.dwell * 1.05);
      p.favorite *= 1.04;
      p.share_via_copy_link *= 1.15;
    }

    let ni = 1.0;
    if (CLICKBAIT_RE.test(f.first_line)) ni *= 1.6;
    if (f.hashtags >= 3) ni *= 1.4;
    if (f.hashtags >= 5) ni *= 1.5;
    if (f.like_bait.length || f.follow_bait.length) ni *= 1.8;
    if (f.all_caps_count >= 3) ni *= 1.3;
    if (f.emoji_count > 8) ni *= 1.3;
    if (f.spam_hits.length) ni *= 2.0;
    if (f.avg_sentence_len > 40) ni *= 1.2;
    p.not_interested = Math.min(0.9, BASE.not_interested * ni);

    let mu = 1.0;
    if (f.like_bait.length || f.follow_bait.length) mu *= 2.0;
    if (f.spam_hits.length) mu *= 3.0;
    if (f.hashtags >= 5) mu *= 1.8;
    if (f.all_caps_count >= 5) mu *= 1.5;
    p.mute_author = Math.min(0.9, BASE.mute_author * mu);

    let bl = 1.0;
    if (f.spam_hits.length) bl *= 2.5;
    if (f.sensitive_hits.length) bl *= 4.0;
    p.block_author = Math.min(0.9, BASE.block_author * bl);

    let rp = 1.0;
    if (f.spam_hits.length) rp *= 6.0;
    if (f.sensitive_hits.length) rp *= 20.0;
    if (f.civic_hits.length) rp *= 15.0;
    if (f.suspicious_links.length) rp *= 5.0;
    p.report = Math.min(0.95, BASE.report * rp);

    p.dwell = clamp(p.dwell);
    p.not_dwelled = clamp(1.0 - p.dwell);
    return p;
  }

  function diversityMultiplier(k) {
    k = Math.max(0, k);
    return (1.0 - W.DIVERSITY_FLOOR) * Math.pow(W.DIVERSITY_DECAY, k) + W.DIVERSITY_FLOOR;
  }

  function displayFromWeighted(s) {
    if (s <= DISPLAY_ANCHORS[0][0]) return 0;
    if (s >= DISPLAY_ANCHORS[DISPLAY_ANCHORS.length - 1][0]) return 100;
    for (let i = 0; i < DISPLAY_ANCHORS.length - 1; i++) {
      const [x0, y0] = DISPLAY_ANCHORS[i];
      const [x1, y1] = DISPLAY_ANCHORS[i + 1];
      if (s >= x0 && s <= x1) return y0 + ((s - x0) / (x1 - x0)) * (y1 - y0);
    }
    return 50;
  }

  function computeScore(f, opts) {
    opts = opts || {};
    const p = estimateProbabilities(f);
    if (!f.has_photo) p.photo_expand = 0;
    if (!f.has_video) p.video_open = 0;
    const replyWeight = W.REPLY + (f.is_mutual_author ? W.MUTUAL_BOOST : 0.0);

    const c = {
      favorite: W.FAVORITE * p.favorite,
      reply: replyWeight * p.reply,
      retweet: W.RETWEET * p.retweet,
      quote: W.QUOTE * p.quote,
      share: W.SHARE * p.share,
      share_via_dm: W.SHARE_VIA_DM * p.share_via_dm,
      share_via_copy_link: W.SHARE_VIA_COPY_LINK * p.share_via_copy_link,
      follow_author: W.FOLLOW_AUTHOR * p.follow_author,
      photo_expand: W.PHOTO_EXPAND * p.photo_expand,
      video_open: W.VIDEO_OPEN * p.video_open,
      dwell: W.DWELL * p.dwell,
      dwell_time: W.CONT_DWELL_TIME * p.dwell_time,
      not_interested: W.NOT_INTERESTED * p.not_interested,
      mute_author: W.MUTE * p.mute_author,
      block_author: W.BLOCK * p.block_author,
      report: W.REPORT * p.report,
      not_dwelled: W.NOT_DWELLED * p.not_dwelled,
    };

    const weighted = Object.values(c).reduce((a, b) => a + b, 0);
    const sessionIndex = Math.max(1, parseInt(opts.session_index || 1, 10));
    const divMult = sessionIndex > 1 ? diversityMultiplier(sessionIndex - 1) : 1.0;
    const oonMult = opts.is_reply ? W.OON : 1.0;
    const finalWeighted = weighted * divMult * oonMult;

    const per10k = {};
    for (const k of ["favorite", "reply", "retweet", "quote", "share_via_dm", "share_via_copy_link", "follow_author"]) {
      per10k[k] = Math.round(p[k] * 10000 * 10) / 10;
    }

    return {
      weighted_score: Math.round(finalWeighted * 10000) / 10000,
      raw_weighted_score: Math.round(weighted * 10000) / 10000,
      display_score: Math.round(displayFromWeighted(finalWeighted) * 10) / 10,
      contributions: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v * 10000) / 10000])),
      reply_weight_used: replyWeight,
      diversity_multiplier: divMult,
      oon_multiplier: oonMult,
      session_index: sessionIndex,
      per_10k: per10k,
    };
  }

  function runChecks(f) {
    const checks = [];
    const add = (level, rule, matched, why, fix) =>
      checks.push({ level, rule, matched, why, fix });

    if (f.sensitive_hits.length) {
      add("DROP", "FOSNR abuse / NSFW_TEXT drop", f.sensitive_hits,
        "Hate, abuse, violent speech or NSFW text is dropped for non-followers (FOSNR_*_DROP / NSFW_TEXT_DROP).",
        "Remove the flagged phrasing entirely — labels carry account-level consequences.");
    }
    if (f.civic_hits.length) {
      add("DROP", "FOSNR_CIVIC_INTEGRITY_DROP", f.civic_hits,
        "Civic/election integrity claims trigger a drop for non-followers on both surfaces.",
        "Avoid unverified election-fraud claims and vote-suppression phrasing.");
    }
    if (f.suspicious_links.length) {
      add("DROP", "MALICIOUS_URL_DROP", f.suspicious_links,
        "Link shorteners and abuse-prone TLDs are flagged; high-recall spam drops apply out-of-network.",
        "Use a direct, reputable domain — or drop the link in a reply.");
    }
    if (f.spam_hits.length) {
      add(f.spam_hits.length >= 2 ? "DROP" : "RISK", "SPAM_DROP / SPAM_HIGH_RECALL_DROP", f.spam_hits,
        "Engagement farming, follower schemes and DM funnels feed the spam classifiers (grox).",
        "Remove sell-y CTAs and growth-hacking phrasing.");
    }
    if (f.like_bait.length || f.follow_bait.length) {
      add("RISK", "Platform-manipulation / engagement bait", f.like_bait.concat(f.follow_bait),
        "Bait phrasing drives mute (-58.8) and not-interested (-43.2) predictions and violates platform-manipulation rules.",
        "Replace with a genuine question or a reason to engage.");
    }
    if (f.quote_bait.length) {
      add("RISK", "Quote-bait phrasing", f.quote_bait,
        "Explicit quote prompts read as manipulative; organic quotability works better.",
        "State a strong stance worth quoting instead.");
    }
    if (f.hashtags >= 4) {
      add("RISK", "Spam-pattern heuristics", [f.hashtag_list.join(", ")],
        "4+ hashtags is a classic spam shape; suppresses likes and inflates negative feedback.",
        "Keep 0-1 topical hashtags.");
    }
    if (f.all_caps_count >= 4) {
      add("RISK", "Shouting / low-quality text heuristics", [f.all_caps_count + " all-caps words"],
        "ALL-CAPS walls pattern-match low-quality content and raise negative feedback.",
        "Capitalize at most one word for emphasis.");
    }
    if (f.emoji_count > 8) {
      add("RISK", "Emoji-wall heuristic", [f.emoji_count + " emoji"],
        "Emoji walls correlate with spam in text classifiers and depress dwell.",
        "Use 0-4 emoji where they add meaning.");
    }
    if (f.exclamations >= 4) {
      add("RISK", "Hype punctuation heuristic", [f.exclamations + " exclamation marks"],
        "Reads as hype/spam; degrades like and dwell probability.",
        "One exclamation maximum.");
    }
    if (f.link_count >= 2) {
      add("RISK", "Link-stuffed post", [f.link_count + " links"],
        "Multiple links pattern-match spam; open_link weight is only 0.2 so links add little.",
        "One link maximum; put the value in the post itself.");
    }
    if (f.avg_sentence_len > 40) {
      add("RISK", "Wall-of-text (not_dwelled + not_interested risk)",
        ["avg " + Math.round(f.avg_sentence_len) + " words/sentence"],
        "Hard-to-skim posts raise P(not dwelled) and P(not interested).",
        "Break into short lines / 1-2 sentence paragraphs.");
    }

    const blocked = checks.filter((x) => x.level === "DROP");
    const risky = checks.filter((x) => x.level === "RISK");
    return { verdict: blocked.length ? "FAIL" : risky.length ? "REVIEW" : "PASS", checks };
  }

  /* ---------------- corrections ---------------- */

  const KEEP_UPPER = new Set(["AI", "USA", "UK", "EU", "SEO", "API", "CEO", "CTO", "B2B", "B2C", "SAAS", "LLC",
    "FAQ", "UX", "UI", "ARR", "MRR", "TAM", "SAM", "SOM", "IPO", "KPI", "OKR", "NPS", "CTR", "CPC", "CPM",
    "ROAS", "HTML", "CSS", "SQL", "AWS", "GCP", "VC", "GDPR", "DM", "PM", "AM", "PS"]);
  const CONCLUSION_RE = /(bottom line|key takeaway|the fix|the lesson|the result|what matters|the key|the point|the truth|net net|in short|so what)/i;
  const SENT_SPLIT = /(?<=[.!?\u2026])\s+/;

  const tidy = (t) => t
    .replace(/[ \t]+/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .replace(/^\s*[!,.:;]+\s*$/gm, "")
    .replace(/^\s*[!,.:;]+\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const removeAll = (text, phrases) => {
    for (const p of phrases) {
      if (!p) continue;
      text = text.replace(new RegExp("\\s*" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:\\s+[^,.!?;\\n]*)?[!,.:]+", "gi"), "");
    }
    return tidy(text);
  };

  const dropExtraHashtags = (text, keep) => {
    const tags = text.match(/#\w+/g) || [];
    let removed = 0;
    for (const tag of tags) {
      if (removed >= tags.length - keep) break;
      text = text.replace(new RegExp("\\s*" + tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b"), "");
      removed++;
    }
    return tidy(text);
  };

  const fixCapsWords = (text) => {
    const out = [];
    let last = 0;
    for (const m of text.matchAll(/\b[A-Z]{3,}\b/g)) {
      out.push(text.slice(last, m.index));
      const w = m[0];
      if (KEEP_UPPER.has(w)) out.push(w);
      else {
        const before = text.slice(0, m.index).trimEnd();
        out.push(!before || ".!?\n".includes(before.slice(-1)) ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase());
      }
      last = m.index + w.length;
    }
    out.push(text.slice(last));
    return out.join("");
  };

  const reduceEmoji = (text, keep) => {
    const list = text.match(EMOJI_RE) || [];
    let excess = list.length - keep;
    if (excess <= 0) return text;
    for (let i = list.length - 1; i >= 0 && excess > 0; i--) {
      const idx = text.lastIndexOf(list[i]);
      if (idx >= 0) { text = text.slice(0, idx) + text.slice(idx + list[i].length); excess--; }
    }
    return tidy(text);
  };

  const breakWall = (text, perPara) => {
    const sentences = text.trim().split(SENT_SPLIT).filter((s) => s.trim());
    if (sentences.length < 4) return text;
    const paras = [];
    for (let i = 0; i < sentences.length; i += perPara) {
      paras.push(sentences.slice(i, i + perPara).join(" ").trim());
    }
    return paras.filter(Boolean).join("\n\n");
  };

  const trimToLimit = (text, limit) => {
    if (weightedLength(text) <= limit) return text;
    for (let i = 0; i < 80; i++) {
      const pieces = text.trim().split(SENT_SPLIT);
      if (pieces.length > 1) text = pieces.slice(0, -1).join(" ").trim();
      else {
        const words = text.split(" ");
        if (words.length <= 1) break;
        text = words.slice(0, -1).join(" ");
      }
      if (weightedLength(text) <= limit) return text;
    }
    return text;
  };

  const pickTakeaway = (text) => {
    const sentences = text.trim().split(SENT_SPLIT).map((s) => s.trim()).filter(Boolean);
    if (!sentences.length) return "";
    const pool = sentences.filter((s) => CONCLUSION_RE.test(s));
    let s = pool[0] || sentences[0];
    s = s.replace(/^(and|but|so|also|that'?s why)\s+/i, "");
    if (s.length > 90) {
      let cut = s.slice(0, 90);
      if (cut.includes(" ")) cut = cut.slice(0, cut.lastIndexOf(" "));
      s = cut.replace(/[,;:-]+$/, "") + "\u2026";
    }
    return s;
  };

  function buildCorrections(f, text, opts) {
    opts = opts || {};
    if (!text.trim()) return { list: [], final: text };
    const limit = opts.is_premium ? W.PREMIUM_LIMIT : W.STANDARD_LIMIT;
    const out = [];
    let cur = text;
    const add = (id, label, why, newText) => {
      if (newText != null && newText !== cur) { out.push({ id, label, why, new_text: newText }); cur = newText; }
    };

    const bait = f.like_bait.concat(f.follow_bait);
    if (bait.length) {
      add("bait", "Remove engagement bait",
        "'" + bait[0] + "' style bait spikes mute (-58.8) and not-interested (-43.2) and violates platform-manipulation rules.",
        removeAll(cur, bait));
    }
    if (f.spam_hits.length) {
      add("spam", "Remove spam-pattern phrasing",
        "'" + f.spam_hits[0] + "' feeds the spam classifiers — high-recall spam drops you from recommendations.",
        removeAll(cur, f.spam_hits));
    }
    if (f.hashtags > 1) {
      add("tags", "Keep 1 hashtag (drop " + (f.hashtags - 1) + ")",
        "3+ hashtags suppress likes x0.8 and inflate not-interested risk x1.4.",
        dropExtraHashtags(cur, 1));
    }
    if (f.all_caps_count >= 2) {
      add("caps", "Fix ALL-CAPS shouting",
        f.all_caps_count + " all-caps words pattern-match low-quality text and depress likes x0.85.",
        fixCapsWords(cur));
    }
    if (f.exclamations >= 3) {
      add("excl", "Calm the exclamation marks",
        f.exclamations + " '!' reads as hype and costs ~15% like probability.",
        cur.replace(/!{2,}/g, "!"));
    }
    if (f.emoji_count > 8) {
      add("emoji", "Trim the emoji wall",
        f.emoji_count + " emoji correlates with spam (not-interested x1.3). Keeping the first 3.",
        reduceEmoji(cur, 3));
    }
    if (f.avg_sentence_len > 40 && f.sentence_count >= 3) {
      add("wall", "Break the wall of text",
        "Average " + Math.round(f.avg_sentence_len) + " words/sentence raises P(not dwelled) and P(not interested).",
        breakWall(cur, 2));
    }
    if (f.suspicious_links.length) {
      add("link", "Remove risky link",
        f.suspicious_links[0] + " — shorteners/abused TLDs pattern-match MALICIOUS_URL drops. Link in a reply instead.",
        removeAll(cur, f.suspicious_links.map((s) => s.split(" ")[0])));
    }
    if (f.weighted_length > limit) {
      add("trim", "Trim to the " + limit + " limit",
        "Over the limit — X truncates the post. This cuts whole sentences from the end.",
        trimToLimit(cur, limit));
    }
    if (!f.has_question && !f.has_list && f.weighted_length > 60 && !f.is_reply) {
      add("ask", "Add a closing question",
        "No question found — P(reply) x weight 5.0 (10x a like) is the strongest lever you're not pulling.",
        tidy(cur + "\n\nWhat's your take?"));
    }
    if (!f.has_takeaway && f.weighted_length > 100) {
      const t = pickTakeaway(text);
      if (t) {
        add("takeaway", "Add a key-takeaway line",
          "A scannable takeaway ('Bottom line: ...') lifts dwell (0.004/s) and quotability (copy-link share w=20.0).",
          tidy(cur + "\n\nBottom line: " + t));
      }
    }
    return { list: out, final: cur };
  }

  /* ---------------- tips ---------------- */

  function coldStart(opts) {
    const followers = parseInt((opts && opts.followers) || 0, 10);
    const avgImpressions = parseInt((opts && opts.avg_impressions) || 0, 10);
    const eligible = followers < W.COLD_FOLLOWERS && avgImpressions < W.COLD_IMPRESSIONS;
    return { eligible };
  }

  function buildTips(f, score, opts) {
    opts = opts || {};
    const tips = [];
    if (f.is_reply) {
      tips.push({ level: "warn", icon: "⚠️", text: "Replies and reposts are discounted x0.75 even from followed accounts. Original posts reach further." });
    }
    if (f.has_question) {
      tips.push({ level: "good", icon: "✅", text: "Question detected — reply weight is 5.0 (10x a like), +15 more for mutuals. End with the question on its own line for maximum reply lift." });
    } else {
      tips.push({ level: "tip", icon: "💬", text: "No question found. A closing question is the strongest reply driver (P(reply) x weight 5.0)." });
    }
    if (!f.has_photo && !f.has_video) {
      tips.push({ level: "tip", icon: "📷", text: "No media. A photo adds photo_expand + dwell lift; video adds video_open + ~6s dwell time (must be >=10s to count)." });
    }
    if (f.hashtags === 0) {
      tips.push({ level: "tip", icon: "#", text: "Consider one topical hashtag (1 is neutral-positive; 3+ degrades likes and raises not-interested risk x1.4)." });
    } else if (f.hashtags >= 3) {
      tips.push({ level: "warn", icon: "⚠️", text: f.hashtags + " hashtags. 3+ suppresses likes and inflates not-interested (-43.2). Trim to 0-1." });
    }
    if (f.is_premium) {
      if (f.weighted_length > 280 && f.weighted_length <= 1500) {
        tips.push({ level: "good", icon: "📖", text: "Premium long-form (" + f.weighted_length + " chars): predicted dwell time earns 0.004/s — the biggest single lever you have. Keep paragraphs 1-2 lines and add media to hold readers." });
      }
      if (f.weighted_length > 6000) {
        tips.push({ level: "warn", icon: "📉", text: "Very long post — completion rate drops, raising P(not dwelled) and mute risk. Consider splitting into a thread." });
      }
    } else if (f.weighted_length < 90) {
      tips.push({ level: "tip", icon: "📏", text: "Short post. 160-260 weighted chars earns ~25% more dwell time (0.004/s) and dwell probability." });
    } else if (f.weighted_length > 270) {
      tips.push({ level: "tip", icon: "📏", text: "Near the 280 limit. Slightly trimming improves dwell quality and reduces not_dwelled risk." });
    }
    if (!f.has_list && !f.has_numbers) {
      tips.push({ level: "tip", icon: "🔑", text: "No list/numbers. Lists and specific numbers drive DM shares (w=5.0) and copy-link shares (w=20.0) — the two highest-weighted positive signals." });
    }
    if (f.has_thread_marker || f.has_list) {
      tips.push({ level: "good", icon: "🧵", text: "Thread/list utility detected — boosts follow_author (w=4.0) and shares." });
    }
    if (!f.has_takeaway && f.weighted_length > 100) {
      tips.push({ level: "tip", icon: "🎯", text: "No key-takeaway line. Add a scannable summary ('Bottom line: …' or a label like 'TAM vs. Reality') — it lifts dwell, likes, and copy-link shares." });
    }
    if (score.diversity_multiplier < 1) {
      tips.push({ level: "warn", icon: "🔄", text: "Post #" + score.session_index + " today scores x" + score.diversity_multiplier.toFixed(2) + " (author diversity decay 0.5^k, floor 0.25). Space posts 30+ min apart." });
    }
    if (score.oon_multiplier < 1) {
      tips.push({ level: "warn", icon: "❌", text: "Reply/out-of-network content is discounted x0.75. Publish originals for reach." });
    }
    if (coldStart(opts).eligible) {
      tips.push({ level: "good", icon: "🚀", text: "Cold Start Boost likely active: posts under 24h old get lifted toward feed slots 15-16 while under 1,000 impressions." });
    }
    return tips;
  }

  window.LITE = {
    W, extractFeatures, computeScore, runChecks, buildCorrections, buildTips,
    coldStart, weightedLength,
  };
})();
