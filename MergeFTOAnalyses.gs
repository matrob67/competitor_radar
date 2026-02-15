/**
 * 🛠️ EMERGENCY CACHE MERGE UTILITY
 * Run this function ONCE if you have duplicate "DETAILED_FTO_ANALYSIS_CONSOLIDATED.json" files.
 * It will merge all data across duplicates and trash the redundant files.
 */
function manuallyMergeFTOFiles() {
  const FOLDER_ID_DASHBOARD_EXPORT = "1ZHUjA42XKA20_bHj8Bs3pD05RTb_-Qkn";
  const FILENAME = "DETAILED_FTO_ANALYSIS_CONSOLIDATED.json";
  
  console.log("🚀 Starting Manual FTO Analysis Merge...");
  
  const folder = DriveApp.getFolderById(FOLDER_ID_DASHBOARD_EXPORT);
  const files = folder.getFilesByName(FILENAME);
  const found = [];
  
  while (files.hasNext()) {
    const f = files.next();
    if (!f.isTrashed()) found.push(f);
  }
  
  if (found.length <= 1) {
    console.log("✅ No duplicates found or only one file exists. Nothing to merge.");
    return;
  }
  
  console.log(`⚠️ Found ${found.length} files. Starting deep merge...`);
  
  // Sort by date (Oldest first so newest overwrites during merge)
  found.sort((a, b) => a.getLastUpdated().getTime() - b.getLastUpdated().getTime());
  
  const masterFile = found[found.length - 1]; // Newest will be the master
  let mergedData = {};
  
  found.forEach((file, idx) => {
    try {
      const content = JSON.parse(file.getBlob().getDataAsString());
      console.log(`   📄 Processing file ${idx + 1}: ${file.getName()} (${Math.round(file.getSize()/1024)} KB)`);
      
      // VALIDATE FORMAT: Must be Object -> InventionKey -> PatentKey -> {score, claims...}
      for (const invId in content) {
        const invData = content[invId];
        
        // Skip if not an object (Invention level)
        if (typeof invData !== 'object' || Array.isArray(invData)) continue;
        
        if (!mergedData[invId]) mergedData[invId] = {};
        
        for (const patId in invData) {
          const patAnalysis = invData[patId];
          
          // Basic validation for deep analysis format
          if (patAnalysis && patAnalysis.claims && Array.isArray(patAnalysis.claims)) {
            // Overwrite with newer or add new
            mergedData[invId][patId] = patAnalysis;
          }
        }
      }
    } catch (e) {
      console.error(`   ❌ Failed to parse file ${file.getId()}: ${e.message}`);
    }
  });

  // Calculate final count
  let invCount = Object.keys(mergedData).length;
  let analysisCount = 0;
  for (let k in mergedData) analysisCount += Object.keys(mergedData[k]).length;

  console.log(`\n✅ Merge Complete!`);
  console.log(`   - Total Inventions: ${invCount}`);
  console.log(`   - Total Detailed Analyses: ${analysisCount}`);
  
  // Save to master
  masterFile.setContent(JSON.stringify(mergedData, null, 2));
  console.log(`💾 Master file updated: ${masterFile.getId()}`);
  
  // Trash others
  found.forEach(file => {
    if (file.getId() !== masterFile.getId()) {
      file.setTrashed(true);
      console.log(`🗑️ Trashed duplicate: ${file.getId()}`);
    }
  });
  
  console.log("\n✨ All set! You can now refresh the dashboard.");
}
