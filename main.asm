INCLUDE Irvine32.inc

.data
    array DWORD 1,2,3,4,5,6,7,8,9

.code
main PROC
    ; 1. Point ESI to the first element (address of array)
    mov esi, OFFSET array
    mov eax, [esi]          ; EAX = 1 (first element)

    ; 2. Point EDI to the last element (offset + size - element_size)
    mov edi, OFFSET array + SIZEOF array - TYPE array
    mov ebx, [edi]          ; EBX = 9 (last element)

    ; 3. Display registers in terminal
    call DumpRegs

    exit
main ENDP
END main