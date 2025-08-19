"""
充电会话管理模块
管理充电会话的生命周期、状态跟踪和数据存储
"""

import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import logging
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)

class SessionStatus(Enum):
    """充电会话状态"""
    PREPARING = "Preparing"      # 准备中
    CHARGING = "Charging"        # 充电中
    SUSPENDED_EV = "SuspendedEV" # 车辆暂停
    SUSPENDED_EVSE = "SuspendedEVSE"  # 充电桩暂停
    FINISHING = "Finishing"      # 结束中
    COMPLETED = "Completed"      # 已完成
    FAULTED = "Faulted"         # 故障
    CANCELLED = "Cancelled"      # 已取消

@dataclass
class MeterValue:
    """电表数据"""
    timestamp: str
    sampled_values: List[Dict[str, Any]]

@dataclass
class ChargingSession:
    """充电会话"""
    session_id: str
    pile_id: str
    connector_id: int
    user_id: Optional[str]
    id_tag: str
    transaction_id: Optional[int]
    
    # 时间信息
    start_time: datetime
    end_time: Optional[datetime]
    
    # 电表数据
    meter_start: float
    meter_stop: Optional[float]
    
    # 状态信息
    status: SessionStatus
    stop_reason: Optional[str]
    
    # 计费信息
    energy_delivered: float = 0.0
    cost: float = 0.0
    price_per_kwh: float = 1.5
    
    # 实时数据
    current_power: float = 0.0
    voltage: float = 0.0
    current: float = 0.0
    temperature: float = 0.0
    
    # 电表历史数据
    meter_values: List[MeterValue] = None
    
    def __post_init__(self):
        if self.meter_values is None:
            self.meter_values = []
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        data = asdict(self)
        data['start_time'] = self.start_time.isoformat() if self.start_time else None
        data['end_time'] = self.end_time.isoformat() if self.end_time else None
        data['status'] = self.status.value if isinstance(self.status, SessionStatus) else self.status
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ChargingSession':
        """从字典创建"""
        if 'start_time' in data and data['start_time']:
            data['start_time'] = datetime.fromisoformat(data['start_time'])
        if 'end_time' in data and data['end_time']:
            data['end_time'] = datetime.fromisoformat(data['end_time'])
        if 'status' in data:
            data['status'] = SessionStatus(data['status'])
        return cls(**data)

class ChargingSessionManager:
    """充电会话管理器"""
    
    def __init__(self):
        self.sessions: Dict[str, ChargingSession] = {}
        self.transaction_sessions: Dict[int, str] = {}  # transaction_id -> session_id
        self.pile_sessions: Dict[str, List[str]] = {}   # pile_id -> [session_ids]
        self.user_sessions: Dict[str, List[str]] = {}   # user_id -> [session_ids]
        
        # WebSocket连接管理
        self.client_subscriptions: Dict[str, Dict] = {}  # client_id -> {pile_id, websocket}
        
        # 统计数据
        self.total_sessions = 0
        self.total_energy_delivered = 0.0
        
    async def initialize(self):
        """初始化会话管理器"""
        logger.info("初始化充电会话管理器...")
        # 这里可以从数据库加载历史会话
        
    async def cleanup(self):
        """清理资源"""
        logger.info("清理充电会话管理器资源...")
        self.sessions.clear()
        self.transaction_sessions.clear()
        self.pile_sessions.clear()
        self.user_sessions.clear()
        self.client_subscriptions.clear()
    
    async def create_session(
        self,
        pile_id: str,
        user_id: str,
        connector_id: int,
        id_tag: str,
        transaction_id: Optional[int] = None
    ) -> ChargingSession:
        """创建充电会话"""
        session_id = self.generate_session_id()
        
        session = ChargingSession(
            session_id=session_id,
            pile_id=pile_id,
            connector_id=connector_id,
            user_id=user_id,
            id_tag=id_tag,
            transaction_id=transaction_id,
            start_time=datetime.now(timezone.utc),
            end_time=None,
            meter_start=0.0,
            meter_stop=None,
            status=SessionStatus.PREPARING
        )
        
        # 存储会话
        self.sessions[session_id] = session
        
        if transaction_id:
            self.transaction_sessions[transaction_id] = session_id
        
        # 更新索引
        if pile_id not in self.pile_sessions:
            self.pile_sessions[pile_id] = []
        self.pile_sessions[pile_id].append(session_id)
        
        if user_id:
            if user_id not in self.user_sessions:
                self.user_sessions[user_id] = []
            self.user_sessions[user_id].append(session_id)
        
        self.total_sessions += 1
        
        logger.info(f"创建充电会话: {session_id} - 充电桩: {pile_id}, 用户: {user_id}")
        
        # 通知订阅者
        await self.notify_session_update(session)
        
        return session
    
    async def create_session_from_pile(
        self,
        pile_id: str,
        connector_id: int,
        id_tag: str,
        transaction_id: int,
        meter_start: float,
        start_time: str
    ) -> ChargingSession:
        """从充电桩启动创建会话"""
        session_id = self.generate_session_id()
        
        # 解析时间
        start_datetime = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        
        session = ChargingSession(
            session_id=session_id,
            pile_id=pile_id,
            connector_id=connector_id,
            user_id=None,  # 从id_tag查找用户
            id_tag=id_tag,
            transaction_id=transaction_id,
            start_time=start_datetime,
            end_time=None,
            meter_start=meter_start,
            meter_stop=None,
            status=SessionStatus.CHARGING
        )
        
        # 存储会话
        self.sessions[session_id] = session
        self.transaction_sessions[transaction_id] = session_id
        
        # 更新索引
        if pile_id not in self.pile_sessions:
            self.pile_sessions[pile_id] = []
        self.pile_sessions[pile_id].append(session_id)
        
        self.total_sessions += 1
        
        logger.info(f"从充电桩创建会话: {session_id} - 交易: {transaction_id}")
        
        await self.notify_session_update(session)
        
        return session
    
    async def get_session(self, session_id: str) -> Optional[ChargingSession]:
        """获取充电会话"""
        return self.sessions.get(session_id)
    
    async def get_session_by_transaction(self, transaction_id: int) -> Optional[ChargingSession]:
        """根据交易ID获取会话"""
        session_id = self.transaction_sessions.get(transaction_id)
        if session_id:
            return self.sessions.get(session_id)
        return None
    
    async def update_session_status(self, session_id: str, status: SessionStatus):
        """更新会话状态"""
        session = self.sessions.get(session_id)
        if session:
            session.status = status
            logger.info(f"更新会话状态: {session_id} -> {status.value}")
            await self.notify_session_update(session)
    
    async def update_meter_values(self, transaction_id: int, meter_values: List[Dict]):
        """更新电表数据"""
        session = await self.get_session_by_transaction(transaction_id)
        if not session:
            logger.warning(f"未找到交易 {transaction_id} 对应的会话")
            return
        
        # 处理电表数据
        for meter_value in meter_values:
            timestamp = meter_value.get("timestamp")
            sampled_values = meter_value.get("sampledValue", [])
            
            # 创建电表数据对象
            meter_data = MeterValue(
                timestamp=timestamp,
                sampled_values=sampled_values
            )
            session.meter_values.append(meter_data)
            
            # 更新实时数据
            for sampled_value in sampled_values:
                measurand = sampled_value.get("measurand", "Energy.Active.Import.Register")
                value = float(sampled_value.get("value", 0))
                unit = sampled_value.get("unit", "Wh")
                
                if measurand == "Energy.Active.Import.Register":
                    if unit == "kWh":
                        session.energy_delivered = value
                    elif unit == "Wh":
                        session.energy_delivered = value / 1000
                        
                elif measurand == "Power.Active.Import":
                    if unit == "kW":
                        session.current_power = value
                    elif unit == "W":
                        session.current_power = value / 1000
                        
                elif measurand == "Voltage":
                    session.voltage = value
                    
                elif measurand == "Current.Import":
                    session.current = value
                    
                elif measurand == "Temperature":
                    session.temperature = value
            
            # 计算费用
            session.cost = session.energy_delivered * session.price_per_kwh
        
        logger.debug(f"更新电表数据: 会话 {session.session_id}, 功率 {session.current_power}kW, 电量 {session.energy_delivered}kWh")
        
        await self.notify_session_update(session)
    
    async def end_session(self, session_id: str, reason: str = "Local"):
        """结束充电会话"""
        session = self.sessions.get(session_id)
        if not session:
            logger.warning(f"未找到会话: {session_id}")
            return
        
        session.end_time = datetime.now(timezone.utc)
        session.status = SessionStatus.COMPLETED
        session.stop_reason = reason
        
        # 如果没有meter_stop，使用当前电量
        if session.meter_stop is None:
            session.meter_stop = session.meter_start + session.energy_delivered
        
        # 更新统计数据
        self.total_energy_delivered += session.energy_delivered
        
        logger.info(f"结束充电会话: {session_id}, 电量: {session.energy_delivered}kWh, 费用: {session.cost}元")
        
        await self.notify_session_update(session)
        
        return session
    
    async def end_session_by_transaction(
        self,
        transaction_id: int,
        meter_stop: float,
        end_time: str,
        reason: str = "Local"
    ) -> Optional[ChargingSession]:
        """根据交易ID结束会话"""
        session = await self.get_session_by_transaction(transaction_id)
        if not session:
            logger.warning(f"未找到交易 {transaction_id} 对应的会话")
            return None
        
        # 解析结束时间
        end_datetime = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
        
        session.end_time = end_datetime
        session.meter_stop = meter_stop
        session.status = SessionStatus.COMPLETED
        session.stop_reason = reason
        
        # 计算最终电量和费用
        session.energy_delivered = meter_stop - session.meter_start
        session.cost = session.energy_delivered * session.price_per_kwh
        
        # 更新统计数据
        self.total_energy_delivered += session.energy_delivered
        
        # 清理索引
        if transaction_id in self.transaction_sessions:
            del self.transaction_sessions[transaction_id]
        
        logger.info(f"结束充电会话: {session.session_id}, 交易: {transaction_id}, 电量: {session.energy_delivered}kWh")
        
        await self.notify_session_update(session)
        
        return session
    
    async def get_sessions(
        self,
        pile_id: Optional[str] = None,
        user_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[ChargingSession]:
        """获取会话列表"""
        sessions = list(self.sessions.values())
        
        # 过滤条件
        if pile_id:
            sessions = [s for s in sessions if s.pile_id == pile_id]
        
        if user_id:
            sessions = [s for s in sessions if s.user_id == user_id]
        
        if status:
            sessions = [s for s in sessions if s.status.value == status]
        
        # 排序（按开始时间倒序）
        sessions.sort(key=lambda x: x.start_time, reverse=True)
        
        # 分页
        return sessions[offset:offset + limit]
    
    async def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """获取会话实时状态"""
        session = self.sessions.get(session_id)
        if not session:
            return {}
        
        # 计算持续时间
        duration = 0
        if session.start_time:
            end_time = session.end_time or datetime.now(timezone.utc)
            duration = int((end_time - session.start_time).total_seconds())
        
        return {
            "session_id": session_id,
            "status": session.status.value,
            "current_power": session.current_power,
            "energy_delivered": session.energy_delivered,
            "duration": duration,
            "cost": session.cost,
            "voltage": session.voltage,
            "current": session.current,
            "temperature": session.temperature
        }
    
    async def get_active_session_count(self) -> int:
        """获取活跃会话数量"""
        active_statuses = [SessionStatus.PREPARING, SessionStatus.CHARGING, SessionStatus.SUSPENDED_EV, SessionStatus.SUSPENDED_EVSE]
        return len([s for s in self.sessions.values() if s.status in active_statuses])
    
    async def get_total_energy_delivered(self) -> float:
        """获取总充电量"""
        return self.total_energy_delivered
    
    # WebSocket订阅管理
    
    async def subscribe_pile_status(self, client_id: str, pile_id: str, websocket):
        """订阅充电桩状态更新"""
        self.client_subscriptions[client_id] = {
            "pile_id": pile_id,
            "websocket": websocket
        }
        logger.info(f"客户端 {client_id} 订阅充电桩 {pile_id} 状态更新")
    
    async def unsubscribe_client(self, client_id: str):
        """取消客户端订阅"""
        if client_id in self.client_subscriptions:
            del self.client_subscriptions[client_id]
            logger.info(f"客户端 {client_id} 取消订阅")
    
    async def notify_session_update(self, session: ChargingSession):
        """通知会话更新"""
        # 通知订阅了该充电桩的客户端
        for client_id, subscription in self.client_subscriptions.items():
            if subscription["pile_id"] == session.pile_id:
                try:
                    websocket = subscription["websocket"]
                    message = {
                        "type": "session_update",
                        "data": session.to_dict()
                    }
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"发送会话更新通知失败: {e}")
                    # 清理无效连接
                    await self.unsubscribe_client(client_id)
    
    def generate_session_id(self) -> str:
        """生成会话ID"""
        import uuid
        return f"session_{uuid.uuid4().hex[:8]}"

# 全局会话管理器实例
session_manager = ChargingSessionManager()