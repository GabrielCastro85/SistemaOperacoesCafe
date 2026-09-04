param(
  [string]$Root = (Resolve-Path ".").Path
)

Add-Type -AssemblyName System.Drawing

$icons = @(
  @{ Source = "public/assets/branding/villa/logo.png"; Target = "build/icons/villa.ico" },
  @{ Source = "public/assets/branding/grao/logo.png"; Target = "build/icons/grao.ico" },
  @{ Source = "build/icon-sources/multiempresa-app-icon.png"; Target = "build/icons/multiempresa.ico" }
)

$sizes = @(16, 24, 32, 48, 64, 128, 256)

function New-IconPngBytes([System.Drawing.Image]$source, [int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $scale = [Math]::Min($size / $source.Width, $size / $source.Height)
  $width = [int]($source.Width * $scale)
  $height = [int]($source.Height * $scale)
  $x = [int](($size - $width) / 2)
  $y = [int](($size - $height) / 2)
  $graphics.DrawImage($source, $x, $y, $width, $height)
  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  $bytes = $stream.ToArray()
  $stream.Dispose()
  return ,$bytes
}

foreach ($icon in $icons) {
  $sourcePath = Join-Path $Root $icon.Source
  $targetPath = Join-Path $Root $icon.Target
  New-Item -ItemType Directory -Force -Path (Split-Path $targetPath) | Out-Null
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  try {
    $entries = @()
    foreach ($size in $sizes) {
      $entries += @{ Size = $size; Bytes = [byte[]](New-IconPngBytes $source $size) }
    }
    $stream = New-Object System.IO.MemoryStream
    $writer = New-Object System.IO.BinaryWriter $stream
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$entries.Count)
    $offset = 6 + ($entries.Count * 16)
    foreach ($entry in $entries) {
      $writer.Write([byte]($(if ($entry.Size -eq 256) { 0 } else { $entry.Size })))
      $writer.Write([byte]($(if ($entry.Size -eq 256) { 0 } else { $entry.Size })))
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]32)
      $writer.Write([UInt32]$entry.Bytes.Length)
      $writer.Write([UInt32]$offset)
      $offset += $entry.Bytes.Length
    }
    foreach ($entry in $entries) {
      $writer.Write($entry.Bytes)
    }
    [System.IO.File]::WriteAllBytes($targetPath, $stream.ToArray())
    $writer.Dispose()
    $stream.Dispose()
  } finally {
    $source.Dispose()
  }
}
