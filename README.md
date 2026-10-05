# 🚀 MASM 32 + Irvine32 Assembly Lab Environment (for macOS & VS Code)

[![Platform: macOS (Apple Silicon M1/M2/M3/M4 & Intel)](https://img.shields.io/badge/Platform-macOS%20ARM64%20%26%20x86__64-brightgreen.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#)
[![VS Code Ready](https://img.shields.io/badge/VS%20Code-Preconfigured-007ACC.svg)](#)

A zero-setup, native **x86 32-bit MASM Assembly + Irvine32** development and debugging environment built for **Mac users** taking Computer Organization & Assembly Language courses (*Kip Irvine textbook curriculum*).

Write your code directly in **VS Code** inside `main.asm`, build with **`Cmd + Shift + B`**, and step through your code line-by-line with real-time register inspection (`DumpRegs`, `EAX`, `EBX`, Flags, Stack, and Memory).

---

## ✨ Features

- ⚡ **VS Code 1-Click Workflow:** Press `Cmd + Shift + B` to assemble and run `main.asm` directly in the VS Code terminal.
- 🔍 **Interactive Terminal Debugger:** Run `./masm main.asm -d` to step through instructions line-by-line (like `F10` in Visual Studio) and watch CPU registers & flags update in real time.
- 📦 **Irvine32 Standard Library Support:**
  - `DumpRegs`, `DumpMem`
  - `WriteString`, `WriteInt`, `WriteDec`, `WriteHex`, `WriteBin`, `WriteChar`
  - `ReadInt`, `ReadDec`, `ReadHex`, `ReadChar`, `ReadString`
  - `Crlf`, `Clrscr`, `WaitMsg`, `RandomRange`, `Random32`, `Randomize`
- 🖥️ **Optional Visual Web Studio:** Launch `./run.sh` to get a full graphical IDE with real-time memory tables, call stack inspector, and breakpoints.
- 📚 **Preloaded University Lab Templates:** Includes starter code for Labs 1 through 6 (Data transfer, offsets, arrays, loops, conditionals, and procedures).

---

## 🚀 Quick Start (For You & Your Friends)

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/masm-irvine32-mac.git
cd masm-irvine32-mac
```

### 2. Run Automatic 1-Click Setup
```bash
./setup.sh
```
> **What `setup.sh` does automatically:**
> - Checks for Node.js and auto-installs it via Homebrew if missing.
> - Configures all file permissions.
> - Runs health diagnostics to guarantee everything works on their Mac.

### 3. Open in VS Code & Start Coding!
1. Open the folder in VS Code: `code .`
2. Edit **`main.asm`**.
3. Press **`Cmd + Shift + B`** to build & run!

---

## 🔄 Getting Future Updates

Whenever you push new templates or improvements to GitHub, your friends can update everything in 1 command without losing their local code in `main.asm`:

```bash
./update.sh
```
*(Or in VS Code: **Terminal ➔ Run Task ➔ MASM: Update from GitHub**)*

---

## 🛠️ Commands & Usage

| Command | Action |
| :--- | :--- |
| `Cmd + Shift + B` | **Build & Run** active `.asm` file in VS Code |
| `./masm main.asm` | Run `main.asm` from the terminal |
| `./masm main.asm -d` | **Interactive Debugger** (Step with `Enter`, `r` to dump registers, `m` for memory) |
| `./masm main.asm -w` | **Watch Mode** (Automatically re-runs every time you save `main.asm`) |
| `./run.sh` | Launch the **Graphical Web Studio** in your browser (`http://localhost:8080`) |

---

## 📝 Example Starter Code (`main.asm`)

```assembly
INCLUDE Irvine32.inc

.data
    welcomeMsg BYTE "Hello from MASM Assembly on Mac!", 0dh, 0ah, 0
    val1       DWORD 100h
    val2       DWORD 250h
    result     DWORD ?

.code
main PROC
    ; Display text
    mov edx, OFFSET welcomeMsg
    call WriteString

    ; Arithmetic
    mov eax, val1
    add eax, val2
    mov result, eax

    ; Inspect CPU Registers
    call DumpRegs

    exit
main ENDP
END main
```

---

## 💻 System Requirements
- **macOS:** Apple Silicon (M1/M2/M3/M4) or Intel Mac.
- **Node.js:** Standard on modern Mac development setups (`node -v`).
- **VS Code:** (Recommended).

---

## 📄 License
MIT License. Created to help students easily learn Assembly on macOS.
