/**
 * MASM Lexer, Parser & Execution Engine for x86 32-bit Assembly
 */

class MasmParser {
    constructor(cpu, irvine) {
        this.cpu = cpu;
        this.irvine = irvine;
        this.reset();
    }

    reset() {
        this.instructions = []; // Array of executable instruction objects
        this.labels = {};       // labelName -> instructionIndex
        this.dataOffset = 0x00404000;
        this.codeBase = 0x00401000;
        this.constants = {};
        this.procedures = {};   // procName -> instructionIndex
        this.dataSymbols = [];
        this.errors = [];
        this.warnings = [];
    }

    // Evaluate an immediate constant expression or numeric string
    parseNumber(token) {
        if (typeof token === 'number') return token;
        if (!token) return 0;
        token = token.trim();

        // Single character literal 'A' or "A"
        if ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"'))) {
            if (token.length === 3) {
                return token.charCodeAt(1);
            }
        }

        // Check if defined constant
        if (this.constants[token.toUpperCase()] !== undefined) {
            return this.constants[token.toUpperCase()];
        }

        // Binary: e.g. 10101111b or 10101111B
        if (/^[01]+[bB]$/.test(token)) {
            return parseInt(token.slice(0, -1), 2);
        }

        // Hex: e.g. 0A4h, 10h, 0FFFFh, 0x1234, 1000000000123456789Ah
        if (/^0x[0-9a-fA-F]+$/i.test(token)) {
            try { return Number(BigInt(token) & 0xFFFFFFFFFFFFFFFFn); } catch(e) { return parseInt(token, 16); }
        }
        if (/^[0-9][0-9a-fA-F]*[hH]$/.test(token)) {
            try { return Number(BigInt('0x' + token.slice(0, -1)) & 0xFFFFFFFFFFFFFFFFn); } catch(e) { return parseInt(token.slice(0, -1), 16); }
        }

        // Floating point or scientific notation: e.g. -1.25, 3.2E+100, -6.223424E-2343
        if (/^[+-]?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$/.test(token)) {
            return parseFloat(token);
        }

        // Decimal: e.g. 1234, -42, +10
        if (/^[+-]?[0-9]+$/.test(token)) {
            return parseInt(token, 10);
        }

        // Hex without h if starts with 0 and only valid hex? Be careful, usually MASM requires 'h' or '0x'.
        return NaN;
    }

    // Parses data allocation line like: val1 DWORD 100 or arr BYTE 1, 2, 3 or msg BYTE "Hello", 0
    parseDataDeclaration(line, lineNum) {
        // Strip comments
        const commentIdx = line.indexOf(';');
        if (commentIdx !== -1) line = line.slice(0, commentIdx);
        line = line.trim();
        if (!line) return;

        // Match variable declarations: BYTE, SBYTE, WORD, SWORD, DWORD, SDWORD, FWORD, QWORD, TBYTE, REAL4, REAL8, REAL10
        const match = line.match(/^([a-zA-Z_@$?][a-zA-Z0-9_@$?]*)\s+(BYTE|SBYTE|WORD|SWORD|DWORD|SDWORD|FWORD|QWORD|TBYTE|REAL4|REAL8|REAL10)\s+(.*)$/i);
        if (!match) return;

        const varName = match[1].toUpperCase();
        const typeName = match[2].toUpperCase();
        let valString = match[3].trim();

        let elemSize = 1;
        if (typeName === 'WORD' || typeName === 'SWORD') elemSize = 2;
        if (typeName === 'DWORD' || typeName === 'SDWORD' || typeName === 'REAL4') elemSize = 4;
        if (typeName === 'FWORD') elemSize = 6;
        if (typeName === 'QWORD' || typeName === 'REAL8') elemSize = 8;
        if (typeName === 'TBYTE' || typeName === 'REAL10') elemSize = 10;

        const currentAddr = this.dataOffset;
        this.cpu.symbolTable[varName] = currentAddr;

        // Check for DUP: e.g. 5 DUP(0) or 10 DUP(?)
        const dupMatch = valString.match(/^(\d+)\s+DUP\s*\((.*)\)$/i);
        let bytesWritten = 0;

        if (dupMatch) {
            const count = parseInt(dupMatch[1], 10);
            const dupValStr = dupMatch[2].trim();
            const dupVal = dupValStr === '?' ? 0 : (this.parseNumber(dupValStr) || 0);

            for (let i = 0; i < count; i++) {
                this.cpu.writeMem(this.dataOffset, dupVal, elemSize);
                this.dataOffset += elemSize;
                bytesWritten += elemSize;
            }
        } else {
            // Parse comma-separated elements, strings, numbers
            const items = this.splitDataItems(valString);
            for (const item of items) {
                if ((item.startsWith('"') && item.endsWith('"')) || (item.startsWith("'") && item.endsWith("'"))) {
                    // String literal
                    const content = item.slice(1, -1);
                    for (let c = 0; c < content.length; c++) {
                        this.cpu.writeByte(this.dataOffset, content.charCodeAt(c));
                        this.dataOffset += 1;
                        bytesWritten += 1;
                    }
                } else {
                    const num = this.parseNumber(item);
                    const val = isNaN(num) ? 0 : num;
                    this.cpu.writeMem(this.dataOffset, val, elemSize);
                    this.dataOffset += elemSize;
                    bytesWritten += elemSize;
                }
            }
        }

        this.dataSymbols.push({
            name: varName,
            type: typeName,
            address: currentAddr,
            size: bytesWritten,
            line: lineNum,
            elemSize: elemSize
        });
    }

    splitDataItems(str) {
        const items = [];
        let cur = '';
        let inQuote = false;
        let quoteChar = '';

        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if ((ch === '"' || ch === "'") && (!inQuote || quoteChar === ch)) {
                inQuote = !inQuote;
                quoteChar = inQuote ? ch : '';
                cur += ch;
            } else if (ch === ',' && !inQuote) {
                if (cur.trim()) items.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        if (cur.trim()) items.push(cur.trim());
        return items;
    }

    // Parse source code into memory and instructions
    assemble(sourceCode) {
        this.reset();
        this.cpu.reset();

        const lines = sourceCode.split('\n');
        let currentSection = 'code'; // default

        // First Pass: Collect constants, data segment variables, and labels
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const lineNum = i + 1;

            // Strip comments
            const commentIdx = line.indexOf(';');
            if (commentIdx !== -1) line = line.slice(0, commentIdx);
            line = line.trim();
            if (!line) continue;

            const upper = line.toUpperCase();

            // Section directives
            if (upper.startsWith('.DATA')) {
                currentSection = 'data';
                continue;
            } else if (upper.startsWith('.CODE')) {
                currentSection = 'code';
                continue;
            } else if (upper.startsWith('.386') || upper.startsWith('.MODEL') || upper.startsWith('.STACK') || upper.startsWith('INCLUDE') || upper.startsWith('EXITPROCESS PROTO')) {
                continue;
            }

            // Constants: e.g. COUNT = 5 or SIZE EQU 10
            const constMatch = line.match(/^([a-zA-Z_@$?][a-zA-Z0-9_@$?]*)\s*(=|EQU)\s*(.+)$/i);
            if (constMatch) {
                const constName = constMatch[1].toUpperCase();
                const constVal = this.parseNumber(constMatch[3]);
                this.constants[constName] = isNaN(constVal) ? 0 : constVal;
                continue;
            }

            if (currentSection === 'data') {
                this.parseDataDeclaration(line, lineNum);
            }
        }

        // Pass this data info to CPU for inspector
        this.cpu.dataSymbols = this.dataSymbols;

        // Second Pass: Parse instructions and code labels
        currentSection = 'code';
        let currentProc = null;

        for (let i = 0; i < lines.length; i++) {
            let originalLine = lines[i];
            const lineNum = i + 1;

            let line = originalLine;
            const commentIdx = line.indexOf(';');
            if (commentIdx !== -1) line = line.slice(0, commentIdx);
            line = line.trim();
            if (!line) continue;

            const upper = line.toUpperCase();

            if (upper.startsWith('.DATA')) {
                currentSection = 'data';
                continue;
            } else if (upper.startsWith('.CODE')) {
                currentSection = 'code';
                continue;
            } else if (upper.startsWith('.386') || upper.startsWith('.MODEL') || upper.startsWith('.STACK') || upper.startsWith('INCLUDE') || upper.startsWith('EXITPROCESS PROTO') || upper.startsWith('END MAIN') || upper === 'END') {
                continue;
            }

            if (currentSection !== 'code') continue;

            // Check for Procedure Start: name PROC
            const procMatch = line.match(/^([a-zA-Z_@$?][a-zA-Z0-9_@$?]*)\s+PROC\b/i);
            if (procMatch) {
                const procName = procMatch[1].toUpperCase();
                this.procedures[procName] = this.instructions.length;
                this.labels[procName] = this.instructions.length;
                currentProc = procName;
                continue;
            }

            // Check for Procedure End: name ENDP
            const endpMatch = line.match(/^([a-zA-Z_@$?][a-zA-Z0-9_@$?]*)\s+ENDP\b/i);
            if (endpMatch) {
                currentProc = null;
                continue;
            }

            // Check for label: label: [optional instruction]
            const labelMatch = line.match(/^([a-zA-Z_@$?][a-zA-Z0-9_@$?]*):\s*(.*)$/);
            if (labelMatch) {
                const labelName = labelMatch[1].toUpperCase();
                this.labels[labelName] = this.instructions.length;
                line = labelMatch[2].trim();
                if (!line) continue;
            }

            // Now parse the instruction
            try {
                const inst = this.parseInstruction(line, lineNum, originalLine);
                if (inst) {
                    inst.address = this.codeBase + (this.instructions.length * 4);
                    this.instructions.push(inst);
                }
            } catch (err) {
                this.errors.push({ line: lineNum, message: err.message, text: originalLine });
            }
        }

        // Set initial EIP
        const mainIndex = this.procedures['MAIN'] !== undefined ? this.procedures['MAIN'] : 0;
        this.cpu.regs.EIP = this.codeBase + (mainIndex * 4);

        return {
            success: this.errors.length === 0,
            errors: this.errors,
            instructionsCount: this.instructions.length,
            dataSymbols: this.dataSymbols
        };
    }

    parseInstruction(line, lineNum, originalLine) {
        line = line.trim();
        if (!line) return null;

        // Handle INVOKE ExitProcess, 0 or exit
        if (line.toUpperCase() === 'EXIT') {
            return { mnemonic: 'EXIT', operands: [], lineNum, originalLine };
        }
        if (line.toUpperCase().startsWith('INVOKE EXITPROCESS')) {
            const parts = line.split(',');
            const code = parts[1] ? (this.parseNumber(parts[1]) || 0) : 0;
            return { mnemonic: 'EXIT', operands: [{ type: 'imm', value: code }], lineNum, originalLine };
        }

        // Split Mnemonic from Operands
        const spaceIdx = line.search(/\s/);
        let mnemonic = '';
        let operandStr = '';

        if (spaceIdx === -1) {
            mnemonic = line.toUpperCase();
        } else {
            mnemonic = line.slice(0, spaceIdx).toUpperCase();
            operandStr = line.slice(spaceIdx).trim();
        }

        const rawOperands = operandStr ? this.splitOperands(operandStr) : [];
        const operands = rawOperands.map(op => this.parseOperand(op));

        return {
            mnemonic,
            operands,
            lineNum,
            originalLine
        };
    }

    splitOperands(str) {
        const list = [];
        let cur = '';
        let inBracket = false;
        let inQuote = false;
        let quoteChar = '';

        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if ((ch === '"' || ch === "'") && (!inQuote || quoteChar === ch)) {
                inQuote = !inQuote;
                quoteChar = inQuote ? ch : '';
                cur += ch;
            } else if (ch === '[' && !inQuote) {
                inBracket = true;
                cur += ch;
            } else if (ch === ']' && !inQuote) {
                inBracket = false;
                cur += ch;
            } else if (ch === ',' && !inBracket && !inQuote) {
                if (cur.trim()) list.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        if (cur.trim()) list.push(cur.trim());
        return list;
    }

    parseOperand(opStr) {
        opStr = opStr.trim();

        // Check for OFFSET varName
        const offsetMatch = opStr.match(/^OFFSET\s+([a-zA-Z_@$?][a-zA-Z0-9_@$?]*)$/i);
        if (offsetMatch) {
            const name = offsetMatch[1].toUpperCase();
            return { type: 'offset', name };
        }

        // Check for LENGTHOF, SIZEOF, TYPE
        const opKeyword = opStr.match(/^(LENGTHOF|SIZEOF|TYPE)\s+([a-zA-Z_@$?][a-zA-Z0-9_@$?]*)$/i);
        if (opKeyword) {
            return { type: 'meta', op: opKeyword[1].toUpperCase(), name: opKeyword[2].toUpperCase() };
        }

        // Check for PTR explicit sizing: e.g. BYTE PTR [esi], DWORD PTR [val1 + 4]
        let ptrSize = null;
        let innerStr = opStr;
        const ptrMatch = opStr.match(/^(BYTE|WORD|DWORD|SDWORD|SWORD|SBYTE)\s+PTR\s+(.*)$/i);
        if (ptrMatch) {
            const s = ptrMatch[1].toUpperCase();
            if (s === 'BYTE' || s === 'SBYTE') ptrSize = 1;
            else if (s === 'WORD' || s === 'SWORD') ptrSize = 2;
            else if (s === 'DWORD' || s === 'SDWORD') ptrSize = 4;
            innerStr = ptrMatch[2].trim();
        }

        // Check for Memory Bracket Addressing: [...] or varName[...] or varName
        if (innerStr.includes('[') || innerStr.includes(']')) {
            return { type: 'mem', expr: innerStr, size: ptrSize };
        }

        // Check if Register
        if (this.cpu.isRegister(innerStr)) {
            return { type: 'reg', name: innerStr.toUpperCase(), size: this.cpu.getRegSize(innerStr) };
        }

        // Check if defined variable / symbol name (direct memory reference)
        if (this.cpu.symbolTable[innerStr.toUpperCase()] !== undefined) {
            return { type: 'mem_direct', name: innerStr.toUpperCase(), size: ptrSize };
        }

        // Check if immediate number
        const num = this.parseNumber(innerStr);
        if (!isNaN(num)) {
            return { type: 'imm', value: num };
        }

        // Otherwise assume label/identifier (e.g. for JMP / CALL target)
        return { type: 'label', name: innerStr.toUpperCase() };
    }

    // Resolve an operand value or memory address at runtime
    evalOperand(op) {
        if (op.type === 'reg') {
            return { val: this.cpu.getReg(op.name), size: op.size, type: 'reg', name: op.name };
        } else if (op.type === 'imm') {
            return { val: op.value, size: 4, type: 'imm' };
        } else if (op.type === 'offset') {
            const addr = this.cpu.symbolTable[op.name];
            if (addr === undefined) throw new Error(`Undefined variable in OFFSET: ${op.name}`);
            return { val: addr, size: 4, type: 'imm' };
        } else if (op.type === 'meta') {
            const sym = this.dataSymbols.find(s => s.name === op.name);
            if (!sym) throw new Error(`Undefined symbol in ${op.op}: ${op.name}`);
            if (op.op === 'TYPE') return { val: sym.elemSize, size: 4, type: 'imm' };
            if (op.op === 'LENGTHOF') return { val: Math.floor(sym.size / sym.elemSize), size: 4, type: 'imm' };
            if (op.op === 'SIZEOF') return { val: sym.size, size: 4, type: 'imm' };
        } else if (op.type === 'mem_direct') {
            const addr = this.cpu.symbolTable[op.name];
            const sym = this.dataSymbols.find(s => s.name === op.name);
            const size = op.size || (sym ? sym.elemSize : 4);
            return { val: this.cpu.readMem(addr, size), addr, size, type: 'mem' };
        } else if (op.type === 'mem') {
            const addr = this.resolveEffectiveAddress(op.expr);
            const size = op.size || 4;
            return { val: this.cpu.readMem(addr, size), addr, size, type: 'mem' };
        } else if (op.type === 'label') {
            return { name: op.name, type: 'label' };
        }
        throw new Error(`Cannot evaluate operand: ${JSON.stringify(op)}`);
    }

    // Resolves expressions like: [esi], [esi + 4], [ebp - 8], [array + ecx*4], array[esi], etc.
    resolveEffectiveAddress(expr) {
        expr = expr.trim();

        // Handle array[esi] -> array + [esi]
        let baseSymbol = null;
        let insideBracket = expr;

        const outerMatch = expr.match(/^([a-zA-Z_@$?][a-zA-Z0-9_@$?]*)\s*\[(.*)\]$/);
        if (outerMatch) {
            baseSymbol = outerMatch[1].toUpperCase();
            insideBracket = outerMatch[2];
        } else if (expr.startsWith('[') && expr.endsWith(']')) {
            insideBracket = expr.slice(1, -1);
        }

        let address = 0;
        if (baseSymbol) {
            const symAddr = this.cpu.symbolTable[baseSymbol];
            if (symAddr === undefined) throw new Error(`Unknown variable: ${baseSymbol}`);
            address += symAddr;
        }

        // Tokenize inside bracket by + and -
        // Examples: esi + 4, ebp - 8, array + ecx * 4, esi + edi*2 + 12
        const tokens = insideBracket.replace(/-/g, '+-').split('+').map(t => t.trim()).filter(t => t);

        for (let token of tokens) {
            let sign = 1;
            if (token.startsWith('-')) {
                sign = -1;
                token = token.slice(1).trim();
            }

            // Check if scaled index: reg * scale (e.g. ecx * 4)
            if (token.includes('*')) {
                const parts = token.split('*').map(p => p.trim());
                let regVal = 0;
                let scaleVal = 1;

                if (this.cpu.isRegister(parts[0])) {
                    regVal = this.cpu.getReg(parts[0]);
                    scaleVal = this.parseNumber(parts[1]) || 1;
                } else if (this.cpu.isRegister(parts[1])) {
                    regVal = this.cpu.getReg(parts[1]);
                    scaleVal = this.parseNumber(parts[0]) || 1;
                }
                address += sign * (regVal * scaleVal);
            } else if (this.cpu.isRegister(token)) {
                address += sign * this.cpu.getReg(token);
            } else if (this.cpu.symbolTable[token.toUpperCase()] !== undefined) {
                address += sign * this.cpu.symbolTable[token.toUpperCase()];
            } else {
                const num = this.parseNumber(token);
                if (!isNaN(num)) {
                    address += sign * num;
                } else {
                    throw new Error(`Invalid address term: ${token}`);
                }
            }
        }

        return address >>> 0;
    }

    // Write back result into destination operand (Register or Memory)
    writeOperand(op, val, size) {
        if (op.type === 'reg') {
            this.cpu.setReg(op.name, val);
        } else if (op.type === 'mem_direct') {
            const addr = this.cpu.symbolTable[op.name];
            const sym = this.dataSymbols.find(s => s.name === op.name);
            const finalSize = size || op.size || (sym ? sym.elemSize : 4);
            this.cpu.writeMem(addr, val, finalSize);
        } else if (op.type === 'mem') {
            const addr = this.resolveEffectiveAddress(op.expr);
            const finalSize = size || op.size || 4;
            this.cpu.writeMem(addr, val, finalSize);
        } else {
            throw new Error(`Destination must be register or memory`);
        }
    }

    // Step a single instruction
    async step() {
        if (this.cpu.isHalted) return { halted: true };

        const currentInstIdx = Math.floor((this.cpu.regs.EIP - this.codeBase) / 4);
        if (currentInstIdx < 0 || currentInstIdx >= this.instructions.length) {
            this.cpu.isHalted = true;
            return { halted: true, reason: 'End of instructions reached' };
        }

        const inst = this.instructions[currentInstIdx];
        this.cpu.markState();
        this.cpu.instructionCount++;

        // Advance EIP by default to next instruction
        this.cpu.regs.EIP = (this.cpu.regs.EIP + 4) >>> 0;

        await this.executeInstruction(inst);
        this.cpu.diffState();

        return {
            halted: this.cpu.isHalted,
            inst,
            lineNum: inst.lineNum,
            nextEIP: this.cpu.regs.EIP
        };
    }

    async executeInstruction(inst) {
        const m = inst.mnemonic;
        const ops = inst.operands;

        switch (m) {
            case 'NOP':
                break;

            case 'EXIT':
                this.cpu.isHalted = true;
                this.cpu.exitCode = ops[0] ? this.evalOperand(ops[0]).val : 0;
                break;

            case 'MOV': {
                const dest = ops[0];
                const src = this.evalOperand(ops[1]);
                const size = dest.size || src.size || 4;
                this.writeOperand(dest, src.val, size);
                break;
            }

            case 'MOVZX': {
                const dest = ops[0];
                const src = this.evalOperand(ops[1]);
                this.writeOperand(dest, src.val >>> 0, dest.size || 4);
                break;
            }

            case 'MOVSX': {
                const dest = ops[0];
                const src = this.evalOperand(ops[1]);
                let sVal = src.val;
                if (src.size === 1) sVal = (src.val << 24) >> 24;
                else if (src.size === 2) sVal = (src.val << 16) >> 16;
                this.writeOperand(dest, sVal, dest.size || 4);
                break;
            }

            case 'XCHG': {
                const d = this.evalOperand(ops[0]);
                const s = this.evalOperand(ops[1]);
                const size = ops[0].size || ops[1].size || 4;
                this.writeOperand(ops[0], s.val, size);
                this.writeOperand(ops[1], d.val, size);
                break;
            }

            case 'LEA': {
                const dest = ops[0];
                const addr = this.resolveEffectiveAddress(ops[1].expr || ops[1].name);
                this.writeOperand(dest, addr, 4);
                break;
            }

            case 'ADD': {
                const d = this.evalOperand(ops[0]);
                const s = this.evalOperand(ops[1]);
                const size = ops[0].size || ops[1].size || 4;
                const res = d.val + s.val;
                this.cpu.updateAddFlags(d.val, s.val, res, size);
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'ADC': {
                const d = this.evalOperand(ops[0]);
                const s = this.evalOperand(ops[1]);
                const size = ops[0].size || ops[1].size || 4;
                const carry = this.cpu.flags.CF;
                const res = d.val + s.val + carry;
                this.cpu.updateAddFlags(d.val, s.val + carry, res, size);
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'SUB': {
                const d = this.evalOperand(ops[0]);
                const s = this.evalOperand(ops[1]);
                const size = ops[0].size || ops[1].size || 4;
                const res = d.val - s.val;
                this.cpu.updateSubFlags(d.val, s.val, res, size);
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'SBB': {
                const d = this.evalOperand(ops[0]);
                const s = this.evalOperand(ops[1]);
                const size = ops[0].size || ops[1].size || 4;
                const borrow = this.cpu.flags.CF;
                const res = d.val - (s.val + borrow);
                this.cpu.updateSubFlags(d.val, s.val + borrow, res, size);
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'INC': {
                const d = this.evalOperand(ops[0]);
                const size = ops[0].size || 4;
                const prevCF = this.cpu.flags.CF; // INC does not modify CF in x86
                const res = d.val + 1;
                this.cpu.updateAddFlags(d.val, 1, res, size);
                this.cpu.flags.CF = prevCF;
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'DEC': {
                const d = this.evalOperand(ops[0]);
                const size = ops[0].size || 4;
                const prevCF = this.cpu.flags.CF; // DEC does not modify CF in x86
                const res = d.val - 1;
                this.cpu.updateSubFlags(d.val, 1, res, size);
                this.cpu.flags.CF = prevCF;
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'NEG': {
                const d = this.evalOperand(ops[0]);
                const size = ops[0].size || 4;
                const res = 0 - d.val;
                this.cpu.updateSubFlags(0, d.val, res, size);
                this.cpu.flags.CF = (d.val !== 0) ? 1 : 0;
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'MUL': {
                const s = this.evalOperand(ops[0]);
                const size = ops[0].size || 4;
                if (size === 1) {
                    const res = (this.cpu.getReg('AL') * (s.val & 0xFF)) >>> 0;
                    this.cpu.setReg('AX', res);
                    const overflow = (res > 0xFF);
                    this.cpu.flags.CF = overflow ? 1 : 0;
                    this.cpu.flags.OF = overflow ? 1 : 0;
                } else if (size === 2) {
                    const res = (this.cpu.getReg('AX') * (s.val & 0xFFFF)) >>> 0;
                    this.cpu.setReg('AX', res & 0xFFFF);
                    this.cpu.setReg('DX', (res >> 16) & 0xFFFF);
                    const overflow = ((res >> 16) !== 0);
                    this.cpu.flags.CF = overflow ? 1 : 0;
                    this.cpu.flags.OF = overflow ? 1 : 0;
                } else {
                    const a = BigInt(this.cpu.getReg('EAX'));
                    const b = BigInt(s.val >>> 0);
                    const res = a * b;
                    const low = Number(res & 0xFFFFFFFFn);
                    const high = Number((res >> 32n) & 0xFFFFFFFFn);
                    this.cpu.setReg('EAX', low);
                    this.cpu.setReg('EDX', high);
                    const overflow = (high !== 0);
                    this.cpu.flags.CF = overflow ? 1 : 0;
                    this.cpu.flags.OF = overflow ? 1 : 0;
                }
                break;
            }

            case 'IMUL': {
                // Supports 1-operand, 2-operand, and 3-operand forms
                if (ops.length === 1) {
                    const s = this.evalOperand(ops[0]);
                    const size = ops[0].size || 4;
                    if (size === 1) {
                        const a = (this.cpu.getReg('AL') << 24) >> 24;
                        const b = (s.val << 24) >> 24;
                        const res = a * b;
                        this.cpu.setReg('AX', res & 0xFFFF);
                        const overflow = (res < -128 || res > 127);
                        this.cpu.flags.CF = overflow ? 1 : 0;
                        this.cpu.flags.OF = overflow ? 1 : 0;
                    } else if (size === 2) {
                        const a = (this.cpu.getReg('AX') << 16) >> 16;
                        const b = (s.val << 16) >> 16;
                        const res = a * b;
                        this.cpu.setReg('AX', res & 0xFFFF);
                        this.cpu.setReg('DX', (res >> 16) & 0xFFFF);
                        const overflow = (res < -32768 || res > 32767);
                        this.cpu.flags.CF = overflow ? 1 : 0;
                        this.cpu.flags.OF = overflow ? 1 : 0;
                    } else {
                        const a = BigInt(this.cpu.getRegSigned('EAX'));
                        const b = BigInt((s.val | 0));
                        const res = a * b;
                        const low = Number(res & 0xFFFFFFFFn);
                        const high = Number((res >> 32n) & 0xFFFFFFFFn);
                        this.cpu.setReg('EAX', low);
                        this.cpu.setReg('EDX', high);
                        const overflow = (res < -2147483648n || res > 2147483647n);
                        this.cpu.flags.CF = overflow ? 1 : 0;
                        this.cpu.flags.OF = overflow ? 1 : 0;
                    }
                } else if (ops.length === 2) {
                    // imul reg, reg/mem/imm
                    const d = this.evalOperand(ops[0]);
                    const s = this.evalOperand(ops[1]);
                    const res = (d.val | 0) * (s.val | 0);
                    this.writeOperand(ops[0], res, ops[0].size || 4);
                } else if (ops.length === 3) {
                    // imul reg, reg/mem, imm
                    const s = this.evalOperand(ops[1]);
                    const imm = this.evalOperand(ops[2]);
                    const res = (s.val | 0) * (imm.val | 0);
                    this.writeOperand(ops[0], res, ops[0].size || 4);
                }
                break;
            }

            case 'DIV': {
                const s = this.evalOperand(ops[0]);
                const size = ops[0].size || 4;
                if (s.val === 0) throw new Error('Divide by zero exception');

                if (size === 1) {
                    const dividend = this.cpu.getReg('AX');
                    const quot = Math.floor(dividend / (s.val & 0xFF));
                    const rem = dividend % (s.val & 0xFF);
                    this.cpu.setReg('AL', quot & 0xFF);
                    this.cpu.setReg('AH', rem & 0xFF);
                } else if (size === 2) {
                    const dividend = ((this.cpu.getReg('DX') << 16) | this.cpu.getReg('AX')) >>> 0;
                    const divisor = s.val & 0xFFFF;
                    const quot = Math.floor(dividend / divisor);
                    const rem = dividend % divisor;
                    this.cpu.setReg('AX', quot & 0xFFFF);
                    this.cpu.setReg('DX', rem & 0xFFFF);
                } else {
                    const dividend = (BigInt(this.cpu.getReg('EDX')) << 32n) | BigInt(this.cpu.getReg('EAX'));
                    const divisor = BigInt(s.val >>> 0);
                    const quot = dividend / divisor;
                    const rem = dividend % divisor;
                    this.cpu.setReg('EAX', Number(quot & 0xFFFFFFFFn));
                    this.cpu.setReg('EDX', Number(rem & 0xFFFFFFFFn));
                }
                break;
            }

            case 'IDIV': {
                const s = this.evalOperand(ops[0]);
                const size = ops[0].size || 4;
                if (s.val === 0) throw new Error('Divide by zero exception');

                if (size === 1) {
                    const dividend = (this.cpu.getReg('AX') << 16) >> 16;
                    const divisor = (s.val << 24) >> 24;
                    const quot = Math.trunc(dividend / divisor);
                    const rem = dividend % divisor;
                    this.cpu.setReg('AL', quot & 0xFF);
                    this.cpu.setReg('AH', rem & 0xFF);
                } else if (size === 2) {
                    const dividend = (this.cpu.getReg('DX') << 16) | this.cpu.getReg('AX');
                    const divisor = (s.val << 16) >> 16;
                    const quot = Math.trunc(dividend / divisor);
                    const rem = dividend % divisor;
                    this.cpu.setReg('AX', quot & 0xFFFF);
                    this.cpu.setReg('DX', rem & 0xFFFF);
                } else {
                    const dividend = (BigInt((this.cpu.getReg('EDX') | 0)) << 32n) | BigInt(this.cpu.getReg('EAX'));
                    const divisor = BigInt(s.val | 0);
                    const quot = dividend / divisor;
                    const rem = dividend % divisor;
                    this.cpu.setReg('EAX', Number(quot & 0xFFFFFFFFn));
                    this.cpu.setReg('EDX', Number(rem & 0xFFFFFFFFn));
                }
                break;
            }

            case 'AND': {
                const d = this.evalOperand(ops[0]);
                const s = this.evalOperand(ops[1]);
                const size = ops[0].size || 4;
                const res = (d.val & s.val) >>> 0;
                this.cpu.updateLogicFlags(res, size);
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'OR': {
                const d = this.evalOperand(ops[0]);
                const s = this.evalOperand(ops[1]);
                const size = ops[0].size || 4;
                const res = (d.val | s.val) >>> 0;
                this.cpu.updateLogicFlags(res, size);
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'XOR': {
                const d = this.evalOperand(ops[0]);
                const s = this.evalOperand(ops[1]);
                const size = ops[0].size || 4;
                const res = (d.val ^ s.val) >>> 0;
                this.cpu.updateLogicFlags(res, size);
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'NOT': {
                const d = this.evalOperand(ops[0]);
                const size = ops[0].size || 4;
                const mask = size === 1 ? 0xFF : (size === 2 ? 0xFFFF : 0xFFFFFFFF);
                const res = (~d.val) & mask;
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'TEST': {
                const d = this.evalOperand(ops[0]);
                const s = this.evalOperand(ops[1]);
                const size = ops[0].size || 4;
                const res = (d.val & s.val) >>> 0;
                this.cpu.updateLogicFlags(res, size);
                break;
            }

            case 'CMP': {
                const d = this.evalOperand(ops[0]);
                const s = this.evalOperand(ops[1]);
                const size = ops[0].size || ops[1].size || 4;
                const res = d.val - s.val;
                this.cpu.updateSubFlags(d.val, s.val, res, size);
                break;
            }

            case 'SHL':
            case 'SAL': {
                const d = this.evalOperand(ops[0]);
                const count = (this.evalOperand(ops[1]).val & 0x1F);
                const size = ops[0].size || 4;
                const mask = size === 1 ? 0xFF : (size === 2 ? 0xFFFF : 0xFFFFFFFF);
                if (count > 0) {
                    const topBitShift = (size * 8) - count;
                    const carry = (topBitShift >= 0) ? ((d.val >> topBitShift) & 1) : 0;
                    const res = (d.val << count) & mask;
                    this.cpu.flags.CF = carry;
                    this.cpu.updateParityFlag(res);
                    this.cpu.flags.ZF = (res === 0) ? 1 : 0;
                    this.cpu.flags.SF = (res & (1 << ((size * 8) - 1))) ? 1 : 0;
                    this.writeOperand(ops[0], res, size);
                }
                break;
            }

            case 'SHR': {
                const d = this.evalOperand(ops[0]);
                const count = (this.evalOperand(ops[1]).val & 0x1F);
                const size = ops[0].size || 4;
                if (count > 0) {
                    const carry = (d.val >> (count - 1)) & 1;
                    const res = (d.val >>> count);
                    this.cpu.flags.CF = carry;
                    this.cpu.updateParityFlag(res);
                    this.cpu.flags.ZF = (res === 0) ? 1 : 0;
                    this.cpu.flags.SF = 0;
                    this.writeOperand(ops[0], res, size);
                }
                break;
            }

            case 'SAR': {
                const d = this.evalOperand(ops[0]);
                const count = (this.evalOperand(ops[1]).val & 0x1F);
                const size = ops[0].size || 4;
                let sVal = d.val;
                if (size === 1) sVal = (d.val << 24) >> 24;
                else if (size === 2) sVal = (d.val << 16) >> 16;
                else sVal = d.val | 0;

                if (count > 0) {
                    const carry = (sVal >> (count - 1)) & 1;
                    const res = (sVal >> count) & (size === 1 ? 0xFF : (size === 2 ? 0xFFFF : 0xFFFFFFFF));
                    this.cpu.flags.CF = carry;
                    this.cpu.updateParityFlag(res);
                    this.cpu.flags.ZF = (res === 0) ? 1 : 0;
                    this.cpu.flags.SF = (res & (1 << ((size * 8) - 1))) ? 1 : 0;
                    this.writeOperand(ops[0], res, size);
                }
                break;
            }

            case 'ROL': {
                const d = this.evalOperand(ops[0]);
                const count = (this.evalOperand(ops[1]).val & 0x1F);
                const size = ops[0].size || 4;
                const bits = size * 8;
                const mask = size === 1 ? 0xFF : (size === 2 ? 0xFFFF : 0xFFFFFFFF);
                const shift = count % bits;
                const res = ((d.val << shift) | (d.val >>> (bits - shift))) & mask;
                this.cpu.flags.CF = res & 1;
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'ROR': {
                const d = this.evalOperand(ops[0]);
                const count = (this.evalOperand(ops[1]).val & 0x1F);
                const size = ops[0].size || 4;
                const bits = size * 8;
                const mask = size === 1 ? 0xFF : (size === 2 ? 0xFFFF : 0xFFFFFFFF);
                const shift = count % bits;
                const res = ((d.val >>> shift) | (d.val << (bits - shift))) & mask;
                this.cpu.flags.CF = (res >> (bits - 1)) & 1;
                this.writeOperand(ops[0], res, size);
                break;
            }

            case 'PUSH': {
                const s = this.evalOperand(ops[0]);
                this.cpu.push(s.val, ops[0].size || 4);
                break;
            }

            case 'POP': {
                const val = this.cpu.pop(ops[0].size || 4);
                this.writeOperand(ops[0], val, ops[0].size || 4);
                break;
            }

            case 'PUSHFD': {
                this.cpu.push(this.cpu.getEFlagsDword(), 4);
                break;
            }

            case 'POPFD': {
                const efl = this.cpu.pop(4);
                this.cpu.setEFlagsDword(efl);
                break;
            }

            case 'PUSHAD': {
                const tempESP = this.cpu.regs.ESP;
                this.cpu.push(this.cpu.regs.EAX);
                this.cpu.push(this.cpu.regs.ECX);
                this.cpu.push(this.cpu.regs.EDX);
                this.cpu.push(this.cpu.regs.EBX);
                this.cpu.push(tempESP);
                this.cpu.push(this.cpu.regs.EBP);
                this.cpu.push(this.cpu.regs.ESI);
                this.cpu.push(this.cpu.regs.EDI);
                break;
            }

            case 'POPAD': {
                this.cpu.setReg('EDI', this.cpu.pop());
                this.cpu.setReg('ESI', this.cpu.pop());
                this.cpu.setReg('EBP', this.cpu.pop());
                this.cpu.pop(); // discard original ESP
                this.cpu.setReg('EBX', this.cpu.pop());
                this.cpu.setReg('EDX', this.cpu.pop());
                this.cpu.setReg('ECX', this.cpu.pop());
                this.cpu.setReg('EAX', this.cpu.pop());
                break;
            }

            // JUMPS & CONTROL FLOW
            case 'JMP': {
                this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JE':
            case 'JZ': {
                if (this.cpu.flags.ZF === 1) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JNE':
            case 'JNZ': {
                if (this.cpu.flags.ZF === 0) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JG':
            case 'JNLE': {
                if (this.cpu.flags.ZF === 0 && this.cpu.flags.SF === this.cpu.flags.OF) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JGE':
            case 'JNL': {
                if (this.cpu.flags.SF === this.cpu.flags.OF) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JL':
            case 'JNGE': {
                if (this.cpu.flags.SF !== this.cpu.flags.OF) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JLE':
            case 'JNG': {
                if (this.cpu.flags.ZF === 1 || this.cpu.flags.SF !== this.cpu.flags.OF) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JA':
            case 'JNBE': {
                if (this.cpu.flags.CF === 0 && this.cpu.flags.ZF === 0) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JAE':
            case 'JNB':
            case 'JNC': {
                if (this.cpu.flags.CF === 0) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JB':
            case 'JNAE':
            case 'JC': {
                if (this.cpu.flags.CF === 1) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JBE':
            case 'JNA': {
                if (this.cpu.flags.CF === 1 || this.cpu.flags.ZF === 1) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JS': {
                if (this.cpu.flags.SF === 1) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JNS': {
                if (this.cpu.flags.SF === 0) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JO': {
                if (this.cpu.flags.OF === 1) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JNO': {
                if (this.cpu.flags.OF === 0) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JP':
            case 'JPE': {
                if (this.cpu.flags.PF === 1) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'JNP':
            case 'JPO': {
                if (this.cpu.flags.PF === 0) this.jumpToLabel(ops[0].name);
                break;
            }

            case 'LOOP': {
                let ecx = this.cpu.regs.ECX - 1;
                this.cpu.setReg('ECX', ecx);
                if (ecx > 0) {
                    this.jumpToLabel(ops[0].name);
                }
                break;
            }

            case 'LOOPZ':
            case 'LOOPE': {
                let ecx = this.cpu.regs.ECX - 1;
                this.cpu.setReg('ECX', ecx);
                if (ecx > 0 && this.cpu.flags.ZF === 1) {
                    this.jumpToLabel(ops[0].name);
                }
                break;
            }

            case 'LOOPNZ':
            case 'LOOPNE': {
                let ecx = this.cpu.regs.ECX - 1;
                this.cpu.setReg('ECX', ecx);
                if (ecx > 0 && this.cpu.flags.ZF === 0) {
                    this.jumpToLabel(ops[0].name);
                }
                break;
            }

            case 'JECXZ': {
                if (this.cpu.regs.ECX === 0) this.jumpToLabel(ops[0].name);
                break;
            }

            // CALL & RET
            case 'CALL': {
                const targetName = ops[0].name;
                // Check if Irvine32 function
                const isIrvine = [
                    'DUMPREGS', 'DUMPMEM', 'WRITESTRING', 'WRITEINT', 'WRITEDEC', 'WRITEHEX', 'WRITEBIN',
                    'WRITECHAR', 'CRLF', 'CLRSCR', 'READINT', 'READDEC', 'READHEX', 'READCHAR', 'READSTRING',
                    'RANDOMIZE', 'RANDOMRANGE', 'RANDOM32', 'WAITMSG', 'DELAY', 'SETTEXTCOLOR', 'GOTOXY',
                    'STRLENGTH', 'STRCOPY', 'STRCOMPARE'
                ].includes(targetName);

                if (isIrvine) {
                    await this.irvine.executeProcedure(targetName);
                } else {
                    // User defined procedure or label
                    const targetIdx = this.labels[targetName];
                    if (targetIdx === undefined) throw new Error(`Undefined procedure or label: ${targetName}`);
                    this.cpu.push(this.cpu.regs.EIP); // Push return address
                    this.cpu.callStack.push(this.cpu.regs.EIP);
                    this.cpu.regs.EIP = this.codeBase + (targetIdx * 4);
                }
                break;
            }

            case 'RET': {
                if (this.cpu.callStack.length > 0) {
                    this.cpu.callStack.pop();
                    const retAddr = this.cpu.pop();
                    this.cpu.regs.EIP = retAddr;
                } else {
                    // Ret from main terminates program
                    this.cpu.isHalted = true;
                }
                break;
            }

            default:
                throw new Error(`Unsupported x86 instruction: ${m}`);
        }
    }

    jumpToLabel(labelName) {
        const targetIdx = this.labels[labelName];
        if (targetIdx === undefined) throw new Error(`Jump to undefined label: ${labelName}`);
        this.cpu.regs.EIP = this.codeBase + (targetIdx * 4);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MasmParser;
}
