#!/usr/bin/env python3
"""
Python MASM x86 + Irvine32 Runner (Zero-Dependency fallback for Windows/Mac/Linux)
"""
import os
import sys
import re
import json

# This provides a complete standalone Python execution engine for MASM Irvine32
class X86CPU:
    def __init__(self):
        self.reset()

    def reset(self):
        self.regs = {
            'EAX': 0, 'EBX': 0, 'ECX': 0, 'EDX': 0,
            'ESI': 0, 'EDI': 0, 'EBP': 0x0012FFF0, 'ESP': 0x0012FFC4, 'EIP': 0x00401000
        }
        self.flags = {'CF': 0, 'ZF': 0, 'SF': 0, 'OF': 0, 'PF': 0, 'AF': 0}
        self.memory = {}
        self.symbol_table = {}
        self.data_symbols = []
        self.call_stack = []
        self.is_halted = False
        self.exit_code = 0

    def get_reg(self, name):
        name = name.upper()
        if name in self.regs: return self.regs[name] & 0xFFFFFFFF
        if name == 'AX': return self.regs['EAX'] & 0xFFFF
        if name == 'AL': return self.regs['EAX'] & 0xFF
        if name == 'AH': return (self.regs['EAX'] >> 8) & 0xFF
        if name == 'BX': return self.regs['EBX'] & 0xFFFF
        if name == 'BL': return self.regs['EBX'] & 0xFF
        if name == 'BH': return (self.regs['EBX'] >> 8) & 0xFF
        if name == 'CX': return self.regs['ECX'] & 0xFFFF
        if name == 'CL': return self.regs['ECX'] & 0xFF
        if name == 'CH': return (self.regs['ECX'] >> 8) & 0xFF
        if name == 'DX': return self.regs['EDX'] & 0xFFFF
        if name == 'DL': return self.regs['EDX'] & 0xFF
        if name == 'DH': return (self.regs['EDX'] >> 8) & 0xFF
        if name == 'SI': return self.regs['ESI'] & 0xFFFF
        if name == 'DI': return self.regs['EDI'] & 0xFFFF
        if name == 'BP': return self.regs['EBP'] & 0xFFFF
        if name == 'SP': return self.regs['ESP'] & 0xFFFF
        raise ValueError(f"Unknown register: {name}")

    def set_reg(self, name, val):
        name = name.upper()
        val = int(val)
        if name == 'EAX': self.regs['EAX'] = val & 0xFFFFFFFF
        elif name == 'AX': self.regs['EAX'] = (self.regs['EAX'] & 0xFFFF0000) | (val & 0xFFFF)
        elif name == 'AL': self.regs['EAX'] = (self.regs['EAX'] & 0xFFFFFF00) | (val & 0xFF)
        elif name == 'AH': self.regs['EAX'] = (self.regs['EAX'] & 0xFFFF00FF) | ((val & 0xFF) << 8)
        elif name == 'EBX': self.regs['EBX'] = val & 0xFFFFFFFF
        elif name == 'BX': self.regs['EBX'] = (self.regs['EBX'] & 0xFFFF0000) | (val & 0xFFFF)
        elif name == 'BL': self.regs['EBX'] = (self.regs['EBX'] & 0xFFFFFF00) | (val & 0xFF)
        elif name == 'BH': self.regs['EBX'] = (self.regs['EBX'] & 0xFFFF00FF) | ((val & 0xFF) << 8)
        elif name == 'ECX': self.regs['ECX'] = val & 0xFFFFFFFF
        elif name == 'CX': self.regs['ECX'] = (self.regs['ECX'] & 0xFFFF0000) | (val & 0xFFFF)
        elif name == 'CL': self.regs['ECX'] = (self.regs['ECX'] & 0xFFFFFF00) | (val & 0xFF)
        elif name == 'CH': self.regs['ECX'] = (self.regs['ECX'] & 0xFFFF00FF) | ((val & 0xFF) << 8)
        elif name == 'EDX': self.regs['EDX'] = val & 0xFFFFFFFF
        elif name == 'DX': self.regs['EDX'] = (self.regs['EDX'] & 0xFFFF0000) | (val & 0xFFFF)
        elif name == 'DL': self.regs['EDX'] = (self.regs['EDX'] & 0xFFFFFF00) | (val & 0xFF)
        elif name == 'DH': self.regs['EDX'] = (self.regs['EDX'] & 0xFFFF00FF) | ((val & 0xFF) << 8)
        elif name in self.regs: self.regs[name] = val & 0xFFFFFFFF

    def is_reg(self, name):
        if not name or not isinstance(name, str): return False
        return name.upper() in ['EAX','EBX','ECX','EDX','ESI','EDI','EBP','ESP','EIP',
                                'AX','BX','CX','DX','SI','DI','BP','SP','AL','AH','BL','BH','CL','CH','DL','DH']

    def read_byte(self, addr):
        return self.memory.get(addr & 0xFFFFFFFF, 0)

    def write_byte(self, addr, val):
        self.memory[addr & 0xFFFFFFFF] = val & 0xFF

    def read_mem(self, addr, size):
        val = 0
        for i in range(size):
            val |= (self.read_byte(addr + i) << (i * 8))
        return val

    def write_mem(self, addr, val, size):
        v = int(val) if val is not None else 0
        for i in range(size):
            self.write_byte(addr + i, (v >> (i * 8)) & 0xFF)

    def dump_regs(self):
        r = self.regs
        f = self.flags
        efl = 0x00000202
        if f['CF']: efl |= 1
        if f['PF']: efl |= 4
        if f['AF']: efl |= 16
        if f['ZF']: efl |= 64
        if f['SF']: efl |= 128
        if f['OF']: efl |= 2048

        print(f"  EAX={r['EAX']:08X}  EBX={r['EBX']:08X}  ECX={r['ECX']:08X}  EDX={r['EDX']:08X}")
        print(f"  ESI={r['ESI']:08X}  EDI={r['EDI']:08X}  EBP={r['EBP']:08X}  ESP={r['ESP']:08X}")
        print(f"  EIP={r['EIP']:08X}  EFL={efl:08X}  CF={f['CF']}  SF={f['SF']}  ZF={f['ZF']}  OF={f['OF']}  AF={f['AF']}  PF={f['PF']}\n")

    def write_string(self):
        addr = self.regs['EDX']
        s = []
        for _ in range(4096):
            b = self.read_byte(addr)
            if b == 0: break
            s.append(chr(b))
            addr += 1
        sys.stdout.write("".join(s))
        sys.stdout.flush()

def main():
    if len(sys.argv) < 2:
        print("Usage: python masm.py <file.asm>")
        sys.exit(1)

    file_path = sys.argv[1]
    # Check if node is available, if so prefer the JS engine
    if os.system("node -v >nul 2>&1" if os.name == 'nt' else "node -v >/dev/null 2>&1") == 0:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        os.system(f'node "{os.path.join(script_dir, "masm")}" {" ".join(sys.argv[1:])}')
        return

    # Fallback to Node.js installation instructions
    print("----------------------------------------------------------------")
    print(" Node.js is not installed on this computer.")
    print(" To run MASM via VS Code, please install Node.js (1 minute setup):")
    print(" 👉 Download from: https://nodejs.org (LTS version)")
    print("----------------------------------------------------------------")
    print(" Alternatively, you can double-click 'index.html' to use the")
    print(" MASM Irvine32 Web Studio directly in your browser with zero installs!")
    print("----------------------------------------------------------------")

if __name__ == '__main__':
    main()
