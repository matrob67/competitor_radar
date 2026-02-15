function debugVerifyFolderStructure() {
  const FOLDER_ID = "1g--GJf6ob3TlGRnaZlaFVXZpIdz-_3cx"; // FOLDER_ID_INVENTIONS
  const root = DriveApp.getFolderById(FOLDER_ID);
  const subfolders = root.getFolders();
  
  Logger.log("📂 Root Folder: " + root.getName());
  
  let count = 0;
  while (subfolders.hasNext()) {
      const sub = subfolders.next();
      Logger.log("   dw📂 Subfolder: " + sub.getName());
      
      const files = sub.getFilesByName("_SUMMARY_CACHE_GLOBAL.json");
      if (files.hasNext()) {
          const f = files.next();
          Logger.log("      ✅ Found '_SUMMARY_CACHE_GLOBAL.json'");
          try {
             const text = f.getBlob().getDataAsString();
             Logger.log("      📝 Content Preview: " + text.substring(0, 200));
          } catch(e) {
             Logger.log("      ❌ Could not read text: " + e.message);
          }
      } else {
          Logger.log("      ⚠️ 'INVENTION SUMMARY' not found here.");
          // List what IS there
          const allFiles = sub.getFiles();
          let fileNames = [];
          while(allFiles.hasNext()) fileNames.push(allFiles.next().getName());
          Logger.log("      📄 Files found: " + fileNames.join(", "));
      }
      
      count++;
      if (count >= 5) break; // Limit to 5 for test
  }
}
