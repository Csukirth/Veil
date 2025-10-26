# Veil MCP Server - Quick Reference

## Installation & Setup

```bash
# 1. Install dependencies
cd /Users/spartan/calhacks/veil/mcp-veil-server
npm install

# 2. Build
npm run build

# 3. Get SIM API key from https://www.sim.ai

# 4. Configure Claude Desktop
# Edit: ~/Library/Application Support/Claude/claude_desktop_config.json
```

## Claude Desktop Config

```json
{
  "mcpServers": {
    "veil-search": {
      "command": "node",
      "args": ["/Users/spartan/calhacks/veil/mcp-veil-server/build/index.js"],
      "env": {
        "SIM_API_KEY": "your_sim_api_key_here"
      }
    }
  }
}
```

## Available Tools

### 🔍 web-search
**Search the web with automatic deidentification**

```
Parameters:
- query: string (required) - Your search query
- maxResults: number (1-10, default 5) - Number of results

Example Claude prompts:
- "Search for 'AI developments 2024'"
- "Find information about quantum computing"
- "Search for React tutorials"
```

### 🌐 scrape-url
**Extract content from a URL with deidentification**

```
Parameters:
- url: string (required) - URL to scrape

Example Claude prompts:
- "Scrape https://example.com/article and summarize"
- "Read this page: [URL]"
- "Extract content from [URL]"
```

### 🚀 search-and-scrape
**Search and automatically scrape top result**

```
Parameters:
- query: string (required) - Your search query

Example Claude prompts:
- "Find and read the latest on [topic]"
- "Search for [topic] and give me a detailed summary"
- "Discover and analyze [subject]"
```

## What Gets Deidentified

✅ **Personal Information:**
- Names: `<PERSON>John Smith</PERSON>`
- Emails: `<EMAIL>user@example.com</EMAIL>`
- Phone numbers: `<PHONE>555-123-4567</PHONE>`
- Addresses: `<ADDRESS>123 Main St</ADDRESS>`

✅ **Sensitive Data:**
- SSN: `<SSN>123-45-6789</SSN>`
- Credit cards: `<CREDIT_CARD>****</CREDIT_CARD>`
- Bank accounts: `<ACCOUNT>****</ACCOUNT>`

✅ **Organization Info:**
- Company names (when sensitive)
- Organization-specific data
- Internal identifiers

## Common Commands

```bash
# Rebuild after changes
npm run build

# View logs (Mac)
tail -f ~/Library/Logs/Claude/mcp*.log

# Test build exists
ls -lh build/index.js

# Update dependencies
npm update && npm run build
```

## Troubleshooting

### Tools not showing?
1. Check path in config is correct
2. Verify build exists: `ls build/index.js`
3. Restart Claude Desktop completely (Cmd+Q)
4. Check logs: `~/Library/Logs/Claude/mcp*.log`

### "SIM_API_KEY not set"?
1. Add key to `env` section in Claude config
2. Verify no typos: `SIM_API_KEY` (exact spelling)
3. Restart Claude Desktop after changing config

### Search fails?
- Query too vague → be more specific
- Rate limited → wait 1-2 minutes
- Network issue → check connection

### Scraping fails?
- Site blocks scrapers → try different URL
- Requires JavaScript → use simpler sites
- Protected content → respect site's terms

## Performance Tips

- **Fast:** `web-search` for quick facts
- **Detailed:** `scrape-url` for specific pages  
- **Automated:** `search-and-scrape` for discovery

## Rate Limits

- **DuckDuckGo:** ~10-20 searches/min recommended
- **SIM API:** Check your plan at sim.ai
- **Scraping:** ~5-10 pages/min recommended

## File Structure

```
mcp-veil-server/
├── build/
│   └── index.js              # Built server (executable)
├── src/
│   └── index.ts              # Source code
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── README.md                 # Main documentation
├── SETUP_GUIDE.md           # Detailed setup
├── USAGE_EXAMPLES.md        # Real examples
└── QUICK_REFERENCE.md       # This file
```

## Example Workflow

```
You: "Search for latest React features"
    ↓
Claude uses: web-search tool
    ↓
Veil MCP: Searches DuckDuckGo → Deidentifies → Returns
    ↓
Claude: Shows you clean, safe results
```

## Privacy Features

| Feature | Status |
|---------|--------|
| PII Masking | ✅ Automatic |
| Sensitive Data Tagging | ✅ Automatic |
| Local Processing | ✅ No cloud storage |
| HTTPS Only | ✅ All requests |
| API Key Security | ✅ Environment vars |

## Support

- **Docs:** See README.md and SETUP_GUIDE.md
- **Examples:** See USAGE_EXAMPLES.md
- **SIM API:** https://www.sim.ai/support
- **Claude:** https://www.anthropic.com/claude

## Quick Test

After setup, try in Claude:

```
Search for "artificial intelligence" and show me the results
```

Expected: 
- 🔨 Tool usage indicator appears
- Search results shown
- Any PII in results is masked with XML tags

## Success Checklist

- [ ] npm install completed
- [ ] npm run build succeeded
- [ ] build/index.js exists
- [ ] SIM API key obtained
- [ ] Claude config updated
- [ ] Claude Desktop restarted
- [ ] 🔨 Hammer icon visible
- [ ] Test search works

## Version Info

- **Server Version:** 1.0.0
- **MCP SDK:** ^1.9.0
- **Node.js Required:** 16+
- **TypeScript:** ^5.8.3

---

**🔒 Safe Web Search for Claude Desktop**

Need more help? Check the full documentation:
- `README.md` - Overview and features
- `SETUP_GUIDE.md` - Step-by-step setup
- `USAGE_EXAMPLES.md` - Real-world examples

