function runTopicGenerationTest() {
  console.log("🚀 STARTING TOPIC GENERATION TEST (Summary + Claims Only)");

  // 1. DATA LOADING
  // Need to call loadDashboardData() but it's in another file. 
  // In GAS, all files are shared, so this works if run from Editor.
  var marketDataRaw = loadDashboardData(); 
  var marketData = [];
  if (Array.isArray(marketDataRaw)) {
      marketData = marketDataRaw;
  } else if (marketDataRaw && marketDataRaw.items) {
      marketData = marketDataRaw.items;
  }
  
  const mistralData = loadInventions(); 

  // console.log(`📦 Loaded: ${marketData.length} Market Patents + ${mistralData.length} Mistral Inventions`);

  // 2. PREPARE TEXT CONTENT
  // We want to force classification based on CONTENT, not metadata.
  
  const allDocs = [];

  // Market: Prioritize Claims > Abstract > Title
  if (marketData && marketData.length > 0) {
      marketData.forEach(d => {
          // [FIX] Ensure valid content
          let content = d.CleanClaim || d.Abstract || d.Title || "";
          if (content.length > 500) content = content.substring(0, 500); // Truncate for prompt efficiency
          
          allDocs.push({
              id: d.PatentNumber || d.Title,
              company: d.Company || "Market",
              content: content,
              originalTopic: d.Topic || "Uncategorized"
          });
      });
  }

  // Mistral: Prioritize SummaryText > Name
  if (mistralData && mistralData.length > 0) {
      mistralData.forEach(d => {
          let content = d.SummaryText || d.Name || "";
          if (content.length > 500) content = content.substring(0, 500);

          allDocs.push({
              id: d.Name,
              company: "Mistral",
              content: content,
              originalTopic: "Internal"
          });
      });
  }

  console.log(`📝 Total Documents to Analyze: ${allDocs.length}`);
  
  // 3. DEFINE TAXONOMY (Baseline Topics tailored to LLM/AI)
  // These represent the "Strategic Buckets" the user likely wants.
  const TAXONOMY = [
      "Large Language Model Architecture",
      "Reinforcement Learning (RLHF)",
      "Multimodal AI (Text/Image/Audio)",
      "Efficient Inference & Optimization",
      "Retrieval Augmented Generation (RAG)",
      "Code Generation & Reasoning",
      "AI Safety, Alignment & Content Moderation",
      "Hardware Acceleration (TPU/GPU)",
      "Data Processing & Training Infrastructure",
      "Speech & Audio Processing",
      "Automated Agents & Planning"
  ];
  
  console.log("ℹ️ Using Taxonomy:", TAXONOMY);

  // [USER REQUEST] Log Sample Contents for Verification
  console.log("\n🔍 DATA VERIFICATION (Sample of what is being analyzed):");
  console.log("-----------------------------------------");
  
  // Show 3 Mistral (Summaries)
  mistralData.slice(0, 3).forEach(d => {
      const txt = d.SummaryText || d.Name || "N/A";
      console.log(`[MISTRAL] ${d.Name.substring(0,30)}...`);
      console.log(`   📝 Summary Snippet: "${txt.substring(0, 150).replace(/\n/g, ' ')}..."\n`);
  });

  // Show 3 Market (Claims)
  marketData.slice(0, 3).forEach(d => {
      const txt = d.CleanClaim || d.Abstract || "N/A";
      console.log(`[MARKET] ${d.Title.substring(0,30)}... (${d.Company})`);
      console.log(`   ⚖️ Claim/Abstract Snippet: "${txt.substring(0, 150).replace(/\n/g, ' ')}..."\n`);
  });
  console.log("-----------------------------------------\n");


  // 4. BATCH CLASSIFICATION
  // We classify ALL docs against this taxonomy.
  
  const BATCH_SIZE = 15; // Increased batch size for speed
  const assignments = {}; 
  
  // Init counters
  TAXONOMY.forEach(t => {
      assignments[t] = { Mistral: 0, OpenAI: 0, Anthropic: 0, Total: 0 };
  });
  assignments["Uncategorized"] = { Mistral: 0, OpenAI: 0, Anthropic: 0, Total: 0 };
  assignments["Other"] = { Mistral: 0, OpenAI: 0, Anthropic: 0, Total: 0 };

  // PROCESS ALL DOCUMENTS
  const docsToProcess = allDocs; 

  console.log(`🚀 Starting Batch Classification for ALL ${docsToProcess.length} items...`);

  for (let i = 0; i < docsToProcess.length; i += BATCH_SIZE) {
      const batch = docsToProcess.slice(i, i + BATCH_SIZE);
      
      const prompt = `Classify these technologies into ONE of the following topics:
${JSON.stringify(TAXONOMY)}

Return ONLY a valid JSON object mapping exact ID to exact Topic Name.
Example: {"MyPatent1": "Multimodal AI (Text/Image/Audio)", "Patent2": "AI Safety..."}
If no topic fits, use "Other".

Documents:
${batch.map(d => `ID: "${d.id}"\nText: ${d.content}`).join('\n---\n')}`;

      try {
          // Use chat model
          const resp = getMistralChat(prompt, "mistral-small-latest"); 
          if (!resp) continue;

          // Clean JSON
          let jsonStr = resp.trim();
          if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
          
          let results = {};
          try {
              results = JSON.parse(jsonStr);
          } catch(e) {
              console.error("❌ JSON Parse Error:", e.message);
              continue;
          }
          
          console.log(`   ✅ Processed Batch ${Math.floor(i/BATCH_SIZE) + 1}`);

          // Tally Results
          batch.forEach(doc => {
              const assignedTopic = results[doc.id] || "Uncategorized";
              
              // Normalize topic string (handle trivial typos or exact match)
              let bestMatch = TAXONOMY.find(t => t.toLowerCase() === assignedTopic.toLowerCase()) || "Other";
              
              if (!assignments[bestMatch]) bestMatch = "Other";

              // Increment
              if (doc.company === 'Mistral') assignments[bestMatch].Mistral++;
              else if (doc.company === 'OpenAI') assignments[bestMatch].OpenAI++;
              else if (doc.company === 'Anthropic') assignments[bestMatch].Anthropic++;
              
              assignments[bestMatch].Total++;
          });

      } catch (e) {
          console.error(`   ❌ Batch Error: ${e.message}`);
      }
  }

  // 5. OUPUT REPORT
  console.log("\n📊 FINAL TOPIC DISTRIBUTION (Test Run - 40 items):");
  console.log("---------------------------------------------------");
  TAXONOMY.forEach(t => {
      const stats = assignments[t];
      // Only show if non-zero for clarity
      if (stats.Total > 0) {
          console.log(`Subject: ${t}`);
          console.log(`   Mistral:   ${stats.Mistral}`);
          console.log(`   OpenAI:    ${stats.OpenAI}`);
          console.log(`   Anthropic: ${stats.Anthropic}`);
          console.log("---------------------------------------------------");
      }
  });
}
