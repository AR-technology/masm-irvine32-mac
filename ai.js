#!/usr/bin/env node
/**
 * Offline AI Assembly Generator & Converter: MASM (32-bit Irvine32) ⇄ TASM (16-bit 8086)
 * Runs 100% locally and offline without external API keys or network connection.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const AssemblyAI = require('./js/ai_generator.js');

// ANSI Colors for Rich Terminal Display
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
    bgBlue: '\x1b[44m\x1b[37m',
    bgMagenta: '\x1b[45m\x1b[37m',
    bgCyan: '\x1b[46m\x1b[30m'
};

function printBanner() {
    console.log(`
${c.cyan}╔═══════════════════════════════════════════════════════════════════╗
║   🤖 ${c.bold}OFFLINE AI CODE GENERATOR: MASM ⇄ TASM ASSEMBLY${c.reset}${c.cyan}         ║
║   100% Local • Zero API Keys • Irvine32 & 8086 DOS Support        ║
╚═══════════════════════════════════════════════════════════════════╝${c.reset}`);
}

function displayResult(result, options = {}) {
    console.log(`\n${c.bold}${c.green}▶ Problem:${c.reset} ${c.bold}${result.title}${c.reset}`);
    console.log(`${c.dim}  ${result.analysis}${c.reset}\n`);

    const showMasm = !options.tasmOnly;
    const showTasm = !options.masmOnly;

    if (showMasm) {
        console.log(`${c.bgBlue} 📦 [MASM] 32-bit Protected Mode (Irvine32) ${c.reset}`);
        console.log(`${c.dim}───────────────────────────────────────────────────────────────────${c.reset}`);
        console.log(result.masm);
        console.log(`${c.dim}───────────────────────────────────────────────────────────────────${c.reset}\n`);
    }

    if (showTasm) {
        console.log(`${c.bgMagenta} ⚡ [TASM] 16-bit Real Mode (8086 DOS / .model small) ${c.reset}`);
        console.log(`${c.dim}───────────────────────────────────────────────────────────────────${c.reset}`);
        console.log(result.tasm);
        console.log(`${c.dim}───────────────────────────────────────────────────────────────────${c.reset}\n`);
    }

    if (!options.masmOnly && !options.tasmOnly && result.differences && result.differences.length > 0) {
        console.log(`${c.yellow}${c.bold}💡 Key Differences (MASM vs TASM):${c.reset}`);
        result.differences.forEach(diff => {
            console.log(`  ${c.yellow}•${c.reset} ${diff}`);
        });
        console.log('');
    }

    // Save MASM to main.asm if requested
    if (options.saveMasm) {
        const targetPath = path.resolve(process.cwd(), 'main.asm');
        fs.writeFileSync(targetPath, result.masm, 'utf8');
        console.log(`${c.green}✓ Saved MASM code directly to ${c.bold}main.asm${c.reset} (Run with: ${c.cyan}./masm main.asm${c.reset} or ${c.cyan}Cmd+Shift+B${c.reset})\n`);
    }

    // Save TASM to file if requested
    if (options.saveTasmFile) {
        const targetPath = path.resolve(process.cwd(), options.saveTasmFile);
        fs.writeFileSync(targetPath, result.tasm, 'utf8');
        console.log(`${c.green}✓ Saved TASM code to ${c.bold}${options.saveTasmFile}${c.reset}\n`);
    }
}

// Interactive Shell Mode
function startInteractiveShell() {
    printBanner();
    console.log(`${c.dim}Type any statement (e.g., 'check if even or odd', 'bubble sort', 'add 25 and 40')${c.reset}`);
    console.log(`${c.dim}Commands: 'save' (saves last MASM to main.asm), 'examples', 'exit' or 'q' to quit.\n${c.reset}`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${c.cyan}${c.bold}ai> ${c.reset}`
    });

    let lastResult = null;
    rl.prompt();

    rl.on('line', (line) => {
        const input = line.trim();

        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit' || input.toLowerCase() === 'q') {
            console.log(`\n${c.dim}Goodbye!${c.reset}`);
            process.exit(0);
        }

        if (input.toLowerCase() === 'examples' || input.toLowerCase() === 'help') {
            console.log(`\n${c.bold}Try these sample problem statements:${c.reset}`);
            AssemblyAI.getExamples().forEach((ex, idx) => {
                console.log(`  ${c.dim}${idx + 1}.${c.reset} ${ex}`);
            });
            console.log('');
            rl.prompt();
            return;
        }

        if (input.toLowerCase() === 'save') {
            if (lastResult) {
                const targetPath = path.resolve(process.cwd(), 'main.asm');
                fs.writeFileSync(targetPath, lastResult.masm, 'utf8');
                console.log(`${c.green}✓ Saved MASM code to main.asm!${c.reset}\n`);
            } else {
                console.log(`${c.red}No code generated yet. Enter a statement first.${c.reset}\n`);
            }
            rl.prompt();
            return;
        }

        if (input.length === 0) {
            rl.prompt();
            return;
        }

        try {
            lastResult = AssemblyAI.generate(input);
            displayResult(lastResult);
            console.log(`${c.dim}(Tip: Type 'save' to write this MASM code to main.asm)${c.reset}\n`);
        } catch (err) {
            console.log(`${c.red}Error generating code: ${err.message}${c.reset}\n`);
        }

        rl.prompt();
    });
}

// CLI Argument Parsing
function main() {
    const rawArgs = process.argv.slice(2);

    if (rawArgs.length === 0) {
        startInteractiveShell();
        return;
    }

    const options = {
        saveMasm: false,
        saveTasmFile: null,
        masmOnly: false,
        tasmOnly: false
    };

    const promptParts = [];

    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];
        if (arg === '--fix' || arg === '-f') {
            const targetFile = rawArgs[++i] || 'main.asm';
            const resolved = path.resolve(process.cwd(), targetFile);
            if (!fs.existsSync(resolved)) {
                console.log(`${c.red}File not found: ${targetFile}${c.reset}`);
                process.exit(1);
            }
            const content = fs.readFileSync(resolved, 'utf8');
            const fixed = AssemblyAI.fixTasm(content);
            fs.writeFileSync(resolved, fixed, 'utf8');
            console.log(`${c.green}✓ Auto-fixed TASM file: ${c.bold}${targetFile}${c.reset}`);
            console.log(`${c.dim}  Replaced missing PrintNum with inline printing & formatted END main for DOSBox.${c.reset}\n`);
            process.exit(0);
        } else if (arg === '--save' || arg === '-s') {
            options.saveMasm = true;
        } else if (arg === '--masm') {
            options.masmOnly = true;
        } else if (arg === '--tasm') {
            options.tasmOnly = true;
        } else if (arg === '--save-tasm') {
            options.saveTasmFile = rawArgs[++i] || 'program.asm';
        } else if (arg === '--help' || arg === '-h') {
            printBanner();
            console.log(`Usage:
  ./ai "<statement>"                 Generate both MASM and TASM code
  ./ai "<statement>" --save          Generate and save MASM code to main.asm
  ./ai "<statement>" --save-tasm out.asm  Save TASM code to file
  ./ai --fix <file.asm>              Auto-fix TASM file (replaces PrintNum & fixes EOF)
  ./ai --masm "<statement>"          Output MASM code only
  ./ai --tasm "<statement>"          Output TASM code only
  ./ai                               Launch interactive shell

Examples:
  ./ai "add two numbers 25 and 40"
  ./ai "check if number is even or odd"
  ./ai "reverse a string"
  ./ai "find largest of three numbers"
  ./ai "bubble sort array"
  ./ai "calculate factorial of 5"
`);
            process.exit(0);
        } else {
            promptParts.push(arg);
        }
    }

    const statement = promptParts.join(' ');
    if (!statement) {
        startInteractiveShell();
        return;
    }

    printBanner();
    const result = AssemblyAI.generate(statement);
    displayResult(result, options);
}

module.exports = {
    main,
    displayResult,
    startInteractiveShell
};

if (require.main === module) {
    main();
}
