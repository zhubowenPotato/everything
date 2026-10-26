$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Xaml

$script:LauncherRoot = Split-Path -Parent $PSScriptRoot
$script:RepoRoot = Split-Path -Parent $script:LauncherRoot
$script:LogDir = Join-Path $script:LauncherRoot '_logs'

$createdNew = $false
$script:Mutex = New-Object System.Threading.Mutex($true, 'Local\EverythingLauncher', [ref]$createdNew)
if (-not $createdNew) { exit }

function New-Brush([string]$hex) {
  $converter = New-Object System.Windows.Media.BrushConverter
  return $converter.ConvertFromString($hex)
}

$script:BrushCard = New-Brush '#FFFFFF'
$script:BrushCardBorder = New-Brush '#E2EAE4'
$script:BrushCardHover = New-Brush '#F7FBF8'
$script:BrushCardHoverBorder = New-Brush '#B9D5C2'
$script:BrushRunningBg = New-Brush '#F7FBF8'
$script:BrushRunningBorder = New-Brush '#B9D5C2'
$script:BrushStartingBg = New-Brush '#FFFBF2'
$script:BrushStartingBorder = New-Brush '#E7D3A3'
$script:BrushErrorBg = New-Brush '#FFF7F7'
$script:BrushErrorBorder = New-Brush '#E7B9B9'
$script:BrushAccent = New-Brush '#356D49'
$script:BrushAccentSoft = New-Brush '#E6F2E9'
$script:BrushAccentDark = New-Brush '#2A5A3B'
$script:BrushDanger = New-Brush '#B34A4A'
$script:BrushWarning = New-Brush '#B5852D'
$script:BrushText = New-Brush '#1B2A22'
$script:BrushMuted = New-Brush '#73877A'
$script:BrushFaint = New-Brush '#8CA095'
$script:BrushDotReady = New-Brush '#9CAFA2'
$script:BrushDotRunning = New-Brush '#3E9B64'
$script:BrushDotStarting = New-Brush '#D69B2D'
$script:BrushDotError = New-Brush '#C85B5B'
$script:BrushWhite = New-Brush '#FFFFFF'

$script:Apps = @(
  [pscustomobject]@{ Name='Spreadsheet'; Dir='spreadsheet'; Category='office'; Desc='公式、图表、透视表与 AI 表格' },
  [pscustomobject]@{ Name='Documents'; Dir='documents'; Category='office'; Desc='DOCX 文档编辑、评论与修订' },
  [pscustomobject]@{ Name='Presentation'; Dir='presentation'; Category='office'; Desc='PPTX 演示、动画与演讲者视图' },
  [pscustomobject]@{ Name='Whiteboard'; Dir='whiteboard'; Category='office'; Desc='无限白板、便签与实时协作' },
  [pscustomobject]@{ Name='PDF'; Dir='pdf'; Category='office'; Desc='PDF 编辑、批注、OCR 与签名' },
  [pscustomobject]@{ Name='Notes'; Dir='notes'; Category='office'; Desc='自由笔记、手写、标签与搜索' },
  [pscustomobject]@{ Name='Records'; Dir='records'; Category='office'; Desc='Airtable 式数据表、视图与表单' },
  [pscustomobject]@{ Name='Meetings'; Dir='meetings'; Category='collab'; Desc='视频会议、屏幕共享与聊天' },
  [pscustomobject]@{ Name='Teamchat'; Dir='teamchat'; Category='collab'; Desc='团队频道、线程、私信与附件' },
  [pscustomobject]@{ Name='Email'; Dir='email'; Category='collab'; Desc='Puter 邮箱收发、附件与搜索' },
  [pscustomobject]@{ Name='Contacts'; Dir='contacts'; Category='collab'; Desc='轻量联系人管理与云端存储' },
  [pscustomobject]@{ Name='Calendar'; Dir='calendar'; Category='collab'; Desc='日历、重复事件、提醒与 ICS' },
  [pscustomobject]@{ Name='Signatures'; Dir='signatures'; Category='collab'; Desc='电子签名、签署流程与审计' },
  [pscustomobject]@{ Name='Photo Studio'; Dir='photo-studio'; Category='creative'; Desc='图层、蒙版、修图与 PSD' },
  [pscustomobject]@{ Name='Video Studio'; Dir='video-studio'; Category='creative'; Desc='多轨剪辑、特效、字幕与导出' },
  [pscustomobject]@{ Name='Vector Studio'; Dir='vector-studio'; Category='creative'; Desc='矢量插画、钢笔与 SVG/PDF' },
  [pscustomobject]@{ Name='Audio Studio'; Dir='audio-studio'; Category='creative'; Desc='录音、波形编辑、多轨混音' },
  [pscustomobject]@{ Name='Music Studio'; Dir='music-studio'; Category='creative'; Desc='Pattern、钢琴卷帘与音乐制作' },
  [pscustomobject]@{ Name='3D Studio'; Dir='3d'; Category='creative'; Desc='3D 建模、雕刻、动画与渲染' },
  [pscustomobject]@{ Name='CAD'; Dir='cad'; Category='engineering'; Desc='2D 制图、图层、标注与 DXF' },
  [pscustomobject]@{ Name='Parametric'; Dir='parametric'; Category='engineering'; Desc='参数化建模、B-Rep 与 STEP/STL' },
  [pscustomobject]@{ Name='Circuits'; Dir='circuits'; Category='engineering'; Desc='原理图、PCB 布局与 Gerber' },
  [pscustomobject]@{ Name='Building Design'; Dir='building-design'; Category='engineering'; Desc='BIM、平面/立面/剖面与图纸' },
  [pscustomobject]@{ Name='Tasks'; Dir='tasks'; Category='productivity'; Desc='个人与共享待办清单' },
  [pscustomobject]@{ Name='Projects'; Dir='projects'; Category='productivity'; Desc='看板、时间线与项目协作' },
  [pscustomobject]@{ Name='Wiki'; Dir='wiki'; Category='productivity'; Desc='团队页面、文档与数据库' },
  [pscustomobject]@{ Name='Time Tracking'; Dir='time-tracking'; Category='productivity'; Desc='按客户/项目记录可计费工时' },
  [pscustomobject]@{ Name='Surveys'; Dir='survey'; Category='productivity'; Desc='问卷搭建、分享与结果分析' },
  [pscustomobject]@{ Name='Accounting'; Dir='accounting'; Category='finance'; Desc='复式记账、对账与财务报表' },
  [pscustomobject]@{ Name='Invoicing'; Dir='invoicing'; Category='finance'; Desc='报价、发票、周期计费与支付链接' },
  [pscustomobject]@{ Name='Expenses'; Dir='expense'; Category='finance'; Desc='AI OCR 票据、报销与对账' },
  [pscustomobject]@{ Name='Cap Table'; Dir='cap-table'; Category='finance'; Desc='股权、期权与融资管理' },
  [pscustomobject]@{ Name='CRM'; Dir='crm'; Category='business'; Desc='线索、商机、跟进与销售预测' },
  [pscustomobject]@{ Name='Help Desk'; Dir='help-desk'; Category='business'; Desc='共享收件箱、工单与帮助中心' },
  [pscustomobject]@{ Name='Contracts'; Dir='contracts'; Category='business'; Desc='合同、续约提醒与义务跟踪' },
  [pscustomobject]@{ Name='Point of Sale'; Dir='pos'; Category='business'; Desc='商品、结账、折扣与销售报表' },
  [pscustomobject]@{ Name='Inventory'; Dir='inventory'; Category='business'; Desc='库存、库位、低库存与供应商' },
  [pscustomobject]@{ Name='Assets'; Dir='assets'; Category='business'; Desc='设备台账、领用、维护与归还' },
  [pscustomobject]@{ Name='Hiring'; Dir='hiring'; Category='business'; Desc='招聘页面、候选人流程与 Offer' },
  [pscustomobject]@{ Name='Shifts'; Dir='shifts'; Category='business'; Desc='可用时间、排班、换班与考勤' },
  [pscustomobject]@{ Name='Childcare'; Dir='childcare'; Category='business'; Desc='签到、日报、家长沟通与学费' },
  [pscustomobject]@{ Name='Field Service'; Dir='field-service'; Category='business'; Desc='客户、工单、排程与收款' },
  [pscustomobject]@{ Name='Legal'; Dir='legal'; Category='business'; Desc='案件、工时、账单与信托账户' },
  [pscustomobject]@{ Name='Fleet'; Dir='fleet'; Category='business'; Desc='车辆、检查、维修与成本管理' },
  [pscustomobject]@{ Name='Property Management'; Dir='property-management'; Category='business'; Desc='房产、租约、收租与维修' },
  [pscustomobject]@{ Name='API Client'; Dir='api-client'; Category='developer'; Desc='HTTP 请求构建、测试与同步' },
  [pscustomobject]@{ Name='Chess'; Dir='chess'; Category='games'; Desc='国际象棋，本地/在线与 AI 对战' },
  [pscustomobject]@{ Name='Backgammon'; Dir='backgammon'; Category='games'; Desc='西洋双陆棋，本地/在线对战' },
  [pscustomobject]@{ Name='Checkers'; Dir='checkers'; Category='games'; Desc='跳棋，本地/在线与 AI 对战' },
  [pscustomobject]@{ Name='Solitaire'; Dir='solitaire'; Category='games'; Desc='Klondike 与 Spider 纸牌' },
  [pscustomobject]@{ Name='Sudoku'; Dir='sudoku'; Category='games'; Desc='数独、每日题、铅笔标记与提示' }
)

$script:Categories = @(
  [pscustomobject]@{ Key='all'; Name='全部应用'; Count=$script:Apps.Count; Color='#356D49' },
  [pscustomobject]@{ Key='office'; Name='办公文档'; Count=7; Color='#4A7C59' },
  [pscustomobject]@{ Key='collab'; Name='协作沟通'; Count=6; Color='#3A7CA5' },
  [pscustomobject]@{ Key='creative'; Name='创意工具'; Count=6; Color='#A56A4A' },
  [pscustomobject]@{ Key='engineering'; Name='工程设计'; Count=4; Color='#6A6AA5' },
  [pscustomobject]@{ Key='productivity'; Name='效率管理'; Count=5; Color='#A58A3A' },
  [pscustomobject]@{ Key='finance'; Name='财务'; Count=4; Color='#3A8A7A' },
  [pscustomobject]@{ Name='行业业务'; Key='business'; Count=13; Color='#7A5A9A' },
  [pscustomobject]@{ Key='developer'; Name='开发工具'; Count=1; Color='#5A7A9A' },
  [pscustomobject]@{ Key='games'; Name='游戏'; Count=5; Color='#A55A7A' }
)

$script:SelectedCategory = 'all'
$script:SearchText = ''
$script:States = @{}
$script:CardRefs = @{}
$script:IconCache = @{}
$script:ReservedPorts = @{}
$script:PortRangeStart = 5173
$script:PortRangeEnd = 5399

function Test-PortAvailable([int]$Port) {
  if ($script:ReservedPorts.ContainsKey($Port)) { return $false }
  try {
    if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop) { return $false }
  } catch {}

  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::IPv6Any, $Port)
    $listener.Server.DualMode = $true
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    if ($listener) { try { $listener.Stop() } catch {} }
    return $false
  }
}

function Get-AvailableAppPort {
  for ($port = $script:PortRangeStart; $port -le $script:PortRangeEnd; $port++) {
    if (Test-PortAvailable $port) { return $port }
  }
  throw "端口 $($script:PortRangeStart)-$($script:PortRangeEnd) 已全部被占用。"
}

function Release-AppPort($Entry) {
  if ($Entry -and $Entry.Port) {
    [void]$script:ReservedPorts.Remove([int]$Entry.Port)
    $Entry.Port = $null
  }
}

function Stop-ProjectDevServers {
  $sourcePrefix = $script:RepoRoot.TrimEnd('\') + '\src\'
  $escapedPrefix = [regex]::Escape($sourcePrefix)
  $targets = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine -match $escapedPrefix -and $_.CommandLine -match 'vite'
  })
  foreach ($target in $targets) {
    try {
      $killInfo = New-Object System.Diagnostics.ProcessStartInfo
      $killInfo.FileName = Join-Path $env:SystemRoot 'System32\taskkill.exe'
      $killInfo.Arguments = "/PID $($target.ProcessId) /T /F"
      $killInfo.UseShellExecute = $false
      $killInfo.CreateNoWindow = $true
      $killInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
      $killer = [System.Diagnostics.Process]::Start($killInfo)
      [void]$killer.WaitForExit(4000)
    } catch {}
  }
}

function New-ImageSource([string]$path) {
  $bitmap = New-Object System.Windows.Media.Imaging.BitmapImage
  $bitmap.BeginInit()
  $bitmap.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
  $bitmap.UriSource = New-Object System.Uri($path)
  $bitmap.EndInit()
  $bitmap.Freeze()
  return $bitmap
}

function Get-AppIcon([string]$dir) {
  if ($script:IconCache.ContainsKey($dir)) { return $script:IconCache[$dir] }
  $path = Join-Path $script:RepoRoot ('src\' + $dir + '\icon-128.png')
  if (-not (Test-Path $path)) { return $null }
  $image = New-ImageSource $path
  $script:IconCache[$dir] = $image
  return $image
}

$xamlPath = Join-Path $PSScriptRoot 'launcher.xaml'
$script:Window = [Windows.Markup.XamlReader]::Parse((Get-Content -LiteralPath $xamlPath -Raw -Encoding UTF8))
$window = $script:Window
$script:Window.Width = [Math]::Min(1120, [System.Windows.SystemParameters]::WorkArea.Width - 28)
$script:Window.Height = [Math]::Min(740, [System.Windows.SystemParameters]::WorkArea.Height - 28)

$script:TitleBar = $window.FindName('TitleBar')
$script:BrandLogo = $window.FindName('BrandLogo')
$script:RunningDot = $window.FindName('RunningDot')
$script:RunningCountText = $window.FindName('RunningCountText')
$script:MinimizeButton = $window.FindName('MinimizeButton')
$script:CloseButton = $window.FindName('CloseButton')
$script:SearchBox = $window.FindName('SearchBox')
$script:SearchPlaceholder = $window.FindName('SearchPlaceholder')
$script:CategoryPanel = $window.FindName('CategoryPanel')
$script:CategoryTitle = $window.FindName('CategoryTitle')
$script:CategorySubtitle = $window.FindName('CategorySubtitle')
$script:ResultCountText = $window.FindName('ResultCountText')
$script:AppsPanel = $window.FindName('AppsPanel')
$script:EmptyState = $window.FindName('EmptyState')
$script:StatusDot = $window.FindName('StatusDot')
$script:StatusText = $window.FindName('StatusText')
$script:LogsButton = $window.FindName('LogsButton')
$script:StopAllButton = $window.FindName('StopAllButton')

$logoPath = Join-Path $script:RepoRoot 'assets\everything.png'
if (Test-Path $logoPath) {
  $logo = New-ImageSource $logoPath
  $script:BrandLogo.Source = $logo
  $window.Icon = $logo
}

$script:TitleBar.Add_MouseLeftButtonDown({
  param($sender, $eventArgs)
  if ($eventArgs.ButtonState -eq [System.Windows.Input.MouseButtonState]::Pressed) {
    $script:Window.DragMove()
  }
})
$script:MinimizeButton.Add_Click({ $script:Window.WindowState = [System.Windows.WindowState]::Minimized })
$script:CloseButton.Add_Click({ $script:Window.Close() })

$script:SearchBox.Add_TextChanged({
  $script:SearchText = $script:SearchBox.Text.Trim()
  if ([string]::IsNullOrEmpty($script:SearchText)) {
    $script:SearchPlaceholder.Visibility = [System.Windows.Visibility]::Visible
  } else {
    $script:SearchPlaceholder.Visibility = [System.Windows.Visibility]::Collapsed
  }
  Render-AppList
})
$script:SearchBox.Add_KeyDown({
  param($sender, $eventArgs)
  if ($eventArgs.Key -eq [System.Windows.Input.Key]::Escape) {
    $script:SearchBox.Text = ''
    $eventArgs.Handled = $true
  }
})
$window.Add_KeyDown({
  param($sender, $eventArgs)
  $modifiers = [System.Windows.Input.Keyboard]::Modifiers
  if ($eventArgs.Key -eq [System.Windows.Input.Key]::F -and (($modifiers -band [System.Windows.Input.ModifierKeys]::Control) -ne 0)) {
    $script:SearchBox.Focus()
    $script:SearchBox.SelectAll()
    $eventArgs.Handled = $true
  }
})

$script:LogsButton.Add_Click({
  if (-not (Test-Path $script:LogDir)) { New-Item -ItemType Directory -Path $script:LogDir -Force | Out-Null }
  Start-Process -FilePath 'explorer.exe' -ArgumentList $script:LogDir
})
$script:StopAllButton.Add_Click({ Stop-AllApps })

function New-GridLengthColumn([double]$width) {
  $column = New-Object System.Windows.Controls.ColumnDefinition
  $column.Width = New-Object System.Windows.GridLength($width)
  return $column
}
function New-GridLengthStarColumn {
  $column = New-Object System.Windows.Controls.ColumnDefinition
  $column.Width = New-Object System.Windows.GridLength(1, [System.Windows.GridUnitType]::Star)
  return $column
}
function New-TextBlock([string]$text, [double]$size, $brush, $weight) {
  $textBlock = New-Object System.Windows.Controls.TextBlock
  $textBlock.Text = $text
  $textBlock.FontSize = $size
  $textBlock.Foreground = $brush
  if ($weight -ne $null) { $textBlock.FontWeight = $weight }
  return $textBlock
}

function Update-GlobalStatus {
  $active = @($script:States.Values | Where-Object { $_.Process -and -not $_.Process.HasExited })
  $errors = @($script:States.Values | Where-Object { $_.State -eq 'error' })
  $count = $active.Count
  $script:RunningCountText.Text = "$count 个运行中"
  $script:StopAllButton.IsEnabled = $count -gt 0
  if ($count -gt 0) {
    $script:RunningDot.Fill = $script:BrushDotRunning
    $script:StatusDot.Fill = $script:BrushDotRunning
  } else {
    $script:RunningDot.Fill = $script:BrushDotReady
    $script:StatusDot.Fill = $script:BrushDotReady
  }
  if ($errors.Count -gt 0) {
    $script:StatusDot.Fill = $script:BrushDotError
    $script:StatusText.Text = "有 $($errors.Count) 个应用启动失败，打开日志目录查看原因"
  } elseif ($count -gt 0) {
    $script:StatusText.Text = "$count 个本地服务运行中 · 关闭启动器会停止它们"
  } else {
    $script:StatusText.Text = '就绪 · 点击卡片启动应用'
  }
}

function Update-CardState([string]$dir) {
  if (-not $script:CardRefs.ContainsKey($dir)) { return }
  $refs = $script:CardRefs[$dir]
  $entry = $script:States[$dir]
  $state = 'ready'
  if ($entry) {
    if ($entry.Process -and -not $entry.Process.HasExited) {
      $state = $entry.State
    } elseif ($entry.State -eq 'error') {
      $state = 'error'
    }
  }
  switch ($state) {
    'installing' {
      $refs.Card.Background = $script:BrushStartingBg
      $refs.Card.BorderBrush = $script:BrushStartingBorder
      $refs.Dot.Fill = $script:BrushDotStarting
      $refs.Status.Text = '安装依赖'
      $refs.Status.Foreground = $script:BrushWarning
      $refs.Button.Content = '取消'
      $refs.Button.Background = $script:BrushWarning
      $refs.Button.Foreground = $script:BrushWhite
    }
    'starting' {
      $refs.Card.Background = $script:BrushStartingBg
      $refs.Card.BorderBrush = $script:BrushStartingBorder
      $refs.Dot.Fill = $script:BrushDotStarting
      $refs.Status.Text = '启动中'
      $refs.Status.Foreground = $script:BrushWarning
      $refs.Button.Content = '取消'
      $refs.Button.Background = $script:BrushWarning
      $refs.Button.Foreground = $script:BrushWhite
    }
    'running' {
      $refs.Card.Background = $script:BrushRunningBg
      $refs.Card.BorderBrush = $script:BrushRunningBorder
      $refs.Dot.Fill = $script:BrushDotRunning
      if ($entry -and $entry.Port) {
        $refs.Status.Text = "运行中 · $($entry.Port)"
      } else {
        $refs.Status.Text = '运行中'
      }
      $refs.Status.Foreground = $script:BrushAccent
      $refs.Button.Content = '停止'
      $refs.Button.Background = $script:BrushDanger
      $refs.Button.Foreground = $script:BrushWhite
    }
    'error' {
      $refs.Card.Background = $script:BrushErrorBg
      $refs.Card.BorderBrush = $script:BrushErrorBorder
      $refs.Dot.Fill = $script:BrushDotError
      $refs.Status.Text = '失败'
      $refs.Status.Foreground = $script:BrushDanger
      $refs.Button.Content = '重试'
      $refs.Button.Background = $script:BrushAccent
      $refs.Button.Foreground = $script:BrushWhite
    }
    default {
      $refs.Card.Background = $script:BrushCard
      $refs.Card.BorderBrush = $script:BrushCardBorder
      $refs.Dot.Fill = $script:BrushDotReady
      $refs.Status.Text = '就绪'
      $refs.Status.Foreground = $script:BrushFaint
      $refs.Button.Content = '启动'
      $refs.Button.Background = $script:BrushAccent
      $refs.Button.Foreground = $script:BrushWhite
    }
  }
}

function Render-Categories {
  $script:CategoryPanel.Children.Clear()
  foreach ($category in $script:Categories) {
    $button = New-Object System.Windows.Controls.Button
    $button.Style = $window.FindResource('CategoryButton')
    $button.Tag = $category.Key
    $button.Margin = New-Object System.Windows.Thickness(0,0,0,3)

    $grid = New-Object System.Windows.Controls.Grid
    $grid.ColumnDefinitions.Add((New-GridLengthColumn 14))
    $grid.ColumnDefinitions.Add((New-GridLengthStarColumn))
    $grid.ColumnDefinitions.Add((New-GridLengthColumn 28))

    $dot = New-Object System.Windows.Shapes.Ellipse
    $dot.Width = 6
    $dot.Height = 6
    $dot.Fill = New-Brush $category.Color
    $dot.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
    [System.Windows.Controls.Grid]::SetColumn($dot, 0)
    [void]$grid.Children.Add($dot)

    $nameBrush = $script:BrushText
    if ($script:SelectedCategory -eq $category.Key) { $nameBrush = $script:BrushAccentDark }
    $name = New-TextBlock $category.Name 12.5 $nameBrush ([System.Windows.FontWeights]::SemiBold)
    $name.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
    [System.Windows.Controls.Grid]::SetColumn($name, 1)
    [void]$grid.Children.Add($name)

    $count = New-TextBlock ([string]$category.Count) 10.5 $script:BrushFaint $null
    $count.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Right
    $count.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
    [System.Windows.Controls.Grid]::SetColumn($count, 2)
    [void]$grid.Children.Add($count)

    $button.Content = $grid
    if ($script:SelectedCategory -eq $category.Key) {
      $button.Background = $script:BrushAccentSoft
    }
    $button.Add_Click({
      param($sender, $eventArgs)
      $script:SelectedCategory = [string]$sender.Tag
      Render-Categories
      Render-AppList
    })
    [void]$script:CategoryPanel.Children.Add($button)
  }
}

function New-AppCard($app) {
  $card = New-Object System.Windows.Controls.Border
  $card.Width = 360
  $card.MinHeight = 118
  $card.Margin = New-Object System.Windows.Thickness(0,0,14,14)
  $card.CornerRadius = New-Object System.Windows.CornerRadius(14)
  $card.Padding = New-Object System.Windows.Thickness(16,14,16,14)
  $card.Background = $script:BrushCard
  $card.BorderBrush = $script:BrushCardBorder
  $card.BorderThickness = New-Object System.Windows.Thickness(1)
  $card.Cursor = [System.Windows.Input.Cursors]::Hand
  $card.Tag = $app
  $card.ToolTip = "$($app.Name)`n$($app.Desc)`nsrc\$($app.Dir)"

  $grid = New-Object System.Windows.Controls.Grid
  $grid.ColumnDefinitions.Add((New-GridLengthColumn 46))
  $grid.ColumnDefinitions.Add((New-GridLengthStarColumn))
  $grid.ColumnDefinitions.Add((New-GridLengthColumn 66))

  $iconBorder = New-Object System.Windows.Controls.Border
  $iconBorder.Width = 44
  $iconBorder.Height = 44
  $iconBorder.CornerRadius = New-Object System.Windows.CornerRadius(12)
  $iconBorder.Background = New-Brush '#F1F6F2'
  $iconBorder.VerticalAlignment = [System.Windows.VerticalAlignment]::Top
  $icon = New-Object System.Windows.Controls.Image
  $icon.Width = 30
  $icon.Height = 30
  $icon.Stretch = [System.Windows.Media.Stretch]::Uniform
  $icon.Source = Get-AppIcon $app.Dir
  $iconBorder.Child = $icon
  [System.Windows.Controls.Grid]::SetColumn($iconBorder, 0)
  [void]$grid.Children.Add($iconBorder)

  $content = New-Object System.Windows.Controls.StackPanel
  $content.Margin = New-Object System.Windows.Thickness(12,0,10,0)
  $content.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
  [System.Windows.Controls.Grid]::SetColumn($content, 1)

  $name = New-TextBlock $app.Name 14 $script:BrushText ([System.Windows.FontWeights]::SemiBold)
  $name.TextTrimming = [System.Windows.TextTrimming]::CharacterEllipsis
  [void]$content.Children.Add($name)

  $desc = New-TextBlock $app.Desc 10.8 $script:BrushMuted $null
  $desc.TextWrapping = [System.Windows.TextWrapping]::Wrap
  $desc.MaxHeight = 30
  $desc.Margin = New-Object System.Windows.Thickness(0,4,0,0)
  [void]$content.Children.Add($desc)

  $meta = New-Object System.Windows.Controls.Grid
  $meta.Margin = New-Object System.Windows.Thickness(0,8,0,0)
  $meta.ColumnDefinitions.Add((New-GridLengthStarColumn))
  $meta.ColumnDefinitions.Add((New-GridLengthColumn 86))

  $path = New-TextBlock ('src\' + $app.Dir) 9.5 $script:BrushFaint $null
  $path.FontFamily = New-Object System.Windows.Media.FontFamily('Consolas')
  $path.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
  [void]$meta.Children.Add($path)

  $statusPanel = New-Object System.Windows.Controls.StackPanel
  $statusPanel.Orientation = [System.Windows.Controls.Orientation]::Horizontal
  $statusPanel.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Right
  $statusPanel.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
  $dot = New-Object System.Windows.Shapes.Ellipse
  $dot.Width = 6
  $dot.Height = 6
  $dot.Fill = $script:BrushDotReady
  $dot.Margin = New-Object System.Windows.Thickness(0,0,6,0)
  $dot.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
  [void]$statusPanel.Children.Add($dot)
  $status = New-TextBlock '就绪' 9.5 $script:BrushFaint $null
  $status.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
  [void]$statusPanel.Children.Add($status)
  [System.Windows.Controls.Grid]::SetColumn($statusPanel, 1)
  [void]$meta.Children.Add($statusPanel)
  [void]$content.Children.Add($meta)
  [void]$grid.Children.Add($content)

  $button = New-Object System.Windows.Controls.Button
  $button.Style = $window.FindResource('CardActionButton')
  $button.Width = 62
  $button.Height = 30
  $button.Content = '启动'
  $button.Tag = $app
  $button.VerticalAlignment = [System.Windows.VerticalAlignment]::Center
  $button.Add_Click({
    param($sender, $eventArgs)
    $eventArgs.Handled = $true
    Toggle-App $sender.Tag
  })
  [System.Windows.Controls.Grid]::SetColumn($button, 2)
  [void]$grid.Children.Add($button)

  $card.Child = $grid
  $card.Add_MouseEnter({
    param($sender, $eventArgs)
    $sender.Background = $script:BrushCardHover
    $sender.BorderBrush = $script:BrushCardHoverBorder
  })
  $card.Add_MouseLeave({
    param($sender, $eventArgs)
    Update-CardState $sender.Tag.Dir
  })
  $card.Add_MouseLeftButtonUp({
    param($sender, $eventArgs)
    if (-not $eventArgs.Handled) { Toggle-App $sender.Tag }
  })

  $script:CardRefs[$app.Dir] = [pscustomobject]@{
    Card = $card
    Dot = $dot
    Status = $status
    Button = $button
  }
  Update-CardState $app.Dir
  return $card
}

function Render-AppList {
  $script:AppsPanel.Children.Clear()
  $script:CardRefs = @{}
  $query = $script:SearchText.ToLowerInvariant()
  $list = @($script:Apps | Where-Object {
    ($script:SelectedCategory -eq 'all' -or $_.Category -eq $script:SelectedCategory) -and
    ([string]::IsNullOrEmpty($query) -or (($_.Name + ' ' + $_.Dir + ' ' + $_.Desc).ToLowerInvariant().Contains($query)))
  })

  $category = $script:Categories | Where-Object { $_.Key -eq $script:SelectedCategory } | Select-Object -First 1
  $script:CategoryTitle.Text = $category.Name
  if ($script:SelectedCategory -eq 'all' -and [string]::IsNullOrEmpty($query)) {
    $script:CategorySubtitle.Text = '51 个本地应用，选择卡片即可启动'
  } else {
    $script:CategorySubtitle.Text = "$($list.Count) 个应用"
  }
  $script:ResultCountText.Text = "$($list.Count) 个应用"

  if ($list.Count -eq 0) {
    $script:EmptyState.Visibility = [System.Windows.Visibility]::Visible
  } else {
    $script:EmptyState.Visibility = [System.Windows.Visibility]::Collapsed
  }

  foreach ($app in $list) {
    [void]$script:AppsPanel.Children.Add((New-AppCard $app))
  }
  Update-GlobalStatus
}

function Get-LogText([string]$path) {
  if (-not (Test-Path $path)) { return '' }
  try { return (Get-Content -LiteralPath $path -Tail 40 -ErrorAction SilentlyContinue) -join "`n" }
  catch { return '' }
}

function Update-States {
  foreach ($dir in @($script:States.Keys)) {
    $entry = $script:States[$dir]
    if ($entry.Process) {
      if ($entry.Process.HasExited) {
        $code = $entry.Process.ExitCode
        if ($code -ne 0) { $entry.State = 'error' } else { $entry.State = 'stopped' }
        $entry.Process.Dispose()
        $entry.Process = $null
        Release-AppPort $entry
      } elseif ($entry.State -eq 'starting' -or $entry.State -eq 'installing') {
        $logText = Get-LogText $entry.Log
        if ($logText -match 'ready in|Local:') {
          $entry.State = 'running'
        } elseif ($logText -match 'Installing dependencies') {
          $entry.State = 'installing'
        }
      }
    }
    Update-CardState $dir
  }
  Update-GlobalStatus
}

function Start-App($app) {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    [System.Windows.MessageBox]::Show('未找到 Node.js。请安装 Node.js 22.12 或更高版本。', 'Everything Launcher', 'OK', 'Warning') | Out-Null
    return
  }
  if (-not (Test-Path $script:LogDir)) { New-Item -ItemType Directory -Path $script:LogDir -Force | Out-Null }
  $categoryFolder = $script:CategoryFolders[$app.Category]
  $wrapper = Join-Path (Join-Path $script:LauncherRoot $categoryFolder) ($app.Name + '.bat')
  $log = Join-Path $script:LogDir ($app.Dir + '.log')
  $needsInstall = -not (Test-Path (Join-Path $script:RepoRoot ('src\' + $app.Dir + '\node_modules')))
  try {
    $port = Get-AvailableAppPort
  } catch {
    [System.Windows.MessageBox]::Show($_.Exception.Message, 'Everything Launcher', 'OK', 'Warning') | Out-Null
    return
  }
  $script:ReservedPorts[$port] = $app.Dir

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $env:ComSpec
  $psi.Arguments = '/d /c ""' + $wrapper + '" > "' + $log + '" 2>&1"'
  $psi.WorkingDirectory = $script:LauncherRoot
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $psi.EnvironmentVariables['EVERYTHING_LAUNCH_NO_PAUSE'] = '1'
  $psi.EnvironmentVariables['EVERYTHING_LAUNCH_PORT'] = [string]$port

  try {
    $process = [System.Diagnostics.Process]::Start($psi)
    $state = 'starting'
    if ($needsInstall) { $state = 'installing' }
    $script:States[$app.Dir] = [pscustomobject]@{
      Process = $process
      State = $state
      Log = $log
      Port = $port
      Started = Get-Date
    }
    $script:StatusText.Text = "正在启动 $($app.Name)…"
    Update-CardState $app.Dir
    Update-GlobalStatus
  } catch {
    [void]$script:ReservedPorts.Remove([int]$port)
    [System.Windows.MessageBox]::Show("启动 $($app.Name) 失败：`n$($_.Exception.Message)", 'Everything Launcher', 'OK', 'Error') | Out-Null
  }
}

function Stop-App([string]$dir) {
  $entry = $script:States[$dir]
  if (-not $entry) { return }
  if ($entry.Process -and -not $entry.Process.HasExited) {
    try {
      $killInfo = New-Object System.Diagnostics.ProcessStartInfo
      $killInfo.FileName = Join-Path $env:SystemRoot 'System32\taskkill.exe'
      $killInfo.Arguments = "/PID $($entry.Process.Id) /T /F"
      $killInfo.UseShellExecute = $false
      $killInfo.CreateNoWindow = $true
      $killInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
      $killer = [System.Diagnostics.Process]::Start($killInfo)
      [void]$killer.WaitForExit(4000)
    } catch {}
  }
  $entry.Process = $null
  $entry.State = 'stopped'
  Release-AppPort $entry
  Update-CardState $dir
  Update-GlobalStatus
}

function Stop-AllApps {
  foreach ($dir in @($script:States.Keys)) { Stop-App $dir }
  Stop-ProjectDevServers
}

function Toggle-App($app) {
  $entry = $script:States[$app.Dir]
  if ($entry -and $entry.Process -and -not $entry.Process.HasExited) {
    Stop-App $app.Dir
  } else {
    Start-App $app
  }
}

$script:CategoryFolders = @{
  office = '01-Office'
  collab = '02-Collaboration'
  creative = '03-Creative'
  engineering = '04-Engineering'
  productivity = '05-Productivity'
  finance = '06-Finance'
  business = '07-Business'
  developer = '08-Developer'
  games = '09-Games'
}

$script:Timer = New-Object System.Windows.Threading.DispatcherTimer
$script:Timer.Interval = [TimeSpan]::FromMilliseconds(900)
$script:Timer.Add_Tick({ Update-States })
$script:Timer.Start()

$window.Add_Closing({
  param($sender, $eventArgs)
  $script:Timer.Stop()
  Stop-AllApps
})

Render-Categories
Render-AppList
[void]$window.ShowDialog()
try { $script:Mutex.ReleaseMutex() } catch {}
