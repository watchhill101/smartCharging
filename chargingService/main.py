"""
OCPP充电服务主入口
实现OCPP 1.6J协议的充电桩通信服务
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ocpp_service import OCPPService
from charging_session import ChargingSessionManager
from pile_manager import ChargingPileManager
from models import ChargingPile, ChargingSession, OCPPMessage
from config import settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('charging_service.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="智能充电OCPP服务",
    description="基于OCPP 1.6J协议的充电桩通信服务",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局服务实例
ocpp_service = OCPPService()
session_manager = ChargingSessionManager()
pile_manager = ChargingPileManager()

# WebSocket连接管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.pile_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, pile_id: str):
        await websocket.accept()
        self.active_connections[pile_id] = websocket
        self.pile_connections[pile_id] = websocket
        logger.info(f"充电桩 {pile_id} 已连接")
    
    def disconnect(self, pile_id: str):
        if pile_id in self.active_connections:
            del self.active_connections[pile_id]
        if pile_id in self.pile_connections:
            del self.pile_connections[pile_id]
        logger.info(f"充电桩 {pile_id} 已断开连接")
    
    async def send_message(self, pile_id: str, message: dict):
        if pile_id in self.active_connections:
            websocket = self.active_connections[pile_id]
            await websocket.send_json(message)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            await connection.send_json(message)

manager = ConnectionManager()

# API模型
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

# WebSocket端点 - 充电桩连接
@app.websocket("/ws/pile/{pile_id}")
async def websocket_endpoint(websocket: WebSocket, pile_id: str):
    """充电桩WebSocket连接端点"""
    try:
        await manager.connect(websocket, pile_id)
        
        # 注册充电桩
        await pile_manager.register_pile(pile_id, websocket)
        
        # 发送BootNotification
        boot_notification = await ocpp_service.handle_boot_notification(pile_id)
        await websocket.send_json(boot_notification)
        
        while True:
            # 接收充电桩消息
            data = await websocket.receive_json()
            logger.info(f"收到充电桩 {pile_id} 消息: {data}")
            
            # 处理OCPP消息
            response = await ocpp_service.handle_message(pile_id, data)
            if response:
                await websocket.send_json(response)
                
    except WebSocketDisconnect:
        manager.disconnect(pile_id)
        await pile_manager.unregister_pile(pile_id)
        logger.info(f"充电桩 {pile_id} 断开连接")
    except Exception as e:
        logger.error(f"WebSocket连接错误: {e}")
        manager.disconnect(pile_id)
        await pile_manager.unregister_pile(pile_id)

# WebSocket端点 - 客户端连接
@app.websocket("/ws/client/{client_id}")
async def client_websocket_endpoint(websocket: WebSocket, client_id: str):
    """客户端WebSocket连接端点"""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            logger.info(f"收到客户端 {client_id} 消息: {data}")
            
            # 处理客户端消息
            if data.get("type") == "subscribe_pile":
                pile_id = data.get("pile_id")
                # 订阅充电桩状态更新
                await session_manager.subscribe_pile_status(client_id, pile_id, websocket)
                
    except WebSocketDisconnect:
        logger.info(f"客户端 {client_id} 断开连接")
    except Exception as e:
        logger.error(f"客户端WebSocket连接错误: {e}")

# REST API端点

@app.get("/")
async def root():
    """健康检查端点"""
    return {
        "service": "OCPP充电服务",
        "version": "1.0.0",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/piles")
async def get_piles():
    """获取所有充电桩列表"""
    piles = await pile_manager.get_all_piles()
    return {
        "success": True,
        "data": piles,
        "total": len(piles)
    }

@app.get("/piles/{pile_id}")
async def get_pile_info(pile_id: str):
    """获取指定充电桩信息"""
    pile = await pile_manager.get_pile(pile_id)
    if not pile:
        raise HTTPException(status_code=404, detail="充电桩不存在")
    
    return {
        "success": True,
        "data": pile
    }

@app.get("/piles/{pile_id}/status")
async def get_pile_status(pile_id: str):
    """获取充电桩状态"""
    status = await pile_manager.get_pile_status(pile_id)
    if not status:
        raise HTTPException(status_code=404, detail="充电桩不存在")
    
    return {
        "success": True,
        "data": status
    }

@app.post("/charging/start")
async def start_charging(request: StartChargingRequest):
    """开始充电"""
    try:
        # 检查充电桩是否可用
        pile = await pile_manager.get_pile(request.pile_id)
        if not pile:
            raise HTTPException(status_code=404, detail="充电桩不存在")
        
        if pile.status != "Available":
            raise HTTPException(status_code=400, detail="充电桩当前不可用")
        
        # 发送RemoteStartTransaction
        result = await ocpp_service.remote_start_transaction(
            request.pile_id,
            request.id_tag,
            request.connector_id
        )
        
        if result.get("status") == "Accepted":
            # 创建充电会话
            session = await session_manager.create_session(
                pile_id=request.pile_id,
                user_id=request.user_id,
                connector_id=request.connector_id,
                id_tag=request.id_tag
            )
            
            return {
                "success": True,
                "data": {
                    "session_id": session.session_id,
                    "pile_id": request.pile_id,
                    "status": "Starting"
                },
                "message": "充电启动成功"
            }
        else:
            raise HTTPException(status_code=400, detail="充电启动失败")
            
    except Exception as e:
        logger.error(f"启动充电失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/charging/stop")
async def stop_charging(request: StopChargingRequest):
    """停止充电"""
    try:
        # 获取充电会话
        session = await session_manager.get_session(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="充电会话不存在")
        
        # 发送RemoteStopTransaction
        result = await ocpp_service.remote_stop_transaction(
            request.pile_id,
            session.transaction_id
        )
        
        if result.get("status") == "Accepted":
            # 结束充电会话
            await session_manager.end_session(request.session_id, request.reason)
            
            return {
                "success": True,
                "data": {
                    "session_id": request.session_id,
                    "pile_id": request.pile_id,
                    "status": "Stopping"
                },
                "message": "充电停止成功"
            }
        else:
            raise HTTPException(status_code=400, detail="充电停止失败")
            
    except Exception as e:
        logger.error(f"停止充电失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/charging/sessions")
async def get_charging_sessions(
    pile_id: Optional[str] = None,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """获取充电会话列表"""
    sessions = await session_manager.get_sessions(
        pile_id=pile_id,
        user_id=user_id,
        status=status,
        limit=limit,
        offset=offset
    )
    
    return {
        "success": True,
        "data": sessions,
        "total": len(sessions)
    }

@app.get("/charging/sessions/{session_id}")
async def get_charging_session(session_id: str):
    """获取指定充电会话详情"""
    session = await session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="充电会话不存在")
    
    return {
        "success": True,
        "data": session
    }

@app.get("/charging/sessions/{session_id}/status")
async def get_charging_session_status(session_id: str) -> ChargingStatusResponse:
    """获取充电会话实时状态"""
    session = await session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="充电会话不存在")
    
    # 获取实时状态
    status = await session_manager.get_session_status(session_id)
    
    return ChargingStatusResponse(
        pile_id=session.pile_id,
        status=session.status,
        session_id=session_id,
        current_power=status.get("current_power"),
        energy_delivered=status.get("energy_delivered"),
        duration=status.get("duration"),
        cost=status.get("cost")
    )

@app.post("/piles/{pile_id}/reset")
async def reset_pile(pile_id: str, reset_type: str = "Soft"):
    """重置充电桩"""
    try:
        result = await ocpp_service.reset_pile(pile_id, reset_type)
        
        return {
            "success": True,
            "data": result,
            "message": f"充电桩重置命令已发送"
        }
        
    except Exception as e:
        logger.error(f"重置充电桩失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/piles/{pile_id}/unlock")
async def unlock_connector(pile_id: str, connector_id: int = 1):
    """解锁充电枪"""
    try:
        result = await ocpp_service.unlock_connector(pile_id, connector_id)
        
        return {
            "success": True,
            "data": result,
            "message": "充电枪解锁命令已发送"
        }
        
    except Exception as e:
        logger.error(f"解锁充电枪失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/statistics")
async def get_statistics():
    """获取服务统计信息"""
    stats = {
        "connected_piles": len(manager.active_connections),
        "active_sessions": await session_manager.get_active_session_count(),
        "total_energy_delivered": await session_manager.get_total_energy_delivered(),
        "uptime": datetime.now().isoformat()
    }
    
    return {
        "success": True,
        "data": stats
    }

# 启动事件
@app.on_event("startup")
async def startup_event():
    """服务启动事件"""
    logger.info("OCPP充电服务启动中...")
    
    # 初始化服务
    await ocpp_service.initialize()
    await session_manager.initialize()
    await pile_manager.initialize()
    
    logger.info("OCPP充电服务启动完成")

# 关闭事件
@app.on_event("shutdown")
async def shutdown_event():
    """服务关闭事件"""
    logger.info("OCPP充电服务关闭中...")
    
    # 清理资源
    await ocpp_service.cleanup()
    await session_manager.cleanup()
    await pile_manager.cleanup()
    
    logger.info("OCPP充电服务已关闭")

if __name__ == "__main__":
    # 运行服务
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )