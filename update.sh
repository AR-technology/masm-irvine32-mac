#!/bin/bash
# ==============================================================================
# Auto-Update Script: Fetches the latest updates from the GitHub repository
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}Checking for updates from GitHub repository...${NC}"

# Ensure git is available
if ! command -v git >/dev/null 2>&1; then
    echo -e "${RED}Error: Git is not installed.${NC}"
    exit 1
fi

# Fetch and pull
if [ -d ".git" ]; then
    echo -e "Fetching latest changes..."
    # Preserve local main.asm if modified
    git stash -q || true
    git pull origin main || git pull origin master
    git stash pop -q 2>/dev/null || true
    
    chmod +x masm run.sh setup.sh update.sh 2>/dev/null || true
    
    echo -e "\n${GREEN}✓ Successfully updated to the latest version!${NC}"
else
    echo -e "${YELLOW}Notice: This folder is not connected to a git repository.${NC}"
    echo -e "If you cloned this from GitHub, make sure you are inside the repo directory."
fi
