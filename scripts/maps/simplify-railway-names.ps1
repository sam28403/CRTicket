$ErrorActionPreference = 'Stop'
$auditRoot = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'data/maps/station-coordinate-audit'
$names = [System.Collections.Generic.HashSet[string]]::new()
foreach ($region in @('CN', 'HK', 'LA')) {
    $file = [System.IO.File]::OpenRead((Join-Path $auditRoot "raw/$region.json.gz"))
    $gzip = [System.IO.Compression.GZipStream]::new($file, [System.IO.Compression.CompressionMode]::Decompress)
    $reader = [System.IO.StreamReader]::new($gzip)
    try { $data = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose(); $gzip.Dispose(); $file.Dispose() }
    foreach ($element in $data.elements) {
        if (!$element.tags) { continue }
        foreach ($property in $element.tags.PSObject.Properties) {
            if ($property.Name -match '^(name|official_name|short_name|alt_name|full_name|long_name|int_name)(:.*)?$') {
                foreach ($value in ([string]$property.Value -split ';')) { $null = $names.Add($value) }
            }
        }
    }
}
$variants = [ordered]@{}
foreach ($name in @($names | Sort-Object)) {
    if ($name -notmatch '\p{IsCJKUnifiedIdeographs}') { continue }
    $simplified = [Microsoft.VisualBasic.Strings]::StrConv($name, [Microsoft.VisualBasic.VbStrConv]::SimplifiedChinese, 2052)
    if ($simplified -ne $name) { $variants[$name] = $simplified }
}
$variants | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $auditRoot 'name-simplifications.json') -Encoding utf8
Write-Output "Saved $($variants.Count) simplified name variants"
