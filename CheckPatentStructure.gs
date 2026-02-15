function checkPatentLogic() {
  const PATENT_FOLDER_ID = "1MOu4DThxvy9MSF5Rs2qHBuGj51lumVa5"; 
  const root = DriveApp.getFolderById(PATENT_FOLDER_ID);
  const subfolders = root.getFolders();
  
  Logger.log("📂 Root: " + root.getName());
  
  let i = 0;
  while (subfolders.hasNext()) {
     const sub = subfolders.next();
     Logger.log("   dw📂 Subfolder (Category?): " + sub.getName());
     
     const subSubs = sub.getFolders();
     let j = 0;
     while (subSubs.hasNext()) {
         const subSub = subSubs.next();
         Logger.log("      dw📂 SubSubfolder (Patent?): " + subSub.getName());
         
         const files = subSub.getFiles();
         while (files.hasNext()) {
             const f = files.next();
             if (f.getName().toUpperCase().includes("INVENTION SUMMARY")) {
                 Logger.log("         ✅ Found File: " + f.getName());
                 Logger.log("         - Category (Subfolder): " + sub.getName());
                 Logger.log("         - Title (SubSubFolder?): " + subSub.getName()); // Which one does the user consider title?
                 break;
             }
         }
         j++;
         if (j >= 2) break;
     }
     
     i++;
     if (i >= 2) break; // Limit
  }
}
