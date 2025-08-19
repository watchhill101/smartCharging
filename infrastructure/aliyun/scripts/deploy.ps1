# 阿里云基础设施部署脚本 (PowerShell版本)
# 使用方法: .\deploy.ps1 [init|plan|apply|destroy]

param(
    [Parameter(Position=0)]
    [ValidateSet("init", "validate", "plan", "apply", "destroy", "output", "help")]
    [string]$Command = "help"
)

# 颜色定义
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
}

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "Info"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    switch ($Level) {
        "Info" { Write-Host "[$timestamp] [INFO] $Message" -ForegroundColor $Colors.Blue }
        "Success" { Write-Host "[$timestamp] [SUCCESS] $Message" -ForegroundColor $Colors.Green }
        "Warning" { Write-Host "[$timestamp] [WARNING] $Message" -ForegroundColor $Colors.Yellow }
        "Error" { Write-Host "[$timestamp] [ERROR] $Message" -ForegroundColor $Colors.Red }
    }
}

# 检查必要工具
function Test-Prerequisites {
    Write-Log "检查必要工具..." "Info"
    
    if (-not (Get-Command terraform -ErrorAction SilentlyContinue)) {
        Write-Log "Terraform 未安装，请先安装 Terraform" "Error"
        exit 1
    }
    
    if (-not (Get-Command aliyun -ErrorAction SilentlyContinue)) {
        Write-Log "阿里云CLI未安装，建议安装以便管理资源" "Warning"
    }
    
    Write-Log "工具检查完成" "Success"
}

# 检查配置文件
function Test-Config {
    Write-Log "检查配置文件..." "Info"
    
    if (-not (Test-Path "terraform.tfvars")) {
        Write-Log "terraform.tfvars 文件不存在" "Error"
        Write-Log "请复制 terraform.tfvars.example 为 terraform.tfvars 并填入实际值" "Info"
        exit 1
    }
    
    if (-not (Test-Path "certs")) {
        Write-Log "certs 目录不存在，将创建示例证书目录" "Warning"
        New-Item -ItemType Directory -Path "certs" -Force | Out-Null
        Write-Log "请将SSL证书文件放入 certs\ 目录：" "Info"
        Write-Log "  - domain.crt (证书文件)" "Info"
        Write-Log "  - domain.key (私钥文件)" "Info"
    }
    
    Write-Log "配置检查完成" "Success"
}

# 初始化Terraform
function Initialize-Terraform {
    Write-Log "初始化 Terraform..." "Info"
    terraform init
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Terraform 初始化完成" "Success"
    } else {
        Write-Log "Terraform 初始化失败" "Error"
        exit 1
    }
}

# 验证配置
function Test-TerraformConfig {
    Write-Log "验证 Terraform 配置..." "Info"
    terraform validate
    if ($LASTEXITCODE -eq 0) {
        Write-Log "配置验证通过" "Success"
    } else {
        Write-Log "配置验证失败" "Error"
        exit 1
    }
}

# 规划部署
function New-TerraformPlan {
    Write-Log "生成部署计划..." "Info"
    terraform plan -out=tfplan
    if ($LASTEXITCODE -eq 0) {
        Write-Log "部署计划生成完成" "Success"
    } else {
        Write-Log "部署计划生成失败" "Error"
        exit 1
    }
}

# 执行部署
function Start-TerraformApply {
    Write-Log "开始部署基础设施..." "Info"
    $response = Read-Host "这将创建阿里云资源并产生费用，确认继续？(y/N)"
    
    if ($response -match "^[yY]([eE][sS])?$") {
        if (Test-Path "tfplan") {
            terraform apply tfplan
        } else {
            terraform apply
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "基础设施部署完成" "Success"
            
            # 显示重要输出
            Write-Log "重要信息：" "Info"
            terraform output
        } else {
            Write-Log "基础设施部署失败" "Error"
            exit 1
        }
    } else {
        Write-Log "部署已取消" "Info"
        exit 0
    }
}

# 销毁资源
function Remove-TerraformResources {
    Write-Log "这将销毁所有阿里云资源，确认继续？(y/N)" "Warning"
    $response = Read-Host
    
    if ($response -match "^[yY]([eE][sS])?$") {
        Write-Log "开始销毁基础设施..." "Info"
        terraform destroy
        if ($LASTEXITCODE -eq 0) {
            Write-Log "基础设施销毁完成" "Success"
        } else {
            Write-Log "基础设施销毁失败" "Error"
            exit 1
        }
    } else {
        Write-Log "销毁已取消" "Info"
        exit 0
    }
}

# 显示帮助信息
function Show-Help {
    Write-Host @"
阿里云基础设施部署脚本 (PowerShell版本)

使用方法:
  .\deploy.ps1 [命令]

命令:
  init     初始化 Terraform
  validate 验证配置文件
  plan     生成部署计划
  apply    执行部署
  destroy  销毁资源
  output   显示输出信息
  help     显示帮助信息

示例:
  .\deploy.ps1 init
  .\deploy.ps1 plan
  .\deploy.ps1 apply
"@
}

# 主函数
function Main {
    # 切换到terraform目录
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    $terraformPath = Join-Path $scriptPath "..\terraform"
    
    if (Test-Path $terraformPath) {
        Set-Location $terraformPath
    } else {
        Write-Log "Terraform目录不存在: $terraformPath" "Error"
        exit 1
    }
    
    switch ($Command) {
        "init" {
            Test-Prerequisites
            Test-Config
            Initialize-Terraform
        }
        "validate" {
            Test-TerraformConfig
        }
        "plan" {
            Test-Prerequisites
            Test-Config
            Test-TerraformConfig
            New-TerraformPlan
        }
        "apply" {
            Test-Prerequisites
            Test-Config
            Test-TerraformConfig
            Start-TerraformApply
        }
        "destroy" {
            Remove-TerraformResources
        }
        "output" {
            terraform output
        }
        "help" {
            Show-Help
        }
        default {
            Write-Log "未知命令: $Command" "Error"
            Show-Help
            exit 1
        }
    }
}

# 执行主函数
Main