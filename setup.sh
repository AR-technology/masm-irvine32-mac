#!/bin/bash
# ==============================================================================
# MASM + Irvine32 Environment Auto-Setup & Health Check (macOS & Linux)
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}  MASM 32 + Irvine32 Automated Setup & Health Check   ${NC}"
echo -e "${CYAN}======================================================${NC}\n"

# 1. Check for Node.js
echo -n "Checking Node.js environment... "
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Found (${NODE_VERSION})${NC}"
else
    echo -e "${YELLOW}Not found.${NC}"
    echo -e "Node.js is required to run the MASM engine."
    
    # Check if Homebrew is available to auto-install
    if command -v brew >/dev/null 2>&1; then
        echo -e "${CYAN}Homebrew detected. Installing Node.js automatically...${NC}"
        brew install node
    else
        echo -e "${RED}Please install Node.js (https://nodejs.org) or install Homebrew (https://brew.sh)${NC}"
        exit 1
    fi
fi

# 2. Check for Python (Optional, for web studio server)
echo -n "Checking Python 3 environment... "
if command -v python3 >/dev/null 2>&1; then
    PY_VERSION=$(python3 --version)
    echo -e "${GREEN}✓ Found (${PY_VERSION})${NC}"
else
    echo -e "${YELLOW}⚠ Optional: python3 not found (Web studio launcher may need it)${NC}"
fi

# 3. Set Execution Permissions on Scripts
echo -n "Configuring execution permissions... "
chmod +x masm run.sh setup.sh update.sh 2>/dev/null || true
echo -e "${GREEN}✓ Done${NC}"

# 4. Run Self-Diagnostic Test
echo -e "\n${CYAN}Running core emulator self-tests...${NC}"
node test.js

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}  🎉 Setup Complete! Everything is ready to use.       ${NC}"
echo -e "${GREEN}======================================================${NC}\n"

echo -e "To start working:"
echo -e "  1. Open this folder in VS Code: ${CYAN}code .${NC}"
echo -e "  2. Edit ${CYAN}main.asm${NC} and press ${YELLOW}Cmd + Shift + B${NC} to run."
echo -e "  3. Or run in terminal: ${CYAN}./masm main.asm -d${NC} for interactive debugging."
echo -e "  4. To update in future: ${CYAN}./update.sh${NC}\n"
