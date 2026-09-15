# ============================================================
# brace_check.ps1 - JS 括号平衡检查（识别字符串、模板串、注释、正则）
# 用法：powershell -File tools\brace_check.ps1 file1.js file2.js ...
#
# ⚠️ PowerShell 语义陷阱（本脚本已修复，改时勿回退）：
#   1) 哈希表 ContainsKey/索引器传 [char] 永远查不到 string 键
#      （char 与 string 的 GetHashCode 不同）——必须先 [string] 转换；
#   2) 单引号串 '\\' 是两个字符，与单字符 [char]92 永不相等——
#      转义判断必须用 [char]92 比较；
#   3) PS 数组没有 .Pop()——模板串 ${ 嵌套计数用整型计数器。
# ============================================================
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Paths)

$BS = [char]92  # 反斜杠

function Get-BraceReport([string]$file) {
  $raw = Get-Content -LiteralPath $file -Raw -Encoding UTF8
  if ($null -eq $raw) { return 'MISSING  ' + $file }

  $c = $raw.ToCharArray()
  $n = $c.Length
  $i = 0
  $depth = @{ '{' = 0; '(' = 0; '[' = 0 }
  $open  = @{ '{' = '}'; '(' = ')'; '[' = ']' }
  $close = @{ '}' = '{'; ')' = '('; ']' = '[' }

  # 状态机：code / sq / dq / tmpl / line / block / regex
  $state = 'code'
  $tmplDepth = 0        # 模板串里的 ${ ... } 嵌套计数
  $lastSig = ''         # 上一个非空白非注释字符，用于判断 / 是否为正则
  $word = ''            # 紧邻的标识符，用于区分 return /re/ 与 a / b
  $KEYWORDS = @('return','typeof','instanceof','in','of','new','delete','void',
                'case','do','else','yield','await','throw')

  while ($i -lt $n) {
    $ch  = $c[$i]
    $nx  = if ($i + 1 -lt $n) { $c[$i + 1] } else { [char]0 }
    $chS = [string]$ch   # 关键：哈希表操作必须用 string 键

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
        # 模板串里的 ${ ... } 闭合后要回到模板串状态
        if ($chS -eq '}' -and $tmplDepth -gt 0) {
          if ($depth['{'] -gt 0) { $depth['{']-- }
          $tmplDepth--
          $state = 'tmpl'
          $i++
          continue
        }
        $o = $close[$chS]
        if ($depth[$o] -gt 0) { $depth[$o]-- }
      }
      if ($open.ContainsKey($chS)) {
        $depth[$chS]++
      }
      # 维护标识符缓冲：word 字符追加，其他非空白字符清空（空白保留，供 return /re/ 判断）
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
      if ($ch -eq "`n") { $state = 'code' }   # 误判保护：回到代码态
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
        $tmplDepth++; $depth['{']++; $state = 'code'; $lastSig = '{'; $i += 2; continue
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
  if ($state -ne 'code') { $report += '    EOF-state: ' + $state + "`r`n" }
  foreach ($k in @('{', '(', '[')) {
    $rep = if ($depth[$k] -eq 0) { 'balanced' } else { 'UNCLOSED x' + $depth[$k] }
    $report += ('    ' + $k + $open[$k] + ': ' + $rep + "`r`n")
  }
  return $report
}

foreach ($p in $Paths) { Write-Output (Get-BraceReport $p) }
Write-Output 'DONE'