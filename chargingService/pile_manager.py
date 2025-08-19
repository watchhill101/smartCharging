"""
充电桩管理模块
管理充电桩的连接状态、配置信息和实时数据
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import logging
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)

class PileStatus(Enum):
    """充电桩状态"""
    AVAILABLE = "Available"           # 可用
    PREPARING = "Preparing"           # 准备中
    CHARGING = "Charging"             # 充电中
    SUSPENDED_EV = "SuspendedEV"      # 车辆暂停
    SUSPENDED_EVSE = "SuspendedEVSE"  # 充电桩暂停
    FINISHING = "Finishing"           # 结束中
    RESERVED = "Reserved"             # 已预约
    UNAVAILABLE = "Unavailable"       # 不可用
    FAULTED = "Faulted"              # 故障

class ConnectorStatus(Enum):
    """连接器状态"""
    AVAILABLE = "Available"
    PREPARING = "Preparing"
    CHARGING = "Charging"
    SUSPENDED_EV = "SuspendedEV"
    SUSPENDED_EVSE = "SuspendedEVSE"
    FINISHING = "Finishing"
    RESERVED = "Reserved"
    UNAVAILABLE = "Unavailable"
    FAULTED = "Faulted"

@dataclass
class Connector:
    """充电连接器"""
    connector_id: int
    status: ConnectorStatus
    error_code: str = "NoError"
    info: Optional[str] = None
    vendor_id: Optional[str] = None
    vendor_error_code: Optional[str] = None
    
    def to_dict(self) -> Dict:
        data = asdict(self)
        data['status'] = self.status.value if isinstance(self.status, ConnectorStatus) else self.status
        return data

@dataclass
class ChargingPile:
    """充电桩"""
    pile_id: str
    station_id: str
    pile_number: str
    
    # 基本信息
    charge_point_vendor: Optional[str] = None
    charge_point_model: Optional[str] = None
    charge_point_serial_number: Optional[str] = None
    firmware_version: Optional[str] = None
    
    # 状态信息
    status: PileStatus = PileStatus.UNAVAILABLE
    is_online: bool = False
    last_heartbeat: Optional[datetime] = None
    last_boot_time: Optional[datetime] = None
    
    # 连接器信息
    connectors: List[Connector] = None
    
    # 配置信息
    max_power: float = 0.0  # 最大功率 kW
    supported_protocols: List[str] = None
    
    # 位置信息
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # WebSocket连接
    websocket: Optional[Any] = None
    
    def __post_init__(self):
        if self.connectors is None:
            # 默认创建一个连接器
            self.connectors = [Connector(
                connector_id=1,
                status=ConnectorStatus.UNAVAILABLE
            )]
        if self.supported_protocols is None:
            self.supported_protocols = ["OCPP16"]
    
    def to_dict(self) -> Dict:
        data = asdict(self)
        data['status'] = self.status.value if isinstance(self.status, PileStatus) else self.status
        data['last_heartbeat'] = self.last_heartbeat.isoformat() if self.last_heartbeat else None
        data['last_boot_time'] = self.last_boot_time.isoformat() if self.last_boot_time else None
        data['connectors'] = [c.to_dict() for c in self.connectors]
        # 移除websocket字段
        data.pop('websocket', None)
        return data

class ChargingPileManager:
    """充电桩管理器"""
    
    def __init__(self):
        self.piles: Dict[str, ChargingPile] = {}
        self.station_piles: Dict[str, List[str]] = {}  # station_id -> [pile_ids]
        
        # 监控任务
        self.heartbeat_monitor_task: Optional[asyncio.Task] = None
        self.heartbeat_timeout = 600  # 10分钟心跳超时
        
    async def initialize(self):
        """初始化充电桩管理器"""
        logger.info("初始化充电桩管理器...")
        
        # 启动心跳监控任务
        self.heartbeat_monitor_task = asyncio.create_task(self.heartbeat_monitor())
        
        # 这里可以从数据库加载充电桩配置
        await self.load_piles_from_config()
        
    async def cleanup(self):
        """清理资源"""
        logger.info("清理充电桩管理器资源...")
        
        # 停止监控任务
        if self.heartbeat_monitor_task:
            self.heartbeat_monitor_task.cancel()
            try:
                await self.heartbeat_monitor_task
            except asyncio.CancelledError:
                pass
        
        self.piles.clear()
        self.station_piles.clear()
    
    async def load_piles_from_config(self):
        """从配置加载充电桩信息"""
        # 这里应该从数据库或配置文件加载
        # 暂时创建一些示例充电桩
        sample_piles = [
            {
                "pile_id": "pile_001",
                "station_id": "station_001",
                "pile_number": "A001",
                "max_power": 60.0,
                "latitude": 39.9042,
                "longitude": 116.4074
            },
            {
                "pile_id": "pile_002",
                "station_id": "station_001",
                "pile_number": "A002",
                "max_power": 60.0,
                "latitude": 39.9042,
                "longitude": 116.4074
            },
            {
                "pile_id": "pile_003",
                "station_id": "station_002",
                "pile_number": "B001",
                "max_power": 7.0,
                "latitude": 39.9100,
                "longitude": 116.4100
            }
        ]
        
        for pile_config in sample_piles:
            pile = ChargingPile(**pile_config)
            self.piles[pile.pile_id] = pile
            
            # 更新站点索引
            if pile.station_id not in self.station_piles:
                self.station_piles[pile.station_id] = []
            self.station_piles[pile.station_id].append(pile.pile_id)
        
        logger.info(f"加载了 {len(sample_piles)} 个充电桩配置")
    
    async def register_pile(self, pile_id: str, websocket):
        """注册充电桩连接"""
        pile = self.piles.get(pile_id)
        if not pile:
            # 创建新的充电桩
            pile = ChargingPile(
                pile_id=pile_id,
                station_id="unknown",
                pile_number=pile_id
            )
            self.piles[pile_id] = pile
        
        pile.websocket = websocket
        pile.is_online = True
        pile.last_heartbeat = datetime.now(timezone.utc)
        pile.status = PileStatus.AVAILABLE
        
        # 更新连接器状态
        for connector in pile.connectors:
            connector.status = ConnectorStatus.AVAILABLE
        
        logger.info(f"充电桩 {pile_id} 已注册并上线")
        
    async def unregister_pile(self, pile_id: str):
        """注销充电桩连接"""
        pile = self.piles.get(pile_id)
        if pile:
            pile.websocket = None
            pile.is_online = False
            pile.status = PileStatus.UNAVAILABLE
            
            # 更新连接器状态
            for connector in pile.connectors:
                connector.status = ConnectorStatus.UNAVAILABLE
            
            logger.info(f"充电桩 {pile_id} 已下线")
    
    async def get_pile(self, pile_id: str) -> Optional[ChargingPile]:
        """获取充电桩信息"""
        return self.piles.get(pile_id)
    
    async def get_all_piles(self) -> List[ChargingPile]:
        """获取所有充电桩"""
        return list(self.piles.values())
    
    async def get_piles_by_station(self, station_id: str) -> List[ChargingPile]:
        """获取指定站点的充电桩"""
        pile_ids = self.station_piles.get(station_id, [])
        return [self.piles[pile_id] for pile_id in pile_ids if pile_id in self.piles]
    
    async def get_pile_status(self, pile_id: str) -> Optional[Dict]:
        """获取充电桩状态"""
        pile = self.piles.get(pile_id)
        if not pile:
            return None
        
        return {
            "pile_id": pile_id,
            "status": pile.status.value,
            "is_online": pile.is_online,
            "last_heartbeat": pile.last_heartbeat.isoformat() if pile.last_heartbeat else None,
            "connectors": [c.to_dict() for c in pile.connectors]
        }
    
    async def update_pile_info(self, pile_id: str, info: Dict):
        """更新充电桩信息"""
        pile = self.piles.get(pile_id)
        if not pile:
            return
        
        # 更新基本信息
        if "charge_point_vendor" in info:
            pile.charge_point_vendor = info["charge_point_vendor"]
        if "charge_point_model" in info:
            pile.charge_point_model = info["charge_point_model"]
        if "charge_point_serial_number" in info:
            pile.charge_point_serial_number = info["charge_point_serial_number"]
        if "firmware_version" in info:
            pile.firmware_version = info["firmware_version"]
        if "last_boot_time" in info:
            pile.last_boot_time = datetime.fromisoformat(info["last_boot_time"])
        
        logger.debug(f"更新充电桩 {pile_id} 信息: {info}")
    
    async def update_connector_status(
        self,
        pile_id: str,
        connector_id: int,
        status: str,
        error_code: str = "NoError"
    ):
        """更新连接器状态"""
        pile = self.piles.get(pile_id)
        if not pile:
            return
        
        # 查找连接器
        connector = None
        for c in pile.connectors:
            if c.connector_id == connector_id:
                connector = c
                break
        
        if not connector:
            # 创建新连接器
            connector = Connector(
                connector_id=connector_id,
                status=ConnectorStatus(status),
                error_code=error_code
            )
            pile.connectors.append(connector)
        else:
            connector.status = ConnectorStatus(status)
            connector.error_code = error_code
        
        # 更新充电桩整体状态
        await self.update_pile_status(pile_id)
        
        logger.debug(f"更新充电桩 {pile_id} 连接器 {connector_id} 状态: {status}")
    
    async def update_pile_status(self, pile_id: str):
        """根据连接器状态更新充电桩状态"""
        pile = self.piles.get(pile_id)
        if not pile:
            return
        
        # 如果充电桩离线，状态为不可用
        if not pile.is_online:
            pile.status = PileStatus.UNAVAILABLE
            return
        
        # 根据连接器状态确定充电桩状态
        connector_statuses = [c.status for c in pile.connectors]
        
        if any(s == ConnectorStatus.FAULTED for s in connector_statuses):
            pile.status = PileStatus.FAULTED
        elif any(s == ConnectorStatus.CHARGING for s in connector_statuses):
            pile.status = PileStatus.CHARGING
        elif any(s in [ConnectorStatus.SUSPENDED_EV, ConnectorStatus.SUSPENDED_EVSE] for s in connector_statuses):
            pile.status = PileStatus.SUSPENDED_EV if ConnectorStatus.SUSPENDED_EV in connector_statuses else PileStatus.SUSPENDED_EVSE
        elif any(s == ConnectorStatus.PREPARING for s in connector_statuses):
            pile.status = PileStatus.PREPARING
        elif any(s == ConnectorStatus.FINISHING for s in connector_statuses):
            pile.status = PileStatus.FINISHING
        elif any(s == ConnectorStatus.RESERVED for s in connector_statuses):
            pile.status = PileStatus.RESERVED
        elif all(s == ConnectorStatus.AVAILABLE for s in connector_statuses):
            pile.status = PileStatus.AVAILABLE
        else:
            pile.status = PileStatus.UNAVAILABLE
    
    async def update_last_heartbeat(self, pile_id: str):
        """更新最后心跳时间"""
        pile = self.piles.get(pile_id)
        if pile:
            pile.last_heartbeat = datetime.now(timezone.utc)
    
    async def heartbeat_monitor(self):
        """心跳监控任务"""
        while True:
            try:
                await asyncio.sleep(60)  # 每分钟检查一次
                
                current_time = datetime.now(timezone.utc)
                timeout_threshold = current_time - timedelta(seconds=self.heartbeat_timeout)
                
                for pile_id, pile in self.piles.items():
                    if pile.is_online and pile.last_heartbeat:
                        if pile.last_heartbeat < timeout_threshold:
                            logger.warning(f"充电桩 {pile_id} 心跳超时，标记为离线")
                            await self.unregister_pile(pile_id)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"心跳监控任务错误: {e}")
    
    async def get_online_piles(self) -> List[ChargingPile]:
        """获取在线充电桩列表"""
        return [pile for pile in self.piles.values() if pile.is_online]
    
    async def get_available_piles(self) -> List[ChargingPile]:
        """获取可用充电桩列表"""
        return [pile for pile in self.piles.values() if pile.status == PileStatus.AVAILABLE]
    
    async def get_charging_piles(self) -> List[ChargingPile]:
        """获取正在充电的充电桩列表"""
        return [pile for pile in self.piles.values() if pile.status == PileStatus.CHARGING]
    
    async def get_pile_statistics(self) -> Dict[str, Any]:
        """获取充电桩统计信息"""
        total_piles = len(self.piles)
        online_piles = len(await self.get_online_piles())
        available_piles = len(await self.get_available_piles())
        charging_piles = len(await self.get_charging_piles())
        
        # 按状态统计
        status_counts = {}
        for pile in self.piles.values():
            status = pile.status.value
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            "total_piles": total_piles,
            "online_piles": online_piles,
            "available_piles": available_piles,
            "charging_piles": charging_piles,
            "offline_piles": total_piles - online_piles,
            "status_distribution": status_counts,
            "online_rate": online_piles / total_piles if total_piles > 0 else 0,
            "availability_rate": available_piles / online_piles if online_piles > 0 else 0
        }
    
    async def send_message_to_pile(self, pile_id: str, message: Dict) -> bool:
        """向充电桩发送消息"""
        pile = self.piles.get(pile_id)
        if not pile or not pile.websocket:
            logger.warning(f"充电桩 {pile_id} 不在线，无法发送消息")
            return False
        
        try:
            await pile.websocket.send_json(message)
            return True
        except Exception as e:
            logger.error(f"向充电桩 {pile_id} 发送消息失败: {e}")
            # 标记充电桩为离线
            await self.unregister_pile(pile_id)
            return False

# 全局充电桩管理器实例
pile_manager = ChargingPileManager()