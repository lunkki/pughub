$ErrorActionPreference = "Stop"

$dest = Join-Path $PSScriptRoot "..\public\maps"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$base = "https://raw.githubusercontent.com/kus/cs2-modded-server/assets/images"

$files = @(
  "cs_italy.jpg",
  "cs_office.jpg",
  "de_vertigo.jpg",
  "de_ancient.jpg",
  "de_ancient_night.jpg",
  "de_anubis.jpg",
  "de_dust2.jpg",
  "de_inferno.jpg",
  "de_mirage.jpg",
  "de_nuke.jpg",
  "de_overpass.jpg",
  "de_train.jpg",
  "de_jura.jpg",
  "de_grail.jpg",
  "cs_agency.jpg",
  "de_basalt.jpg",
  "de_edin.jpg",
  "de_assembly.jpg",
  "de_cbble.jpg",
  "de_cache.jpg",
  "de_pipeline.jpg",
  "de_biome.jpg",
  "mp_raid.jpg",
  "de_mutiny.jpg",
  "cs_assault.jpg",
  "de_ruins_d_prefab.jpg",
  "cs_militia.jpg",
  "de_aztec_hr.jpg",
  "de_akiba.jpg",
  "cs_insertion2.jpg",
  "de_mills.jpg",
  "de_thera.jpg",
  "de_season.jpg",
  "de_ema.jpg",
  "twofort_cs2.jpg",
  "de_rats_remake.jpg",
  "de_mirage_bricks.jpg"
)

foreach ($file in $files | Sort-Object -Unique) {
  $url = "$base/$file"
  $outPath = Join-Path $dest $file
  Write-Host "Downloading $file" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $outPath
}

Write-Host "Done. Saved to $dest" -ForegroundColor Green
