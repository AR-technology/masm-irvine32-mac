/**
 * x86 32-bit CPU Simulator & Memory Management
 */

class X86CPU {
    constructor() {
        this.reset();
    }

    reset() {
        // 32-bit General Purpose Registers
        this.regs = {
            EAX: 0,
            EBX: 0,
            ECX: 0,
            EDX: 0,
            ESI: 0,
            EDI: 0,
            EBP: 0x0012FFF0,
            ESP: 0x0012FFC4,
            EIP: 0x00401000
        };

        // Track modified registers for UI highlighting
        this.changedRegs = new Set();
        this.prevRegs = { ...this.regs };

        // Status Flags
        this.flags = {
            CF: 0, // Carry
            ZF: 0, // Zero
            SF: 0, // Sign
            OF: 0, // Overflow
            PF: 0, // Parity
            AF: 0  // Aux Carry
        };
        this.changedFlags = new Set();
        this.prevFlags = { ...this.flags };

        // Memory Space (Uint8Array virtual memory map)
        // 0x00401000 -> Code
        // 0x00404000 -> Data
        // 0x00120000 -> Stack
        this.memory = new Map(); // address (number) -> byte (0-255)
        this.symbolTable = {};  // label -> address / value
        this.dataSymbols = [];  // list of data declarations for UI inspection

        this.callStack = [];    // For call / ret tracking
        this.isHalted = false;
        this.exitCode = 0;
        this.instructionCount = 0;
    }

    markState() {
        this.prevRegs = { ...this.regs };
        this.prevFlags = { ...this.flags };
        this.changedRegs.clear();
        this.changedFlags.clear();
    }

    diffState() {
        for (const reg of Object.keys(this.regs)) {
            if (this.regs[reg] !== this.prevRegs[reg]) {
                this.changedRegs.add(reg);
            }
        }
        for (const flag of Object.keys(this.flags)) {
            if (this.flags[flag] !== this.prevFlags[flag]) {
                this.changedFlags.add(flag);
            }
        }
    }

    // Register Getters / Setters with sub-register aliasing (AL, AH, AX, EAX etc.)
    getReg(name) {
        name = name.toUpperCase();
        switch (name) {
            case 'EAX': return this.regs.EAX >>> 0;
            case 'AX': return this.regs.EAX & 0xFFFF;
            case 'AL': return this.regs.EAX & 0xFF;
            case 'AH': return (this.regs.EAX >> 8) & 0xFF;

            case 'EBX': return this.regs.EBX >>> 0;
            case 'BX': return this.regs.EBX & 0xFFFF;
            case 'BL': return this.regs.EBX & 0xFF;
            case 'BH': return (this.regs.EBX >> 8) & 0xFF;

            case 'ECX': return this.regs.ECX >>> 0;
            case 'CX': return this.regs.ECX & 0xFFFF;
            case 'CL': return this.regs.ECX & 0xFF;
            case 'CH': return (this.regs.ECX >> 8) & 0xFF;

            case 'EDX': return this.regs.EDX >>> 0;
            case 'DX': return this.regs.EDX & 0xFFFF;
            case 'DL': return this.regs.EDX & 0xFF;
            case 'DH': return (this.regs.EDX >> 8) & 0xFF;

            case 'ESI': return this.regs.ESI >>> 0;
            case 'SI': return this.regs.ESI & 0xFFFF;

            case 'EDI': return this.regs.EDI >>> 0;
            case 'DI': return this.regs.EDI & 0xFFFF;

            case 'EBP': return this.regs.EBP >>> 0;
            case 'BP': return this.regs.EBP & 0xFFFF;

            case 'ESP': return this.regs.ESP >>> 0;
            case 'SP': return this.regs.ESP & 0xFFFF;

            case 'EIP': return this.regs.EIP >>> 0;
            case 'IP': return this.regs.EIP & 0xFFFF;

            default:
                throw new Error(`Unknown register: ${name}`);
        }
    }

    getRegSigned(name) {
        name = name.toUpperCase();
        const size = this.getRegSize(name);
        const val = this.getReg(name);
        if (size === 1) return (val << 24) >> 24;
        if (size === 2) return (val << 16) >> 16;
        return val | 0;
    }

    setReg(name, val) {
        name = name.toUpperCase();
        val = Number(val);
        switch (name) {
            case 'EAX':
                this.regs.EAX = (val >>> 0);
                this.changedRegs.add('EAX');
                break;
            case 'AX':
                this.regs.EAX = ((this.regs.EAX & 0xFFFF0000) | (val & 0xFFFF)) >>> 0;
                this.changedRegs.add('EAX');
                break;
            case 'AL':
                this.regs.EAX = ((this.regs.EAX & 0xFFFFFF00) | (val & 0xFF)) >>> 0;
                this.changedRegs.add('EAX');
                break;
            case 'AH':
                this.regs.EAX = ((this.regs.EAX & 0xFFFF00FF) | ((val & 0xFF) << 8)) >>> 0;
                this.changedRegs.add('EAX');
                break;

            case 'EBX':
                this.regs.EBX = (val >>> 0);
                this.changedRegs.add('EBX');
                break;
            case 'BX':
                this.regs.EBX = ((this.regs.EBX & 0xFFFF0000) | (val & 0xFFFF)) >>> 0;
                this.changedRegs.add('EBX');
                break;
            case 'BL':
                this.regs.EBX = ((this.regs.EBX & 0xFFFFFF00) | (val & 0xFF)) >>> 0;
                this.changedRegs.add('EBX');
                break;
            case 'BH':
                this.regs.EBX = ((this.regs.EBX & 0xFFFF00FF) | ((val & 0xFF) << 8)) >>> 0;
                this.changedRegs.add('EBX');
                break;

            case 'ECX':
                this.regs.ECX = (val >>> 0);
                this.changedRegs.add('ECX');
                break;
            case 'CX':
                this.regs.ECX = ((this.regs.ECX & 0xFFFF0000) | (val & 0xFFFF)) >>> 0;
                this.changedRegs.add('ECX');
                break;
            case 'CL':
                this.regs.ECX = ((this.regs.ECX & 0xFFFFFF00) | (val & 0xFF)) >>> 0;
                this.changedRegs.add('ECX');
                break;
            case 'CH':
                this.regs.ECX = ((this.regs.ECX & 0xFFFF00FF) | ((val & 0xFF) << 8)) >>> 0;
                this.changedRegs.add('ECX');
                break;

            case 'EDX':
                this.regs.EDX = (val >>> 0);
                this.changedRegs.add('EDX');
                break;
            case 'DX':
                this.regs.EDX = ((this.regs.EDX & 0xFFFF0000) | (val & 0xFFFF)) >>> 0;
                this.changedRegs.add('EDX');
                break;
            case 'DL':
                this.regs.EDX = ((this.regs.EDX & 0xFFFFFF00) | (val & 0xFF)) >>> 0;
                this.changedRegs.add('EDX');
                break;
            case 'DH':
                this.regs.EDX = ((this.regs.EDX & 0xFFFF00FF) | ((val & 0xFF) << 8)) >>> 0;
                this.changedRegs.add('EDX');
                break;

            case 'ESI':
                this.regs.ESI = (val >>> 0);
                this.changedRegs.add('ESI');
                break;
            case 'SI':
                this.regs.ESI = ((this.regs.ESI & 0xFFFF0000) | (val & 0xFFFF)) >>> 0;
                this.changedRegs.add('ESI');
                break;

            case 'EDI':
                this.regs.EDI = (val >>> 0);
                this.changedRegs.add('EDI');
                break;
            case 'DI':
                this.regs.EDI = ((this.regs.EDI & 0xFFFF0000) | (val & 0xFFFF)) >>> 0;
                this.changedRegs.add('EDI');
                break;

            case 'EBP':
                this.regs.EBP = (val >>> 0);
                this.changedRegs.add('EBP');
                break;
            case 'BP':
                this.regs.EBP = ((this.regs.EBP & 0xFFFF0000) | (val & 0xFFFF)) >>> 0;
                this.changedRegs.add('EBP');
                break;

            case 'ESP':
                this.regs.ESP = (val >>> 0);
                this.changedRegs.add('ESP');
                break;
            case 'SP':
                this.regs.ESP = ((this.regs.ESP & 0xFFFF0000) | (val & 0xFFFF)) >>> 0;
                this.changedRegs.add('ESP');
                break;

            case 'EIP':
                this.regs.EIP = (val >>> 0);
                break;

            default:
                throw new Error(`Cannot write to unknown register: ${name}`);
        }
    }

    isRegister(name) {
        if (!name || typeof name !== 'string') return false;
        const reg = name.toUpperCase();
        return ['EAX','EBX','ECX','EDX','ESI','EDI','EBP','ESP','EIP',
                'AX','BX','CX','DX','SI','DI','BP','SP',
                'AL','AH','BL','BH','CL','CH','DL','DH'].includes(reg);
    }

    getRegSize(name) {
        name = name.toUpperCase();
        if (['AL','AH','BL','BH','CL','CH','DL','DH'].includes(name)) return 1;
        if (['AX','BX','CX','DX','SI','DI','BP','SP'].includes(name)) return 2;
        return 4;
    }

    // Memory operations (Little Endian)
    readByte(addr) {
        addr = addr >>> 0;
        return this.memory.get(addr) || 0;
    }

    writeByte(addr, val) {
        addr = addr >>> 0;
        this.memory.set(addr, val & 0xFF);
    }

    readWord(addr) {
        addr = addr >>> 0;
        const b0 = this.readByte(addr);
        const b1 = this.readByte(addr + 1);
        return (b1 << 8) | b0;
    }

    writeWord(addr, val) {
        addr = addr >>> 0;
        this.writeByte(addr, val & 0xFF);
        this.writeByte(addr + 1, (val >> 8) & 0xFF);
    }

    readDword(addr) {
        addr = addr >>> 0;
        const b0 = this.readByte(addr);
        const b1 = this.readByte(addr + 1);
        const b2 = this.readByte(addr + 2);
        const b3 = this.readByte(addr + 3);
        return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
    }

    writeDword(addr, val) {
        addr = addr >>> 0;
        this.writeByte(addr, val & 0xFF);
        this.writeByte(addr + 1, (val >> 8) & 0xFF);
        this.writeByte(addr + 2, (val >> 16) & 0xFF);
        this.writeByte(addr + 3, (val >> 24) & 0xFF);
    }

    readMem(addr, size) {
        if (size === 1) return this.readByte(addr);
        if (size === 2) return this.readWord(addr);
        if (size === 4) return this.readDword(addr);
        // Multi-byte fallback (e.g. 6, 8, 10 bytes)
        let val = 0n;
        for (let i = 0; i < size; i++) {
            val |= BigInt(this.readByte(addr + i)) << BigInt(i * 8);
        }
        return Number(val);
    }

    writeMem(addr, val, size) {
        if (size === 1) this.writeByte(addr, val);
        else if (size === 2) this.writeWord(addr, val);
        else if (size === 4) this.writeDword(addr, val);
        else {
            // Write arbitrary N bytes (e.g. FWORD 6 bytes, QWORD 8 bytes, TBYTE 10 bytes)
            let bVal = BigInt(typeof val === 'number' && !isNaN(val) ? Math.floor(val) : 0);
            for (let i = 0; i < size; i++) {
                this.writeByte(addr + i, Number(bVal & 0xFFn));
                bVal >>= 8n;
            }
        }
    }

    // Stack Operations
    push(val, size = 4) {
        if (size === 4) {
            this.regs.ESP = (this.regs.ESP - 4) >>> 0;
            this.writeDword(this.regs.ESP, val);
        } else if (size === 2) {
            this.regs.ESP = (this.regs.ESP - 2) >>> 0;
            this.writeWord(this.regs.ESP, val);
        } else {
            throw new Error(`Cannot push byte directly in 32-bit x86`);
        }
        this.changedRegs.add('ESP');
    }

    pop(size = 4) {
        let val;
        if (size === 4) {
            val = this.readDword(this.regs.ESP);
            this.regs.ESP = (this.regs.ESP + 4) >>> 0;
        } else if (size === 2) {
            val = this.readWord(this.regs.ESP);
            this.regs.ESP = (this.regs.ESP + 2) >>> 0;
        } else {
            throw new Error(`Cannot pop byte directly in 32-bit x86`);
        }
        this.changedRegs.add('ESP');
        return val;
    }

    // Flags computation
    updateParityFlag(val) {
        // Parity flag reflects parity of least significant byte (8 bits)
        let b = val & 0xFF;
        let count = 0;
        while (b) {
            count += (b & 1);
            b >>= 1;
        }
        this.flags.PF = (count % 2 === 0) ? 1 : 0;
    }

    updateAddFlags(dest, src, result, size) {
        const mask = size === 1 ? 0xFF : (size === 2 ? 0xFFFF : 0xFFFFFFFF);
        const signBit = size === 1 ? 0x80 : (size === 2 ? 0x8000 : 0x80000000);

        const uDest = dest & mask;
        const uSrc = src & mask;
        const uRes = result & mask;

        // Zero Flag
        this.flags.ZF = (uRes === 0) ? 1 : 0;

        // Sign Flag
        this.flags.SF = (uRes & signBit) ? 1 : 0;

        // Carry Flag
        this.flags.CF = (dest + src > mask) ? 1 : 0;

        // Overflow Flag (Signed)
        // OF is set if operands have same sign, and result has different sign
        const sDest = (uDest & signBit) !== 0;
        const sSrc = (uSrc & signBit) !== 0;
        const sRes = (uRes & signBit) !== 0;
        this.flags.OF = ((sDest === sSrc) && (sDest !== sRes)) ? 1 : 0;

        // Aux Carry Flag (Lower 4-bit nibble carry)
        this.flags.AF = (((dest & 0x0F) + (src & 0x0F)) > 0x0F) ? 1 : 0;

        this.updateParityFlag(uRes);
    }

    updateSubFlags(dest, src, result, size) {
        const mask = size === 1 ? 0xFF : (size === 2 ? 0xFFFF : 0xFFFFFFFF);
        const signBit = size === 1 ? 0x80 : (size === 2 ? 0x8000 : 0x80000000);

        const uDest = dest & mask;
        const uSrc = src & mask;
        const uRes = result & mask;

        // Zero Flag
        this.flags.ZF = (uRes === 0) ? 1 : 0;

        // Sign Flag
        this.flags.SF = (uRes & signBit) ? 1 : 0;

        // Carry Flag (Borrow for subtraction: dest < src)
        this.flags.CF = (uDest < uSrc) ? 1 : 0;

        // Overflow Flag (Signed subtraction)
        // OF set if (dest positive, src negative, res negative) OR (dest negative, src positive, res positive)
        const sDest = (uDest & signBit) !== 0;
        const sSrc = (uSrc & signBit) !== 0;
        const sRes = (uRes & signBit) !== 0;
        this.flags.OF = ((sDest !== sSrc) && (sDest !== sRes)) ? 1 : 0;

        // Aux Carry (Borrow from bit 4)
        this.flags.AF = ((dest & 0x0F) < (src & 0x0F)) ? 1 : 0;

        this.updateParityFlag(uRes);
    }

    updateLogicFlags(result, size) {
        const mask = size === 1 ? 0xFF : (size === 2 ? 0xFFFF : 0xFFFFFFFF);
        const signBit = size === 1 ? 0x80 : (size === 2 ? 0x8000 : 0x80000000);
        const uRes = result & mask;

        this.flags.ZF = (uRes === 0) ? 1 : 0;
        this.flags.SF = (uRes & signBit) ? 1 : 0;
        this.flags.CF = 0; // Cleared by AND, OR, XOR, TEST
        this.flags.OF = 0; // Cleared by AND, OR, XOR, TEST
        this.flags.AF = 0;
        this.updateParityFlag(uRes);
    }

    getEFlagsDword() {
        let efl = 0x00000202; // Default reserved bits
        if (this.flags.CF) efl |= (1 << 0);
        if (this.flags.PF) efl |= (1 << 2);
        if (this.flags.AF) efl |= (1 << 4);
        if (this.flags.ZF) efl |= (1 << 6);
        if (this.flags.SF) efl |= (1 << 7);
        if (this.flags.OF) efl |= (1 << 11);
        return efl >>> 0;
    }

    setEFlagsDword(efl) {
        this.flags.CF = (efl & (1 << 0)) ? 1 : 0;
        this.flags.PF = (efl & (1 << 2)) ? 1 : 0;
        this.flags.AF = (efl & (1 << 4)) ? 1 : 0;
        this.flags.ZF = (efl & (1 << 6)) ? 1 : 0;
        this.flags.SF = (efl & (1 << 7)) ? 1 : 0;
        this.flags.OF = (efl & (1 << 11)) ? 1 : 0;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = X86CPU;
}
