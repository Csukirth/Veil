# Veil MCP Server

A Model Context Protocol (MCP) server that provides web search and scraping capabilities with automatic deidentification of sensitive data using the Veil/SIM API.

## Features

This MCP server gives Claude Desktop three powerful tools:

### 1. 🔍 `web-search`
Search the web and get deidentified results
- Uses DuckDuckGo (no API key required)
- Returns up to 10 results
- Automatically removes PII and sensitive data

### 2. 🌐 `scrape-url`
Scrape and extract content from any URL
- Extracts main content from web pages
- Converts HTML to clean Markdown
- Removes navigation, ads, and other noise
- Deidentifies extracted content

### 3. 🚀 `search-and-scrape`
Search and automatically scrape the top result
- Combines search + scraping in one step
- Perfect for quick research
- Returns fully deidentified content

## Privacy & Security

All content is automatically processed through the SIM API to:
- ✅ Detect and mask PII (names, emails, phone numbers, addresses)
- ✅ Identify sensitive financial data
- ✅ Protect medical information
- ✅ Remove social security numbers and IDs
- ✅ Tag sensitive content with XML markers

This ensures that when Claude processes web content, no personal or sensitive information is exposed.

## Installation

### Prerequisites

- Node.js 16+ and npm
- Claude Desktop app
- SIM API key (get from https://www.sim.ai)

### Setup

1. **Clone and install dependencies:**
   ```bash
   cd /Users/spartan/calhacks/veil/mcp-veil-server
   npm install
   ```

2. **Set your SIM API key:**
   ```bash
   export SIM_API_KEY=your_sim_api_key_here
   ```
   
   Or add it to your shell profile (`~/.zshrc` or `~/.bashrc`):
   ```bash
   echo 'export SIM_API_KEY=your_sim_api_key_here' >> ~/.zshrc
   source ~/.zshrc
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

### Connect to Claude Desktop

1. Open your Claude Desktop configuration file:
   - **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%AppData%\Claude\claude_desktop_config.json`

2. Add the Veil server configuration:
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
   
   **Important:** Replace `your_sim_api_key_here` with your actual SIM API key.

3. **Restart Claude Desktop**

4. Look for the 🔨 hammer icon in Claude Desktop to confirm the tools are available

## Usage Examples

### Basic Web Search

Ask Claude:
> "Can you search for 'latest AI breakthroughs' using veil-search?"

Claude will:
1. Search the web
2. Return deidentified results
3. Protect any PII in search snippets

### Scrape Specific URL

Ask Claude:
> "Can you scrape https://example.com/article and summarize it?"

Claude will:
1. Fetch and extract the article content
2. Remove all PII and sensitive data
3. Return clean, deidentified text

### Search and Scrape Combined

Ask Claude:
> "Find and read the latest research on climate change"

Claude will:
1. Search for relevant content
2. Automatically scrape the top result
3. Return deidentified content ready for analysis

## How It Works

```
User Query → Claude Desktop → Veil MCP Server
                                    ↓
                            Web Search/Scrape
                                    ↓
                              SIM API (Deidentification)
                                    ↓
                            Deidentified Content
                                    ↓
                            ← Return to Claude
```

### Deidentification Example

**Before:**
```
Contact John Smith at john.smith@example.com or call 555-123-4567.
His SSN is 123-45-6789.
```

**After:**
```
Contact <PERSON>John Smith</PERSON> at <EMAIL>john.smith@example.com</EMAIL> 
or call <PHONE>555-123-4567</PHONE>.
His SSN is <SSN>123-45-6789</SSN>.
```

## Architecture

```
┌─────────────────┐
│ Claude Desktop  │
└────────┬────────┘
         │ MCP Protocol
         │
┌────────▼────────────────┐
│  Veil MCP Server        │
│  ┌──────────────────┐   │
│  │ web-search       │   │
│  │ scrape-url       │   │
│  │ search-and-scrape│   │
│  └──────────────────┘   │
└────────┬────────────────┘
         │
    ┌────▼────┐    ┌──────────┐
    │  Web    │    │ SIM API  │
    │ Scraper │───▶│ (Veil)   │
    └─────────┘    └──────────┘
                   Deidentification
```

## Development

### File Structure

```
mcp-veil-server/
├── src/
│   └── index.ts          # Main server implementation
├── build/                # Compiled JavaScript (after npm run build)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

### Build Commands

```bash
# Build the project
npm run build

# Watch mode for development
npm run dev
```

### Testing

After building, you can test the server directly:

```bash
# Set environment variable
export SIM_API_KEY=your_key_here

# Run the server (it will wait for MCP messages on stdin)
node build/index.js
```

The server communicates via stdio, so it's designed to be called by Claude Desktop rather than run standalone.

## Troubleshooting

### Server not showing in Claude Desktop

1. **Check the config path:** Ensure the `args` path in `claude_desktop_config.json` points to the correct location
2. **Verify the build:** Run `npm run build` to ensure the `build/index.js` file exists
3. **Check permissions:** Ensure the build file is executable (should be set automatically by build script)
4. **Restart Claude:** Fully quit and restart Claude Desktop

### "SIM_API_KEY not set" warning

The server will still work for searching, but deidentification will be disabled. To fix:
1. Add your SIM API key to the `env` section of the Claude config
2. Or set it as a system environment variable
3. Restart Claude Desktop

### Search returns no results

- DuckDuckGo may temporarily block requests if too many are made
- Try a different search query
- Wait a few minutes and try again

### Scraping fails for a URL

Some websites block scrapers or require JavaScript:
- Try a different URL
- The site may have anti-bot protection
- Check if the URL is accessible in a regular browser

## API Rate Limits

- **DuckDuckGo:** No official limit, but avoid excessive requests
- **SIM API:** Check your plan limits at https://www.sim.ai
- Recommended: Maximum 10-20 searches per minute

## Security Notes

- ✅ All web content is deidentified before reaching Claude
- ✅ No data is stored locally (streaming only)
- ✅ Uses HTTPS for all external requests
- ⚠️  Your SIM API key is stored in Claude's config file
- ⚠️  Only scrape websites you have permission to access

## Future Enhancements

Planned features:
- [ ] Support for more search engines (Google, Bing)
- [ ] PDF scraping and deidentification
- [ ] Batch processing of multiple URLs
- [ ] Custom deidentification rules
- [ ] Local caching of scraped content
- [ ] Integration with BrightData for enhanced scraping

## License

MIT License - See LICENSE file for details

## Support

For issues related to:
- **MCP Server:** Open an issue in this repository
- **SIM API:** Contact https://www.sim.ai/support
- **Claude Desktop:** Check https://www.anthropic.com/claude

## Credits

Built using:
- [Model Context Protocol SDK](https://github.com/anthropics/mcp) by Anthropic
- [SIM AI API](https://www.sim.ai) for deidentification
- [Cheerio](https://cheerio.js.org/) for HTML parsing
- [Turndown](https://github.com/mixmark-io/turndown) for HTML to Markdown conversion

---

**🔒 Veil MCP Server - Private Web Search for Claude Desktop**

