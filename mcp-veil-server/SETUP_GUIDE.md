# Veil MCP Server - Setup Guide

## Quick Setup (5 minutes)

Follow these steps to get the Veil MCP Server working with Claude Desktop:

### Step 1: Install Dependencies ✅ DONE

```bash
cd /Users/spartan/calhacks/veil/mcp-veil-server
npm install
npm run build
```

### Step 2: Get Your SIM API Key

1. Visit [https://www.sim.ai](https://www.sim.ai)
2. Create an account or log in
3. Navigate to your API settings
4. Copy your API key

### Step 3: Configure Claude Desktop

#### Mac Users:

1. **Open the Claude Desktop config file:**
   ```bash
   open ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. **If the file doesn't exist, create it:**
   ```bash
   mkdir -p ~/Library/Application\ Support/Claude/
   touch ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

3. **Add this configuration** (replace `your_sim_api_key_here` with your actual key):
   ```json
   {
     "mcpServers": {
       "veil-search": {
         "command": "node",
         "args": [
           "/Users/spartan/calhacks/veil/mcp-veil-server/build/index.js"
         ],
         "env": {
           "SIM_API_KEY": "your_sim_api_key_here"
         }
       }
     }
   }
   ```

#### Windows Users:

1. **Open the Claude Desktop config file:**
   ```
   %AppData%\Claude\claude_desktop_config.json
   ```

2. **Add this configuration** (update the path and API key):
   ```json
   {
     "mcpServers": {
       "veil-search": {
         "command": "node",
         "args": [
           "C:\\path\\to\\veil\\mcp-veil-server\\build\\index.js"
         ],
         "env": {
           "SIM_API_KEY": "your_sim_api_key_here"
         }
       }
     }
   }
   ```

### Step 4: Restart Claude Desktop

1. **Quit Claude Desktop completely** (not just close the window)
   - Mac: `Cmd + Q` or Right-click dock icon → Quit
   - Windows: Right-click system tray icon → Exit

2. **Relaunch Claude Desktop**

3. **Look for the 🔨 hammer icon** in the Claude interface
   - This indicates MCP tools are loaded
   - You should see three tools available:
     - `web-search`
     - `scrape-url`
     - `search-and-scrape`

### Step 5: Test It!

Try asking Claude:

#### Test 1: Basic Search
```
Can you search for "latest AI developments" using the web-search tool?
```

Expected: Claude will search and return deidentified results

#### Test 2: Scrape a URL
```
Can you scrape https://en.wikipedia.org/wiki/Artificial_intelligence and give me a summary?
```

Expected: Claude will fetch, deidentify, and summarize the page

#### Test 3: Search and Scrape
```
Find and read an article about machine learning, then summarize it.
```

Expected: Claude will search, scrape the top result, and provide a summary

## Troubleshooting

### ❌ "Tools not showing in Claude Desktop"

**Solution 1: Check the path**
```bash
# Verify the build file exists
ls -la /Users/spartan/calhacks/veil/mcp-veil-server/build/index.js
```

**Solution 2: Check the config syntax**
- Make sure the JSON is valid (no trailing commas, proper quotes)
- Use a JSON validator: https://jsonlint.com

**Solution 3: Check Claude logs**
```bash
# Mac
tail -f ~/Library/Logs/Claude/mcp*.log

# Look for errors related to "veil-search"
```

### ⚠️ "SIM_API_KEY not set" warning

This means the deidentification is disabled. To fix:

1. **Verify your API key is in the config:**
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. **Make sure there are no typos** in `SIM_API_KEY`

3. **Try setting it as a system variable:**
   ```bash
   # Add to ~/.zshrc or ~/.bashrc
   echo 'export SIM_API_KEY=your_key_here' >> ~/.zshrc
   source ~/.zshrc
   ```

### 🚫 "Search returns no results"

**Possible causes:**
1. DuckDuckGo may be temporarily blocking requests
2. Network connectivity issues
3. The search query is too specific

**Solutions:**
- Try a different, broader search query
- Wait 1-2 minutes and try again
- Check your internet connection

### 🔴 "Failed to scrape URL"

**Possible causes:**
1. The website blocks scrapers
2. The URL requires JavaScript to render
3. The site has anti-bot protection

**Solutions:**
- Try a different URL
- Check if the URL loads in a regular browser
- Use sites known to be scraper-friendly (Wikipedia, news sites, etc.)

## Advanced Configuration

### Multiple MCP Servers

You can run Veil alongside other MCP servers:

```json
{
  "mcpServers": {
    "veil-search": {
      "command": "node",
      "args": ["/Users/spartan/calhacks/veil/mcp-veil-server/build/index.js"],
      "env": {
        "SIM_API_KEY": "your_key"
      }
    },
    "weather": {
      "command": "node",
      "args": ["/path/to/other-mcp-server/build/index.js"]
    }
  }
}
```

### Custom Environment Variables

Add more environment variables as needed:

```json
{
  "mcpServers": {
    "veil-search": {
      "command": "node",
      "args": ["/Users/spartan/calhacks/veil/mcp-veil-server/build/index.js"],
      "env": {
        "SIM_API_KEY": "your_sim_key",
        "BRIGHTDATA_API_KEY": "optional_brightdata_key",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Using Shell Wrapper (Alternative)

If environment variables aren't working, create a wrapper script:

**veil-mcp.sh:**
```bash
#!/bin/bash
export SIM_API_KEY=your_key_here
node /Users/spartan/calhacks/veil/mcp-veil-server/build/index.js
```

**Make it executable:**
```bash
chmod +x veil-mcp.sh
```

**Update Claude config:**
```json
{
  "mcpServers": {
    "veil-search": {
      "command": "/Users/spartan/calhacks/veil/mcp-veil-server/veil-mcp.sh",
      "args": []
    }
  }
}
```

## Verification Checklist

Before opening an issue, verify:

- [ ] Node.js version 16+ installed (`node --version`)
- [ ] Dependencies installed (`npm install` completed successfully)
- [ ] Build succeeded (`npm run build` completed without errors)
- [ ] `build/index.js` file exists and is executable
- [ ] SIM API key is valid and active
- [ ] Claude Desktop config JSON is valid
- [ ] Claude Desktop has been fully restarted (not just window closed)
- [ ] 🔨 hammer icon appears in Claude Desktop interface

## Performance Tips

### Optimal Usage Patterns

1. **For quick facts:** Use `web-search` (faster)
2. **For detailed content:** Use `scrape-url` (more thorough)
3. **For research:** Use `search-and-scrape` (automated)

### Rate Limiting

To avoid rate limits:
- Keep searches to 5-10 per minute
- Use specific queries (not generic ones)
- Don't scrape the same URL repeatedly

### Cost Optimization (SIM API)

Each deidentification call uses API credits:
- Web search results: ~1-2 API calls
- Scraped page: ~1-3 API calls (depending on content size)
- Monitor your usage at: https://www.sim.ai/dashboard

## Security Best Practices

### API Key Security

✅ **DO:**
- Store API keys in environment variables
- Use different keys for development and production
- Rotate API keys periodically
- Monitor API usage for anomalies

❌ **DON'T:**
- Commit API keys to version control
- Share API keys in screenshots or logs
- Use the same key across multiple projects
- Store keys in plain text files

### Scraping Ethics

Only scrape websites you have permission to access:
- ✅ Public documentation sites
- ✅ Your own websites
- ✅ Sites with explicit API/scraping permission
- ❌ Sites with terms prohibiting scraping
- ❌ Password-protected content
- ❌ Copyrighted material without permission

## Updates and Maintenance

### Updating the Server

```bash
cd /Users/spartan/calhacks/veil/mcp-veil-server
git pull origin main
npm install
npm run build
```

Then restart Claude Desktop.

### Checking for Updates

```bash
# Check npm packages
npm outdated

# Update packages
npm update
npm run build
```

## Getting Help

### Log Files

**Mac:**
```bash
# MCP server logs
tail -f ~/Library/Logs/Claude/mcp*.log

# Claude Desktop logs
tail -f ~/Library/Logs/Claude/*.log
```

**Windows:**
```
%AppData%\Claude\logs\
```

### Common Log Messages

**✅ Success:**
```
Veil MCP Server running on stdio
```

**⚠️ Warning:**
```
WARNING: SIM_API_KEY not set - deidentification will be disabled
```

**❌ Error:**
```
Fatal error in main(): ...
```

### Support Resources

- **Issues:** [GitHub Issues](#)
- **SIM API Support:** https://www.sim.ai/support
- **Claude Desktop Help:** https://www.anthropic.com/claude
- **MCP Documentation:** https://modelcontextprotocol.io

## Success! 🎉

If you see the 🔨 hammer icon and can successfully search the web through Claude, you're all set!

The Veil MCP Server is now:
- ✅ Searching the web for you
- ✅ Scraping and extracting content
- ✅ Automatically deidentifying sensitive data
- ✅ Protecting your privacy

**Enjoy safe and private web search with Claude! 🔒**

