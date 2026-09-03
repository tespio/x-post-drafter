/* XPost Lite UI — browser-only */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const L = window.LITE;
  const state = { analysis: null, drafts: [], settings: { premium: false, followers: 0, avg_impressions: 0 } };

  const LS_DRAFTS = "xps_lite_drafts";
  const LS_SETTINGS = "xps_lite_settings";

  function loadSettings() {
    try { Object.assign(state.settings, JSON.parse(localStorage.getItem(LS_SETTINGS) || "{}")); } catch (e) {}
    $("setFollowers").value = state.settings.followers || 0;
    $("setImpressions").value = state.settings.avg_impressions || 0;
    $("optPremium").checked = !!state.settings.premium;
  }
  function saveSettings() {
    state.settings.followers = parseInt($("setFollowers").value || 0, 10);
    state.settings.avg_impressions = parseInt($("setImpressions").value || 0, 10);
    state.settings.premium = $("optPremium").checked;
    localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings));
  }

  /* tabs */
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tabpane").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
  function gotoTab(name) { document.querySelector('.tab[data-tab="' + name + '"]').click(); }

  /* composer */
  const composer = $("composer");
  let timer = null;
  composer.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(analyzeNow, 300); });
  ["optPremium", "optPhoto", "optVideo", "optReply", "optMutual", "optSession"].forEach((id) => {
    $(id).addEventListener("change", () => { if (id === "optPremium") saveSettings(); analyzeNow(); });
  });
  ["setFollowers", "setImpressions"].forEach((id) => {
    $(id).addEventListener("change", () => { saveSettings(); updateColdHint(); });
  });

  function charLimit() { return $("optPremium").checked ? 25000 : 280; }

  function currentOpts() {
    return {
      has_photo: $("optPhoto").checked,
      has_video: $("optVideo").checked,
      is_reply: $("optReply").checked,
      is_mutual_author: $("optMutual").checked,
      is_premium: $("optPremium").checked,
      session_index: parseInt($("optSession").value, 10),
      followers: state.settings.followers,
      avg_impressions: state.settings.avg_impressions,
    };
  }

  function analyzeNow() {
    const text = composer.value;
    const opts = currentOpts();
    const f = L.extractFeatures(text, opts);
    const score = L.computeScore(f, opts);
    const compliance = L.runChecks(f);
    const corr = L.buildCorrections(f, text, opts);
    const tips = L.buildTips(f, score, opts);
    state.analysis = { features: f, score, compliance, corrections: corr.list, corrections_all: { composer: corr.final }, tips };
    renderAnalysis();
  }

  const ACTION_LABELS = {
    favorite: ["Like", 0.5], reply: ["Reply", 5.0], retweet: ["Repost", 1.0], quote: ["Quote", 5.0],
    share: ["Share", 2.0], share_via_dm: ["DM share", 5.0], share_via_copy_link: ["Copy-link share", 20.0],
    follow_author: ["Follow author", 4.0], photo_expand: ["Photo expand", 0.05], video_open: ["Video open", 0.07],
    dwell: ["Dwelled", 0.05], dwell_time: ["Dwell time (per s)", 0.004],
    not_interested: ["Not interested", -43.2], mute_author: ["Mute", -58.8], block_author: ["Block", -31.2],
    report: ["Report", -234.0], not_dwelled: ["Not dwelled", -0.02],
  };

  function verdictFor(s) {
    if (s >= 75) return ["🚀 Elite — top-decile structure", "var(--green)"];
    if (s >= 60) return ["💪 Strong — optimized signals", "var(--green)"];
    if (s >= 45) return ["🙂 Decent — room to optimize", "var(--yellow)"];
    if (s >= 30) return ["⚠️ Weak — negative-risk heavy", "var(--yellow)"];
    return ["🛑 Poor — will underperform", "var(--red)"];
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderAnalysis() {
    const a = state.analysis;
    if (!a) return;
    const s = a.score, f = a.features;
    const limit = charLimit();
    const len = f.weighted_length;
    const over = len > limit;
    const empty = !composer.value.trim();

    if (empty) {
      $("gauge").style.background = "conic-gradient(var(--border) 100%)";
      $("scoreNum").textContent = "–";
      $("scoreVerdict").textContent = "Start typing…";
      $("weightedRaw").textContent = "–";
      $("multLine").textContent = "";
      $("charLabel").textContent = "0 / " + limit + " weighted";
      $("charPct").textContent = "0";
      $("charRing").style.background = "conic-gradient(var(--blue) 0%, var(--border) 0)";
      $("composerWarn").classList.add("hidden");
      $("per10k").innerHTML = "";
      $("contribBars").innerHTML = "<p class='hint'>Signal contributions appear here as you type.</p>";
      $("compliancePanel").innerHTML = "<div class='passline'>✅ No flags yet</div>";
      $("tipsPanel").innerHTML = "<p class='hint'>Optimization tips appear here.</p>";
      $("correctionsCard").classList.add("hidden");
      return;
    }

    $("charLabel").textContent = len + " / " + limit + " weighted";
    const pct = Math.min(100, (len / limit) * 100);
    $("charPct").textContent = over ? "!" : Math.round(pct);
    $("charRing").style.background = "conic-gradient(" + (over ? "var(--red)" : pct > 90 ? "var(--yellow)" : "var(--blue)") + " " + pct + "%, var(--border) " + pct + "%)";
    $("composerWarn").classList.toggle("hidden", !over);

    const failed = a.compliance.verdict === "FAIL";
    const [vtext, vcolor] = verdictFor(s.display_score);
    $("gauge").style.background = failed
      ? "conic-gradient(var(--red) 100%)"
      : "conic-gradient(" + vcolor + " " + s.display_score + "%, var(--border) " + s.display_score + "%)";
    $("scoreNum").textContent = failed ? "0" : (over ? "—" : Math.round(s.display_score));
    $("scoreVerdict").textContent = failed ? "🛑 WILL BE DROPPED — fix compliance first" : (over ? "Over the limit" : vtext);
    $("weightedRaw").textContent = s.raw_weighted_score;
    const mults = [];
    if (s.diversity_multiplier < 1) mults.push("diversity ×" + s.diversity_multiplier.toFixed(2));
    if (s.oon_multiplier < 1) mults.push("OON/reply ×" + s.oon_multiplier);
    if (s.reply_weight_used > 5) mults.push("reply w=" + s.reply_weight_used + " (mutual boost)");
    $("multLine").innerHTML = mults.length ? esc(mults.join(" · ")) : "no penalties applied";

    const pk = s.per_10k;
    $("per10k").innerHTML = ["favorite", "reply", "retweet", "quote", "share_via_dm", "share_via_copy_link", "follow_author"]
      .map((k) => '<div class="p10k"><div class="n">' + pk[k] + '</div><div class="l">' + ACTION_LABELS[k][0] + '/10k</div></div>').join("");

    const entries = Object.entries(s.contributions).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
    const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 0.001);
    $("contribBars").innerHTML = entries.map(([k, v]) => {
      const neg = v < 0;
      const width = Math.max(2, (Math.abs(v) / maxAbs) * 100);
      return '<div class="bar-row"><div class="bar-label"><span><b>' + ACTION_LABELS[k][0] + '</b> · w=' + ACTION_LABELS[k][1] + '</span><span>' + (v >= 0 ? "+" : "") + v.toFixed(4) + '</span></div><div class="bar-track"><div class="bar-fill ' + (neg ? "neg" : "pos") + '" style="width:' + width + '%"></div></div></div>';
    }).join("");

    const c = a.compliance;
    let html = c.verdict === "PASS"
      ? '<div class="passline">✅ PASS — no drop/interstitial triggers found</div>'
      : '<div class="check ' + (c.verdict === "FAIL" ? "drop" : "risk") + '"><span class="lvl">' + (c.verdict === "FAIL" ? "FAIL — WILL BE DROPPED FOR NON-FOLLOWERS" : "REVIEW — RISK FLAGS") + '</span></div>';
    html += c.checks.map((chk) => {
      const cls = chk.level === "DROP" ? "drop" : "risk";
      return '<div class="check ' + cls + '"><span class="lvl">' + chk.level + '</span><div class="rule">' + esc(chk.rule) + '</div><div class="why"><b>Matched:</b> ' + esc(chk.matched.join(", ")) + '<br>' + esc(chk.why) + '</div><div class="fix">✔ Fix: ' + esc(chk.fix) + '</div></div>';
    }).join("");
    $("compliancePanel").innerHTML = html;

    const card = $("correctionsCard");
    const list = a.corrections;
    if (list.length) {
      card.classList.remove("hidden");
      $("correctionsPanel").innerHTML = list.map((x, i) =>
        '<div class="corr-item"><div class="lbl">' + esc(x.label) + '</div><div class="why">' + esc(x.why) + '</div><button class="primary" data-i="' + i + '">Apply fix</button></div>').join("");
      $("btnApplyAll").classList.toggle("hidden", !a.corrections_all.composer);
      document.querySelectorAll("#correctionsPanel [data-i]").forEach((b) => {
        b.addEventListener("click", () => {
          const x = list[parseInt(b.dataset.i, 10)];
          if (x) { composer.value = x.new_text; analyzeNow(); }
        });
      });
    } else card.classList.add("hidden");
    $("btnApplyAll").onclick = () => {
      if (a.corrections_all.composer != null) { composer.value = a.corrections_all.composer; analyzeNow(); }
    };

    $("tipsPanel").innerHTML = a.tips.map((t) => '<div class="tip ' + t.level + '"><span class="icon">' + t.icon + '</span><span class="text">' + esc(t.text) + '</span></div>').join("");
  }

  function updateColdHint() {
    const fI = parseInt($("setFollowers").value || 0, 10);
    const iI = parseInt($("setImpressions").value || 0, 10);
    $("coldStartHint").textContent = (fI < 1000 && iI < 1000)
      ? "🚀 Cold Start Boost eligible: posts <24h old get lifted to feed slots 15–16 while under 1,000 impressions."
      : "Above cold-start thresholds (boost applies under 1,000 followers AND 1,000 impressions).";
  }

  $("btnClear").addEventListener("click", () => { composer.value = ""; analyzeNow(); });

  /* drafts (localStorage) */
  function loadDrafts() {
    try { state.drafts = JSON.parse(localStorage.getItem(LS_DRAFTS) || "[]"); } catch (e) { state.drafts = []; }
    $("draftCount").textContent = state.drafts.length;
    $("draftsCard").classList.toggle("hidden", !state.drafts.length);
    $("draftsList").innerHTML = state.drafts.map((d) =>
      '<div class="draft-item"><pre>' + esc(d.text) + '</pre><div class="row">' +
      '<span class="scorepill ' + pillClass(d.score) + '">' + (d.score != null ? Math.round(d.score) : "–") + ' · ' + esc(d.verdict || "") + '</span>' +
      '<span class="spacer"></span><button class="ghost" data-load="' + d.id + '">Load</button>' +
      '<button class="ghost" data-del="' + d.id + '">🗑</button></div></div>').join("")
      || '<p class="hint">No drafts yet.</p>';
    document.querySelectorAll("[data-load]").forEach((b) => b.addEventListener("click", () => {
      const d = state.drafts.find((x) => x.id === b.dataset.load);
      if (d) { composer.value = d.text; analyzeNow(); }
    }));
    document.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      state.drafts = state.drafts.filter((x) => x.id !== b.dataset.del);
      localStorage.setItem(LS_DRAFTS, JSON.stringify(state.drafts));
      loadDrafts();
    }));
  }
  function pillClass(score) {
    if (score == null) return "";
    if (score >= 60) return "hi";
    if (score >= 40) return "mid";
    return "lo";
  }
  $("btnSaveDraft").addEventListener("click", () => {
    const text = composer.value.trim();
    if (!text) return;
    const a = state.analysis;
    state.drafts.unshift({
      id: "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text, score: a ? a.score.display_score : null, verdict: a ? a.compliance.verdict : null, ts: Date.now(),
    });
    state.drafts = state.drafts.slice(0, 200);
    localStorage.setItem(LS_DRAFTS, JSON.stringify(state.drafts));
    loadDrafts();
  });
  $("btnDrafts").addEventListener("click", () => { gotoTab("composer"); $("draftsCard").classList.remove("hidden"); $("draftsCard").scrollIntoView({ behavior: "smooth" }); });

  /* playbook */
  const PLAYBOOK = [
    ["1 · Replies are worth 10× likes — and +15 more from mutuals", "P(reply) carries weight 5.0 vs 0.5 for a like. If the viewer mutually follows you, reply weight jumps to 20 (bidirectional follow boost). End posts with one sharp question; build genuine mutual follows in your niche.", "ReplyWeight=5.0 · BidirectionalFollowReplyWeightBoost=15.0"],
    ["2 · Make content people SEND", "Copy-link share (20.0) and DM share (5.0) are the two highest positive weights. Lists, frameworks, checklists and specific numbers get sent. Teach something worth forwarding.", "ShareViaCopyLinkWeight=20.0 · ShareViaDmWeight=5.0"],
    ["3 · Quotes (5.0) beat reposts (1.0)", "Write strong, defensible stances people want to add their take to. Quotability = opinion with tension, not rage bait.", "QuoteWeight=5.0 · RetweetWeight=1.0"],
    ["4 · Earn follows with utility", "follow_author weight is 4.0. Threads, teaching posts and 'everything I know' posts drive profile follows — the strongest growth signal you can create.", "FollowAuthorWeight=4.0"],
    ["5 · One mute erases dozens of likes", "Negative weights dwarf positives: mute −58.8, not-interested −43.2, block −31.2, report −234. Bait ('like if', 'follow back'), hashtag walls and hype spam spike these predictions. Never beg.", "MuteAuthorWeight=−58.8 · NotInterestedWeight=−43.2 · ReportWeight=−234.0"],
    ["6 · Space your posts — diversity decay is brutal", "Each extra post by the same author in a feed is multiplied ×0.5^k down to a floor of 0.25. Five posts in an hour: #5 scores at 25%. Post 1 banger, wait 30+ min, post again.", "AuthorDiversityDecay=0.5 · AuthorDiversityFloor=0.25"],
    ["7 · Growth happens OUT of network (×0.75)", "Non-followers see you at ×0.75 — that's where new audience comes from. Originals only: replies and reposts are discounted ×0.75 even from followed accounts. Post originals to travel.", "OonWeightFactor=0.75"],
    ["8 · Small accounts get a cold-start boost", "Under 1,000 followers and 1,000 impressions? Your posts <24h old get lifted toward feed slots 15–16. Consistency wins early: post daily while eligible.", "ColdStartImpressionThreshold=1000 · ColdStartSlotMin/Max=15/16"],
    ["9 · The 48-hour window", "Posts older than 48h are filtered from the feed entirely. Freshness compounds: a post keeps circulating only ~2 days. Repackage old winners as new posts.", "AgeFilter — posts older than 48 hours removed"],
    ["10 · Hold attention: dwell is money", "Dwell time pays 0.004/s plus 0.05 dwell probability, and not-dwelled is a negative signal. Skimmable formatting, media, and video ≥10s keep viewers on post.", "ContDwellTimeWeight=0.004 · MinVideoDurationMs=10000"],
    ["11 · Never trip the drop rules", "Hard drops: spam labels, malicious URLs, NSFW text, civic-integrity misinformation, hate/abuse/violent speech — many enforced only for non-followers, i.e. your growth audience. Keep it clean.", "visibility-filtering/rules/registry.rs — SPAM_DROP · MALICIOUS_URL_DROP · FOSNR_*_DROP"],
    ["12 · Diversify formats — the feed dedupes similarity", "VMRanker reorders feeds with a determinantal point process, trading a little score to avoid similar neighbouring posts. Alternate takes, lists, stories, media.", "vm-ranker/ DPP θ=0.65"],
  ];
  $("playGrid").innerHTML = PLAYBOOK.map((c) =>
    '<div class="play"><h3>' + c[0] + '</h3><p>' + c[1] + '</p><div class="cite">⚙ ' + c[2] + '</div></div>').join("");

  /* init */
  loadSettings();
  updateColdHint();
  loadDrafts();
  analyzeNow();
})();
