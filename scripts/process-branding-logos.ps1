param(
  [Parameter(Mandatory = $true)]
  [string]$VillaSource,
  [Parameter(Mandatory = $true)]
  [string]$GraoSource,
  [Parameter(Mandatory = $true)]
  [string]$OutputRoot
)

Add-Type -AssemblyName System.Drawing

function Convert-Logo {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,
    [Parameter(Mandatory = $true)]
    [string]$Target,
    [int]$Padding = 12
  )

  $image = [System.Drawing.Bitmap]::new($Source)
  $minX = $image.Width
  $minY = $image.Height
  $maxX = 0
  $maxY = 0

  for ($y = 0; $y -lt $image.Height; $y++) {
    for ($x = 0; $x -lt $image.Width; $x++) {
      $color = $image.GetPixel($x, $y)
      $isWhite = $color.R -gt 245 -and $color.G -gt 245 -and $color.B -gt 245
      if (-not $isWhite) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  $minX = [Math]::Max(0, $minX - $Padding)
  $minY = [Math]::Max(0, $minY - $Padding)
  $maxX = [Math]::Min($image.Width - 1, $maxX + $Padding)
  $maxY = [Math]::Min($image.Height - 1, $maxY + $Padding)
  $width = $maxX - $minX + 1
  $height = $maxY - $minY + 1

  $targetDirectory = Split-Path -Parent $Target
  New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null

  $cropped = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($cropped)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.DrawImage(
    $image,
    [System.Drawing.Rectangle]::new(0, 0, $width, $height),
    [System.Drawing.Rectangle]::new($minX, $minY, $width, $height),
    [System.Drawing.GraphicsUnit]::Pixel
  )
  $graphics.Dispose()
  $image.Dispose()

  for ($y = 0; $y -lt $cropped.Height; $y++) {
    for ($x = 0; $x -lt $cropped.Width; $x++) {
      $color = $cropped.GetPixel($x, $y)
      if ($color.R -gt 245 -and $color.G -gt 245 -and $color.B -gt 245) {
        $cropped.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
      }
    }
  }

  $temporaryTarget = "$Target.tmp.png"
  $cropped.Save($temporaryTarget, [System.Drawing.Imaging.ImageFormat]::Png)
  $cropped.Dispose()
  Move-Item -LiteralPath $temporaryTarget -Destination $Target -Force
  Write-Output "Saved $Target ($width x $height)"
}

Convert-Logo -Source $VillaSource -Target (Join-Path $OutputRoot "villa/logo.png") -Padding 10
Convert-Logo -Source $GraoSource -Target (Join-Path $OutputRoot "grao/logo.png") -Padding 18
