param(
    [string]$Endpoint = 'https://overpass-api.de/api/interpreter',
    [string[]]$Regions = @('CN', 'HK', 'LA')
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$snapshotRoot = Join-Path $projectRoot 'data/maps/station-coordinate-audit/raw'
New-Item -ItemType Directory -Force -Path $snapshotRoot | Out-Null

foreach ($region in $Regions) {
    if ($region -notin @('CN', 'HK', 'LA')) { throw "Unsupported region: $region" }
    $query = @"
[out:json][timeout:240][maxsize:268435456];
area["ISO3166-1"="$region"]["boundary"="administrative"]->.scope;
nwr(area.scope)[~"^(railway|construction:railway|proposed:railway|disused:railway|abandoned:railway|preserved:railway|razed:railway)$"~"^(station|halt|tram_stop|service_station|yard|junction|spur_junction|crossover|site)$"]->.facilities;
.facilities out body geom;
.facilities out count;
"@
    $queryPath = Join-Path $snapshotRoot "$region.overpassql"
    Set-Content -LiteralPath $queryPath -Value $query -Encoding utf8
    Write-Output "Fetching $region from $Endpoint"
    $response = Invoke-WebRequest -Uri $Endpoint -Method Post `
        -ContentType 'application/x-www-form-urlencoded' `
        -UserAgent 'CRTicket-coordinate-audit/1.0' `
        -Body ('data=' + [uri]::EscapeDataString($query)) -TimeoutSec 300
    $jsonOptions = @{}
    if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) { $jsonOptions.DateKind = 'String' }
    $data = $response.Content | ConvertFrom-Json @jsonOptions
    if ($data.remark) { throw "Incomplete $region response: $($data.remark)" }
    $elements = @($data.elements | Where-Object type -NE 'count')
    $count = @($data.elements | Where-Object type -EQ 'count')
    if ($count.Count -ne 1 -or [int]$count[0].tags.total -ne $elements.Count -or $elements.Count -eq 0) {
        throw "Missing or inconsistent completion count for $region"
    }
    $path = Join-Path $snapshotRoot "$region.json.gz"
    $stream = [System.IO.File]::Create($path)
    $gzip = [System.IO.Compression.GZipStream]::new($stream, [System.IO.Compression.CompressionLevel]::Optimal)
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($response.Content)
        $gzip.Write($bytes, 0, $bytes.Length)
    } finally {
        $gzip.Dispose()
        $stream.Dispose()
    }
    $receipt = @{
        region = $region
        endpoint = $Endpoint
        retrievedAt = [DateTime]::UtcNow.ToString('o')
        osmTimestamp = if ($data.osm3s.timestamp_osm_base -is [DateTime]) {
            $data.osm3s.timestamp_osm_base.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        } else { $data.osm3s.timestamp_osm_base }
        elementCount = $elements.Count
        count = $count[0].tags
        sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $snapshotRoot "$region.receipt.json") -Encoding utf8
    Write-Output "$region complete: $($elements.Count) objects; OSM $($data.osm3s.timestamp_osm_base)"
}
