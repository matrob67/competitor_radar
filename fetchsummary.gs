const FOLDER_ID_INVENTIONS_FETCH = "1g--GJf6ob3TlGRnaZlaFVXZpIdz-_3cx";
const FOLDER_ID_PATENTS_FETCH = "1MOu4DThxvy9MSF5Rs2qHBuGj51lumVa5";
const SUMMARY_EXPORT_FOLDER_ID = "1ZHUjA42XKA20_bHj8Bs3pD05RTb_-Qkn"; // Dashboard Folder
const OUTPUT_FILENAME = "AGGREGATED_SUMMARIES.json";

function fetchSummaries() {
  const allSummaries = [];
  
  Logger.log("🚀 Starting Summary Aggregation...");
  
  // 1. FETCH INVENTIONS
  Logger.log("📂 Processing INVENTIONS...");
  const invRoot = DriveApp.getFolderById(FOLDER_ID_INVENTIONS_FETCH);
  const invSubfolders = invRoot.getFolders();
  
  while (invSubfolders.hasNext()) {
    const sub = invSubfolders.next();
    const title = sub.getName();
    
    // Look for SUMMARY file
    const files = sub.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      // Strict Match for "INVENTION SUMMARY" (Google Doc or with extension)
      const name = f.getName().toUpperCase();
      const isTargetFile = name === "INVENTION SUMMARY" || name.startsWith("INVENTION SUMMARY.");
      
      if (isTargetFile) {
        try {
           const content = readFileContent(f);
           if (content) {
             const summaryObj = {
               category: "invention",
               title: title,
               date: f.getLastUpdated().toISOString(),
               content: content
             };
             allSummaries.push(summaryObj);
             logPreview(summaryObj);
             if (allSummaries.length % 20 === 0) saveSummaries(allSummaries);
           }
        } catch(e) {
           Logger.log(`❌ Error reading ${title}: ${e.message}`);
        }
        break; 
      }
    }
  }

  // 2. FETCH PATENTS
  Logger.log("📂 Processing PATENTS...");
  const patRoot = DriveApp.getFolderById(FOLDER_ID_PATENTS_FETCH);
  const patSubfolders = patRoot.getFolders();
  
  while (patSubfolders.hasNext()) {
     const sub = patSubfolders.next();
     const title = sub.getName(); // MIST-XXX Title
     
     // Go deeper: SubSubFolders
     const subSubs = sub.getFolders();
     while (subSubs.hasNext()) {
         const subSub = subSubs.next();
         // Look for SUMMARY file inside sub-sub
         const files = subSub.getFiles();
         let found = false;
         while (files.hasNext()) {
             const f = files.next();
          // Strict Match for "INVENTION SUMMARY" (Google Doc or with extension)
          const name = f.getName().toUpperCase();
          const isTargetFile = name === "INVENTION SUMMARY" || name.startsWith("INVENTION SUMMARY.");
          
          if (isTargetFile) {
                 try {
                     const content = readFileContent(f);
                     if (content) {
                         const summaryObj = {
                             category: "patent",
                             title: title, // Subfolder Name (e.g., MIST-037 Document AI Playground)
                             patent_ref: subSub.getName(), // SubSubfolder Name (e.g., US 63/941,635...)
                             date: f.getLastUpdated().toISOString(),
                             content: content
                         };
                         allSummaries.push(summaryObj);
                         logPreview(summaryObj);
                         if (allSummaries.length % 20 === 0) saveSummaries(allSummaries);
                         found = true;
                     }
                 } catch(e) {
                     Logger.log(`❌ Error reading patent ${title}: ${e.message}`);
                 }
                 break; 
             }
         }
         if (found) break; // If found in one sub-sub, assume it covers the "Title" (Patent Family)
     }
  }
  
  Logger.log(`✅ Completed! Found ${allSummaries.length} summaries.`);
  saveSummaries(allSummaries);
  
function saveSummaries(data) {
  const destFolder = DriveApp.getFolderById(SUMMARY_EXPORT_FOLDER_ID);
  
  // Trash old versions of this file if they exist
  const oldFiles = destFolder.getFilesByName(OUTPUT_FILENAME);
  while (oldFiles.hasNext()) oldFiles.next().setTrashed(true);
  
  destFolder.createFile(OUTPUT_FILENAME, JSON.stringify(data, null, 2));
  Logger.log(`💾 [SAVED] Progress Update: ${data.length} summaries saved to ${destFolder.getName()}`);
}
  
  return allSummaries;
}

// Helper to read content (Docs or Text)
function readFileContent(file) {
  if (file.getMimeType() === MimeType.GOOGLE_DOCS) {
      return DocumentApp.openById(file.getId()).getBody().getText();
  } else {
      return file.getBlob().getDataAsString();
  }
}

function logPreview(obj) {
  const preview = obj.content.replace(/\n/g, " ").substring(0, 50);
  Logger.log(`   📝 [${obj.category.toUpperCase()}] ${obj.title}`);
  Logger.log(`      📅 ${obj.date} | 📄 "${preview}..."`);
}
