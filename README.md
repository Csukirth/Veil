Welcome to VEIL!

This file will help you and give you instructions on how to seamlessly run our product
Please Make sure you meet the following requirements:
## Requirements

- Node.js (v16 or higher)
- Ghostscript (for PDF processing)
- (Optional) BrightData API Key

## Setup

### Step 1: Install Ghostscript
**macOS:**
```bash
brew install ghostscript
gs --version  # Verify it's installed
```
**Linux:**
```bash
sudo apt-get install ghostscript
gs --version  # Verify it's installed
```
**Windows:** 
- Download from https://ghostscript.com/releases/gsdnld.html
- After install, run `gs --version` in Command Prompt to verify

### Step 2: Install Node dependencies
```bash
cd Veil-2  # Make sure you're in the project folder
npm install
```

### Step 3: Add your API keys
Create a file named `.env` in the project root folder:
```
# Required for sensitive data detection
-SIM_API_KEY=your_sim_api_key_here

# Optional: For B2B PDF scraping
-BRIGHTDATA_API_KEY=your_brightdata_api_key_here
-UNLOCKER_ZONE=unlocker
```

### Step 4: Run the app
**Terminal 1 - Backend:**
```bash
node server.js
```
**Terminal 2 - Frontend:**
```bash
npm run dev
```

## Usage
   Open http://localhost:5173 in your browser

#NOTE: if you want to run our MCP, there are more instructions:
#MCP Setup:
#Additional Requirements
   -
## Installation

### Prerequisites

- Node.js 16+ and npm
- Claude Desktop app
- SIM API key (get from https://www.sim.ai)

### Setup
1. **Install dependencies:**
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
