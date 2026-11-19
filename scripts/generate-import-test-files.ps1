param(
  [string]$OutputDirectory = "test-data"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$templatePath = Join-Path $repositoryRoot "public\templates\ERIS_Attendance_Import_Template.xlsx"
$outputPath = Join-Path $repositoryRoot $OutputDirectory

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

function ConvertTo-XmlText([object]$Value) {
  return [System.Security.SecurityElement]::Escape([string]$Value)
}

function New-CellXml([string]$Column, [int]$Row, [string]$Value, [int]$Style) {
  if ([string]::IsNullOrEmpty($Value)) {
    return "<x:c r=`"$Column$Row`" s=`"$Style`" />"
  }
  $escapedValue = ConvertTo-XmlText $Value
  return "<x:c r=`"$Column$Row`" s=`"$Style`" t=`"str`"><x:v>$escapedValue</x:v></x:c>"
}

function New-RowXml([int]$RowNumber, [string[]]$Values, [int]$Style) {
  $columns = @("A", "B", "C", "D", "E")
  $cells = for ($index = 0; $index -lt $Values.Count; $index++) {
    New-CellXml $columns[$index] $RowNumber $Values[$index] $Style
  }

  $height = if ($RowNumber -eq 1) { ' ht="28" customHeight="1"' } else { "" }
  return "<x:row r=`"$RowNumber`"$height>$($cells -join '')</x:row>"
}

function New-TestWorkbook(
  [string]$FileName,
  [string]$SheetName,
  [string[]]$Headers,
  [object[]]$Rows
) {
  $destination = Join-Path $outputPath $FileName
  Copy-Item -LiteralPath $templatePath -Destination $destination -Force

  $rowXml = @((New-RowXml 1 $Headers 2))
  for ($index = 0; $index -lt $Rows.Count; $index++) {
    $rowXml += New-RowXml ($index + 2) ([string[]]$Rows[$index]) 3
  }

  $archive = [System.IO.Compression.ZipFile]::Open($destination, [System.IO.Compression.ZipArchiveMode]::Update)
  try {
    $worksheetEntry = $archive.GetEntry("xl/worksheets/sheet1.xml")
    $reader = [System.IO.StreamReader]::new($worksheetEntry.Open())
    $worksheetXml = $reader.ReadToEnd()
    $reader.Dispose()
    $worksheetEntry.Delete()

    for ($index = 0; $index -lt $rowXml.Count; $index++) {
      $rowNumber = $index + 1
      $worksheetXml = [regex]::Replace(
        $worksheetXml,
        "<x:row r=`"$rowNumber`".*?</x:row>",
        $rowXml[$index],
        [System.Text.RegularExpressions.RegexOptions]::Singleline
      )
    }

    $newWorksheetEntry = $archive.CreateEntry("xl/worksheets/sheet1.xml")
    $writer = [System.IO.StreamWriter]::new($newWorksheetEntry.Open(), [System.Text.UTF8Encoding]::new($false))
    $writer.Write($worksheetXml)
    $writer.Dispose()

    $workbookEntry = $archive.GetEntry("xl/workbook.xml")
    $reader = [System.IO.StreamReader]::new($workbookEntry.Open())
    $workbookXml = $reader.ReadToEnd()
    $reader.Dispose()
    $workbookEntry.Delete()

    $workbookXml = [regex]::Replace($workbookXml, 'name="[^"]+"', "name=`"$SheetName`"", 1)
    $newWorkbookEntry = $archive.CreateEntry("xl/workbook.xml")
    $writer = [System.IO.StreamWriter]::new($newWorkbookEntry.Open(), [System.Text.UTF8Encoding]::new($false))
    $writer.Write($workbookXml)
    $writer.Dispose()
  }
  finally {
    $archive.Dispose()
  }

  return $destination
}

$leaveRows = @(
  @("EMP001", "LT001", "2026-11-24", "2026-11-24", "Nghi viec ca nhan"),
  @("EMP002", "LT001", "2026-11-25", "2026-11-26", "Nghi phep nam"),
  @("EMP003", "LT001", "2026-11-27", "2026-11-27", "Kham suc khoe")
)

$leaveFile = New-TestWorkbook `
  "ERIS_Leave_Records_Import_Test.xlsx" `
  "Leave Records" `
  @("employee_code", "leave_type", "start_date", "end_date", "reason") `
  $leaveRows

node (Join-Path $PSScriptRoot "generate-attendance-test-file.cjs")
if ($LASTEXITCODE -ne 0) {
  throw "Could not generate the attendance test workbook."
}
Write-Output $leaveFile
