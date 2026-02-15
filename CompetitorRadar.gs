// ==========================================
// 🚀 COMPETITOR RADAR (ALL-IN-ONE)
// ==========================================

// ==========================================
// 1. ⚙️ CONFIGURATION
// ==========================================

// 📂 FOLDERS
const FOLDER_ID_SOURCE_JSONS = "1ZHUjA42XKA20_bHj8Bs3pD05RTb_-Qkn";  // Where Patbase exports live
const FOLDER_ID_EMBEDDINGS   = "1mbopWY5ypqS_9Y-4XMYox2fGNY_fNVf1";  // Cache (Summaries & Vectors)
const FOLDER_ID_DASHBOARD_EXPORT = "1ZHUjA42XKA20_bHj8Bs3pD05RTb_-Qkn"; // Where to save HTML
const FOLDER_ID_INVENTIONS     = "1g--GJf6ob3TlGRnaZlaFVXZpIdz-_3cx"; // Internal Inventions Root

// 📂 FTO CACHE (Simple JSON Store)
function loadFTOCache() {
  const file = getFileInFolder(FOLDER_ID_EMBEDDINGS, FTO_CACHE_FILENAME);
  if (!file) return {};
  try {
    return JSON.parse(file.getBlob().getDataAsString());
  } catch (e) {
    log("⚠️ Failed to parse FTO Cache: " + e.message);
    return {};
  }
}

function saveFTOCache(data) {
  let file = getFileInFolder(FOLDER_ID_EMBEDDINGS, FTO_CACHE_FILENAME);
  if (file) {
    file.setContent(JSON.stringify(data, null, 2));
  } else {
    const folder = DriveApp.getFolderById(FOLDER_ID_EMBEDDINGS);
    folder.createFile(FTO_CACHE_FILENAME, JSON.stringify(data, null, 2));
  }
}

// 📂 REPORT CACHE
function loadReportCache() {
  const file = getFileInFolder(FOLDER_ID_EMBEDDINGS, REPORT_CACHE_FILENAME);
  if (!file) return null;
  try {
    return JSON.parse(file.getBlob().getDataAsString());
  } catch (e) { return null; }
}

function saveReportCache(data) {
  let file = getFileInFolder(FOLDER_ID_EMBEDDINGS, REPORT_CACHE_FILENAME);
  if (file) {
    file.setContent(JSON.stringify(data, null, 2));
  } else {
    DriveApp.getFolderById(FOLDER_ID_EMBEDDINGS).createFile(REPORT_CACHE_FILENAME, JSON.stringify(data, null, 2));
  }
}

// 📂 CONSOLIDATED DETAILED FTO CACHE
function loadConsolidatedFTOAnalyses() {
  const folder = DriveApp.getFolderById(FOLDER_ID_DASHBOARD_EXPORT);
  const file = getUniqueFile(folder, DETAILED_FTO_CACHE_FILENAME);
  if (!file) return {};
  try {
    const content = file.getBlob().getDataAsString();
    if (!content || content.trim() === "") return {};
    return JSON.parse(content);
  } catch (e) {
    log("❌ CRITICAL: Failed to parse Detailed FTO Cache: " + e.message);
    // Return null instead of {} to signal an error (prevents overwriting valid data with empty)
    return null; 
  }
}

function saveConsolidatedFTOAnalysis(inventionId, patentId, score, claimsData) {
  log(`💾 Saving Detailed FTO Analysis for ${inventionId} vs ${patentId}...`);
  
  // Use LockService to prevent concurrent write issues
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // Wait up to 15 seconds
    
    let cache = loadConsolidatedFTOAnalyses();
    
    // Safety check: If load failed (returned null), DO NOT save or we wipe the file
    if (cache === null) {
      log("   ❌ Aborting save to prevent data loss (Cache loading failed).");
      return { success: false, error: "Cache load failed" };
    }
    
    if (!cache[inventionId]) cache[inventionId] = {};
    
    cache[inventionId][patentId] = {
      score: score,
      date: new Date().toLocaleString(),
      claims: claimsData
    };
    
    const folder = DriveApp.getFolderById(FOLDER_ID_DASHBOARD_EXPORT);
    let file = getUniqueFile(folder, DETAILED_FTO_CACHE_FILENAME);
    
    if (file) {
      file.setContent(JSON.stringify(cache, null, 2));
    } else {
      folder.createFile(DETAILED_FTO_CACHE_FILENAME, JSON.stringify(cache, null, 2));
    }
    
    lock.releaseLock();
    log(`   ✅ Cache Persisted for ${inventionId}`);
    return { success: true };
  } catch (e) {
    log(`   ❌ Lock failed or Write error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// 🔑 API KEYS & MODELS
function getMistralApiKey() {
   return PropertiesService.getScriptProperties().getProperty("MISTRAL_API_KEY");
}
const MODEL_EMBEDDING = "mistral-embed";
const MODEL_CHAT      = "mistral-large-latest";

// 📊 ANALYSIS SETTINGS
const MAX_PATENTS_TO_PROCESS = 500; // Safety limit
const NUM_CLUSTERS           = 10;
const PCA_COMPONENTS         = 2;    // X, Y for scatter plot

// 🎨 DASHBOARD
const DATA_FILENAME     = "_COMPETITOR_RADAR_DATA.json";

// 🌐 WEB APP
// 🌐 WEB APP
function doGet(e) {
  const data = loadDashboardData();
  console.log(`[CompetitorRadar] doGet loaded ${data ? data.length : 0} items.`);
  
  if (!data || data.length === 0) {
    return HtmlService.createHtmlOutput(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1>⚠️ No Data Found</h1>
        <p>The dashboard cannot find the patent data file (<code>${DATA_FILENAME}</code>).</p>
        <hr style="width: 50%; opacity: 0.3;">
        <p><b>Action Required:</b></p>
        <ol style="display: inline-block; text-align: left;">
          <li>Open the Apps Script Editor.</li>
          <li>Select the <code>runCompetitorRadar</code> function.</li>
          <li>Click <b>Run</b> to generate the analysis data.</li>
          <li>Once completed, refresh this page.</li>
        </ol>
      </div>
    `).setTitle('Competitor Radar - No Data');
  }

  const tpl = HtmlService.createTemplateFromFile('CompetitorRadarHtml');
  // Encapsulate in base64 to avoid HTML injection/breaking scripts
  // [FIX] removing newlines just in case
  const rawData = JSON.stringify(data || []);
  const b64 = Utilities.base64Encode(rawData, Utilities.Charset.UTF_8).replace(/\r?\n/g, "");
  tpl.data = b64; 
  return tpl.evaluate()
      .setTitle(`⚔️ Competitor Radar`)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 📝 LOGGING
function log(msg) {
  console.log(`[CompetitorRadar] ${msg}`);
}

// ==========================================
// 2. 🚀 MAIN LOGIC
// ==========================================

const COMPETITOR_RADAR_CACHE_FILENAME = "_COMPETITOR_EMBEDDINGS_CACHE.json";
const FTO_CACHE_FILENAME              = "_COMPETITOR_FTO_CACHE.json";
const REPORT_CACHE_FILENAME           = "_COMPETITOR_REPORT_CACHE.json";
const DETAILED_FTO_CACHE_FILENAME     = "DETAILED_FTO_ANALYSIS_CONSOLIDATED.json";

// Note: onOpen is in Menu.gs

/**
 * 🕒 Setup Automatic Weekly Run
 * Run this function ONCE to schedule the script.
 */
function setupWeeklyTrigger() {
  // Check if already exists
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'runCompetitorRadar') {
      log("⚠️ Trigger already exists. Deleting old one...");
      ScriptApp.deleteTrigger(t);
    }
  }
  
  // Create new
  ScriptApp.newTrigger('runCompetitorRadar')
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(9) // 9 AM
      .create();
      
  log("✅ Weekly Trigger Set! Script will run every Monday at 9 AM.");
  
  if (SpreadsheetApp.getActiveSpreadsheet()) {
     SpreadsheetApp.getUi().alert("✅ Weekly Trigger Set!\n\nThe script will now run automatically every Monday at 9 AM.");
  }
}

function runCompetitorRadar() {
  log("🚀 Starting Competitor Analysis...");
  
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch(e) { log("⚠️ No UI context (running from Editor/Trigger)."); }

  // 1. DATA INGESTION
  const patents = loadSourceData();
  if (patents.length === 0) {
    if (ui) ui.alert("⚠️ No patents found. Check Source Folder ID.");
    else log("⚠️ No patents found. Check Source Folder ID.");
    return;
  }
  
  const toast = SpreadsheetApp.getActiveSpreadsheet();
  if(toast) toast.toast(`Analyzing ${patents.length} patents...`, "Competitor Radar");
  
  log(`📦 Loaded ${patents.length} patents from Source JSONs.`);
  
  // 2. EMBEDDINGS & CACHE
  const cacheMap = loadCache();
  const patentsWithVectors = processEmbeddings(patents, cacheMap);

  // [NEW] Load Inventions EARLY to include in Map
  const inventions = loadInventions(); // Load from Drive
  log(`🛡️ Processing ${inventions.length} internal inventions...`);
  
  // Embed Inventions
  inventions.forEach(inv => {
      // [FIX] Handle missing data
      const text = inv.SummaryText || inv.Name || "";
      
      log(`   🔍 Processing Invention: ${inv.Name}`);
      
      if (!text) {
          log("      ⚠️ Skipping invalid invention (No Name/Summary)");
          inv.vector = new Array(1024).fill(0); // Dummy vector to avoid breaking PCA
          return;
      }
      
      // Log extract
      log(`      📝 Text to Embed: "${text.substring(0, 50)}..."`);

      // Simple caching check (using SummaryText hash)
      if (!inv.vector) {
          const hash = computeHash(text);
          if (cacheMap[hash] && cacheMap[hash].vector) {
             inv.vector = cacheMap[hash].vector;
             log("      ♻️ Using Cached Vector");
          } else {
             // Generate
             log("      ⚙️ Generating new embedding...");
             inv.vector = getMistralEmbedding(text.substring(0, 20000));
             if (inv.vector) {
                 cacheMap[hash] = { vector: inv.vector, title: inv.Name };
                 log(`      ✅ Vector Generated (Length: ${inv.vector.length})`);
                 log(`      🔢 Vector Sample: [${inv.vector.slice(0,5).join(', ')}...]`);
             } else {
                 log("      ❌ Embedding Failed (Result is null)");
             }
          }
      }
  });

  // [FIX] Save Cache after Invention Processing
  // Since we might have generated new vectors for Inventions, we must persist them.
  saveCache(cacheMap);

  // 4. MATH (PCA & Clustering)
  // COMBINE for PCA to share the same space
  const allVectors = [
      ...patentsWithVectors.map(p => p.vector),
      ...inventions.map(i => i.vector)
  ];
  
  // PCA
  const points2D = computePCA(allVectors, PCA_COMPONENTS);
  
  // Assign back to Patents
  patentsWithVectors.forEach((p, i) => {
    p.x = points2D[i][0];
    p.y = points2D[i][1];
  });
  
  // ----------------------------------------------------
  // 🏷️ ANCHORED SEMANTIC ZONING (Dynamic Cluster Naming)
  // ----------------------------------------------------
  // allVectors is already consistent from PCA step
  const allItems = [...patentsWithVectors, ...inventions];
  
  // 1. Try Load Existing Taxonomy (Anchors) for Stability
  let taxonomy = loadTaxonomy();
  const FORCE_REFRESH = true; // [FIX] Force meaningful update
  // ...

  if (!taxonomy || taxonomy.length === 0 || FORCE_REFRESH) {
      log("🔄 No existing taxonomy found (or refresh forced). Running Initial Clustering...");
      
      // A. Run K-Means on EVERYTHING (Market + Mistral)
      // [USER REQUEST] Revert to 15 topics to ensure density but lower threshold
      const RAW_CLUSTERS = 15;
      const clusters = computeKMeans(allVectors, RAW_CLUSTERS);
      
      // Group items by cluster
      const clusterGroups = {};
      clusters.forEach((cId, i) => {
          if (!clusterGroups[cId]) clusterGroups[cId] = [];
          clusterGroups[cId].push({ item: allItems[i], vector: allVectors[i] });
      });
      
      // B. Generate Stable Names (AI)
      taxonomy = [];
      log(`🧠 Naming ${Object.keys(clusterGroups).length} clusters via Mistral...`);
      
      Object.keys(clusterGroups).forEach(cId => {
          const group = clusterGroups[cId];
          if (group.length < 1) return; // Keep ALL non-empty clusters (even size 1 or 2)
          
          // Calculate Centroid
          const centroid = calculateCentroid(group.map(g => g.vector));
          
          // Find items (The "Core" of the zone + Periphery)
          // [USER REQUEST] Use ALL items for naming if possible
          const sorted = group.sort((a, b) => 
              euclideanDistance(a.vector, centroid) - euclideanDistance(b.vector, centroid)
          );
          
          // Max 20 items to avoid token overflow? Or try all?
          // Let's take top 30 to be safe but comprehensive
          const coreItems = sorted.slice(0, 30).map(g => g.item);
          
          // Generate Name
          const name = generateClusterName(coreItems);
          
          if (name && name !== "Uncategorized") {
              taxonomy.push({
                  id: cId,
                  name: name,
                  centroid: centroid, // Save centroid for future assignment
                  count: group.length
              });
              log(`   🏷️ Cluster ${cId} -> "${name}" (${group.length} items)`);
          }
      });
      
      // Save Taxonomy
      saveTaxonomy(taxonomy);
  } else {
      log(`✅ Loaded Stable Taxonomy (${taxonomy.length} anchors).`);
  }
  
  // 2. Assign All Items to Nearest Anchor
  log("📍 Assigning items to nearest Semantic Standard...");
  allItems.forEach(item => {
      let bestTopic = "Uncategorized";
      let minDist = Infinity;
      
      taxonomy.forEach(anchor => {
          const dist = euclideanDistance(item.vector, anchor.centroid);
          if (dist < minDist) {
              minDist = dist;
              bestTopic = anchor.name;
          }
      });
      
      // Threshold check? (Optional, skipping for now to ensure coverage)
      // if (minDist > 0.4) bestTopic = "Other / Emerging"; 
      
      item.Topic = bestTopic;
  });
  
  // 3. Overflow Analysis (Optional - check for items very far from all anchors)
  // ... (Implemented in future if needed) ...

  // [USER REQUEST] Detailed Console Report
  logTaxonomyReport(taxonomy, allItems);

  // ----------------------------------------------------
  // 5. INFRINGEMENT ANALYSIS (FTO)
  // ----------------------------------------------------
  const infringementData = analyzeInfringementRisk(inventions, patentsWithVectors);
  
  // MERGE FTO params (x, y, Topic) into infringementData
  // We want to keep the coordinates from PCA and add the matches from infringement analysis.
  
  const finalFto = inventions.map(inv => {
      // Find the corresponding risk report item
      // analyzeInfringementRisk returns items with 'inventionName' matching 'inv.Name'
      const riskReportItem = infringementData.find(r => r.inventionName === inv.Name);
      
      return {
          ...inv, // Contains x, y, Topic, Name, SummaryText
          ...riskReportItem // Contains matches, matches[], etc. (overwrites if duplicate keys, but keys are distinct enough)
      };
  });
  
  // 6. SAVE DATA FOR DASHBOARD
  const finalPayload = {
     items: patentsWithVectors, 
     fto: finalFto, // Send the MERGED array
     scannedCount: inventions.length,
     updated: new Date().toLocaleString('fr-FR')
  };
  
  saveDataForDashboard(finalPayload);
  
  // Notify
  const scriptUrl = ScriptApp.getService().getUrl();
  log("✅ Analysis Complete!");
  if (scriptUrl) log(`👉 Dashboard URL: ${scriptUrl}`);
  else log("⚠️ Web App not deployed yet. Please deploy to view dashboard.");

  if (ui) {
      const msg = scriptUrl 
        ? `<p>Analysis Complete! 🎉</p><p><a href="${scriptUrl}" target="_blank" style="font-size:16px; font-weight:bold;">👉 Click here to open Dashboard</a></p>`
        : `<p>Analysis Complete! 🎉</p><p>⚠️ <b>Action Required:</b> Please Deploy this script as a Web App to view the dashboard.</p>`;

      const htmlOutput = HtmlService
        .createHtmlOutput(msg)
        .setWidth(400)
        .setHeight(200);
      ui.showModalDialog(htmlOutput, 'Analysis Complete');
  }
}

// ----------------------------------------------------
// 📂 DATA LOADING
// ----------------------------------------------------

function loadSourceData() {
  const folder = DriveApp.getFolderById(FOLDER_ID_SOURCE_JSONS);
  const files = folder.getFiles();
  let allPatents = [];
  const seenKeys = new Set(); // [FIX] Deduplication Tracker
  let skippedCount = 0;
  
  while (files.hasNext()) {
    const f = files.next();
    const name = f.getName().toLowerCase();
    
    // Auto-detect company
    let company = "Unknown";
    if (name.includes("openai")) company = "OpenAI";
    else if (name.includes("anthropic")) company = "Anthropic";
    else if (!name.endsWith(".json")) continue; // Skip non-JSON
    
    log(`📄 Processing ${name} (${company})...`);
    
    try {
      const content = f.getBlob().getDataAsString();
      const json = JSON.parse(content);
      const records = json.Records || [];
      
      records.forEach(rec => {
        try {
          const parsed = parseRecord(rec, company);

          if (parsed) {
             // [FIX] Stricter Deduplication: Company + Alphanumeric Title
             // Removes spaces, punctuation, etc. to catch "Method for X" vs "Method for X."
             const cleanTitle = parsed.Title.toLowerCase().replace(/[^a-z0-9]/g, "");
             const key = `${company}|${cleanTitle}`;
             
             if (seenKeys.has(key)) {
                skippedCount++;
                if (skippedCount <= 5) log(`   🔹 Skipped duplicate: ${parsed.Title.substring(0,40)}...`);
             } else {
                seenKeys.add(key);
                allPatents.push(parsed);
             }
          }
        } catch(e) { /* skip bad record */ }
      });
      
    } catch(e) {
      log(`❌ Error parsing ${name}: ${e.message}`);
    }
  }
  
  if (skippedCount > 0) log(`🧹 Deduplication: Skipped ${skippedCount} duplicate records.`);
  return allPatents;
}

function parseRecord(rec, company) {
  // Safe extraction logic similar to Python
  const titleObj = rec.Titles?.[0] || rec.Titles || {};
  const texts = titleObj.Texts || titleObj;
  const title = texts?.[0]?.text || "Untitled";
  
  const absObj = rec.Abstracts?.[0] || rec.Abstracts || {};
  const absTexts = absObj.Texts || absObj;
  const abstract = absTexts?.[0]?.text || "";
  
  // Claims
  let rawClaim = "";
  if (rec.IndependentClaims?.Texts?.[0]?.text) {
    rawClaim = rec.IndependentClaims.Texts[0].text;
  }
  
  // Family & Dates
  const info = rec.FamilyInformation?.[0] || {};
  const appDateRaw = String(info.applicationdate || "");
  let appYear = 1900;
  let appDate = "1900-01-01";
  
  if (appDateRaw.length === 8) {
    appYear = parseInt(appDateRaw.substring(0, 4));
    appDate = `${appDateRaw.substring(0,4)}-${appDateRaw.substring(4,6)}-${appDateRaw.substring(6)}`;
  }
  
  const url = generateGoogleLink(info.countrycode, info.publicationnumber, info.kindcode, appDateRaw);
  
  // Inventors
  const inventors = (rec.StandardInventors || []).map(i => i.name).filter(n => n);
  const invDisplay = inventors.slice(0, 4).map(i => toTitleCase(i)).join(", ") + (inventors.length > 4 ? "..." : "");

  // Extract Patent Number for Linking
  const patNum = String(info.publicationnumber || "").trim();

  return {
    Company: company,
    Title: cleanText(title),
    PatentNumber: patNum, // [FIX] Added for Frontend Lookup
    Abstract: cleanText(abstract),
    FullText: `${title}. ${abstract}`,
    CleanClaim: cleanText(rawClaim).substring(0, 3000), // Trim for AI
    AppDate: appDate,
    AppYear: appYear,
    URL: url,
    Inventors: invDisplay,
    InventorsList: inventors // Full list for analytics
  };
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

// ----------------------------------------------------
// 🧠 CACHE & EMBEDDINGS
// ----------------------------------------------------
function loadCache() {
  const folder = DriveApp.getFolderById(FOLDER_ID_EMBEDDINGS);
  const files = folder.getFilesByName(COMPETITOR_RADAR_CACHE_FILENAME);
  if (files.hasNext()) {
    try {
      return JSON.parse(files.next().getBlob().getDataAsString());
    } catch (e) {
      log("⚠️ Cache corrupt, starting fresh.");
    }
  }
  return {};
}

function saveCache(cacheMap) {
  const folder = DriveApp.getFolderById(FOLDER_ID_EMBEDDINGS);
  const files = folder.getFilesByName(COMPETITOR_RADAR_CACHE_FILENAME);
  if (files.hasNext()) files.next().setTrashed(true);
  
  folder.createFile(COMPETITOR_RADAR_CACHE_FILENAME, JSON.stringify(cacheMap));
  log("💾 Cache saved to Drive.");
}

function processEmbeddings(patents, cacheMap) {
  let changed = false;
  let processedCount = 0;
  
  for (const p of patents) {
    // [UPDATE] Hash should depend on CLAIM now, not FullText (Title+Abstract)
    // If no claim, we fallback to FullText to avoid breaking everything
    const contentToEmbed = p.CleanClaim && p.CleanClaim.length > 50 ? p.CleanClaim : p.FullText;
    
    const hash = computeHash(contentToEmbed);
    p.hash = hash; // Store for valid checking
    
    if (cacheMap[hash] && cacheMap[hash].vector) {
      p.vector = cacheMap[hash].vector;
      // Also load cached summary if exists?
      if (cacheMap[hash].summary) p.AISummary = cacheMap[hash].summary;
    } else {
      // GENERATE
      if (processedCount >= 500) { // [USER REQUEST] Increased limit for full analysis (was 50)
         log("⏳ Request limit reached (500). Remaining items will use zero-vectors. Rerun script to continue!");
         p.vector = new Array(1024).fill(0); 
         continue; 
      }
      
      
      log(`⚙️ Embedding: ${p.Title.substring(0, 30)}...`);
      // [UPDATE] User requested embedding of CLAIMS (Independent), not Title+Abstract
      const textToEmbed = p.CleanClaim && p.CleanClaim.length > 50 ? p.CleanClaim : p.FullText;

      const vector = getMistralEmbedding(textToEmbed.substring(0, 20000)); // Increased limit
      
      if (vector) {
        p.vector = vector;
        // Save to cache obj
        cacheMap[hash] = {
          vector: vector,
          title: p.Title // Debug info
        };
        changed = true;
        processedCount++;
      } else {
         p.vector = new Array(1024).fill(0); // Fail safe
      }
    }
    
    // Lazy Summary (Optional) - User python script did "Clean Claims" and "AI Summary"
    // AI Summary (Cached)
    // Check if summary exists AND is in the new "Structured" format (contains HTML bold tags)
    // If not, we regenerate it to upgrade the content.
    let hasValidSummary = false;
    if (cacheMap[hash] && cacheMap[hash].summary) {
        if (cacheMap[hash].summary.includes("<b>Context:</b>")) {
             p.AISummary = cacheMap[hash].summary;
             hasValidSummary = true;
        }
    }

    if (!hasValidSummary) {
       // Generate if under limit
       if (processedCount < 20) { // Reduced limit because prompts are bigger/slower
          log(`📝 Analyzing (Structured): ${p.Title.substring(0,25)}...`);
          
          const prompt = `Perform a structured technical analysis of this patent.
          Return ONLY a JSON object with these 3 keys:
          {
             "context": "Background field and current limitations (1-2 sentences)",
             "problem": "Specific technical problem solved (1-2 sentences)",
             "solution": "Core innovation and how it works (2-3 sentences)"
          }
          Title: ${p.Title}
          Abstract: ${p.Abstract}
          Claim: ${p.CleanClaim ? p.CleanClaim.substring(0,1000) : "N/A"}`;
          
          try {
             const resp = getMistralChat(prompt);
             if (resp) {
                let formatted = "";
                try {
                   const json = JSON.parse(resp);
                   formatted = `<b>Context:</b> ${json.context}<br><br><b>Problem:</b> ${json.problem}<br><br><b>Solution:</b> ${json.solution}`;
                } catch(e) {
                   // Fallback for non-JSON
                   formatted = resp.replace(/\n/g, "<br>");
                }
                
                p.AISummary = formatted;
                
                // Update Cache
                if (!cacheMap[hash]) cacheMap[hash] = {};
                cacheMap[hash].summary = formatted;
                changed = true;
                processedCount++; 
             } else {
                p.AISummary = "Analysis generation failed.";
             }
          } catch(e) {
             log("⚠️ Analysis Error: " + e.message);
             p.AISummary = "Analysis error.";
          }
       } else {
          p.AISummary = (cacheMap[hash] && cacheMap[hash].summary) 
             ? cacheMap[hash].summary // Keep old summary if we hit limit
             : "Analysis pending (Run script again).";
       }
    }
  }
  
  if (changed) saveCache(cacheMap);
  return patents;
}

// ----------------------------------------------------
// 🖼️ DATA PERSISTENCE (JSON)
// ----------------------------------------------------
function saveDataForDashboard(data) {
  const folder = DriveApp.getFolderById(FOLDER_ID_SOURCE_JSONS);
  
  // Clean old data files
  const files = folder.getFilesByName(DATA_FILENAME);
  while (files.hasNext()) files.next().setTrashed(true);
  
  // Save new
  folder.createFile(DATA_FILENAME, JSON.stringify(data));
  log(`✅ Data saved to ${DATA_FILENAME}`);
  
  // Also save HTML Dashboard
  saveDashboardHtml(data);
}

function saveDashboardHtml(data) {
   try {
     const tpl = HtmlService.createTemplateFromFile('CompetitorRadarHtml');
      // [FIX] Encode data as Base64 string for safe injection into HTML
      const jsonStr = JSON.stringify(data);
      const base64Data = Utilities.base64Encode(jsonStr);
      tpl.data = base64Data;
     const htmlContent = tpl.evaluate().getContent();
     
     const folder = DriveApp.getFolderById(FOLDER_ID_DASHBOARD_EXPORT);
     const fileName = "Competitor_Radar_Dashboard.html";
     
     // Trash old
     const files = folder.getFilesByName(fileName);
     while (files.hasNext()) files.next().setTrashed(true);
     
     folder.createFile(fileName, htmlContent);
     log(`✅ Dashboard HTML saved to Export Folder.`);
   } catch(e) {
     log(`⚠️ Failed to save Dashboard HTML: ${e.message}`);
   }
}

function loadDashboardData() {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID_SOURCE_JSONS);
    const files = folder.getFilesByName(DATA_FILENAME);
    if (files.hasNext()) {
      const file = files.next();
      const content = file.getBlob().getDataAsString();
      if (!content || content.trim().length === 0) {
        log("⚠️ loadDashboardData: File is empty.");
        return [];
      }
      
      const parsed = JSON.parse(content);
      
      // [NEW] Load Report Cache (SWOTs)
      // [NEW] Load Report Cache (SWOTs) - File Based
      const reportCache = loadAllSWOTs();
      
      // [NEW] Load Strategic Analysis Cache
      let strategicReport = null;
      try {
          const sFiles = folder.getFilesByName("STRATEGIC_ANALYSIS_CONSOLIDATED.json"); // Same folder as source? No, EXPORT folder!
          // Wait, folder above is SOURCE_JSONS. We need DASHBOARD_EXPORT.
          const exportFolder = DriveApp.getFolderById(FOLDER_ID_DASHBOARD_EXPORT);
          const sFiles2 = exportFolder.getFilesByName("STRATEGIC_ANALYSIS_CONSOLIDATED.json");
          
          if (sFiles2.hasNext()) {
              const sCache = JSON.parse(sFiles2.next().getBlob().getDataAsString());
              if (sCache.latest) strategicReport = sCache.latest;
              log("   ✅ Loaded Cached Strategic Analysis");
          }
      } catch(e) {
          log("   ⚠️ Failed to load Strategic Analysis: " + e.message);
      }

      // [CRITICAL FIX] If it's an object with 'items', return the WHOLE object
      if (parsed && !Array.isArray(parsed) && parsed.items) {
          parsed.reports = reportCache; // Attach cached reports
          parsed.strategicReport = strategicReport; // Attach strategic report
          parsed.ftoAnalyses = loadConsolidatedFTOAnalyses(); // [NEW] Attach detailed FTO analyses
          
          // [FIX] Ensure FTO data is attached, but do NOT overwrite if it exists (preserve x/y from analysis)
          if (!parsed.fto || parsed.fto.length === 0) {
              parsed.fto = loadInventions(); 
          }
          
          log(`📦 Loaded Structured Data (Items: ${parsed.items.length}, FTO: ${parsed.fto ? parsed.fto.length : 0}, Reports: ${Object.keys(reportCache).length})`);
          return parsed;
      }

      if (!Array.isArray(parsed)) {
        log(`⚠️ loadDashboardData: Expected Array but got ${typeof parsed}.`);
        if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
        return []; 
      }
      
      // If legacy array, wrap it to include reports?
      // Or just return array and frontend handles it?
      // Better to return object if possible, but frontend might expect array.
      // Let's wrap it in the object format we established above.
      
      // [FIX] Load Internal Inventions for Visuals
      const ftoParams = loadInventions(); // Load from Drive

      log(`✅ loadDashboardData: Successfully loaded ${parsed.length} items (Legacy Array Format).`);
      return { 
          items: parsed, 
          reports: reportCache,
          strategicReport: strategicReport,
          ftoAnalyses: loadConsolidatedFTOAnalyses(), // [NEW] Attach detailed FTO analyses
          fto: ftoParams, // [FIX] Add Internal Inventions
          scannedCount: parsed.length 
      };
    } else {
      log("⚠️ loadDashboardData: No file found.");
    }
  } catch (e) {
    log("⚠️ Could not load dashboard data: " + e.message);
  }
  return [];
}

// ==========================================
// 3. 🛠️ UTILITIES
// ==========================================

function cleanText(text) {
  if (!text) return "";
  return String(text).replace(/"/g, '').replace(/'/g, "").trim();
}

/**
 * Generates correct Google Patents link.
 * Handles US Grant B1 logic and WO year prefixes.
 */
function generateGoogleLink(cc, pn, kc, app_date_raw) {
  let clean_pn = String(pn).trim().replace(" ", "");
  cc = String(cc).trim();
  kc = String(kc).trim();
  let final_kind_code = kc;
  let app_date_str = String(app_date_raw);

  if (cc === 'WO') {
    // WO9912345 -> WO199912345 logic
    const match = clean_pn.match(/^WO(\d{2})(\d+.*)$/);
    if (match) {
        const yy = match[1];
        const rest = match[2];
        const prefix = app_date_str.startsWith("19") ? "19" : "20";
        clean_pn = `WO${prefix}${yy}${rest}`;
    }
  } else if (cc === 'US') {
      let num_part = clean_pn;
      if (num_part.startsWith('US')) num_part = num_part.substring(2);
      
      if (num_part.length === 10 && num_part.startsWith('20')) {
          clean_pn = `US${num_part.substring(0,4)}0${num_part.substring(4)}`;
      } else if (!clean_pn.startsWith('US')) {
          clean_pn = `US${clean_pn}`;
      }

      // B1 Logic
      if (['AA', 'A'].includes(kc)) final_kind_code = 'A1';
      else if (['BA', 'BB', 'B'].includes(kc)) final_kind_code = 'B1';
  }

  let final_pn_for_url = clean_pn;
  if (final_kind_code && !final_pn_for_url.endsWith(final_kind_code)) {
      final_pn_for_url += final_kind_code;
  }

  // Double suffix fix
  if (cc === 'US' && final_pn_for_url.endsWith(kc) && kc !== final_kind_code) {
      final_pn_for_url = final_pn_for_url.substring(0, final_pn_for_url.length - kc.length) + final_kind_code;
  }

  return `https://patents.google.com/patent/${final_pn_for_url}/en`;
}

/**
 * MD5 Hash for cache keys
 */
function computeHash(input) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input);
  let txtHash = "";
  for (let i = 0; i < raw.length; i++) {
    let hashVal = raw[i];
    if (hashVal < 0) hashVal += 256;
    if (hashVal.toString(16).length == 1) txtHash += "0";
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

// ==========================================
// 4. 🤖 MISTRAL CLIENT
// ==========================================

function getMistralEmbedding(text) {
  if (!text) return null;
  const url = "https://api.mistral.ai/v1/embeddings";
  const payload = {
    model: MODEL_EMBEDDING,
    input: [text] // API expects array
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + getMistralApiKey() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      log("❌ Mistral Embedding Error: " + response.getContentText());
      return null;
    }
    const json = JSON.parse(response.getContentText());
    if (json.data && json.data.length > 0) {
      return json.data[0].embedding;
    }
  } catch (e) {
    log("❌ Mistral Connection Error: " + e.message);
  }
  return null;
}


function getMistralChat(prompt, modelOverride) {
  const url = "https://api.mistral.ai/v1/chat/completions";
  const payload = {
    model: modelOverride || MODEL_CHAT,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + getMistralApiKey() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    log(`📡 Calling Mistral Chat API...`);
    const startTime = new Date().getTime();
    
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const content = response.getContentText();
    const duration = (new Date().getTime() - startTime) / 1000;
    
    log(`   ⬅️ Response: ${code} (${duration}s)`);
    
    if (code !== 200) {
      log(`   ❌ Mistral API Error [${code}]:`);
      log(`   ❌ Body: ${content}`);
      
      // Specific Error Handling
      if (code === 401) throw new Error("Unauthorized: Check MISTRAL_API_KEY");
      if (code === 429) throw new Error("Rate Limit Exceeded: Too many requests");
      if (code >= 500) throw new Error("Mistral Server Error");
      
      throw new Error(`Mistral API Failed (${code}): ${content}`);
    }
    
    const json = JSON.parse(content);
    return json.choices[0].message.content;
    
  } catch (e) {
    log("   ❌ Mistral Connection Exception: " + e.message);
    // Re-throw so the caller knows it failed
    throw e;
  }
}

// ==========================================
// 5. 🧮 MATH ENGINE (PCA & K-MEANS)
// ==========================================

// --- PCA IMPLEMENTATION ---
// Simple Power Iteration for Top N components
function computePCA(vectors, n_components = 2) {
  if (!vectors || vectors.length === 0) return [];
  
  const N = vectors.length;
  const D = vectors[0].length;
  
  log(`🧮 Starting PCA on ${N} vectors of dimension ${D}...`);

  // 1. Centering
  const mean = new Array(D).fill(0);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < D; j++) mean[j] += vectors[i][j];
  }
  for (let j = 0; j < D; j++) mean[j] /= N;

  const centered = vectors.map(v => v.map((val, j) => val - mean[j]));

  // 2. Covariance Matrix (Implicitly handled in power iteration to save RAM? 
  // No, let's compute explicit C = X^T * X for speed if D=1024. 
  // Actually X^T * X is D*D. 1024*1024 is ~1M items. Fine for v8 engine.
  
  /*
     However, Power Iteration works on Matrix A.
     We want Eigenvectors of C = (1/N) * X^T * X
     v_new = C * v_old
     v_new = (1/N) * X^T * (X * v_old)
     
     We can do this WITHOUT building the huge Covariance Matrix C!
     X is N*D. 
     v is D*1.
     step 1: y = X * v (result N*1)
     step 2: z = X^T * y (result D*1)
     step 3: v = z / norm(z)
     
     This is O(N*D) per iteration. Much lighter than O(D^2) if N < D, but usually N > D.
     Given N ~ 500, D = 1024. N*D = 500k. Super fast.
  */

  const components = [];
  let current_matrix = centered; // In theory we deflate X, but simpler to deflate C. 
  // For top 2, we can just Orthogonalize PC2 against PC1.

  const eigenvectors = [];

  for (let c = 0; c < n_components; c++) {
    let v = new Array(D).fill(0).map(() => Math.random() - 0.5);
    // Normalize
    let norm = Math.sqrt(v.reduce((s, x) => s + x*x, 0));
    v = v.map(x => x / norm);

    // Power Iteration
    for (let iter = 0; iter < 10; iter++) { // 10 iters usually enough for approx
       // y = X * v
       let y = new Array(N).fill(0);
       for(let i=0; i<N; i++) {
         for(let j=0; j<D; j++) y[i] += centered[i][j] * v[j];
       }
       
       // z = X^T * y
       let z = new Array(D).fill(0);
       for(let j=0; j<D; j++) {
         for(let i=0; i<N; i++) z[j] += centered[i][j] * y[i]; // (X^T)_ji = X_ij
       }
       
       // Deflation/Orthogonalization (Gram-Schmidt)
       for(let k=0; k<eigenvectors.length; k++) {
         // Project z onto previous eigenvector k
         const vk = eigenvectors[k];
         const dot = z.reduce((sum, val, idx) => sum + val * vk[idx], 0);
         for(let idx=0; idx<D; idx++) z[idx] -= dot * vk[idx];
       }

       // Normalize z -> v
       let z_norm = Math.sqrt(z.reduce((s, x) => s + x*x, 0));
       if (z_norm < 1e-9) break; // collapsed
       v = z.map(x => x / z_norm);
    }
    eigenvectors.push(v);
  }

  // 3. Project Data
  // Result = centered * eigenvectors^T
  // out[i][0] = centered[i] dot v1
  // out[i][1] = centered[i] dot v2
  
  const projected = [];
  for(let i=0; i<N; i++) {
     projected.push([
       centered[i].reduce((s, x, j) => s + x * eigenvectors[0][j], 0),
       centered[i].reduce((s, x, j) => s + x * eigenvectors[1][j], 0)
     ]);
  }
  
  return projected;
}

// ----------------------------------------------------
// 📉 K-MEANS IMPLEMENTATION
// ----------------------------------------------------


// --- K-MEANS IMPLEMENTATION ---
function computeKMeans(vectors, k=5, max_iters=10) {
  if (!vectors || vectors.length < k) return new Array(vectors.length).fill(0);
  
  log(`🧮 Starting K-Means (K=${k})...`);
  const N = vectors.length;
  const D = vectors[0].length;

  // 1. Init Centroids (Random Points)
  let centroids = [];
  const picked = new Set();
  while(centroids.length < k) {
    const idx = Math.floor(Math.random() * N);
    if (!picked.has(idx)) {
      picked.add(idx);
      centroids.push([...vectors[idx]]); // Copy
    }
  }

  let assignments = new Array(N).fill(-1);

  for(let iter=0; iter<max_iters; iter++) {
     let changed = false;
     
     // A. Assign
     for(let i=0; i<N; i++) {
        let bestDist = Infinity;
        let bestK = -1;
        for(let c=0; c<k; c++) {
           // Squared Euclidean
           let dist = 0;
           for(let j=0; j<D; j++) {
             const d = vectors[i][j] - centroids[c][j];
             dist += d*d;
           }
           if (dist < bestDist) {
             bestDist = dist;
             bestK = c;
           }
        }
        if (assignments[i] !== bestK) {
          assignments[i] = bestK;
          changed = true;
        }
     }
     
     if (!changed) break;

     // B. Update Centroids
     const newCentroids = Array.from({length: k}, () => new Array(D).fill(0));
     const counts = new Array(k).fill(0);
     
     for(let i=0; i<N; i++) {
       const cluster = assignments[i];
       counts[cluster]++;
       for(let j=0; j<D; j++) newCentroids[cluster][j] += vectors[i][j];
     }
     
     for(let c=0; c<k; c++) {
       if (counts[c] > 0) {
          for(let j=0; j<D; j++) centroids[c][j] = newCentroids[c][j] / counts[c];
       }
     }
  }
  
  return assignments;
}

// ----------------------------------------------------
// 🏷️ CLUSTER NAMING (AI)
// ----------------------------------------------------
function generateClusterNames(patents, k) {
  log("🤖 Generating Cluster Names...");
  const names = {};
  
  // Group titles by cluster
  const groups = {};
  for(const p of patents) {
    if(!groups[p.Cluster]) groups[p.Cluster] = [];
    if(groups[p.Cluster].length < 5) {
        // [FIX] Use Summary for better context if available
        let summary = p.AISummary || p.Abstract || "";
        // Clean up HTML tags if present (e.g. <b>)
        summary = summary.replace(/<[^>]*>?/gm, ''); 
        groups[p.Cluster].push({ title: p.Title, summary: summary });
    }
  }
  
  for(let i=0; i<k; i++) {
    const titles = groups[i];
    if(!titles || titles.length === 0) {
       names[i] = `Cluster ${i} (Empty)`;
       continue;
    }
    
    // Explicit JSON prompt
    const prompt = `Analyze these patent titles and summaries from a technology cluster.
    Identify the core technical theme (e.g. "Large Language Models", "Transformer Architecture", "Reinforcement Learning").
    Generate a Short Topic Name (max 3-5 words) that describes this theme.
    
    Return strictly JSON format: { "topic_name": "YOUR TOPIC HERE" }
    
    Patents:
    ${titles.map(p => `- Title: ${p.title}\n  Summary: ${p.summary.substring(0, 300)}...`).join("\n")}`;
    
     try {
       const response = getMistralChat(prompt);
       if(response) {
          // Try parsing JSON
          let topic = "";
          try {
            // Clean markdown blocks if any
            const clean = response.replace(/```json/g, "").replace(/```/g, "").trim();
            const json = JSON.parse(clean);
            topic = json.topic_name || json.topic || json.name || Object.values(json)[0];
          } catch(e) {
             // If not JSON, just use the text (cleanup quotes)
             topic = response.replace(/"/g, "").trim();
          }
          
          if (topic && topic.length > 50) topic = topic.substring(0, 47) + "..."; // Truncate if too long
          names[i] = topic || `Cluster ${i}`;
          log(`🏷️ Cluster ${i}: ${names[i]}`);
       } else {
          names[i] = `Cluster ${i}`;
       }
     } catch(e) {
       log(`⚠️ Failed to name Cluster ${i}: ${e.message}`);
       names[i] = `Cluster ${i}`;
     }
  }
  return names;
}

// ==========================================
// 6. 🛡️ INFRINGEMENT ANALYSIS (FTO)
// ==========================================

function loadInventions() {
  if (!FOLDER_ID_INVENTIONS) {
      log("⚠️ FOLDER_ID_INVENTIONS not set. Skipping FTO analysis.");
      return [];
  }
  
  log("🛡️ Loading Inventions from Drive...");
  const root = DriveApp.getFolderById(FOLDER_ID_INVENTIONS);
  const folders = root.getFolders();
  const inventions = [];
  
  while (folders.hasNext()) {
    const f = folders.next();
    if (f.isTrashed()) continue;
    
    // Look for "INVENTION SUMMARY" doc
     const files = f.getFiles(); // Changed 'folder' to 'f'
     while (files.hasNext()) {
         const file = files.next();
         if (file.getName().toUpperCase().includes("INVENTION SUMMARY")) {
             // Supports Google Docs, Text, and PDFs (if OCR'd/extractable)
             let text = "";
             const mime = file.getMimeType();
             
             try {
                if (mime === MimeType.GOOGLE_DOCS) {
                    text = DocumentApp.openById(file.getId()).getBody().getText();
                } else if (mime === MimeType.PLAIN_TEXT) {
                    text = file.getBlob().getDataAsString();
                } else if (mime === MimeType.PDF) {
                    // Basic PDF extraction (only works if text layer exists)
                    // For now, let's treat it as blob text if possible, or skip
                    // Better to convert to Doc
                    log(`⚠️ PDF found: ${file.getName()}. Skipped (Convert to Google Doc for analysis).`);
                    continue; 
                } else {
                    continue;
                }
                
                if (text.length > 50) {
                    inventions.push({
                        Name: file.getName(),
                        FolderName: f.getName(), // [NEW] Capture parent folder name (MIST-XXXX)
                        Link: file.getUrl(),
                        SummaryText: text
                    });
                    log(`   📄 Loaded: ${file.getName()} (in ${f.getName()})`);
                }
             } catch(e) {
                 log(`   ❌ Failed to read ${file.getName()}: ${e.message}`);
             }
         }
     }
  }
  log(`✅ Loaded ${inventions.length} inventions.`);
  return inventions;
}

function analyzeInfringementRisk(inventions, patentsWithVectors) {
   if (!inventions || inventions.length === 0) return [];
   
   log(`🛡️ Analyzing Infringement Risk for ${inventions.length} inventions...`);
   
   // Pre-calculate dot products? No, just do it on the fly.
   const riskReport = [];
   
   inventions.forEach(inv => {
       // [CRITICAL OPTIMIZATION] Reuse existing vector if available
       let invVector = inv.vector;
       
       if (!invVector) {
           log(`      ⚠️ Vector missing for ${inv.Name}, regenerating...`);
           const text = inv.SummaryText || inv.summaryText || inv.Name || ""; 
           if (!text) {
               log(`      ❌ Skipping invention with no text: ${inv.Name}`);
               return;
           }
           invVector = getMistralEmbedding(text.substring(0, 15000)); // Clamp to 15k chars
       }
       
       if (!invVector) return;
       
       // 2. Find Top K Patents (Cosine Similarity)
       const candidates = patentsWithVectors
           .filter(p => p.vector && p.vector.length > 0)
           .map(p => {
             // Cosine Similarity
             let dot = 0;
             let normA = 0;
             let normB = 0;
             for(let i=0; i<invVector.length; i++) {
                 dot += invVector[i] * p.vector[i];
                 normA += invVector[i] * invVector[i];
                 normB += p.vector[i] * p.vector[i];
             }
             const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
             return { patent: p, score: sim };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5); // Top 5
          
      // 3. Return Top 5 Candidates (Lightweight)
      const matches = candidates.map(c => {
         return {
            patentTitle: c.patent.Title,
            num: c.patent.URL.match(/patent\/([A-Z0-9]+)/)?.[1] || "Unknown", // [FIX] Frontend expects 'num'
            patentNumber: c.patent.URL.match(/patent\/([A-Z0-9]+)/)?.[1] || "Unknown", // Keep for safety
            patentLink: c.patent.URL,
            patentDate: c.patent.AppDate,
            patentCompany: c.patent.Company,
            patentClaim: c.patent.CleanClaim, // Needed for frontend interaction
            similarity: (c.score * 100).toFixed(1) + "%"
         };
      });
      
      riskReport.push({
        inventionName: inv.Name,
         FolderName: inv.FolderName, // [FIX] Pass folder name to frontend
         inventionLink: inv.Link,
         summaryText: inv.SummaryText, // Needed for frontend interaction
         matches: matches
      });
   });
   
   return riskReport;
}

// 1. EXTRACT CLAIMS (Frontend calls this first to show progress)
function extractIndependentClaims(patentClaim) {
   if (!patentClaim) return [];
   
   log("🔍 Extracting Independent Claims using Mistral Small...");
   
   const prompt = `Identify all INDEPENDENT CLAIMS in the following patent text.
   Ignore dependent claims (e.g. "The method of claim 1...").
   Return a JSON object with a key "claims" containing a list of objects: { "num": "claim number", "text": "full text of claim" }.
   
   PATENT TEXT:
   """${patentClaim.substring(0, 30000)}"""`; // Truncate to safe limit

   try {
       // Use Mistral Small for speed/cost efficiently
       const response = getMistralChat(prompt, "mistral-small-latest");
       const json = JSON.parse(response);
       
       if (json.claims && Array.isArray(json.claims)) {
           log(`✅ Found ${json.claims.length} Independent Claims via AI.`);
           return json.claims.slice(0, 5);
       }
   } catch (e) {
       log("❌ AI Extraction Failed: " + e.message);
   }

   // Fallback to simple regex if AI fails
   log("⚠️ Falling back to Regex extraction.");
   const claimsToAnalyze = [];
   const regex = /(?:^|[\r\n]+)\s*(\d+)\.\s+/g;
   let matches = [];
   let match;
   while ((match = regex.exec(patentClaim)) !== null) {
       matches.push({ num: match[1], index: match.index, fullMatch: match[0] });
   }
   
   if (matches.length === 0) return [{ num: "1", text: patentClaim.substring(0, 2000) + "..." }];

   for (let i = 0; i < matches.length; i++) {
       const start = matches[i].index + matches[i].fullMatch.length; 
       const end = (i < matches.length - 1) ? matches[i+1].index : patentClaim.length;
       const claimText = patentClaim.substring(start, end).trim();
       if (claimText.length > 20) claimsToAnalyze.push({ num: matches[i].num, text: claimText });
   }
   
   return claimsToAnalyze.slice(0, 5); 
}

// 2. ANALYZE SINGLE CLAIM (Frontend calls this in loop)
function analyzeSingleClaim(inventionText, claimNum, claimText, forceUpdate = false) {
    if(!inventionText || !claimText) return { error: "Missing data" };
    if(inventionText.length > 50000) inventionText = inventionText.substring(0, 50000);
    
    // Header for result
    const headerRow = {
       feature: `<b>🏛️ Independent Claim ${claimNum}</b>`,
       verdict: "INFO",
       evidence: "", 
       explanation: "Analysis Complete."
    };
    
   const invObj = { Name: "Interactive Check", SummaryText: inventionText };
   const patObj = { Title: "Selected Patent", CleanClaim: claimText };
   
   try {
       const result = generateClaimChart(invObj, patObj, forceUpdate);
       if (result.error) {
           return [headerRow, { feature: "Error", verdict: "Error", explanation: result.error }];
       } else if (result.cached) {
            // [NEW] Return object handling for Cache
            return { cached: true, cachedAt: result.cachedAt, chart: [headerRow, ...result.chart] };
       } else if (Array.isArray(result.chart)) {
           // Fresh result (already wrapper in object by generateClaimChart if consistent)
           // utilize the chart property
           return { cached: false, cachedAt: new Date().toLocaleString(), chart: [headerRow, ...result.chart] };
       } else if (Array.isArray(result)) {
            // Fallback for old return style if generateClaimChart was not fully updated or acting weird
            return [headerRow, ...result];
       }
   } catch(e) {
       return [headerRow, { feature: "Error", verdict: "Error", explanation: e.message }];
   }
   return [headerRow];
}

function generateClaimChart(invention, patent, forceUpdate = false) {
    const cacheKey = (invention.Name + "_" + patent.Title).replace(/[^a-zA-Z0-9]/g, ""); // Simple Key
    log(`   ⚖️ Generatng Claim Chart: ${invention.Name} vs ${patent.Title.substring(0,20)}...`);

    // 1. Check Cache
    if (!forceUpdate) {
        const cache = loadFTOCache();
        if (cache[cacheKey]) {
            log("   ✅ Cache Hit for Claim Chart");
            // Return cached object (which is the array of feature rows)
            // Add metadata to first row if possible, or wrap it?
            // The frontend expects an array. Let's wrap it in an object if we want to send date.
            // But existing frontend expects array. 
            // We can append a special property to the array? Or just return the array.
            // Requirement says: "display date if exists".
            // So we need to return { chart: [...], cachedAt: date }.
            // This requires Frontend update.
            return { cached: true, cachedAt: cache[cacheKey].date, chart: cache[cacheKey].data };
        }
    }
    
    // We need the Independent Claim.
    if (!patent.CleanClaim) return { error: "No Independent Claim found." };
    
    const fullPrompt = `You are a Patent Attorney. Conduct a strict element-by-element CLAIM ANALYSIS.
    
    INVENTION SUMMARY:
    """${invention.SummaryText}"""
    
    INDEPENDENT CLAIM:
    """${patent.CleanClaim}"""
    
    TASK:
    Break down the claim into individual features (verbatim). For EACH feature, determine if it is present in the Invention Summary.
    
    OUTPUT JSON ARRAY ONLY:
    [{
      "feature": "verbatim text of claim element",
      "verdict": "Yes" | "No" | "Maybe",
      "evidence": "direct quote from invention summary",
      "explanation": "brief reasoning"
    }]`;
    
    try {
        const resp = getMistralChat(fullPrompt); // This now THROWS on error
        
        if (!resp) return { error: "Empty response from AI" };
        
        // Strip Markdown
        const jsonStr = resp.replace(/```json/g, "").replace(/```/g, "").trim();
        const chartData = JSON.parse(jsonStr);

        // 2. Save to Cache
        const cache = loadFTOCache();
        cache[cacheKey] = {
            date: new Date().toLocaleString(),
            data: chartData
        };
        saveFTOCache(cache);
        
        return { cached: false, cachedAt: new Date().toLocaleString(), chart: chartData };
        
    } catch(e) {
        log(`   ❌ Claim Chart Generation Failed: ${e.message}`);
        return { error: e.message, raw_response: "Check logs for details" };
    }
}

// ----------------------------------------------------
// 7. 🧠 STRATEGIC ANALYSIS (SWOT)
// ----------------------------------------------------
// ----------------------------------------------------
// 7. 🧠 STRATEGIC ANALYSIS (SWOT)
// ----------------------------------------------------
function generateSWOT(companyName, limit = 100, providedInventions = [], forceUpdate = false) { // [UPD] Increased limit to 100
    log(`🧠 Generating SWOT for ${companyName}...`);

    const CACHE_FILENAME = "SWOT_ANALYSIS_CONSOLIDATED.json";
    const folder = DriveApp.getFolderById(FOLDER_ID_DASHBOARD_EXPORT);
    
    // Determine Cache Key
    let key = "SWOT_" + companyName.replace(/[^a-zA-Z0-9]/g, "");
    if (companyName.includes("Mistral")) key = "SWOT_Mistral";
    if (companyName.includes("OpenAI")) key = "SWOT_OpenAI";
    if (companyName.includes("Anthropic")) key = "SWOT_Anthropic";

    // 1. Load Existing Cache (with Deduplication)
    let fullCache = {};
    let cacheFile = getUniqueFile(folder, CACHE_FILENAME);
    
    if (cacheFile) {
        try {
            fullCache = JSON.parse(cacheFile.getBlob().getDataAsString());
        } catch(e) {
            log(`   ⚠️ Corrupt cache file, starting fresh.`);
        }
    }

    // 2. Check for Valid Entry
    if (!forceUpdate && fullCache[key]) {
        log(`   ✅ Cache Hit for ${key}`);
        return { cached: true, cachedAt: fullCache[key].date, content: fullCache[key].content };
    }
    
    // 3. Gather Data
    let companyPatents = [];

    if (companyName === 'Mistral (Internal)' || companyName === 'Mistral') {
        // Use provided data from Frontend if available
        if (providedInventions && providedInventions.length > 0) {
            log(`   Using ${providedInventions.length} inventions provided by frontend.`);
            companyPatents = providedInventions.map(i => ({ 
                Title: i.inventionName || i.Name || "Untitled", // Handle both formats
                Abstract: i.summaryText || i.SummaryText || "",
                Claim: "" 
            }));
        } else {
            // Fallback to loading from Drive
            log("   ⚠️ No frontend data, loading from Drive...");
            const invs = loadInventions();
            companyPatents = invs.map(i => ({ Title: i.Name, Abstract: i.SummaryText, Claim: "" }));
        }
    } else {
        const dashboardData = loadDashboardData();
        const allPatents = Array.isArray(dashboardData) ? dashboardData : (dashboardData.items || []);
        
        companyPatents = allPatents.filter(p => p.Company === companyName)
            .map(p => ({
                Title: p.Title,
                Abstract: p.Abstract,
                Claim: p.CleanClaim || "" // [FIX] Correct Key (was p.Claims)
            }));
    }

    if (companyPatents.length === 0) return { error: `No patents found for ${companyName}` };

    // 4. Prepare Prompt
    const context = companyPatents.slice(0, limit).map(p => {
        const text = p.Claim && p.Claim.length > 50 ? `CLAIM: ${p.Claim}` : `ABSTRACT: ${p.Abstract}`;
        return `- ${p.Title}: ${text.substring(0, 800)}...`;
    }).join("\n");

    const prompt = `Perform a STRATEGIC SWOT ANALYSIS of ${companyName}'s patent portfolio.
    
    PATENTS/INVENTIONS:
    ${context}
    
    TASK:
    Identify internal Strengths and Weaknesses based on their technology focus.
    Identify external Opportunities and Threats based on the implied market landscape.
    
    RETURN JSON ONLY:
    {
        "strengths": ["point 1", ...],
        "weaknesses": ["point 1", ...],
        "opportunities": ["point 1", ...],
        "threats": ["point 1", ...]
    }`;

    try {
        const response = getMistralChat(prompt, "mistral-large-latest"); 
        if (!response) throw new Error("Empty response from AI");

        const clean = response.replace(/```json/g, "").replace(/```/g, "").trim();
        const swotData = JSON.parse(clean);
        
        // Ensure Metadata
        swotData.company = companyName; 
        swotData.generationDate = new Date().toLocaleString();

        // 5. Update Unified Cache (Reload file to minimize race conditions, though rare here)
        // In this simple context, we re-use fullCache object but ideally we should re-fetch if highly concurrent.
        // Assuming single user:
        fullCache[key] = {
            date: new Date().toLocaleString(),
            content: swotData
        };

        if (cacheFile) {
            cacheFile.setContent(JSON.stringify(fullCache, null, 2));
            log(`   ✅ Updated Unified Cache File with ${key}`);
        } else {
            folder.createFile(CACHE_FILENAME, JSON.stringify(fullCache, null, 2));
            log(`   ✅ Created Unified Cache File with ${key}`);
        }

        return { cached: false, cachedAt: fullCache[key].date, content: swotData };
    } catch (e) {
        log(`❌ SWOT Failed: ${e.message}`);
        return { error: e.message };
    }
}

// ----------------------------------------------------
// 📂 SWOT FILE CACHE LOADER (Unified)
// ----------------------------------------------------
function loadAllSWOTs() {
    const CACHE_FILENAME = "SWOT_ANALYSIS_CONSOLIDATED.json";
    const folder = DriveApp.getFolderById(FOLDER_ID_DASHBOARD_EXPORT);
    
    try {
        const file = getUniqueFile(folder, CACHE_FILENAME);
        if (file) {
            const content = file.getBlob().getDataAsString();
            const cache = JSON.parse(content);
            log(`📦 Loaded Unified SWOT Cache: ${Object.keys(cache).join(', ')}`);
            return cache;
        }
    } catch(e) {
        log(`⚠️ Failed to load unified SWOT cache: ${e.message}`);
    }
    
    log(`ℹ️ No Unified SWOT Cache found.`);
    return {};
}

function loadInventions() {
  const AGGREGATED_FILENAME = "AGGREGATED_SUMMARIES.json";
  // Use the Dashboard Export folder where fetchsummary.gs saves the file
  const folder = DriveApp.getFolderById(FOLDER_ID_DASHBOARD_EXPORT);
  const files = folder.getFilesByName(AGGREGATED_FILENAME);
  
  const inventions = [];
  log("📂 Loading Inventions from Aggregated JSON: " + AGGREGATED_FILENAME);

  if (files.hasNext()) {
      try {
          const file = files.next();
          const content = file.getBlob().getDataAsString();
          const allData = JSON.parse(content);
          
          if (Array.isArray(allData)) {
              // Filter and Map
              allData.forEach(item => {
                  // User requested ONLY "invention" category for now
                  if (item.category === "invention") {
                      inventions.push({
                          Name: item.title,
                          SummaryText: item.content,
                          Company: "Mistral",
                          Date: item.date,
                          Category: item.category
                      });
                  }
              });
              log(`✅ Successfully loaded ${inventions.length} inventions from filtered JSON.`);
          } else {
              log("⚠️ Aggregated JSON is not an array.");
          }
      } catch (e) {
          log(`❌ Error parsing ${AGGREGATED_FILENAME}: ${e.message}`);
      }
  } else {
      log(`⚠️ ${AGGREGATED_FILENAME} not found in Dashboard Folder.`);
  }
  
  log(`🛡️ Loaded ${inventions.length} Mistral inventions.`);
  return inventions;
}
// ----------------------------------------------------
// 8. 🧠 STRATEGIC REPORT (AI GENERATED)
// ----------------------------------------------------
function getStrategyReport(keywordStats, forceUpdate = false) {
    const CACHE_FILENAME = "STRATEGIC_ANALYSIS_CONSOLIDATED.json"; 
    const folder = DriveApp.getFolderById(FOLDER_ID_DASHBOARD_EXPORT);

    // 1. Check Cache (File) - BEFORE computing expensive stats
    let fullCache = {};
    let cacheFile = getUniqueFile(folder, CACHE_FILENAME); // Use helper

    if (cacheFile) {
        try {
            fullCache = JSON.parse(cacheFile.getBlob().getDataAsString());
        } catch(e) {
            log(`   ⚠️ Corrupt strategies cache, starting fresh.`);
        }
    }

    // Return cached if valid (and not forced)
    if (!forceUpdate && fullCache.latest) {
        log("   ✅ Cache Hit for Strategic Report");
        return fullCache.latest; // { content, date }
    }

    // 2. Prepare Data (If missing, calculate from Dashboard Data)
    let stats = keywordStats;

    // [FIX] GAS Parameter Handling: Parse JSON string if necessary
    let parseError = null;
    let rawInputType = typeof keywordStats;
    let rawInputLength = keywordStats ? String(keywordStats).length : 0;
    
    if (typeof stats === 'string') {
        try {
            stats = JSON.parse(stats);
            log("   ✅ Parsed 'keywordStats' from JSON string.");
        } catch(e) {
            parseError = e.message;
            log("   ⚠️ Failed to parse 'keywordStats' string: " + e.message);
        }
    }

    // [FIX] Handle Array-like Objects (GAS weirdness)
    if (stats && typeof stats === 'object' && !Array.isArray(stats)) {
         try { stats = Object.values(stats); } catch(e) {}
    }

    log(`   🔍 Debug Input Stats: Length=${stats ? stats.length : 'N/A'}, FirstTerm=${stats && stats[0] ? stats[0].term : 'N/A'}`);

    if (!stats || !Array.isArray(stats) || stats.length === 0) {
        log("   ❌ input stats are invalid. Returning error instead of fallback (User wants specific topics).");
        return { 
            content: "Error: No valid topic data received from dashboard.", 
            debug: `Input stats were empty/invalid:\nType: ${rawInputType}\nLength: ${rawInputLength}\nIsArray: ${Array.isArray(stats)}\nParseError: ${parseError}\nFirstChars: ${String(keywordStats).substring(0, 200)}`
        };
    }

    if (stats.length === 0) return { content: "Insufficient data to generate analysis.", date: null };

    log(`🧠 Generating Strategic Report using Mistral Large... (ForceUpdate: ${forceUpdate})`);
    log(`   📊 Stats received: ${stats.length} items.`);

    // Format stats for the prompt
    const dataStr = stats.map(k => {
        return `- **${k.term}**: Mistral(${Math.round(k.mistral)}), OpenAI(${Math.round(k.openai)}), Anthropic(${Math.round(k.anthropic)})`;
    }).join("\n");
    
    log("   📝 Prompt Data Sample:\n" + dataStr.substring(0, 500)); // [DEBUG] Log the prompt data

    const prompt = `You are a Chief Strategy Officer analyzing the AI Patent Landscape.
    
    Here is the "Strategic Topic Landscape" (based on K-Means Clustering of Patent Embeddings):
    
    ${dataStr}
    
    TASK:
    Write a high-level STRATEGIC ANALYSIS.
    
    RETURN STRICTLY A JSON OBJECT with the following structure:
    {
      "strategic_analysis": {
        "key_strengths_mistral_dominance": {
          "title": "🛡️ Key Strengths (Mistral Dominance)",
          "content": "Analysis of where Mistral leads..."
        },
        "market_positioning": {
          "title": "⚖️ Market Positioning",
          "content": "Comparison with OpenAI and Anthropic..."
        },
        "critical_gaps": {
          "title": "⚔️ Critical Gaps & Risks",
          "content": "Where competitors are dominating..."
        },
        "strategic_recommendation": {
          "title": "🚀 Strategic Recommendations",
          "content": "1-2 key actions..."
        }
      }
    }

    TONE: Professional, Executive, Insightful.
    FORMAT: Use Markdown within the "content" strings for bolding or lists.`;

    try {
        const response = getMistralChat(prompt, "mistral-large-latest");
        if (!response) return { content: "Error: No response from AI.", date: null };
        
        // Clean up JSON
        const clean = response.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
        let parsed = null;
        try {
            parsed = JSON.parse(clean);
        } catch(e) {
            log("   ⚠️ AI failed to return pure JSON. Returning as string.");
            parsed = { strategic_analysis: clean };
        }

        const result = {
            content: parsed,
            date: new Date().toLocaleString(),
            stats: stats,
            debug: dataStr.substring(0, 1000)
        };
        
        // Save to File Cache
        fullCache.latest = result;
        
        if (cacheFile) {
            cacheFile.setContent(JSON.stringify(fullCache, null, 2));
             log("   ✅ Updated Strategic Analysis Cache File");
        } else {
            folder.createFile(CACHE_FILENAME, JSON.stringify(fullCache, null, 2));
             log("   ✅ Created Strategic Analysis Cache File");
        }

        return result;

    } catch (e) {
        log(`❌ Strategy Generation Failed: ${e.message}`);
        return { content: `Error generating strategy: ${e.message}`, date: null };
    }
}

/**
 * Helper to get a file by name in a specific folder.
 */
function getFileInFolder(folderId, fileName) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName(fileName);
    if (files.hasNext()) return files.next();
  } catch (e) {
    log(`⚠️ getFileInFolder failed for ${fileName}: ${e.message}`);
  }
  return null;
}

/**
 * Helper to ensure a single JSON file exists for a given name.
 * Merges content if duplicates are found.
 */
/**
 * Helper to ensure a single JSON file exists for a given name.
 * Merges content if duplicates are found (Deep Merge for nested FTO objects).
 */
function getUniqueFile(folder, filename) {
    const files = folder.getFilesByName(filename);
    const found = [];
    while (files.hasNext()) {
        const f = files.next();
        if (!f.isTrashed()) found.push(f);
    }

    if (found.length === 0) return null;
    if (found.length === 1) return found[0];

    // Handle Duplicates: Merge & Clean
    log(`⚠️ Found ${found.length} duplicate files for ${filename}. Merging...`);
    
    // Sort by Last Updated (Newest First)
    found.sort((a, b) => b.getLastUpdated().getTime() - a.getLastUpdated().getTime());
    
    const masterFile = found[0];
    let mergedContent = {};

    // Merge from oldest to newest to preserve latest updates
    for (let i = found.length - 1; i >= 0; i--) {
        try {
            const data = JSON.parse(found[i].getBlob().getDataAsString());
            
            // Deep merge logic for FTO/SWOT structures (Nested Key-Value maps)
            for (let k1 in data) {
                if (!mergedContent[k1]) {
                    mergedContent[k1] = data[k1];
                } else if (typeof data[k1] === 'object' && !Array.isArray(data[k1])) {
                    // Dive one level deeper for Invention->Patent maps
                    for (let k2 in data[k1]) {
                        mergedContent[k1][k2] = data[k1][k2];
                    }
                } else {
                    mergedContent[k1] = data[k1];
                }
            }
        } catch(e) {
            log(`   ⚠️ Failed to parse duplicate file: ${found[i].getName()}`);
        }
        
        // Trash if not master
        if (i !== 0) {
            found[i].setTrashed(true);
        }
    }

    // Save Merged Content to Master
    masterFile.setContent(JSON.stringify(mergedContent, null, 2));
    log(`   ✅ Merged content into master file: ${masterFile.getId()}`);
    
    return masterFile;
}

// ----------------------------------------------------
// 🧠 ADAPTIVE TAXONOMY LOGIC (HYBRID)
// ----------------------------------------------------

function classifyByContent(items, taxonomy) {
    const BATCH_SIZE = 10;
    const assignments = {}; 
    
    // Prepare simplified items for prompt
    const docs = items.map(item => {
        // Handle both Market Patents and Mistral Inventions
        let content = "";
        let id = "";
        
        if (item.SummaryText) { // Mistral Invention
             content = item.SummaryText;
             id = item.Name;
        } else { // Market Patent
             // Prefer CLAIM > ABSTRACT > TITLE
             content = item.CleanClaim || item.Abstract || item.Title;
             id = item.PatentNumber || item.Title; // Fallback to Title if no number
        }
        
        // Truncate
        if (content.length > 500) content = content.substring(0, 500);
        
        return { id: id, content: content };
    });

    log(`🚀 Classifying ${docs.length} documents in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = docs.slice(i, i + BATCH_SIZE);
        
        const prompt = `Classify these technical texts into ONE of the following topics:
${JSON.stringify(taxonomy)}

Return ONLY a valid JSON object mapping exact ID to exact Topic Name.
Example: {"Doc1": "Topic A", "Doc2": "Topic B"}
If no topic fits well, use "Other".

Documents:
${batch.map(d => `ID: "${d.id}"\nText: ${d.content.replace(/\n/g, ' ')}`).join('\n---\n')}`;

        try {
            const resp = getMistralChat(prompt, "mistral-small-latest");
            if (resp) {
                let jsonStr = resp.trim().replace(/```json/g, '').replace(/```/g, '');
                const results = JSON.parse(jsonStr);
                
                // Merge results
                Object.keys(results).forEach(k => {
                    let topic = results[k];
                    // Normalize
                    const match = taxonomy.find(t => t.toLowerCase() === topic.toLowerCase());
                    assignments[k] = match || "Other";
                });
            }
        } catch(e) {
            log(`❌ Classification Batch Error: ${e.message}`);
        }
        
        // Rate Limit Handling (Simple)
        Utilities.sleep(1000);
    }
    
    return assignments;
}

// ----------------------------------------------------
// 🧠 ANCHORED CLUSTERING HELPERS
// ----------------------------------------------------

const TAXONOMY_FILENAME = "_COMPETITOR_TAXONOMY_CACHE.json";

function loadTaxonomy() {
    const file = getFileInFolder(FOLDER_ID_EMBEDDINGS, TAXONOMY_FILENAME);
    if (!file) return [];
    try {
        return JSON.parse(file.getBlob().getDataAsString());
    } catch (e) {
        log("⚠️ Taxonomy Cache corrupt.");
        return [];
    }
}

function saveTaxonomy(taxonomy) {
    let file = getFileInFolder(FOLDER_ID_EMBEDDINGS, TAXONOMY_FILENAME);
    if (file) {
        file.setContent(JSON.stringify(taxonomy, null, 2));
    } else {
        DriveApp.getFolderById(FOLDER_ID_EMBEDDINGS).createFile(TAXONOMY_FILENAME, JSON.stringify(taxonomy, null, 2));
    }
    log(`💾 Taxonomy Anchors saved (${taxonomy.length} clusters).`);
}

function calculateCentroid(vectors) {
    if (vectors.length === 0) return [];
    const dim = vectors[0].length;
    const centroid = new Array(dim).fill(0);
    
    vectors.forEach(v => {
        for (let i = 0; i < dim; i++) centroid[i] += v[i];
    });
    
    for (let i = 0; i < dim; i++) centroid[i] /= vectors.length;
    return centroid;
}

function euclideanDistance(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
}

function generateClusterName(items) {
    // Generate AI Name based on ALL items (Summary/Title/Claim)
    // [USER REQUEST] Use Full Content (Claims + Summaries)
    
    // Safety: Limit total chars to avoid 128k context overflow (approx 50k chars is safe for large)
    const MAX_CHARS = 50000;
    let currentChars = 0;
    
    const samples = items.map(i => {
        if (currentChars > MAX_CHARS) return "";
        
        let txt = "";
        if (i.Company === "Mistral") {
             txt = i.SummaryText || i.Name;
        } else {
             // For Market: Use Independent Claim > Abstract
             txt = i.CleanClaim || i.Abstract || i.Title;
        }
        
        // Truncate individual item to 2000 chars to allow variety
        if (txt.length > 2000) txt = txt.substring(0, 2000);
        
        currentChars += txt.length;
        return `- [${i.Company || "Market"}] ${txt.replace(/\n/g, ' ')}`;
    }).filter(s => s !== "").join('\n\n');
    
    // [USER REQUEST] Detailed Logging
    log(`   🤖 Generating Name for Cluster based on ${items.length} items (${currentChars} chars)...`);

    const prompt = `You are a Patent Strategist. Analyze these patent documents (Claims & Summaries) which form a specific technology cluster.
    Generate a precise, technical, distinct Name for this technology area (3-6 words).
    Avoid generic terms like "System" or "Method". Be specific (e.g. "Reinforcement Learning from Human Feedback").
    
    Return ONLY a valid JSON object with the key "topic".
    Example: {"topic": "Your Topic Name Here"}
    Do not add any other text.
    
    Documents:
    ${samples}`;
    
    try {
        const resp = getMistralChat(prompt, "mistral-large-latest"); // Force Large model for deep understanding
        if (resp) {
            let name = resp.trim();
            // [FIX] Robust JSON Parsing
            if (name.includes("{")) {
                try {
                    // Extract JSON if embedded in text
                    const jsonMatch = name.match(/\{[\s\S]*?\}/);
                    if (jsonMatch) {
                        const jsonStr = jsonMatch[0];
                        const json = JSON.parse(jsonStr);
                        // Try common keys
                        name = json.name || json.topic || json.technology_name || json.title || json.cluster_name || Object.values(json)[0] || name;
                    }
                } catch(e) {
                    // Fallback: Regex Cleanup
                    name = name.replace(/\{.*?:\s*"/, '').replace(/"\s*\}/, '').replace(/\{/, '').replace(/\}/, '');
                }
            }
            
            // Clean up quotes and trailing chars
            name = name.replace(/^["']|["']$/g, '').replace(/\.$/, '').trim(); 
            
            // Simple validation
            if (name.length > 60) name = name.substring(0, 60);
            return name;
        }
    } catch(e) {
        log(`   ❌ Naming Failed: ${e.message}`);
    }
    return "Uncategorized Cluster";
}

// [USER REQUEST] Detailed Report Logic
function logTaxonomyReport(taxonomy, allItems) {
    log("\n📊 ANCHORED ZONING REPORT:");
    log("-------------------------");
    
    taxonomy.forEach(anchor => {
        const items = allItems.filter(i => i.Topic === anchor.name);
        const companies = {};
        items.forEach(i => {
             const c = i.Company || (i.SummaryText ? "Mistral" : "Unknown"); 
             companies[c] = (companies[c] || 0) + 1;
        });
        
        log(`📍 [${anchor.name}] (Total: ${items.length})`);
        Object.keys(companies).forEach(c => log(`   - ${c}: ${companies[c] || 0}`));
        
        // Show sample titles
        if(items.length > 0) {
             log(`   examples: ${items.slice(0, 2).map(i => i.Title || i.Name).join(", ")}`);
        }
        log("-------------------------");
    });
}

