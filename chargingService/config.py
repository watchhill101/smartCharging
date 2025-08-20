"""
OCPP充电服务配置
"""

import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """应用配置"""
    
    # 服务配置
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    DEBUG: bool = False
    
    # CORS配置
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8080",
        "https://localhost:3000",
        "https://localhost:8080"
    ]
    
    # 数据库配置
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "charging_service"
    
    # Redis配置
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_DB: int = 1
    
    # OCPP配置
    OCPP_VERSION: str = "1.6"
    HEARTBEAT_INTERVAL: int = 300  # 5分钟
    HEARTBEAT_TIMEOUT: int = 600   # 10分钟
    
    # 充电配置
    DEFAULT_PRICE_PER_KWH: float = 1.5  # 默认电价
    MAX_CHARGING_POWER: float = 350.0   # 最大充电功率 kW
    MIN_CHARGING_POWER: float = 3.3     # 最小充电功率 kW
    
    # 安全配置
    SECRET_KEY: str = "your-secret-key-here"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24小时
    
    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "charging_service.log"
    LOG_MAX_SIZE: int = 10 * 1024 * 1024  # 10MB
    LOG_BACKUP_COUNT: int = 5
    
    # WebSocket配置
    WS_PING_INTERVAL: int = 30
    WS_PING_TIMEOUT: int = 10
    WS_MAX_CONNECTIONS: int = 1000
    
    # 监控配置
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    
    # 外部服务配置
    USER_SERVICE_URL: str = "http://localhost:3000/api"
    PAYMENT_SERVICE_URL: str = "http://localhost:3001/api"
    NOTIFICATION_SERVICE_URL: str = "http://localhost:3002/api"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# 创建全局配置实例
settings = Settings()

# OCPP配置常量
OCPP_CONFIG = {
    "version": "1.6J",
    "supported_features": [
        "Core",
        "FirmwareManagement", 
        "LocalAuthListManagement",
        "Reservation",
        "SmartCharging",
        "RemoteTrigger"
    ],
    "message_timeout": 30,  # 消息超时时间（秒）
    "max_message_size": 1024 * 1024,  # 最大消息大小（1MB）
}

# 充电桩状态映射
PILE_STATUS_MAPPING = {
    "Available": "可用",
    "Preparing": "准备中", 
    "Charging": "充电中",
    "SuspendedEV": "车辆暂停",
    "SuspendedEVSE": "充电桩暂停",
    "Finishing": "结束中",
    "Reserved": "已预约",
    "Unavailable": "不可用",
    "Faulted": "故障"
}

# 错误代码映射
ERROR_CODE_MAPPING = {
    "NoError": "无错误",
    "ConnectorLockFailure": "连接器锁定失败",
    "EVCommunicationError": "车辆通信错误",
    "GroundFailure": "接地故障",
    "HighTemperature": "高温",
    "InternalError": "内部错误",
    "LocalListConflict": "本地列表冲突",
    "OtherError": "其他错误",
    "OverCurrentFailure": "过流故障",
    "PowerMeterFailure": "电表故障",
    "PowerSwitchFailure": "电源开关故障",
    "ReaderFailure": "读卡器故障",
    "ResetFailure": "重置失败",
    "UnderVoltage": "欠压",
    "OverVoltage": "过压",
    "WeakSignal": "信号弱"
}

# 停止原因映射
STOP_REASON_MAPPING = {
    "EmergencyStop": "紧急停止",
    "EVDisconnected": "车辆断开",
    "HardReset": "硬重置",
    "Local": "本地停止",
    "Other": "其他",
    "PowerLoss": "断电",
    "Reboot": "重启",
    "Remote": "远程停止",
    "SoftReset": "软重置",
    "UnlockCommand": "解锁命令",
    "DeAuthorized": "取消授权"
}

# 计量单位映射
UNIT_MAPPING = {
    "Wh": "瓦时",
    "kWh": "千瓦时", 
    "varh": "乏时",
    "kvarh": "千乏时",
    "W": "瓦",
    "kW": "千瓦",
    "VA": "伏安",
    "kVA": "千伏安",
    "var": "乏",
    "kvar": "千乏",
    "A": "安培",
    "V": "伏特",
    "K": "开尔文",
    "Celcius": "摄氏度",
    "Fahrenheit": "华氏度",
    "Percent": "百分比"
}

# 默认配置值
DEFAULT_CONFIG = {
    "AuthorizeRemoteTxRequests": "true",
    "ClockAlignedDataInterval": "0",
    "ConnectionTimeOut": "60",
    "GetConfigurationMaxKeys": "50",
    "HeartbeatInterval": "86400",
    "LocalAuthorizeOffline": "true",
    "LocalPreAuthorize": "false",
    "MeterValuesAlignedData": "Energy.Active.Import.Register",
    "MeterValuesSampledData": "Energy.Active.Import.Register",
    "MeterValueSampleInterval": "60",
    "NumberOfConnectors": "1",
    "ResetRetries": "3",
    "StopTransactionOnEVSideDisconnect": "true",
    "StopTransactionOnInvalidId": "true",
    "StopTxnAlignedData": "Energy.Active.Import.Register",
    "StopTxnSampledData": "Energy.Active.Import.Register",
    "SupportedFeatureProfiles": "Core,FirmwareManagement,LocalAuthListManagement,Reservation,SmartCharging,RemoteTrigger",
    "TransactionMessageAttempts": "3",
    "TransactionMessageRetryInterval": "60",
    "UnlockConnectorOnEVSideDisconnect": "true",
    "WebSocketPingInterval": "54"
}