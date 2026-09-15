# ============================================================
# brace_debug.ps1 - 栈式括号诊断（记录未闭合括号的行号）
# 与 brace_check.ps1 同一状态机，但：
#   1) 用 [char]92 正确比较反斜杠（修复 '\\'-as-2-chars 的比较 bug）
#   2) 用栈记录每个未闭合括号的打开行号
# 用法：powershell -File tools\brace_debug.ps1 file1.js file2.js ...
# ============================================================
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Paths)

$BS = [char]92  # 反斜杠

function Get-BraceDebug([string]$file) {
  $raw = Get-Content -LiteralPath $file -Raw -Encoding UTF8
  if ($null -eq $raw) { return 'MISSING  ' + $file }

  $c = $raw.ToCharArray()
  $n = $c.Length
  $i = 0
  $line = 1
  $stack = New-Object System.Collections.Stack   # 每项: @{ ch='{'; line=N }
  $tmplStack = New-Object System.Collections.Stack
  $state = 'code'
  $lastSig = ''
  $word = ''            # 紧邻的标识符，用于区分 return /re/ 与 a / b
  $KEYWORDS = @('return','typeof','instanceof','in','of','new','delete','void',
                'case','do','else','yield','await','throw')

  $open = @{ '{' = '}'; '(' = ')'; '[' = ']' }
  $close = @{ '}' = '{'; ')' = '('; ']' = '[' }

  while ($i -lt $n) {
    $ch  = $c[$i]
    $nx  = if ($i + 1 -lt $n) { $c[$i + 1] } else { [char]0 }
    $chS = [string]$ch   # 关键：哈希表操作必须用 string 键
    if ($ch -eq [char]10) { $line++ }

    if ($state -eq 'code') {
      if ($ch -eq '/' -and $nx -eq '/') { $state = 'line'; $i += 2; continue }
      if ($ch -eq '/' -and $nx -eq '*') { $state = 'block'; $i += 2; continue }
      if ($ch -eq "'") { $state = 'sq'; $i++; continue }
      if ($ch -eq '"') { $state = 'dq'; $i++; continue }
      if ($ch -eq '`') { $state = 'tmpl'; $i++; continue }
      if ($ch -eq '/') {
        # 正则 vs 除号：标识符/./)]"'` 之后是除号；关键词、运算符、( [ { ; , : ! 之后是正则
        $prev = $lastSig
        $isRegex = $true
        if ($prev -match '[A-Za-z0-9_$]') {
          if ($KEYWORDS -notcontains $word) { $isRegex = $false }
        } elseif ($prev -eq '.' -or $prev -eq ')' -or $prev -eq ']' -or
                  $prev -eq "'" -or $prev -eq '"' -or $prev -eq '`') {
          $isRegex = $false
        }
        if ($isRegex) { $state = 'regex'; $i++; continue }
      }
      if ($close.ContainsKey($chS)) {
        if ($chS -eq '}' -and $tmplStack.Count -gt 0) {
          if ($stack.Count -gt 0) { [void]$stack.Pop() }
          [void]$tmplStack.Pop()
          $state = 'tmpl'
          $i++
          continue
        }
        if ($stack.Count -gt 0) { [void]$stack.Pop() }
      }
      if ($open.ContainsKey($chS)) {
        $stack.Push(@{ ch = $chS; line = $line })
      }
      # 维护标识符缓冲：word 字符追加，其他非空白字符清空（空白保留）
      if ($ch -match '[A-Za-z0-9_$]') { $word = $word + $ch }
      elseif ($ch -ne ' ' -and $ch -ne "`t" -and $ch -ne "`r" -and $ch -ne "`n") { $word = '' }
      if ($ch -ne ' ' -and $ch -ne "`t" -and $ch -ne "`r" -and $ch -ne "`n") { $lastSig = $ch }
      $i++; continue
    }

    if ($state -eq 'regex') {
      if ($ch -eq $BS) { $i += 2; continue }
      if ($ch -eq '[') {
        $i++
        while ($i -lt $n -and $c[$i] -ne ']' -and $c[$i] -ne "`n") {
          if ($c[$i] -eq $BS) { $i += 2; continue }
          $i++
        }
        if ($i -lt $n) { $i++ }
        continue
      }
      if ($ch -eq '/') { $state = 'code'; $lastSig = '/'; $i++; continue }
      if ($ch -eq "`n") { $state = 'code' }
      $i++; continue
    }

    if ($state -eq 'sq') {
      if ($ch -eq $BS) { $i += 2; continue }
      if ($ch -eq "'") { $state = 'code'; $lastSig = "'" }
      $i++; continue
    }
    if ($state -eq 'dq') {
      if ($ch -eq $BS) { $i += 2; continue }
      if ($ch -eq '"') { $state = 'code'; $lastSig = '"' }
      $i++; continue
    }
    if ($state -eq 'tmpl') {
      if ($ch -eq $BS) { $i += 2; continue }
      if ($ch -eq '`') { $state = 'code'; $lastSig = '`'; $i++; continue }
      if ($ch -eq '$' -and $nx -eq '{') {
        $tmplStack.Push(@{ line = $line })
        $stack.Push(@{ ch = '{'; line = $line })
        $state = 'code'; $lastSig = '{'; $i += 2; continue
      }
      $i++; continue
    }
    if ($state -eq 'line') {
      if ($ch -eq "`n") { $state = 'code' }
      $i++; continue
    }
    if ($state -eq 'block') {
      if ($ch -eq '*' -and $nx -eq '/') { $state = 'code'; $i += 2; continue }
      $i++; continue
    }
    $i++
  }

  $report = '  ' + $file + "`r`n"
  if ($state -ne 'code') {
    $report += '    EOF-state: ' + $state + "`r`n"
  }
  if ($stack.Count -eq 0) {
    $report += '    all balanced (stack empty)' + "`r`n"
  } else {
    $arr = $stack.ToArray()
    foreach ($item in $arr) {
      $report += ('    UNCLOSED ' + $item.ch + ' opened at line ' + $item.line + "`r`n")
    }
  }
  return $report
}

foreach ($p in $Paths) { Write-Output (Get-BraceDebug $p) }
Write-Output 'DONE'