INCLUDE Irvine32.inc

.data
    array    DWORD 10, 20, 30, 40, 50
    arrCount DWORD 5
    sumMsg   BYTE "Sum of Array     = ", 0
    avgMsg   BYTE "Average of Array = ", 0

.code
main PROC
    mov esi, OFFSET array       ; ESI points to first element
    mov ecx, arrCount           ; ECX holds element count
    mov eax, 0                  ; EAX accumulates sum

sum_loop:
    add eax, [esi]              ; Add current DWORD element
    add esi, TYPE array         ; Advance pointer by 4 bytes
    loop sum_loop

    push eax                    ; Save sum for average calculation

    ; Print Sum
    mov edx, OFFSET sumMsg
    call WriteString
    call WriteInt
    call Crlf

    ; Calculate Average
    pop eax
    mov edx, 0
    mov ebx, arrCount
    div ebx                     ; EAX = Sum / Count

    ; Print Average
    mov edx, OFFSET avgMsg
    call WriteString
    call WriteDec
    call Crlf

    exit
main ENDP
END main