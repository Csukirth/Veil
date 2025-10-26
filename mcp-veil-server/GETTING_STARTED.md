# Getting Started with Veil MCP Server

## ⚡ 5-Minute Setup

### Step 1: Build the Server (Already Done! ✅)

The server is already built and ready to use:
```bash
✅ Dependencies installed (122 packages)
✅ TypeScript compiled
✅ Executable created at: build/index.js
```

### Step 2: Get Your SIM API Key

1. Go to **https://www.sim.ai**
2. Sign up or log in
3. Navigate to API settings
4. Copy your API key

### Step 3: Configure Claude Desktop

**Mac:**
```bash
# Open the config file
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**If the file doesn't exist:**
```bash
mkdir -p ~/Library/Application\ Support/Claude/
touch ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Add this configuration:**
```json
{
  "mcpServers": {
    "veil-search": {
      "command": "node",
      "args": [
        "/Users/spartan/calhacks/veil/mcp-veil-server/build/index.js"
      ],
      "env": {
        "SIM_API_KEY": "paste_your_api_key_here"
      }
    }
  }
}
```

**Important:** Replace `paste_your_api_key_here` with your actual SIM API key!

### Step 4: Restart Claude Desktop

1. **Fully quit Claude Desktop**
   - Mac: Press `Cmd + Q` or right-click dock icon → Quit
   - Don't just close the window!

2. **Relaunch Claude Desktop**

3. **Look for the 🔨 hammer icon**
   - Should appear in the Claude interface
   - Indicates MCP tools are loaded

### Step 5: Test It!

Try this in Claude:

```
Search for "artificial intelligence breakthroughs 2024"
```

**Expected result:**
- Claude uses the `web-search` tool
- Returns 5 search results
- All PII is automatically deidentified
- Results shown with titles, URLs, and summaries

## 🎯 Quick Test Commands

### Test 1: Web Search
```
Search for "quantum computing" and show me the results
```

### Test 2: Scrape a URL
```
Scrape https://en.wikipedia.org/wiki/Machine_learning and summarize it
```

### Test 3: Search and Scrape
```
Find and read the latest article about climate change
```

## 🔍 What You Should See

### Success Indicators
✅ 🔨 Hammer icon visible in Claude  
✅ Claude says "I'll use the web-search tool"  
✅ Results appear with masked PII (if any)  
✅ Content is returned within 5-10 seconds  

### Example Output
```
I've searched for "quantum computing" and found these results:

1. Quantum Computing - Wikipedia
   URL: https://en.wikipedia.org/wiki/Quantum_computing
   Summary: Quantum computing harnesses quantum mechanics to process information...

2. What is Quantum Computing? | IBM
   URL: https://www.ibm.com/quantum-computing
   Summary: Learn about quantum computers and their applications...
```

## ❌ Troubleshooting

### Problem: No 🔨 hammer icon

**Solution:**
1. Check the config file path is correct
2. Verify `build/index.js` exists:
   ```bash
   ls -la /Users/spartan/calhacks/veil/mcp-veil-server/build/index.js
   ```
3. Make sure Claude is **fully quit** then relaunched
4. Check logs:
   ```bash
   tail -f ~/Library/Logs/Claude/mcp*.log
   ```

### Problem: "SIM_API_KEY not set" warning

**Solution:**
1. Open config file again
2. Make sure your API key is in the `env` section
3. Check for typos: `SIM_API_KEY` (exact spelling)
4. Restart Claude Desktop

### Problem: Search returns no results

**Solution:**
1. Try a more specific query
2. Wait 1-2 minutes (rate limiting)
3. Check internet connection

## 📚 What's Next?

### Learn More
- **README.md** - Complete feature overview
- **USAGE_EXAMPLES.md** - 10+ real-world examples
- **SETUP_GUIDE.md** - Detailed troubleshooting
- **QUICK_REFERENCE.md** - Command reference

### Try These Use Cases

**Research:**
```
Search for "latest AI research papers" and summarize the top findings
```

**Learning:**
```
Find a tutorial on React hooks and explain the key concepts
```

**News:**
```
Search for today's tech news and give me the highlights
```

**Analysis:**
```
Scrape this article [URL] and identify the main arguments
```

## 🔒 Privacy Features

Every search and scrape automatically:
- ✅ Detects PII (names, emails, phone numbers, addresses)
- ✅ Masks sensitive data (SSN, credit cards, financial info)
- ✅ Tags with XML markers (e.g., `<EMAIL>user@example.com</EMAIL>`)
- ✅ Preserves context for Claude to understand

**Example:**
```
Before: Contact John Smith at john@example.com
After:  Contact <PERSON>John Smith</PERSON> at <EMAIL>john@example.com</EMAIL>
```

## 💡 Pro Tips

### Tip 1: Be Specific
```
Good: "Search for React Server Components tutorial 2024"
Bad:  "Search for programming"
```

### Tip 2: Use the Right Tool
- **Quick facts** → `web-search`
- **Deep reading** → `scrape-url`
- **Automated discovery** → `search-and-scrape`

### Tip 3: Iterate
```
You: "Search for X"
Claude: [returns results]
You: "Now scrape the first result and summarize"
```

## ✅ Success Checklist

- [ ] SIM API key obtained from sim.ai
- [ ] Claude config file updated with key
- [ ] Claude Desktop fully quit and relaunched
- [ ] 🔨 Hammer icon visible
- [ ] Test search completed successfully
- [ ] Results show deidentified content

## 🎉 You're All Set!

The Veil MCP Server is now protecting your privacy while Claude searches the web!

**Three powerful tools at your disposal:**
- 🔍 `web-search` - Find information safely
- 🌐 `scrape-url` - Extract content privately
- 🚀 `search-and-scrape` - Automate discovery securely

**Need Help?**
- Check the logs: `~/Library/Logs/Claude/mcp*.log`
- Read the docs: All markdown files in this folder
- SIM API support: https://www.sim.ai/support

---

**🔒 Search the web without compromising privacy! 🚀**

