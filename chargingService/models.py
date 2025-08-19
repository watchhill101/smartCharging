"""
OCPP数据模型定义
定义OCPP协议中使用的各种消息和数据结构
"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field
from enum import Enum

# OCPP消息类型
class MessageType(Enum):
    CALL = 2
    CALLRESULT = 3
    CALLERROR = 4

# OCPP操作类型
class Action(Enum):
    # 充电桩发起的操作
    BOOT_NOTIFICATION = "BootNotification"
    STATUS_NOTIFICATION = "StatusNotification"
    START_TRANSACTION = "StartTransaction"
    STOP_TRANSACTION = "StopTransaction"
    HEARTBEAT = "Heartbeat"
    METER_VALUES = "MeterValues"
    AUTHORIZE = "Authorize"
    
    # 中央系统发起的操作
    REMOTE_START_TRANSACTION = "RemoteStartTransaction"
    REMOTE_STOP_TRANSACTION = "RemoteStopTransaction"
    RESET = "Reset"
    UNLOCK_CONNECTOR = "UnlockConnector"
    CHANGE_CONFIGURATION = "ChangeConfiguration"
    GET_CONFIGURATION = "GetConfiguration"

# 基础OCPP消息
class OCPPMessage(BaseModel):
    message_type: MessageType
    message_id: str
    action: Optional[str] = None
    payload: Dict[str, Any] = {}

# 状态枚举
class ChargePointStatus(str, Enum):
    AVAILABLE = "Available"
    PREPARING = "Preparing"
    CHARGING = "Charging"
    SUSPENDED_EV = "SuspendedEV"
    SUSPENDED_EVSE = "SuspendedEVSE"
    FINISHING = "Finishing"
    RESERVED = "Reserved"
    UNAVAILABLE = "Unavailable"
    FAULTED = "Faulted"

class ChargePointErrorCode(str, Enum):
    CONNECTOR_LOCK_FAILURE = "ConnectorLockFailure"
    EV_COMMUNICATION_ERROR = "EVCommunicationError"
    GROUND_FAILURE = "GroundFailure"
    HIGH_TEMPERATURE = "HighTemperature"
    INTERNAL_ERROR = "InternalError"
    LOCAL_LIST_CONFLICT = "LocalListConflict"
    NO_ERROR = "NoError"
    OTHER_ERROR = "OtherError"
    OVER_CURRENT_FAILURE = "OverCurrentFailure"
    POWER_METER_FAILURE = "PowerMeterFailure"
    POWER_SWITCH_FAILURE = "PowerSwitchFailure"
    READER_FAILURE = "ReaderFailure"
    RESET_FAILURE = "ResetFailure"
    UNDER_VOLTAGE = "UnderVoltage"
    OVER_VOLTAGE = "OverVoltage"
    WEAK_SIGNAL = "WeakSignal"

class AuthorizationStatus(str, Enum):
    ACCEPTED = "Accepted"
    BLOCKED = "Blocked"
    EXPIRED = "Expired"
    INVALID = "Invalid"
    CONCURRENT_TX = "ConcurrentTx"

class Reason(str, Enum):
    EMERGENCY_STOP = "EmergencyStop"
    EV_DISCONNECTED = "EVDisconnected"
    HARD_RESET = "HardReset"
    LOCAL = "Local"
    OTHER = "Other"
    POWER_LOSS = "PowerLoss"
    REBOOT = "Reboot"
    REMOTE = "Remote"
    SOFT_RESET = "SoftReset"
    UNLOCK_COMMAND = "UnlockCommand"
    DE_AUTHORIZED = "DeAuthorized"

# BootNotification相关
class BootNotificationRequest(BaseModel):
    charge_point_vendor: str = Field(..., alias="chargePointVendor")
    charge_point_model: str = Field(..., alias="chargePointModel")
    charge_point_serial_number: Optional[str] = Field(None, alias="chargePointSerialNumber")
    charge_box_serial_number: Optional[str] = Field(None, alias="chargeBoxSerialNumber")
    firmware_version: Optional[str] = Field(None, alias="firmwareVersion")
    iccid: Optional[str] = None
    imsi: Optional[str] = None
    meter_type: Optional[str] = Field(None, alias="meterType")
    meter_serial_number: Optional[str] = Field(None, alias="meterSerialNumber")

class BootNotificationResponse(BaseModel):
    status: str  # Accepted, Pending, Rejected
    current_time: str = Field(..., alias="currentTime")
    interval: int

# StatusNotification相关
class StatusNotificationRequest(BaseModel):
    connector_id: int = Field(..., alias="connectorId")
    error_code: ChargePointErrorCode = Field(..., alias="errorCode")
    status: ChargePointStatus
    info: Optional[str] = None
    timestamp: Optional[str] = None
    vendor_id: Optional[str] = Field(None, alias="vendorId")
    vendor_error_code: Optional[str] = Field(None, alias="vendorErrorCode")

class StatusNotificationResponse(BaseModel):
    pass  # 空响应

# Authorize相关
class IdTagInfo(BaseModel):
    status: AuthorizationStatus
    expiry_date: Optional[str] = Field(None, alias="expiryDate")
    parent_id_tag: Optional[str] = Field(None, alias="parentIdTag")

class AuthorizeRequest(BaseModel):
    id_tag: str = Field(..., alias="idTag")

class AuthorizeResponse(BaseModel):
    id_tag_info: IdTagInfo = Field(..., alias="idTagInfo")

# StartTransaction相关
class StartTransactionRequest(BaseModel):
    connector_id: int = Field(..., alias="connectorId")
    id_tag: str = Field(..., alias="idTag")
    meter_start: int = Field(..., alias="meterStart")
    timestamp: str
    reservation_id: Optional[int] = Field(None, alias="reservationId")

class StartTransactionResponse(BaseModel):
    id_tag_info: IdTagInfo = Field(..., alias="idTagInfo")
    transaction_id: int = Field(..., alias="transactionId")

# StopTransaction相关
class SampledValue(BaseModel):
    value: str
    context: Optional[str] = None
    format: Optional[str] = None
    measurand: Optional[str] = None
    phase: Optional[str] = None
    location: Optional[str] = None
    unit: Optional[str] = None

class MeterValue(BaseModel):
    timestamp: str
    sampled_value: List[SampledValue] = Field(..., alias="sampledValue")

class StopTransactionRequest(BaseModel):
    meter_stop: int = Field(..., alias="meterStop")
    timestamp: str
    transaction_id: int = Field(..., alias="transactionId")
    reason: Optional[Reason] = None
    id_tag: Optional[str] = Field(None, alias="idTag")
    transaction_data: Optional[List[MeterValue]] = Field(None, alias="transactionData")

class StopTransactionResponse(BaseModel):
    id_tag_info: Optional[IdTagInfo] = Field(None, alias="idTagInfo")

# Heartbeat相关
class HeartbeatRequest(BaseModel):
    pass  # 空请求

class HeartbeatResponse(BaseModel):
    current_time: str = Field(..., alias="currentTime")

# MeterValues相关
class MeterValuesRequest(BaseModel):
    connector_id: int = Field(..., alias="connectorId")
    transaction_id: Optional[int] = Field(None, alias="transactionId")
    meter_value: List[MeterValue] = Field(..., alias="meterValue")

class MeterValuesResponse(BaseModel):
    pass  # 空响应

# RemoteStartTransaction相关
class ChargingProfile(BaseModel):
    charging_profile_id: int = Field(..., alias="chargingProfileId")
    stack_level: int = Field(..., alias="stackLevel")
    charging_profile_purpose: str = Field(..., alias="chargingProfilePurpose")
    charging_profile_kind: str = Field(..., alias="chargingProfileKind")
    recurrency_kind: Optional[str] = Field(None, alias="recurrencyKind")
    valid_from: Optional[str] = Field(None, alias="validFrom")
    valid_to: Optional[str] = Field(None, alias="validTo")

class RemoteStartTransactionRequest(BaseModel):
    connector_id: Optional[int] = Field(None, alias="connectorId")
    id_tag: str = Field(..., alias="idTag")
    charging_profile: Optional[ChargingProfile] = Field(None, alias="chargingProfile")

class RemoteStartTransactionResponse(BaseModel):
    status: str  # Accepted, Rejected

# RemoteStopTransaction相关
class RemoteStopTransactionRequest(BaseModel):
    transaction_id: int = Field(..., alias="transactionId")

class RemoteStopTransactionResponse(BaseModel):
    status: str  # Accepted, Rejected

# Reset相关
class ResetRequest(BaseModel):
    type: str  # Hard, Soft

class ResetResponse(BaseModel):
    status: str  # Accepted, Rejected

# UnlockConnector相关
class UnlockConnectorRequest(BaseModel):
    connector_id: int = Field(..., alias="connectorId")

class UnlockConnectorResponse(BaseModel):
    status: str  # Unlocked, UnlockFailed, NotSupported

# 充电桩信息
class ChargingPile(BaseModel):
    pile_id: str
    station_id: str
    pile_number: str
    charge_point_vendor: Optional[str] = None
    charge_point_model: Optional[str] = None
    charge_point_serial_number: Optional[str] = None
    firmware_version: Optional[str] = None
    status: ChargePointStatus = ChargePointStatus.UNAVAILABLE
    is_online: bool = False
    last_heartbeat: Optional[datetime] = None
    last_boot_time: Optional[datetime] = None
    max_power: float = 0.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None

# 充电会话
class ChargingSession(BaseModel):
    session_id: str
    pile_id: str
    connector_id: int
    user_id: Optional[str] = None
    id_tag: str
    transaction_id: Optional[int] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    meter_start: float = 0.0
    meter_stop: Optional[float] = None
    status: str = "Preparing"
    stop_reason: Optional[str] = None
    energy_delivered: float = 0.0
    cost: float = 0.0
    current_power: float = 0.0

# 配置项
class ConfigurationKey(BaseModel):
    key: str
    readonly: bool
    value: Optional[str] = None

# 错误响应
class CallError(BaseModel):
    error_code: str
    error_description: str
    error_details: Dict[str, Any] = {}

# 统计信息
class Statistics(BaseModel):
    total_piles: int = 0
    online_piles: int = 0
    available_piles: int = 0
    charging_piles: int = 0
    total_sessions: int = 0
    active_sessions: int = 0
    total_energy_delivered: float = 0.0
    uptime: str = ""

# API请求/响应模型
class StartChargingRequest(BaseModel):
    pile_id: str
    user_id: str
    connector_id: int = 1
    id_tag: str

class StopChargingRequest(BaseModel):
    pile_id: str
    session_id: str
    reason: str = "Local"

class ChargingStatusResponse(BaseModel):
    pile_id: str
    status: str
    session_id: Optional[str] = None
    current_power: Optional[float] = None
    energy_delivered: Optional[float] = None
    duration: Optional[int] = None
    cost: Optional[float] = None

# WebSocket消息
class WebSocketMessage(BaseModel):
    type: str
    data: Dict[str, Any] = {}
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())

# 响应包装器
class APIResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: str = ""
    error: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())