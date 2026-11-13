Add-Type -AssemblyName System.Drawing
$assetDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets'
foreach ($size in @(180,192,512)) {
  $bitmap = New-Object System.Drawing.Bitmap($size,$size)
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.ScaleTransform($size/512.0,$size/512.0)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.Point]::new(0,0),[System.Drawing.Point]::new(512,512),[System.Drawing.Color]::FromArgb(65,106,235),[System.Drawing.Color]::FromArgb(109,77,207))
  $g.FillRectangle($bg,0,0,512,512)
  $white=[System.Drawing.Brushes]::White
  $soft=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(223,234,255))
  $left=[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(105,175),[System.Drawing.PointF]::new(245,198),[System.Drawing.PointF]::new(245,365),[System.Drawing.PointF]::new(105,340))
  $right=[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(267,198),[System.Drawing.PointF]::new(407,175),[System.Drawing.PointF]::new(407,340),[System.Drawing.PointF]::new(267,365))
  $g.FillPolygon($white,$left);$g.FillPolygon($soft,$right)
  $pen=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(128,154,222),8)
  $g.DrawLine($pen,130,226,216,241);$g.DrawLine($pen,130,260,216,275);$g.DrawLine($pen,130,294,190,304)
  $gold=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,209,92))
  $star=New-Object 'System.Collections.Generic.List[System.Drawing.PointF]'
  for($i=0;$i -lt 10;$i++){ $angle=($i*36-90)*[Math]::PI/180;$radius=if($i%2 -eq 0){44}else{20};$star.Add([System.Drawing.PointF]::new(335+[Math]::Cos($angle)*$radius,117+[Math]::Sin($angle)*$radius)) }
  $g.FillPolygon($gold,$star.ToArray())
  $g.FillEllipse($gold,244,384,24,24)
  $bitmap.Save((Join-Path $assetDir "icon-$size.png"),[System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose();$soft.Dispose();$gold.Dispose();$bg.Dispose();$g.Dispose();$bitmap.Dispose()
}
